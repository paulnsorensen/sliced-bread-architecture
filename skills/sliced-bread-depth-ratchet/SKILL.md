---
name: sliced-bread-depth-ratchet
description: >-
  Measure deterministic depth metrics for each slice of a Sliced Bread
  TypeScript codebase and ratchet them against a committed, human-approved
  baseline. Use when the user asks to "add a depth ratchet", "stop slices
  getting shallower", "gate crust growth in CI", "baseline our slice depth",
  or wants the sliced-bread-depth numbers as a repeatable check. Do NOT use
  for a judgement-based depth assessment (sliced-bread-depth), for boundary
  violations (sliced-bread-guard, sliced-bread-review), or for a full audit
  (sliced-bread-audit).
---

# Sliced Bread Depth Ratchet

This skill computes six per-slice depth numbers from the TypeScript compiler API.
It compares each slice with its own committed baseline.
A change that makes a slice shallower than its baseline is a regression.
In the default `report` mode, the tool reports the regression and exits 0.
In the opt-in `block` mode, the tool exits 1.

The [sliced-bread-depth](../sliced-bread-depth/SKILL.md) skill stays the judgement pass.
It grades lifetime mixing, framework allowances, documented intent, and dual seams.
This skill owns only the deterministic subset of that pass.

## Metrics

[references/metrics.md](references/metrics.md) gives the exact definitions and the known limits.
All six ratchet keys are lower-is-better, with tolerance 0.

| Key                          | Meaning                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------- |
| `M08.crust_logic_statements` | Logical statements inside crust function bodies.                                |
| `M08.share`                  | Crust statements ÷ slice statements (crust plus live internals), as a fraction. |
| `M09.public_surface`         | Export slots on the crust: one per crust file and export name.                  |
| `M10.crust_complexity`       | Cyclomatic complexity of crust function bodies.                                 |
| `M10.share`                  | Crust complexity ÷ slice complexity, as a fraction.                             |
| `M12.unused_exports`         | Crust exports without an external production importer.                          |

The unit is a logical statement, not a physical line.
Reformatting and splitting an internal file do not change any number.
A rename does not change any number when it keeps the export slots ([limits](references/metrics.md#known-gaming-routes-and-limits)).
Test files, and dead internal code, are not in any number.
The report always shows the numerator and the denominator of each share.
The numbers cover TypeScript only, and they are static: the `coverage` record names JavaScript files and dynamic accesses that the tool cannot follow.

The size-aware rule is an advisory signal only: `M08.size-aware` fires when a crust has more than 200 logical statements and a share above 50%.
The rule never blocks, in any mode.
It applies to every slice, and it is the only depth signal for a slice that has no baseline.

## ADR-003 and the blocking mode

ADR-003 makes numeric growth thresholds advisory signals, never gradeable violations.
It names implementation share and public-surface size as the measures that tools grade.
This skill resolves the conflict with three rules:

1. The default mode is `report`. The tool prints regressions and exits 0.
2. Blocking is opt-in per repository. A human sets `"mode": "block"` in the baseline file, and CODEOWNERS routes that change to a human reviewer.
3. A block compares a slice only with its own human-approved baseline. It never compares a slice with a fixed number. The 200-statement and 50% values stay advisory in every mode.

A block is therefore a repository-owned regression policy, not doctrine enforcement.
The ADR names share and surface size.
The numerator caps (`M08.crust_logic_statements`, `M10.crust_complexity`), M10, and M12 go beyond what ADR-003 names.
A repository that opts in accepts those keys as its local policy.
This skill does not change ADR-003.

The numerator caps exist because a share alone is easy to game.
Padding the internals lowers the share with no change to the crust.
For example, 25% more internal code changes a 20% share to 16%.
The numerator cap blocks crust growth that the padding tries to hide.

## Commands

Run the commands from the repository root that holds `slices.toml`.

```bash
node tools/sliced-bread-depth-ratchet/scripts/depth-ratchet.mjs measure         # catalog table; --json for data
node tools/sliced-bread-depth-ratchet/scripts/depth-ratchet.mjs init            # write depth-ratchet.json (mode report)
node tools/sliced-bread-depth-ratchet/scripts/depth-ratchet.mjs check           # the gate
node tools/sliced-bread-depth-ratchet/scripts/depth-ratchet.mjs tighten         # lower caps after a real improvement
node tools/sliced-bread-depth-ratchet/scripts/depth-ratchet.mjs diff-baseline --base origin/main
```

- `check` reports `regressed`, `improved`, `pass`, `new` (no baseline), and `orphan` (a baseline slice that `slices.toml` no longer declares). Each line names the slice and the metric key. A regressed share whose numerator did not grow carries a `denominator-shrink` diagnostic. A `coverage:` line names unmeasured files and dynamic accesses.
- `tighten` lowers each improved cap to the current value. It refuses, and writes nothing, when any metric regressed or any slice is orphaned. It holds a share gain whose numerator did not fall, unless `--accept-denominator-gains` is set. It adds a baseline for a new slice only with `--adopt-new`. No command raises a cap.
- `init` refuses to overwrite an existing baseline.
- `diff-baseline` lists loosening against a base revision: raised caps, removed slices or metrics, `block` to `report`, and a changed measurement version. It exits 0 when the comparison is valid and 2 when the input is invalid. It informs the reviewer. It does not approve or reject the change.

Exit codes: 0 pass or report mode, 1 regression in block mode or a refused tighten, 2 input error.

## Adoption

1. Copy this skill directory to `tools/sliced-bread-depth-ratchet/` and run `npm ci` there. The tool pins `typescript` and `smol-toml`.
2. Commit a `slices.toml`. The schema is the sliced-bread-guard schema, and this tool rejects the same documents. An agent can draft the file. A human approves it.
3. Run `init`. Review the catalog, then commit `depth-ratchet.json`.
4. Add both files to CODEOWNERS ([templates/CODEOWNERS](templates/CODEOWNERS)). Enable required code-owner review on the default branch. CODEOWNERS names the reviewers; branch protection supplies the approval barrier.
5. Add the example job ([templates/depth-ratchet.yml](templates/depth-ratchet.yml)). It runs `check` and `diff-baseline` on each pull request.
6. To block, a human changes `mode` to `block` in a reviewed pull request.

To raise a cap, a human edits `depth-ratchet.json` and gives the reason in the pull request.
Accept a raise only for a deliberate trade-off, such as an internal simplification that raised a share.

## Agent workflow

Before you publish a change in an adopted repository, run `check`.
When it reports `improved`, run `tighten` in the same change.
When `tighten` reports a share as `held`, the share fell only because internal code grew. Do not pass `--accept-denominator-gains` yourself; leave that decision to the human owner.
When `check` reports `regressed`, move the logic back behind the crust, or explain the trade-off to the human owner.
When `check` prints a `coverage:` line, name the unmeasured files or dynamic accesses in your summary.
Never edit `depth-ratchet.json` or `slices.toml` to make `check` pass.

## Tests

```bash
cd skills/sliced-bread-depth-ratchet && npm ci && npm test
```

The suite runs the real CLI, the real compiler API, and real git repositories built from [fixtures/ts-depth](fixtures/ts-depth).
It covers both doctrine calibration cases, the should-move and should-not-move mutations, the gaming cases, tighten, the modes, export provenance, input validation, and the advisor's red-team attacks.
