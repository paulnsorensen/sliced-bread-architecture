# Skill distribution

How the `skills/` tree reaches coding harnesses on developer machines.

- Distribution is owned by the dotfiles repo, not this one: the
  `paulnsorensen/sliced-bread-architecture` entry in dotfiles
  `skills/_registry.yaml` propagates every `skills/<name>/SKILL.md` dir via
  two legs on `dots sync` — chezmoi vendoring (claude + omp) and npx
  `skills add` (the harnesses in `SKILL_HARNESSES`, e.g. codex, cursor).
- Vendoring is unpinned and floats to `main` — a skill on an unmerged branch
  is invisible to every harness until its PR merges.
- `sliced-bread-audit` has no `SKILL.md` (it is a Workflow script), so
  registry auto-discovery skips it; it installs manually per its README.
  Dotfiles ships a same-named but separately-authored audit workflow
  (`dot_claude/exact_workflows/sliced-bread-audit.js`); treat the two as
  distinct — reconcile deliberately rather than copying between them.
