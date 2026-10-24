"""Acceptance: real dependency-cruiser and real git against the ts-shop fixture.

Run: python3 -m unittest discover -s skills/sliced-bread-guard/tests -v
Needs network once for `npm ci` of the fixture lockfile (cached for the run).
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SKILL = Path(__file__).resolve().parents[1]
FIXTURE = SKILL / 'fixtures' / 'ts-shop'
CLI = SKILL / 'scripts' / 'sbguard.py'
GIT_ENV = {
    **os.environ,
    'GIT_AUTHOR_NAME': 'fixture',
    'GIT_AUTHOR_EMAIL': 'fixture@example.invalid',
    'GIT_COMMITTER_NAME': 'fixture',
    'GIT_COMMITTER_EMAIL': 'fixture@example.invalid',
    'GIT_CONFIG_GLOBAL': os.devnull,
    'GIT_CONFIG_NOSYSTEM': '1',
}

_scratch: Path


def setUpModule() -> None:
    global _scratch
    _scratch = Path(tempfile.mkdtemp(prefix='sbguard-acceptance-'))
    deps = _scratch / 'deps'
    deps.mkdir()
    for name in ('package.json', 'package-lock.json'):
        shutil.copy(FIXTURE / name, deps / name)
    subprocess.run(['npm', 'ci', '--ignore-scripts', '--no-audit', '--no-fund'], cwd=deps, check=True, capture_output=True)


def tearDownModule() -> None:
    shutil.rmtree(_scratch, ignore_errors=True)


def sh(repo: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(list(args), cwd=repo, env=GIT_ENV, capture_output=True, text=True, check=check)


def guard(repo: Path, *args: str) -> tuple[int, str]:
    run = sh(repo, sys.executable, str(CLI), *args, check=False)
    return run.returncode, run.stdout + run.stderr


def make_repo(name: str, before_adoption: dict[str, str] | None = None) -> Path:
    """Commit the fixture without the guard, then commit the adoption (map, config, baseline)."""
    repo = Path(tempfile.mkdtemp(prefix=f'{name}-', dir=_scratch)) / 'repo'
    shutil.copytree(FIXTURE, repo, ignore=shutil.ignore_patterns('slices.toml', 'gitignore'))
    shutil.copy(FIXTURE / 'gitignore', repo / '.gitignore')
    os.symlink(_scratch / 'deps' / 'node_modules', repo / 'node_modules')
    for path, content in (before_adoption or {}).items():
        (repo / path).write_text(content, encoding='utf8')
    sh(repo, 'git', 'init', '-q', '-b', 'main')
    sh(repo, 'git', 'add', '-A')
    sh(repo, 'git', 'commit', '-qm', 'before adoption')
    shutil.copy(FIXTURE / 'slices.toml', repo / 'slices.toml')
    for command in (('generate',), ('baseline', '--init')):
        code, out = guard(repo, *command)
        assert code == 0, out
    sh(repo, 'git', 'add', '-A')
    sh(repo, 'git', 'commit', '-qm', 'adopt sliced-bread-guard')
    return repo


def read(repo: Path, path: str) -> str:
    return (repo / path).read_text(encoding='utf8')


def write(repo: Path, path: str, content: str) -> None:
    (repo / path).parent.mkdir(parents=True, exist_ok=True)
    (repo / path).write_text(content, encoding='utf8')


def append(repo: Path, path: str, text: str) -> None:
    write(repo, path, read(repo, path) + text)


def revert(repo: Path) -> None:
    sh(repo, 'git', 'checkout', '--', '.')
    sh(repo, 'git', 'clean', '-fdq', '-e', 'node_modules')


ORDER = 'src/domains/orders/order.ts'
ORDER_TEST = 'src/domains/orders/order.test.ts'
ITEM = 'src/domains/catalog/item.ts'
DISCOUNT = 'src/domains/pricing/discount.ts'
BASELINE = 'sbguard-baseline.json'
CONFIG = '.dependency-cruiser.sbguard.cjs'


class RuleMutations(unittest.TestCase):
    """One shared adopted repo; each mutation must fail with its rule ID and clear on revert."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.repo = make_repo('rules')

    def tearDown(self) -> None:
        revert(self.repo)

    def assert_passes(self, *extra: str) -> str:
        code, out = guard(self.repo, 'check', '--base', 'HEAD', '--strict', *extra)
        self.assertEqual(code, 0, out)
        self.assertIn('PASS', out)
        return out

    def assert_rule(self, rule: str, expected_line: str) -> None:
        code, out = guard(self.repo, 'check', '--base', 'HEAD')
        self.assertEqual(code, 1, out)
        self.assertIn(expected_line, out)
        self.assertTrue(expected_line.startswith(rule + ' '))
        revert(self.repo)
        self.assert_passes()

    def test_clean_fixture_passes(self) -> None:
        out = self.assert_passes()
        self.assertIn('0 new, 1 baselined or suppressed, 0 stale', out)

    def test_adoption_change_passes_against_pre_adoption_base(self) -> None:
        code, out = guard(self.repo, 'check', '--base', 'HEAD~1', '--strict')
        self.assertEqual(code, 0, out)
        self.assertIn('adoption:', out)

    def test_sb01_crust_only(self) -> None:
        append(self.repo, ORDER, "import '../pricing/discount'\n")
        self.assert_rule('SB-01', f'SB-01 crust-only: {ORDER} -> {DISCOUNT}')

    def test_sb01_through_tsconfig_alias(self) -> None:
        append(self.repo, ORDER, "import '@shop/domains/pricing/discount'\n")
        self.assert_rule('SB-01', f'SB-01 crust-only: {ORDER} -> {DISCOUNT}')

    def test_sb01_type_only_import(self) -> None:
        append(self.repo, ORDER, "import type { discountFor as D } from '../pricing/discount'\nexport type T = typeof D\n")
        self.assert_rule('SB-01', f'SB-01 crust-only: {ORDER} -> {DISCOUNT}')

    def test_sb02_allowed_edges(self) -> None:
        append(self.repo, ITEM, "import '../orders'\n")
        self.assert_rule('SB-02', f'SB-02 allowed-edges: {ITEM} -> src/domains/orders/index.ts')

    def test_sb03_slice_cycle(self) -> None:
        append(self.repo, DISCOUNT, "import '../orders'\n")
        self.assert_rule('SB-03', f'SB-03 no-slice-cycles: {DISCOUNT} -> src/domains/orders/index.ts')

    def test_sb04_unmapped_file(self) -> None:
        write(self.repo, 'src/util.ts', 'export const util = 1\n')
        self.assert_rule('SB-04', 'SB-04 file-mapping: src/util.ts -> unmapped')

    def test_sb04_file_outside_source_root(self) -> None:
        write(self.repo, 'lib/escape.ts', "import '../src/domains/pricing/discount'\n")
        self.assert_rule('SB-04', 'SB-04 file-mapping: lib/escape.ts -> unmapped')

    def test_sb05_test_reaches_other_slice_internal(self) -> None:
        append(self.repo, ORDER_TEST, "import '../pricing/discount'\n")
        self.assert_rule('SB-05', f'SB-05 test-boundary: {ORDER_TEST} -> {DISCOUNT}')

    def test_sb05_allows_own_internals(self) -> None:
        append(self.repo, ORDER_TEST, "import './order'\n")
        self.assert_passes()

    def test_sb06_required_edge_missing(self) -> None:
        write(self.repo, ORDER, "import type { Money } from '../common'\n\nexport function orderTotal(lines: Money[]): Money {\n  return lines.length\n}\n")
        # The test file still imports pricing; test edges do not satisfy `requires`.
        self.assert_rule('SB-06', 'SB-06 required-edge-missing: orders -> pricing')

    def test_sb07_inline_suppression(self) -> None:
        append(self.repo, ITEM, '// sbguard-ignore the next import\n')
        code, out = guard(self.repo, 'check', '--base', 'HEAD')
        self.assertEqual(code, 1, out)
        self.assertIn(f'SB-07 suppression-or-baseline-growth: {ITEM} -> inline:sbguard-ignore:', out)
        revert(self.repo)
        self.assert_passes()

    def test_sb07_baseline_growth(self) -> None:
        text = read(self.repo, BASELINE).replace(
            '  "violations": [\n',
            '  "violations": [\n    ["SB-02", "src/domains/catalog/item.ts", "src/domains/orders/index.ts"],\n',
        )
        write(self.repo, BASELINE, text)
        append(self.repo, ITEM, "import '../orders'\n")  # the violation the grown baseline tries to hide
        self.assert_rule(
            'SB-07',
            'SB-07 suppression-or-baseline-growth: sbguard-baseline.json -> '
            'baseline:grew:SB-02|src/domains/catalog/item.ts|src/domains/orders/index.ts',
        )

    def test_sb07_baseline_deleted(self) -> None:
        (self.repo / BASELINE).unlink()
        self.assert_rule('SB-07', 'SB-07 suppression-or-baseline-growth: sbguard-baseline.json -> baseline:deleted')

    def test_sb00_unresolvable_import(self) -> None:
        append(self.repo, ORDER, "import '~/missing/module'\n")
        self.assert_rule('SB-00', f'SB-00 unresolvable-import: {ORDER} -> ~/missing/module')

    def test_drift_on_hand_edit(self) -> None:
        text = read(self.repo, CONFIG).replace('"severity": "error"', '"severity": "warn"', 1)
        write(self.repo, CONFIG, text)
        code, out = guard(self.repo, 'generate', '--check')
        self.assertEqual(code, 1, out)
        code, out = guard(self.repo, 'check', '--base', 'HEAD')
        self.assertEqual(code, 1, out)
        self.assertIn(f'DRIFT {CONFIG}', out)
        revert(self.repo)
        self.assertEqual(guard(self.repo, 'generate', '--check')[0], 0)
        self.assert_passes()

    def test_swapping_a_baselined_violation_fails(self) -> None:
        # Fix the baselined SB-01 and add a different SB-01: the count stays at one.
        write(self.repo, 'src/app/report.ts', read(self.repo, 'src/app/report.ts').replace('pricing/discount', 'pricing'))
        append(self.repo, 'src/app/checkout.ts', "import '../domains/orders/order'\n")
        code, out = guard(self.repo, 'check', '--base', 'HEAD')
        self.assertEqual(code, 1, out)
        self.assertIn('SB-01 crust-only: src/app/checkout.ts -> src/domains/orders/order.ts', out)
        self.assertIn('FAIL: 1 new, 0 baselined or suppressed, 1 stale', out)

    def test_stale_baseline_fails_strict_then_shrinks(self) -> None:
        write(self.repo, 'src/app/report.ts', read(self.repo, 'src/app/report.ts').replace('pricing/discount', 'pricing'))
        self.assertEqual(guard(self.repo, 'check', '--base', 'HEAD')[0], 0)
        code, out = guard(self.repo, 'check', '--base', 'HEAD', '--strict')
        self.assertEqual(code, 1, out)
        self.assertIn('STALE SB-01', out)
        self.assertEqual(guard(self.repo, 'baseline', '--shrink')[0], 0)
        self.assertNotIn('SB-01', read(self.repo, BASELINE))
        self.assert_passes()

    def test_human_suppression_waives_edge_but_not_sb07(self) -> None:
        append(self.repo, ITEM, "import '../orders'\n")
        append(
            self.repo,
            'slices.toml',
            '\n[[suppress]]\nrule = "SB-02"\nfrom = "src/domains/catalog/item.ts"\n'
            'to = "src/domains/orders/index.ts"\nreason = "migration ticket 12"\n',
        )
        self.assert_passes()
        append(self.repo, 'slices.toml', '\n[[suppress]]\nrule = "SB-07"\nfrom = "x"\nto = "y"\nreason = "no"\n')
        code, out = guard(self.repo, 'check', '--base', 'HEAD')
        self.assertEqual(code, 2, out)
        self.assertIn('cannot be suppressed', out)

    def test_setup_errors_never_pass(self) -> None:
        code, out = guard(self.repo, 'check', '--base', 'no-such-ref')
        self.assertEqual((code, 'does not resolve' in out), (2, True), out)
        append(self.repo, 'slices.toml', '\n[[spine]]\nname = "x"\npaths = ["src/x"]\nmay_depend_on = []\ncolour = "red"\n')
        code, out = guard(self.repo, 'check', '--base', 'HEAD')
        self.assertEqual((code, 'unknown field' in out), (2, True), out)
        revert(self.repo)
        (self.repo / 'node_modules').unlink()
        try:
            code, out = guard(self.repo, 'check', '--base', 'HEAD')
            self.assertEqual((code, 'dependency-cruiser not installed' in out), (2, True), out)
        finally:
            os.symlink(_scratch / 'deps' / 'node_modules', self.repo / 'node_modules')


