"""Detect the repository setup and install the guard: vendored CLI, CI job, pre-commit hook."""

from __future__ import annotations

import json
from pathlib import Path

from . import repo

SKILL_ROOT = Path(__file__).resolve().parents[2]
VENDOR_DIR = 'tools/sliced-bread-guard'
WORKFLOW = '.github/workflows/sliced-bread-guard.yml'
HOOK = '.githooks/pre-commit'


def detect(root: Path) -> dict:
    package = {}
    if (root / 'package.json').exists():
        package = json.loads((root / 'package.json').read_text(encoding='utf8'))
    deps = {**package.get('dependencies', {}), **package.get('devDependencies', {})}
    languages = []
    if package or (root / 'tsconfig.json').exists():
        languages.append('typescript')
    if (root / 'pyproject.toml').exists() or (root / 'setup.py').exists():
        languages.append('python')
    checkers = sorted(
        {p.name for p in root.glob('.dependency-cruiser*')}
        | {name for name in ('dependency-cruiser', 'eslint-plugin-boundaries', 'eslint-plugin-import') if name in deps}
        | {name for name in ('tach.toml', '.importlinter') if (root / name).exists()}
    )
    hooks_path = repo.git(root, 'config', '--get', 'core.hooksPath', check=False).stdout.strip()
    managers = [m for m in ('.husky', '.pre-commit-config.yaml', 'lefthook.yml') if (root / m).exists()]
    return {
        'languages': languages,
        'supported_backend': 'typescript' if 'typescript' in languages else None,
        'existing_checkers': checkers,
        'hook_managers': managers,
        'core_hooks_path': hooks_path or None,
        'codeowners': next((p for p in ('.github/CODEOWNERS', 'CODEOWNERS', 'docs/CODEOWNERS') if (root / p).exists()), None),
    }


def _place(root: Path, relative: str, content: str, source: Path, lines: list[str]) -> bool:
    """Write a file only when it is absent; never overwrite different content."""
    target = root / relative
    if target.exists():
        if target.read_text(encoding='utf8') == content:
            lines.append(f'unchanged {relative}')
            return True
        lines.append(f'CONFLICT {relative} exists with different content; merge {source} by hand')
        return False
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf8')
    lines.append(f'wrote {relative}')
    return True


def wire(root: Path, activate: bool) -> tuple[int, list[str]]:
    lines: list[str] = []
    ok = True
    scripts = SKILL_ROOT / 'scripts'
    sources = [scripts / 'sbguard.py', *sorted((scripts / 'sbguard_lib').glob('*.py'))]
    for source in sources:
        relative = f'{VENDOR_DIR}/{source.relative_to(scripts).as_posix()}'
        ok &= _place(root, relative, source.read_text(encoding='utf8'), source, lines)
    templates = SKILL_ROOT / 'templates'
    workflow = templates / 'sliced-bread-guard.yml'
    ok &= _place(root, WORKFLOW, workflow.read_text(encoding='utf8'), workflow, lines)

    found = detect(root)
    if found['hook_managers'] or found['core_hooks_path'] not in (None, '.githooks'):
        managers = ', '.join(found['hook_managers'] or [f'core.hooksPath={found["core_hooks_path"]}'])
        lines.append(f'HOOK existing hook manager ({managers}); add this command to it: python3 {VENDOR_DIR}/sbguard.py check --staged --base HEAD')
    else:
        hook = templates / 'pre-commit'
        placed = _place(root, HOOK, hook.read_text(encoding='utf8'), hook, lines)
        ok &= placed
        if placed:
            (root / HOOK).chmod(0o755)
        if activate:
            repo.git(root, 'config', 'core.hooksPath', '.githooks')
            lines.append('activated: git config core.hooksPath .githooks')
        else:
            lines.append('hook not active yet: run `git config core.hooksPath .githooks` (wire --activate does it)')
    lines.append('CODEOWNERS: add the lines in ' + str(templates / 'CODEOWNERS') + ' and require code-owner review on the default branch')
    return (0 if ok else 1), lines
