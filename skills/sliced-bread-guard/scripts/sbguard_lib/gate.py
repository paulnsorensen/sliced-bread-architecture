"""The identity-set gate: wrapper rules, baseline history, and the pass/fail decision."""

from __future__ import annotations

import hashlib
import json
import os
import re
import tomllib
from dataclasses import dataclass, field
from pathlib import Path

from . import depcruise, repo
from .model import (
    BASELINE_FILE,
    GENERATED_CONFIG,
    SLICES_FILE,
    SOURCE_EXTENSIONS,
    ConfigError,
    SliceMap,
    parse,
)

Identity = tuple[str, str, str]

RULE_TITLES = {
    'SB-00': 'unresolvable-import',
    'SB-01': 'crust-only',
    'SB-02': 'allowed-edges',
    'SB-03': 'no-slice-cycles',
    'SB-04': 'file-mapping',
    'SB-05': 'test-boundary',
    'SB-06': 'required-edge-missing',
    'SB-07': 'suppression-or-baseline-growth',
}
# Directives that would silence an architecture checker from inside a source file.
# Supported grammar: any comment holding one of these markers. See references/rule-blueprints.md.
SUPPRESSION_MARKER = re.compile(
    r'sb-?guard-(?:ignore|disable)[\w-]*'
    r'|dependency-cruiser-ignore|depcruise-ignore'
    r'|eslint-disable(?:-next-line|-line)?'
)
_ARCHITECTURE_LINT_RULE = re.compile(r'(?:^|[\s,])(?:import|import-x|boundaries)/')
_COMMENT = re.compile(r'/\*[\s\S]*?\*/|//[^\n]*')
_HISTORY_PREFIX = 'baseline:'


@dataclass
class Result:
    exit_code: int
    lines: list[str] = field(default_factory=list)


def describe(identity: Identity) -> str:
    rule, source, target = identity
    return f'{rule} {RULE_TITLES.get(rule, "?")}: {source} -> {target}'


def load_baseline(text: str, where: str) -> set[Identity]:
    try:
        data = json.loads(text)
        entries = data['violations']
        if data.get('version') != 1 or not isinstance(entries, list):
            raise ValueError
        result = set()
        for entry in entries:
            if not (isinstance(entry, list) and len(entry) == 3 and all(isinstance(x, str) for x in entry)):
                raise ValueError
            result.add(tuple(entry))
        return result
    except (ValueError, KeyError, TypeError):
        raise ConfigError(f'{where}: malformed baseline (expected version 1 and [rule, from, to] triples)') from None


def dump_baseline(identities: set[Identity]) -> str:
    rows = sorted(list(i) for i in identities)
    body = ',\n'.join('    ' + json.dumps(row) for row in rows)
    return '{\n  "version": 1,\n  "violations": [' + ('\n' + body + '\n  ' if rows else '') + ']\n}\n'


def inventory(model: SliceMap, files: list[str]) -> list[str]:
    return [f for f in files if f.endswith(SOURCE_EXTENSIONS) and not model.is_ignored(f)]


def _mapping(root: Path, model: SliceMap, files: list[str]) -> tuple[dict[str, str], set[Identity]]:
    owner: dict[str, str] = {}
    found: set[Identity] = set()
    for file in files:
        if os.path.islink(root / file):
            found.add(('SB-04', file, 'symlink'))
            continue
        nodes = model.owners(file)
        if not nodes:
            found.add(('SB-04', file, 'unmapped'))
        elif len(nodes) > 1:
            found.add(('SB-04', file, 'ambiguous'))
        else:
            owner[file] = nodes[0].name
    return owner, found


def _strong_components(graph: dict[str, set[str]]) -> list[set[str]]:
    index: dict[str, int] = {}
    low: dict[str, int] = {}
    stack: list[str] = []
    on_stack: set[str] = set()
    out: list[set[str]] = []

    def visit(node: str) -> None:
        index[node] = low[node] = len(index)
        stack.append(node)
        on_stack.add(node)
        for nxt in sorted(graph.get(node, ())):
            if nxt not in index:
                visit(nxt)
                low[node] = min(low[node], low[nxt])
            elif nxt in on_stack:
                low[node] = min(low[node], index[nxt])
        if low[node] == index[node]:
            component = set()
            while True:
                top = stack.pop()
                on_stack.discard(top)
                component.add(top)
                if top == node:
                    break
            out.append(component)

    for node in sorted(graph):
        if node not in index:
            visit(node)
    return out