class CycleIdentity(unittest.TestCase):
    def test_replacing_a_cycle_edge_inside_the_same_scc_fails(self) -> None:
        cyclic = read_fixture(DISCOUNT) + "import '../orders'\n"
        repo = make_repo('cycle', {DISCOUNT: cyclic})
        self.assertIn('SB-03', read(repo, BASELINE))
        self.assertEqual(guard(repo, 'check', '--base', 'HEAD', '--strict')[0], 0)
        write(repo, DISCOUNT, read_fixture(DISCOUNT))
        append(repo, 'src/domains/pricing/index.ts', "import '../orders'\n")
        code, out = guard(repo, 'check', '--base', 'HEAD')
        self.assertEqual(code, 1, out)
        self.assertIn('SB-03 no-slice-cycles: src/domains/pricing/index.ts -> src/domains/orders/index.ts', out)


class Adversarial(unittest.TestCase):
    """Bypasses found in the round-2 gaming review; each must fail."""

    @classmethod
    def setUpClass(cls) -> None:
        suppressed = read_fixture(ITEM).replace(
            'export function', '// sbguard-ignore legacy exception\nexport function'
        )
        cls.repo = make_repo('adversarial', {ITEM: suppressed})

    def tearDown(self) -> None:
        revert(self.repo)

    def check(self) -> tuple[int, str]:
        return guard(self.repo, 'check', '--base', 'HEAD', '--strict')

    def test_baselined_suppression_passes(self) -> None:
        code, out = self.check()
        self.assertEqual(code, 0, out)

    def test_test_named_bridge_cannot_hide_a_cycle(self) -> None:
        # Permit the reciprocal edge so only the cycle rule and the test boundary are in play.
        write(self.repo, 'slices.toml', read(self.repo, 'slices.toml').replace(
            'may_depend_on = ["common"]\nrequires = ["common"]\n\n[[slice]]\nname = "catalog"',
            'may_depend_on = ["common", "orders"]\nrequires = ["common"]\n\n[[slice]]\nname = "catalog"',
        ))
        self.assertEqual(guard(self.repo, 'generate')[0], 0)
        write(self.repo, 'src/domains/pricing/bridge.test.ts', "import '../orders'\nexport const bridge = 1\n")
        append(self.repo, DISCOUNT, "import './bridge.test'\n")
        code, out = self.check()
        self.assertEqual(code, 1, out)
        self.assertIn(f'SB-05 test-boundary: {DISCOUNT} -> src/domains/pricing/bridge.test.ts', out)
        self.assertIn('SB-03 no-slice-cycles: src/domains/pricing/bridge.test.ts -> src/domains/orders/index.ts', out)
        self.assertIn('POLICY pricing may_depend_on: +[\'orders\']', out)

    def test_blanket_eslint_disable_is_a_suppression(self) -> None:
        append(self.repo, ORDER, '/* eslint-disable */\n')
        code, out = self.check()
        self.assertEqual(code, 1, out)
        self.assertIn(f'SB-07 suppression-or-baseline-growth: {ORDER} -> inline:eslint-disable:', out)

    def test_multiline_eslint_disable_naming_an_import_rule_is_a_suppression(self) -> None:
        append(self.repo, ORDER, '/* eslint-disable\n   import/no-cycle\n*/\n')
        code, out = self.check()
        self.assertEqual(code, 1, out)
        self.assertIn(f'SB-07 suppression-or-baseline-growth: {ORDER} -> inline:eslint-disable:', out)

    def test_eslint_disable_for_unrelated_rule_is_allowed(self) -> None:
        append(self.repo, ORDER, '// eslint-disable-next-line no-console\nexport const log = 1\n')
        code, out = self.check()
        self.assertEqual(code, 0, out)

    def test_guard_marker_after_unrelated_eslint_directive_counts(self) -> None:
        append(self.repo, ORDER, '/* eslint-disable no-console -- sbguard-ignore */\n')
        code, out = self.check()
        self.assertEqual(code, 1, out)
        self.assertIn(f'SB-07 suppression-or-baseline-growth: {ORDER} -> inline:sbguard-ignore:', out)
    def test_copying_a_baselined_suppression_fails(self) -> None:
        append(self.repo, ITEM, '// sbguard-ignore legacy exception\nexport function again(): number {\n  return 1\n}\n')
        code, out = self.check()
        self.assertEqual(code, 1, out)
        self.assertIn(f'SB-07 suppression-or-baseline-growth: {ITEM} -> inline:sbguard-ignore:', out)

    def test_identical_duplicate_suppression_fails(self) -> None:
        text = read(self.repo, ITEM)
        write(self.repo, ITEM, text.replace('// sbguard-ignore legacy exception\n', '// sbguard-ignore legacy exception\n' * 2))
        code, out = self.check()
        self.assertEqual(code, 1, out)
        self.assertIn(f'SB-07 suppression-or-baseline-growth: {ITEM} -> inline:sbguard-ignore:', out)

    def test_moving_a_suppression_to_another_line_fails(self) -> None:
        text = read(self.repo, ITEM).replace('// sbguard-ignore legacy exception\n', '')
        write(self.repo, ITEM, '// sbguard-ignore legacy exception\n' + text)
        code, out = self.check()
        self.assertEqual(code, 1, out)
        self.assertIn(f'SB-07 suppression-or-baseline-growth: {ITEM} -> inline:sbguard-ignore:', out)

    def test_policy_change_is_reported(self) -> None:
        write(self.repo, 'slices.toml', read(self.repo, 'slices.toml').replace(
            'tsconfig = "tsconfig.json"\n', 'tsconfig = "tsconfig.json"\nignore = ["src/app/report.ts"]\n'
        ))
        code, out = self.check()
        self.assertIn('POLICY newly ignored: src/app/report.ts', out)
        self.assertIn('POLICY slices.toml changed against the base; it needs code-owner review', out)

