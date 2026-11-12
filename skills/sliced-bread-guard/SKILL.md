---
name: sliced-bread-guard
description: >-
  Set up deterministic static architecture checks for a Sliced Bread codebase:
  draft a slices.toml slice map for human approval, generate native checker
  config from the SB-01..SB-07 rule blueprints, write a shrink-only baseline,
  wire a CI job, a pre-commit hook, and a drift check, then prove each rule by
  planting a violation. Use when the user asks to "enforce the slice
  boundaries in CI", "add architecture checks", "guard the crusts", "set up
  dependency-cruiser for Sliced Bread", or "ratchet architecture debt". Do NOT
  use for a judgment review of a diff (sliced-bread-review), a full audit
  (sliced-bread-audit), or crust depth scoring (sliced-bread-depth).
---

# Sliced Bread Guard

This skill installs static checks that hold a Sliced Bread codebase to its declared slice map.
Every check is deterministic, so a ratchet gate can use it.
Judgment checks stay in `sliced-bread-review`; this skill does not grade them.

The skill has one backend: TypeScript and JavaScript with dependency-cruiser.
For other languages, stop after Step 1 and report that no backend exists yet.

- Rule definitions and the backend support matrix: [`references/rule-blueprints.md`](references/rule-blueprints.md).
- The `slices.toml` schema: [`references/slices-toml.md`](references/slices-toml.md).
- The CLI: `scripts/sbguard.py` (Python 3.11 or newer, standard library only).

In the commands below, `GUARD` is `python3 <skill>/scripts/sbguard.py --root <repo>` before Step 5.
After Step 5, use the vendored copy: `python3 tools/sliced-bread-guard/sbguard.py`.

## Step 1 — Detect

Run `GUARD detect`.
It reports the languages, existing architecture checkers, hook managers, and the CODEOWNERS path.
If `supported_backend` is null, stop and report it.
If the repository already has a dependency-cruiser config, keep it.
The guard writes its own file, `.dependency-cruiser.sbguard.cjs`, and never edits the existing one.

## Step 2 — Propose the slice map

Draft `slices.toml` at the repository root.
Read the source tree, the crust files, and the import graph before you draft it.

- Make each business concept a `[[slice]]` with its crust files and its `shape`.
- Make `app/`, `entrypoints/`, `adapters/`, and `common/` `[[spine]]` entries.
- Set `may_depend_on` from the doctrine arrows and from the edges the code has today.
- Set `requires` only for edges that the design needs, not for every edge that exists.
- Put external test directories in the `paths` of the slice that owns them.

Show the draft to the user as a table: node, kind, paths, crust, `may_depend_on`, `requires`.
Get explicit approval before Step 3.
The human owns this file; you only draft it.

## Step 3 — Generate the checker config

Run `GUARD generate`.
It writes `.dependency-cruiser.sbguard.cjs` with a GENERATED header.
Install the checker if it is missing: `npm install --save-dev dependency-cruiser typescript`.
Run `GUARD generate --check`; it must print `no drift`.

## Step 4 — Write the baseline

Run `GUARD baseline --init` once, in the adoption change.
It records the current violations in `sbguard-baseline.json` and refuses to overwrite an existing baseline.
It also refuses while an import is unresolvable (SB-00); fix the resolver settings first.
Show the user the number of entries per rule.

The baseline only shrinks:

- `GUARD baseline --shrink` removes entries that no longer occur. It never adds an entry.
- A check fails with SB-07 when the baseline holds an entry that the base ref does not hold.
- A check fails with SB-07 when the change deletes the baseline.
- To accept a new violation, a human adds a narrow `[[suppress]]` entry with a reason to `slices.toml`.
  CODEOWNERS review is the approval; the check cannot verify who approved.

Commit `slices.toml`, the generated config, and the baseline in one change.
A base ref without `slices.toml` marks that change as the adoption.

## Step 5 — Wire CI, the hook, and ownership

Run `GUARD wire`, then show the user each line it prints.

- It vendors the CLI into `tools/sliced-bread-guard/`.
- It writes `.github/workflows/sliced-bread-guard.yml`, which runs the drift check and `check --strict` against the trusted base.
- It writes `.githooks/pre-commit`, which checks the staged snapshot.
  If the repository uses husky, pre-commit, lefthook, or another `core.hooksPath`, it prints the command to add instead.
- It never overwrites a file with different content, including the vendored CLI; it prints `CONFLICT`, exits 1, and you merge by hand.
  To upgrade the vendored CLI, delete `tools/sliced-bread-guard/` and run `wire` again.

Ask the user before `GUARD wire --activate`; it sets `core.hooksPath` for this clone.
Give the user the lines in [`templates/CODEOWNERS`](templates/CODEOWNERS).
Tell the user that CODEOWNERS protects nothing until branch protection requires code-owner review.

## Step 6 — Prove each rule

Commit the setup, then run `GUARD prove`.
It checks out HEAD in a temporary worktree, so the user's tree stays untouched.
It refuses to run on a dirty tree, because it proves HEAD only.

For each rule, it plants one violation, expects exit 1 with the rule ID, reverts, and expects a pass.
A setup error (exit 2) never counts as proof.
Report each `PROVED` and `NOT PROVED` line.
`NOT PROVED` with "no place to plant a probe" means the slice map is too small for that probe; say so.
Call the result mutation smoke coverage: one probe per rule shows the rule is wired, not that every variant is caught.

## The check

`GUARD check --base <ref> [--staged] [--strict]` exits 0 on pass, 1 on a rule failure or drift, and 2 on a setup error.
Each new violation prints one line: `SB-0N <title>: <from> -> <to>`.
The gate compares identity sets, not counts, so a fixed violation cannot pay for a new one.
`--strict` also fails on stale baseline entries and stale suppressions; CI uses it.
When `slices.toml` changed against the base, `POLICY` lines show what the change redefines; show them to the reviewer.

## Trust boundary

The check cannot authenticate a human.
These controls hold only when code-owner review is required on the default branch:

- `slices.toml`, which holds the slice map, the `ignore` and `test_patterns` policy, and every suppression.
- `sbguard-baseline.json`, the generated config, the vendored CLI, the workflow, and the hook.
- Every `tsconfig*.json`, which controls import resolution.
- `package.json`, the lockfile, and `.npmrc`, which control the checker that CI installs.
- Every CODEOWNERS file.

The base ref is trusted input.
The pre-commit hook uses `--base HEAD`; it gives local feedback and is not the authoritative gate.
CI uses the pull request's immutable base SHA, or `github.event.before` for a push.
A force-push can move `github.event.before`, so protect the default branch against force-pushes.

The check does not see computed dynamic imports such as `import(name)`.
Report that limit to the user.

## Output

Report these items to the user:

1. The detected setup and the approved slice map.
2. The files written, and each `CONFLICT` or `HOOK` line from `wire`.
3. The baseline entry count per rule.
4. The `prove` result per rule.
5. The trust-boundary actions the user must take: CODEOWNERS lines and required code-owner review.
