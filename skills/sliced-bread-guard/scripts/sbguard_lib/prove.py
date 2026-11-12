"""Prove each rule: plant one violation per rule in a temporary worktree and expect the gate to fail."""

from __future__ import annotations

import json
import os
import tomllib
from dataclasses import dataclass
from pathlib import Path, PurePosixPath

from . import gate, repo
from .model import BASELINE_FILE, SLICES_FILE, Node, SliceMap, dump, load

PROBE = '__sbguard_probe__'


@dataclass
class Probe:
    rule: str
    summary: str
    files: dict[str, str]  # path -> full new content


def _spec(path: str) -> str:
    """Strip the extension so the import works for TypeScript and JavaScript resolvers."""
    return str(PurePosixPath(path).with_suffix(''))


def _import(from_file: str, to_file: str) -> str:
    rel = os.path.relpath(_spec(to_file), str(PurePosixPath(from_file).parent))
    rel = rel if rel.startswith('.') else './' + rel
    return f"import '{rel}'\n"


def _home(node: Node) -> str | None:
    """A directory inside the node where a probe file can live."""
    for path in node.paths:
        if not PurePosixPath(path).suffix:
            return path
    return None


def _target(node: Node, files: list[str], model: SliceMap, internal: bool) -> str | None:
    owned = [f for f in files if model.owners(f) == [node] and not model.is_test(f)]
    if internal:
        owned = [f for f in owned if f not in node.crust]
    elif node.kind == 'slice':
        owned = list(node.crust)
    return owned[0] if owned else None


def _test_name(model: SliceMap, home: str) -> str | None:
    for name in (f'{PROBE}.test.ts', f'{PROBE}.spec.ts', f'__tests__/{PROBE}.ts', f'{PROBE}_test.ts'):
        if model.is_test(f'{home}/{name}'):
            return f'{home}/{name}'
    return None


def probes(root: Path, model: SliceMap, files: list[str]) -> tuple[list[Probe], list[str]]:
    out: list[Probe] = []
    missing: list[str] = []
    homes = {n.name: _home(n) for n in model.nodes}
    slices = [n for n in model.slices if homes[n.name]]

    def first(pairs, rule):
        for pair in pairs:
            if pair:
                return pair
        missing.append(rule)
        return None

    # SB-01: production file in B imports an internal of slice A that B may depend on.
    pick = first(
        ((b, a, _target(a, files, model, True)) if homes[b.name] and a.name in b.may_depend_on and _target(a, files, model, True) else None
         for a in model.slices for b in model.nodes),
        'SB-01',
    )
    if pick:
        b, a, internal = pick
        path = f'{homes[b.name]}/{PROBE}.ts'
        out.append(Probe('SB-01', f'{b.name} imports {internal}', {path: _import(path, internal)}))
    # SB-02: B imports a node it may not depend on.
    pick = first(
        ((b, c, _target(c, files, model, False)) if homes[b.name] and c is not b and c.name not in b.may_depend_on and _target(c, files, model, False) else None
         for b in model.nodes for c in model.nodes),
        'SB-02',
    )
    if pick:
        b, c, target = pick
        path = f'{homes[b.name]}/{PROBE}.ts'
        out.append(Probe('SB-02', f'{b.name} imports {target}', {path: _import(path, target)}))
    # SB-03: two slices import each other's crust.
    if len(slices) >= 2:
        a, b = slices[0], slices[1]
        pa, pb = f'{homes[a.name]}/{PROBE}.ts', f'{homes[b.name]}/{PROBE}.ts'
        out.append(Probe('SB-03', f'{a.name} <-> {b.name}', {pa: _import(pa, b.crust[0]), pb: _import(pb, a.crust[0])}))
    else:
        missing.append('SB-03')
    # SB-04: a source file outside every node.
    path = f'{PROBE}_unmapped.ts'
    if model.owners(path) or model.is_ignored(path):
        missing.append('SB-04')
    else:
        out.append(Probe('SB-04', path, {path: 'export {}\n'}))
    # SB-05: a test in B imports an internal of another slice A.
    pick = first(
        ((b, _test_name(model, homes[b.name]), _target(a, files, model, True)) if homes[b.name] and a is not b and _test_name(model, homes[b.name]) and _target(a, files, model, True) else None
         for a in model.slices for b in model.nodes),
        'SB-05',
    )
    if pick:
        b, path, internal = pick
        out.append(Probe('SB-05', f'test in {b.name} imports {internal}', {path: _import(path, internal)}))
    # SB-06: declare a requires edge that the code does not have.
    data = tomllib.loads((root / SLICES_FILE).read_text(encoding='utf8'))
    present = gate.node_edges(root, model, gate.inventory(model, files))
    pick = None
    for entry in data['slice']:
        for target in entry['may_depend_on']:
            if target not in entry['requires'] and (entry['name'], target) not in present:
                trial = json.loads(json.dumps(data))
                next(s for s in trial['slice'] if s['name'] == entry['name'])['requires'].append(target)
                pick = pick or (entry['name'], target, trial)
    if pick:
        name, target, trial = pick
        out.append(Probe('SB-06', f'{name} requires {target}', {SLICES_FILE: dump(trial)}))
    else:
        missing.append('SB-06')
    # SB-07: an inline suppression marker, and baseline growth.
    if slices:
        path = f'{homes[slices[0].name]}/{PROBE}_suppressed.ts'
        out.append(Probe('SB-07', 'inline suppression', {path: '// sbguard-ignore\nexport {}\n'}))
    baseline = root / BASELINE_FILE
    grown = gate.load_baseline(baseline.read_text(encoding='utf8'), BASELINE_FILE) if baseline.exists() else set()
    grown.add(('SB-02', f'{PROBE}_from.ts', f'{PROBE}_to.ts'))
    out.append(Probe('SB-07', 'baseline growth', {BASELINE_FILE: gate.dump_baseline(grown)}))
    return out, missing


