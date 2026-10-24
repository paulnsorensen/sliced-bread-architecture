"""Git access: file inventory, base-ref reads, and staged snapshots."""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator


class GitError(Exception):
    """A git command failed or a required ref does not exist."""


def git(root: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess:
    run = subprocess.run(['git', '-C', str(root), *args], capture_output=True, text=True)
    if check and run.returncode != 0:
        raise GitError(f'git {" ".join(args)} failed: {run.stderr.strip()}')
    return run


def tracked_files(root: Path, *, staged: bool) -> list[str]:
    args = ['ls-files', '-z', '--cached']
    if not staged:
        args += ['--others', '--exclude-standard']
    names = git(root, *args).stdout.split('\0')
    present = {n for n in names if n}
    if not staged:
        deleted = git(root, 'ls-files', '-z', '--deleted').stdout.split('\0')
        present -= set(deleted)
    return sorted(present)


def resolve(root: Path, ref: str) -> str:
    run = git(root, 'rev-parse', '--verify', '--quiet', f'{ref}^{{commit}}', check=False)
    if run.returncode != 0:
        raise GitError(f'base ref {ref!r} does not resolve to a commit (fetch it first)')
    return run.stdout.strip()


def read_at(root: Path, commit: str, path: str) -> str | None:
    run = git(root, 'show', f'{commit}:{path}', check=False)
    return run.stdout if run.returncode == 0 else None


def dirty(root: Path) -> list[str]:
    return [line for line in git(root, 'status', '--porcelain').stdout.splitlines() if line]


def _link_node_modules(source: Path, target: Path) -> None:
    modules = source / 'node_modules'
    if modules.exists():
        os.symlink(modules.resolve(), target / 'node_modules')


@contextmanager
def staged_snapshot(root: Path) -> Iterator[Path]:
    """Export the index to a temporary directory so the check sees staged content only."""
    with tempfile.TemporaryDirectory(prefix='sbguard-staged-') as scratch:
        target = Path(scratch)
        git(root, 'checkout-index', '--all', f'--prefix={target}/')
        _link_node_modules(root, target)
        yield target


@contextmanager
def head_worktree(root: Path) -> Iterator[Path]:
    """Check out HEAD in a temporary detached worktree; remove it afterwards."""
    scratch = Path(tempfile.mkdtemp(prefix='sbguard-prove-'))
    target = scratch / 'tree'
    git(root, 'worktree', 'add', '--detach', '--quiet', str(target), 'HEAD')
    try:
        _link_node_modules(root, target)
        yield target
    finally:
        git(root, 'worktree', 'remove', '--force', str(target), check=False)
        git(root, 'worktree', 'prune', check=False)
        shutil.rmtree(scratch, ignore_errors=True)
