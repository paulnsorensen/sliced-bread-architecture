"""Load and validate slices.toml, and map files to slice-map nodes."""

from __future__ import annotations

import re
import tomllib
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath

SLICES_FILE = 'slices.toml'
BASELINE_FILE = 'sbguard-baseline.json'
GENERATED_CONFIG = '.dependency-cruiser.sbguard.cjs'
SOURCE_EXTENSIONS = ('.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs')
SHAPES = {'thin-facade', 'framework-bound', 'service'}
SUPPRESSIBLE_RULES = {'SB-01', 'SB-02', 'SB-03', 'SB-04', 'SB-05', 'SB-06'}

_TOP_KEYS = {'version', 'policy', 'slice', 'spine', 'suppress'}
_POLICY_KEYS = {'language', 'unmapped_files', 'suppressions', 'test_patterns', 'ignore', 'tsconfig'}
_SLICE_KEYS = {'name', 'paths', 'crust', 'shape', 'may_depend_on', 'requires'}
_SPINE_KEYS = {'name', 'paths', 'may_depend_on'}
_SUPPRESS_KEYS = {'rule', 'from', 'to', 'reason'}
_REGEX_SPECIALS = set('.^$*+?()[]{}|\\')


class ConfigError(Exception):
    """slices.toml is missing, malformed, or inconsistent."""


@dataclass(frozen=True)
class Node:
    name: str
    kind: str  # 'slice' or 'spine'
    paths: tuple[str, ...]
    may_depend_on: tuple[str, ...]
    crust: tuple[str, ...] = ()
    shape: str = ''
    requires: tuple[str, ...] = ()


@dataclass(frozen=True)
class Suppression:
    rule: str
    source: str
    target: str
    reason: str

    @property
    def identity(self) -> tuple[str, str, str]:
        return (self.rule, self.source, self.target)


@dataclass
class SliceMap:
    nodes: list[Node]
    test_patterns: tuple[str, ...]
    ignore: tuple[str, ...]
    tsconfig: str | None
    suppressions: list[Suppression] = field(default_factory=list)

    def node(self, name: str) -> Node:
        return next(n for n in self.nodes if n.name == name)

    @property
    def slices(self) -> list[Node]:
        return [n for n in self.nodes if n.kind == 'slice']

    def owners(self, file: str) -> list[Node]:
        return [n for n in self.nodes if any(_under(file, p) for p in n.paths)]

    def is_test(self, file: str) -> bool:
        # The same regex goes into the generated checker config, so both engines agree.
        return re.match(glob_regex(self.test_patterns), file) is not None

    def is_ignored(self, file: str) -> bool:
        if file == GENERATED_CONFIG:
            return True
        return bool(self.ignore) and re.match(glob_regex(self.ignore), file) is not None


def _under(file: str, prefix: str) -> bool:
    return file == prefix or file.startswith(prefix + '/')


def js_escape(text: str) -> str:
    """Escape text for a regex that both Python `re` and JavaScript accept."""
    return ''.join('\\' + c if c in _REGEX_SPECIALS else c for c in text)


def prefix_regex(paths: tuple[str, ...]) -> str:
    return '^(?:' + '|'.join(js_escape(p) for p in paths) + ')(?:/|$)'


def exact_regex(paths: tuple[str, ...]) -> str:
    return '^(?:' + '|'.join(js_escape(p) for p in paths) + ')$'


def glob_regex(patterns: tuple[str, ...]) -> str:
    """Translate globs (`**`, `*`, `?`) into one anchored regex for both engines.

    dependency-cruiser rejects nested quantifiers (safe-regex), so `**/` becomes the
    alternation `(?:.*/|)` instead of `(?:.*/)?`.
    """
    parts = []
    for pattern in patterns:
        out, i = '', 0
        while i < len(pattern):
            if pattern.startswith('**/', i):
                out, i = out + '(?:.*/|)', i + 3
            elif pattern.startswith('**', i):
                out, i = out + '.*', i + 2
            elif pattern[i] == '*':
                out, i = out + '[^/]*', i + 1
            elif pattern[i] == '?':
                out, i = out + '[^/]', i + 1
            else:
                out, i = out + js_escape(pattern[i]), i + 1
        parts.append(out)
    return '^(?:' + '|'.join(parts) + ')$'


def _strings(value: object, where: str, *, allow_empty: bool = True) -> tuple[str, ...]:
    if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
        raise ConfigError(f'{where}: expected a list of strings')
    if not allow_empty and not value:
        raise ConfigError(f'{where}: expected at least one entry')
    if len(set(value)) != len(value):
        raise ConfigError(f'{where}: duplicate entries')
    return tuple(value)


def _repo_path(path: str, where: str) -> str:
    pure = PurePosixPath(path)
    if not path or pure.is_absolute() or '..' in pure.parts or str(pure) != path or '\\' in path:
        raise ConfigError(f'{where}: {path!r} must be a normalized repository-relative path')
    if any(c in path for c in '*?[]'):
        raise ConfigError(f'{where}: {path!r} must be a literal path, not a glob')
    return path


def _check_keys(table: object, allowed: set[str], required: set[str], where: str) -> dict:
    if not isinstance(table, dict):
        raise ConfigError(f'{where}: expected a table')
    unknown = set(table) - allowed
    if unknown:
        raise ConfigError(f'{where}: unknown field(s) {", ".join(sorted(unknown))}')
    missing = required - set(table)
    if missing:
        raise ConfigError(f'{where}: missing field(s) {", ".join(sorted(missing))}')
    return table


