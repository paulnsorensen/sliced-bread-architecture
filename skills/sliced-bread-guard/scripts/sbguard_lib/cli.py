"""Command line for sliced-bread-guard. Exit codes: 0 pass, 1 rule failure or drift, 2 setup error."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from . import depcruise, gate, prove, repo, wire
from .model import BASELINE_FILE, GENERATED_CONFIG, ConfigError, load


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog='sbguard', description=__doc__)
    parser.add_argument('--root', type=Path, default=Path.cwd(), help='repository root (default: cwd)')
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('detect', help='report language, existing checkers, and hook managers as JSON')
    gen = sub.add_parser('generate', help=f'write {GENERATED_CONFIG} from slices.toml')
    gen.add_argument('--check', action='store_true', help='fail with DRIFT instead of writing')
    chk = sub.add_parser('check', help='run every rule and compare identity sets with the baseline')
    chk.add_argument('--base', required=True, help='trusted base ref for baseline history (PR base, push before, or HEAD)')
    chk.add_argument('--staged', action='store_true', help='check the index instead of the working tree')
    chk.add_argument('--strict', action='store_true', help='also fail on stale baseline entries (CI)')
    base = sub.add_parser('baseline', help='initialize or shrink the baseline; never grows it')
    mode = base.add_mutually_exclusive_group(required=True)
    mode.add_argument('--init', action='store_true', help='snapshot current violations at adoption')
    mode.add_argument('--shrink', action='store_true', help='drop entries that no longer occur')
    sub.add_parser('prove', help='plant one violation per rule in a temporary worktree of HEAD')
    wir = sub.add_parser('wire', help='vendor the CLI, add the CI job and the pre-commit hook')
    wir.add_argument('--activate', action='store_true', help='set core.hooksPath to .githooks')
    return parser


def _emit(code: int, lines: list[str]) -> int:
    for line in lines:
        print(line)
    return code


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    root = args.root.resolve()
    try:
        if args.command == 'detect':
            print(json.dumps(wire.detect(root), indent=2))
            return 0
        if args.command == 'wire':
            return _emit(*wire.wire(root, args.activate))
        if args.command == 'prove':
            result = prove.prove(root)
            return _emit(result.exit_code, result.lines)
        model = load(root)
        if args.command == 'generate':
            if args.check:
                drifted = gate.drift(root, model)
                return _emit(1 if drifted else 0, [f'DRIFT {GENERATED_CONFIG}' if drifted else 'no drift'])
            (root / GENERATED_CONFIG).write_text(depcruise.render(model), encoding='utf8')
            return _emit(0, [f'wrote {GENERATED_CONFIG}'])
        if args.command == 'check':
            if args.staged:
                files = repo.tracked_files(root, staged=True)
                with repo.staged_snapshot(root) as snapshot:
                    result = gate.check(snapshot, root, load(snapshot), files, args.base, args.strict)
            else:
                files = repo.tracked_files(root, staged=False)
                result = gate.check(root, root, model, files, args.base, args.strict)
            return _emit(result.exit_code, result.lines)
        if args.command == 'baseline':
            current = gate.collect(root, model, gate.inventory(model, repo.tracked_files(root, staged=False)))
            path = root / BASELINE_FILE
            if args.init:
                if path.exists():
                    return _emit(2, [f'{BASELINE_FILE} exists; the baseline is initialized once, at adoption'])
                blocked = sorted(i for i in current if i[0] == 'SB-00')
                if blocked:
                    return _emit(2, ['fix unresolvable imports before adoption:', *map(gate.describe, blocked)])
                waived = {s.identity for s in model.suppressions}
                path.write_text(gate.dump_baseline(current - waived), encoding='utf8')
                return _emit(0, [f'wrote {BASELINE_FILE} with {len(current - waived)} entries'])
            if not path.exists():
                return _emit(2, [f'{BASELINE_FILE} is missing'])
            head = gate.load_baseline(path.read_text(encoding='utf8'), BASELINE_FILE)
            path.write_text(gate.dump_baseline(head & current), encoding='utf8')
            return _emit(0, [f'shrank {BASELINE_FILE}: {len(head)} -> {len(head & current)} entries'])
    except (ConfigError, depcruise.CheckerError, repo.GitError) as error:
        return _emit(2, [f'error: {error}'])
    return 2


if __name__ == '__main__':
    sys.exit(main())