def _production(model: SliceMap, owner: dict[str, str], graph: depcruise.Graph) -> list[tuple[str, str, str, str]]:
    """Cross-node edges from production code: (from, to, from_node, to_node).

    Production code is every non-test file plus every file it reaches, so a file named
    like a test cannot hide a production cycle or a production edge.
    """
    outgoing: dict[str, list[str]] = {}
    for edge in graph.edges:
        outgoing.setdefault(edge.source, []).append(edge.target)
    production = {f for f in owner if not model.is_test(f)}
    pending = list(production)
    while pending:
        for target in outgoing.get(pending.pop(), ()):
            if target in owner and target not in production:
                production.add(target)
                pending.append(target)
    return [
        (e.source, e.target, owner[e.source], owner[e.target])
        for e in graph.edges
        if e.source in production and e.target in owner and owner[e.source] != owner[e.target]
    ]


def node_edges(root: Path, model: SliceMap, files: list[str]) -> set[tuple[str, str]]:
    owner, _ = _mapping(root, model, files)
    return {(a, b) for _, _, a, b in _production(model, owner, depcruise.extract(root, model, files))}


def _graph_rules(model: SliceMap, owner: dict[str, str], graph: depcruise.Graph) -> set[Identity]:
    """SB-03 and SB-06 over production edges."""
    production = _production(model, owner, graph)
    node_graph: dict[str, set[str]] = {}
    for _, _, a, b in production:
        node_graph.setdefault(a, set()).add(b)
    found: set[Identity] = set()
    for component in _strong_components(node_graph):
        if len(component) > 1:
            # Identity is each concrete file edge inside the cycle, so one edge cannot replace another.
            found |= {('SB-03', s, t) for s, t, a, b in production if a in component and b in component}
    present = {(a, b) for _, _, a, b in production}
    for node in model.slices:
        for target in node.requires:
            if (node.name, target) not in present:
                found.add(('SB-06', node.name, target))
    return found


def _directive(comment: str) -> str | None:
    """Return the first suppression directive in one comment, or None.

    Every marker in the comment is examined, so an unrelated ESLint directive cannot hide
    a later guard marker. ESLint directives count when they are blanket (no rule list) or
    name an import or boundaries rule; a directive for rules such as `no-console` does not.
    """
    for match in SUPPRESSION_MARKER.finditer(comment):
        if match.group(0).startswith('eslint-disable'):
            rules = comment[match.end():].split('--', 1)[0].strip(' \t\r\n*/')
            if rules and not _ARCHITECTURE_LINT_RULE.search(rules):
                continue
        return match.group(0)
    return None


def _inline_suppressions(root: Path, files: list[str]) -> set[Identity]:
    """Identity = directive + hash(comment, its line, next code line) + occurrence number.

    The context hash changes when a directive moves to another import; the occurrence
    number makes a copied directive a new identity. Line numbers stay out of it.
    """
    found: set[Identity] = set()
    for file in files:
        try:
            text = (root / file).read_text(encoding='utf8')
        except (OSError, UnicodeDecodeError):
            continue
        lines = text.splitlines()
        seen: dict[tuple[str, str], int] = {}
        for comment in _COMMENT.finditer(text):
            directive = _directive(comment.group(0))
            if directive is None:
                continue
            end = text.count('\n', 0, comment.end())
            following = next((l for l in lines[end + 1:] if l.strip()), '')
            context = '\n'.join(' '.join(part.split()) for part in (comment.group(0), lines[end] if end < len(lines) else '', following))
            digest = hashlib.sha1(context.encode()).hexdigest()[:12]
            seen[(directive, digest)] = seen.get((directive, digest), 0) + 1
            found.add(('SB-07', file, f'inline:{directive}:{digest}:{seen[(directive, digest)]}'))
    return found


def _history(git_root: Path, base: str, head: set[Identity] | None) -> tuple[set[Identity] | None, set[Identity], list[str]]:
    """Return (base baseline or None at adoption, SB-07 history findings, notes)."""
    commit = repo.resolve(git_root, base)
    base_text = repo.read_at(git_root, commit, BASELINE_FILE)
    if base_text is not None:
        base_set = load_baseline(base_text, f'{base}:{BASELINE_FILE}')
    elif repo.read_at(git_root, commit, SLICES_FILE) is not None:
        base_set = set()  # guard adopted without a baseline: nothing may be added later
    else:
        return None, set(), [f'adoption: {base} has no {SLICES_FILE}; the baseline is the initial snapshot and needs CODEOWNERS review']
    found: set[Identity] = set()
    if head is None and base_text is not None:
        found.add(('SB-07', BASELINE_FILE, f'{_HISTORY_PREFIX}deleted'))
    for identity in sorted((head or set()) - base_set):
        found.add(('SB-07', BASELINE_FILE, f'{_HISTORY_PREFIX}grew:' + '|'.join(identity)))
    return base_set, found, []


