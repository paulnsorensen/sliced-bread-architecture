# Deterministic versus LLM checks for Sliced Bread

About two-thirds of the Sliced Bread checks can be computed without an LLM, after a human commits a declared slice map. The rest need LLM judgment. Only the deterministic checks can feed a ratchet gate.

## Check classification: deterministic or LLM

This classification maps each Sliced Bread check to the tools in [[research/architecture-metrics-tooling/architecture-metrics-tooling]].

| Check                                                                               | Deterministic today?          | How                                                                            |
| ----------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------ |
| Forbidden edges, layer direction, cross-slice cycles                                | Yes                           | import-linter, tach, dependency-cruiser, ArchUnit; output is a violation count |
| Imports of another slice's internals instead of its crust                           | Yes, once crusts are declared | tach `expose`, dependency-cruiser path rules                                   |
| Declared dependency the code does not use (reflexion absence)                       | Yes, Python                   | `tach check --exact`                                                           |
| Implementation share (crust LOC ÷ slice LOC), public-surface count                  | Yes                           | LOC and exported-symbol counts over the slice map                              |
| Martin Ca/Ce/I/A/D per slice                                                        | Yes                           | pyscn, ArchUnit, PDepend; dependency-cruiser gives Ca/Ce/I                     |
| Change coupling across seams                                                        | Yes                           | git co-change counts                                                           |
| Erosion (CC × √SLOC) and duplication                                                | Yes                           | radon or lizard, ast-grep, a clone detector                                    |
| Line-count and file-clustering growth signals                                       | Yes, advisory only            | ADR-003 forbids grading them                                                   |
| Static connascence: name, type, position, magic values                              | Partly                        | kegesch/connascence heuristics; parameter count and magic literals             |
| The slice map: which folders are slices, which file is the crust                    | LLM or human, once            | the declared model of a reflexion check; tools enforce it after commit         |
| Lifetime mixing, framework-bound allowance, documented intent, dual seams           | LLM                           | semantic judgment                                                              |
| Demonstrated growth pressure; severity matching against the doctrine contract cases | LLM                           | rule-shaped, but matching the "given" condition needs judgment                 |
| Dynamic connascence (execution order, timing, value, identity); seam dispositions   | LLM                           | not visible statically                                                         |

## Architecture ratchet proposal

An architecture ratchet lets an agent check that a change does not add violations. The hill-climb `ratchet.py` gate fits: `check` fails when a count gets worse than its threshold, and `tighten` moves the threshold only toward better values. Existing debt stays at its baseline, so a change may not make things worse, and each gain tightens the gate.

Proposed shape, as a `sliced-bread-ratchet` skill or a measuring script in `sliced-bread-depth`:

1. **Declared model.** A committed `slices.toml` lists slices, crust paths, and allowed dependencies. An LLM can draft it; a human approves it.
2. **Measure.** One command per metric prints one number on its last line. All metrics are lower-is-better with tolerance 0: `forbidden_edges`, `cross_slice_cycles`, `internal_imports_across_crust`, `unused_declared_deps`, `sum_crust_share_excess`, `sum_D_over_slices`, and `eroded_mass_share`.
3. **Gate.** A copy of `ratchet.py` in the repository runs `check` in CI. An agent runs the same check before publication, or a Stop hook runs it, so the agent sees a regression before review.
4. **LLM layer outside the ratchet.** `sliced-bread-review` applies the judgment checks to the diff only, and its findings stay advisory. An LLM verdict is not deterministic, so a ratchet on it would flake. To make a judgment countable, an LLM proposes an annotation, a human commits it, and tools count it.

## Ratchet proposal risks

- This repository holds the doctrine, not a Sliced Bread codebase. The ratchet ships as a skill or template that consumer repositories adopt, so the first benchmark needs a consumer repository.
- Tool coverage differs by language. tach covers crust exposure and unused dependencies for Python only. TypeScript needs dependency-cruiser plus custom rules.
- A new skill is a new contract. A `/mold` spec owns the design before implementation.

## Depth ratchet prototype as built

The depth half of the ratchet proposal exists as the `skills/sliced-bread-depth-ratchet/` skill (prototype, 2026-10-24). The boundary half (forbidden edges, crust bypass, unused declared dependencies) belongs to the separate `sliced-bread-guard` prototype.

- **Runtime.** Node only, with the TypeScript compiler API pinned to 5.9.3 and `smol-toml` for `slices.toml`. Gotcha: TypeScript 7 exposes only `unstable/*` API entrypoints, so the tool does not use it.
- **Metrics.** Six keys per slice, all lower-is-better with tolerance 0: `M08.crust_logic_statements`, `M08.share`, `M09.public_surface`, `M10.crust_complexity`, `M10.share`, and `M12.unused_exports`. The unit is a logical statement, not a physical line. Dead internal code is not in a denominator. Definitions: `skills/sliced-bread-depth-ratchet/references/metrics.md`.
- **No sums.** Baselines are per slice. A sum over slices lets one slice improve while another regresses, so the proposal's `sum_crust_share_excess` is superseded. Martin's D is dropped, so `sum_D_over_slices` is superseded too.
- **Numerators with shares.** Padding the internals lowers a share with no crust change, so the crust numerators are ratcheted beside the shares. `tighten` holds a share gain whose numerator did not fall until a human accepts it.
- **ADR-003 resolution.** The default mode reports and exits 0. A repository opts in to `block` through the CODEOWNERS-owned baseline file. A block compares a slice only with its own human-approved baseline. The 200-statement and 50% size-aware values stay advisory in every mode. The ADR is unchanged.

_Source: session analysis on 2026-10-19 over [[research/architecture-metrics-tooling/architecture-metrics-tooling]] and the hill-climb ratchet reference; depth-ratchet prototype session on 2026-10-24 · Updated: 2026-10-24 · Supersedes: `sum_crust_share_excess` and `sum_D_over_slices` in the proposed metric list · 2026-10-24_