def _apply(root: Path, files: dict[str, str]) -> None:
    for path, content in files.items():
        target = root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding='utf8')


def _revert(root: Path) -> None:
    repo.git(root, 'checkout', '--', '.')
    repo.git(root, 'clean', '-fdq', '-e', 'node_modules')


def _run(tree: Path) -> gate.Result:
    model = load(tree)
    return gate.check(tree, tree, model, repo.tracked_files(tree, staged=False), 'HEAD', strict=False)


def prove(root: Path) -> gate.Result:
    result = gate.Result(0)
    changes = repo.dirty(root)
    if changes:
        result.lines.append('prove targets HEAD; commit or stash these changes first: ' + '; '.join(changes[:10]))
        result.exit_code = 2
        return result
    with repo.head_worktree(root) as tree:
        control = _run(tree)
        if control.exit_code != 0:
            result.lines += ['control run at HEAD must pass before proving rules:', *control.lines]
            result.exit_code = 1
            return result
        model = load(tree)
        planted, missing = probes(tree, model, repo.tracked_files(tree, staged=False))
        for probe in planted:
            _apply(tree, probe.files)
            try:
                run = _run(tree)
            except Exception as error:  # infrastructure errors never count as proof
                run = gate.Result(2, [f'error: {error}'])
            fired = run.exit_code == 1 and any(line.startswith(probe.rule + ' ') for line in run.lines)
            _revert(tree)
            restored = _run(tree).exit_code == 0
            status = 'PROVED' if fired and restored else 'NOT PROVED'
            result.lines.append(f'{status} {probe.rule} ({probe.summary}): mutation exit {run.exit_code}, restored {"pass" if restored else "FAIL"}')
            if status != 'PROVED':
                result.lines += ['  ' + line for line in run.lines]
                result.exit_code = 1
        for rule in missing:
            result.lines.append(f'NOT PROVED {rule}: the slice map offers no place to plant a probe')
            result.exit_code = 1
    return result