def _never_waived(identity: Identity) -> bool:
    return identity[0] == 'SB-00' or identity[2].startswith(_HISTORY_PREFIX)


def collect(root: Path, model: SliceMap, files: list[str]) -> set[Identity]:
    """Every current violation identity for the snapshot at `root`."""
    owner, found = _mapping(root, model, files)
    graph = depcruise.extract(root, model, files)
    found |= graph.violations
    found |= _graph_rules(model, owner, graph)
    found |= _inline_suppressions(root, files)
    return found


def drift(root: Path, model: SliceMap) -> bool:
    path = root / GENERATED_CONFIG
    return not path.exists() or path.read_text(encoding='utf8') != depcruise.render(model)


def _policy_notes(git_root: Path, commit: str, model: SliceMap, files: list[str]) -> list[str]:
    """Informational: show how a slices.toml change redefines success. Human review decides."""
    text = repo.read_at(git_root, commit, SLICES_FILE)
    if text is None:
        return []
    try:
        old = parse(tomllib.loads(text))
    except (ConfigError, tomllib.TOMLDecodeError):
        return [f'POLICY base {SLICES_FILE} is invalid; review the whole new map']
    notes: list[str] = []
    sources = [f for f in files if f.endswith(SOURCE_EXTENSIONS)]
    notes += [f'POLICY newly ignored: {f}' for f in sources if model.is_ignored(f) and not old.is_ignored(f)]
    notes += [f'POLICY newly classified as test: {f}' for f in sources if model.is_test(f) and not old.is_test(f)]
    before = {n.name: n for n in old.nodes}
    for node in model.nodes:
        prior = before.pop(node.name, None)
        if prior is None:
            notes.append(f'POLICY new node: {node.name}')
            continue
        for label, now, then in (
            ('paths', node.paths, prior.paths),
            ('crust', node.crust, prior.crust),
            ('may_depend_on', node.may_depend_on, prior.may_depend_on),
            ('requires', node.requires, prior.requires),
        ):
            added, removed = sorted(set(now) - set(then)), sorted(set(then) - set(now))
            if added or removed:
                notes.append(f'POLICY {node.name} {label}: +{added} -{removed}')
    notes += [f'POLICY removed node: {name}' for name in before]
    old_suppress = {s.identity for s in old.suppressions}
    notes += [f'POLICY new suppression: {describe(s.identity)} ({s.reason})' for s in model.suppressions if s.identity not in old_suppress]
    if notes:
        notes.append(f'POLICY {SLICES_FILE} changed against the base; it needs code-owner review')
    return notes


def check(root: Path, git_root: Path, model: SliceMap, files: list[str], base: str, strict: bool) -> Result:
    result = Result(0)
    if drift(root, model):
        result.lines.append(f'DRIFT {GENERATED_CONFIG}: differs from the config generated from {SLICES_FILE} (run generate)')
        result.exit_code = 1
    current = collect(root, model, inventory(model, files))
    baseline_path = root / BASELINE_FILE
    head = load_baseline(baseline_path.read_text(encoding='utf8'), BASELINE_FILE) if baseline_path.exists() else None
    _, history, notes = _history(git_root, base, head)
    notes += _policy_notes(git_root, repo.resolve(git_root, base), model, files)
    current |= history
    waived = (head or set()) | {s.identity for s in model.suppressions}
    new = sorted(i for i in current if _never_waived(i) or i not in waived)
    stale = sorted(((head or set()) | {s.identity for s in model.suppressions}) - current)
    result.lines += notes
    result.lines += [describe(i) for i in new]
    result.lines += [f'STALE {describe(i)} (no longer occurs; run baseline --shrink or drop the suppression)' for i in stale]
    if new or (strict and stale):
        result.exit_code = 1
    known = len(current) - len(new)
    verdict = 'FAIL' if result.exit_code else 'PASS'
    result.lines.append(f'{verdict}: {len(new)} new, {known} baselined or suppressed, {len(stale)} stale')
    return result