def read_fixture(path: str) -> str:
    return (FIXTURE / path).read_text(encoding='utf8')


class Wiring(unittest.TestCase):
    def test_wire_is_idempotent_and_hook_checks_staged_content(self) -> None:
        repo = make_repo('wired')
        code, out = guard(repo, 'wire', '--activate')
        self.assertEqual(code, 0, out)
        for path in ('tools/sliced-bread-guard/sbguard.py', '.github/workflows/sliced-bread-guard.yml', '.githooks/pre-commit'):
            self.assertTrue((repo / path).exists(), path)
        sh(repo, 'git', 'add', '-A')
        sh(repo, 'git', 'commit', '-qm', 'wire the guard')
        code, out = guard(repo, 'wire', '--activate')
        self.assertEqual(code, 0, out)
        self.assertIn('unchanged .github/workflows/sliced-bread-guard.yml', out)

        # A rerun never overwrites customized vendored files; it reports a conflict instead.
        vendored = ('tools/sliced-bread-guard/sbguard.py', 'tools/sliced-bread-guard/sbguard_lib/gate.py')
        for path in vendored:
            append(repo, path, '# local customization\n')
        code, out = guard(repo, 'wire')
        self.assertEqual(code, 1, out)
        for path in vendored:
            self.assertIn(f'CONFLICT {path}', out)
            self.assertTrue(read(repo, path).endswith('# local customization\n'), path)
        sh(repo, 'git', 'checkout', '--', 'tools')

        append(repo, ORDER, "import '../pricing/discount'\n")
        sh(repo, 'git', 'add', ORDER)
        commit = sh(repo, 'git', 'commit', '-qm', 'staged violation', check=False)
        self.assertNotEqual(commit.returncode, 0)
        self.assertIn(f'SB-01 crust-only: {ORDER} -> {DISCOUNT}', commit.stdout + commit.stderr)

        # The violation stays in the working tree but leaves the index: the hook must pass.
        sh(repo, 'git', 'restore', '--staged', ORDER)
        write(repo, 'README.md', 'ts-shop\n')
        sh(repo, 'git', 'add', 'README.md')
        commit = sh(repo, 'git', 'commit', '-qm', 'clean staged change', check=False)
        self.assertEqual(commit.returncode, 0, commit.stdout + commit.stderr)


class Prove(unittest.TestCase):
    def test_prove_plants_and_reverts_one_probe_per_rule(self) -> None:
        repo = make_repo('prove')
        code, out = guard(repo, 'prove')
        self.assertEqual(code, 0, out)
        for rule in ('SB-01', 'SB-02', 'SB-03', 'SB-04', 'SB-05', 'SB-06', 'SB-07'):
            self.assertIn(f'PROVED {rule} ', out)
        self.assertNotIn('NOT PROVED', out)
        self.assertEqual(sh(repo, 'git', 'status', '--porcelain').stdout, '')
        self.assertEqual(sh(repo, 'git', 'worktree', 'list', '--porcelain').stdout.count('worktree '), 1)

    def test_prove_refuses_a_dirty_tree(self) -> None:
        repo = make_repo('prove-dirty')
        append(repo, ORDER, '// local edit\n')
        code, out = guard(repo, 'prove')
        self.assertEqual(code, 2, out)
        self.assertIn('prove targets HEAD', out)


if __name__ == '__main__':
    unittest.main()