def load(root: Path) -> SliceMap:
    path = root / SLICES_FILE
    try:
        data = tomllib.loads(path.read_text(encoding='utf8'))
    except FileNotFoundError:
        raise ConfigError(f'{SLICES_FILE}: not found in {root}') from None
    except tomllib.TOMLDecodeError as error:
        raise ConfigError(f'{SLICES_FILE}: invalid TOML ({error})') from None
    return parse(data)


def parse(data: dict) -> SliceMap:
    _check_keys(data, _TOP_KEYS, {'version', 'policy', 'slice'}, SLICES_FILE)
    if data['version'] != 1:
        raise ConfigError(f'{SLICES_FILE}: version must be 1')
    policy = _check_keys(
        data['policy'],
        _POLICY_KEYS,
        {'language', 'unmapped_files', 'suppressions', 'test_patterns'},
        '[policy]',
    )
    if policy['language'] != 'typescript':
        raise ConfigError('[policy] language: only "typescript" has a backend in this version')
    if policy['unmapped_files'] != 'error':
        raise ConfigError('[policy] unmapped_files: only "error" is supported')
    if policy['suppressions'] != 'human-only':
        raise ConfigError('[policy] suppressions: only "human-only" is supported')
    tsconfig = policy.get('tsconfig')
    if tsconfig is not None:
        _repo_path(tsconfig, '[policy] tsconfig')

    nodes: list[Node] = []
    for index, raw in enumerate(data['slice']):
        where = f'[[slice]] #{index + 1}'
        _check_keys(raw, _SLICE_KEYS, _SLICE_KEYS, where)
        if raw['shape'] not in SHAPES:
            raise ConfigError(f'{where}: shape must be one of {", ".join(sorted(SHAPES))}')
        paths = tuple(_repo_path(p, f'{where} paths') for p in _strings(raw['paths'], where, allow_empty=False))
        crust = tuple(_repo_path(p, f'{where} crust') for p in _strings(raw['crust'], where, allow_empty=False))
        for file in crust:
            if not any(_under(file, p) for p in paths):
                raise ConfigError(f'{where}: crust {file!r} is outside the slice paths')
        nodes.append(
            Node(
                name=raw['name'],
                kind='slice',
                paths=paths,
                crust=crust,
                shape=raw['shape'],
                may_depend_on=_strings(raw['may_depend_on'], f'{where} may_depend_on'),
                requires=_strings(raw['requires'], f'{where} requires'),
            )
        )
    for index, raw in enumerate(data.get('spine', [])):
        where = f'[[spine]] #{index + 1}'
        _check_keys(raw, _SPINE_KEYS, _SPINE_KEYS, where)
        paths = tuple(_repo_path(p, f'{where} paths') for p in _strings(raw['paths'], where, allow_empty=False))
        nodes.append(
            Node(
                name=raw['name'],
                kind='spine',
                paths=paths,
                may_depend_on=_strings(raw['may_depend_on'], f'{where} may_depend_on'),
            )
        )

    names = [n.name for n in nodes]
    if len(set(names)) != len(names):
        raise ConfigError(f'{SLICES_FILE}: node names must be unique across slices and spine')
    for node in nodes:
        for target in node.may_depend_on + node.requires:
            if target not in names or target == node.name:
                raise ConfigError(f'{node.name}: unknown or self dependency {target!r}')
        for target in node.requires:
            if target not in node.may_depend_on:
                raise ConfigError(f'{node.name}: requires {target!r} but may_depend_on omits it')
    for a in nodes:
        for b in nodes:
            if a is not b and any(_under(p, q) for p in a.paths for q in b.paths):
                raise ConfigError(f'{a.name} and {b.name}: node paths overlap')

    suppressions = []
    for index, raw in enumerate(data.get('suppress', [])):
        where = f'[[suppress]] #{index + 1}'
        _check_keys(raw, _SUPPRESS_KEYS, _SUPPRESS_KEYS, where)
        if raw['rule'] not in SUPPRESSIBLE_RULES:
            raise ConfigError(f'{where}: rule {raw["rule"]!r} cannot be suppressed')
        if not str(raw['reason']).strip():
            raise ConfigError(f'{where}: reason must not be empty')
        suppressions.append(Suppression(raw['rule'], raw['from'], raw['to'], raw['reason']))

    return SliceMap(
        nodes=nodes,
        test_patterns=_strings(policy['test_patterns'], '[policy] test_patterns', allow_empty=False),
        ignore=_strings(policy.get('ignore', []), '[policy] ignore'),
        tsconfig=tsconfig,
        suppressions=suppressions,
    )


def dump(data: dict) -> str:
    """Serialize a parsed slices.toml dict (strings, ints, string lists, table arrays)."""

    def value(v: object) -> str:
        if isinstance(v, list):
            return '[' + ', '.join(value(x) for x in v) + ']'
        if isinstance(v, int):
            return str(v)
        return '"' + str(v).replace('\\', '\\\\').replace('"', '\\"') + '"'

    lines = [f'version = {data["version"]}', '', '[policy]']
    lines += [f'{k} = {value(v)}' for k, v in data['policy'].items()]
    for table in ('slice', 'spine', 'suppress'):
        for entry in data.get(table, []):
            lines += ['', f'[[{table}]]'] + [f'{k} = {value(v)}' for k, v in entry.items()]
    return '\n'.join(lines) + '\n'
