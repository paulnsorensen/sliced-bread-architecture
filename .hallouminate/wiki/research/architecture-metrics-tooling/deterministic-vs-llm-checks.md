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

_Source: session analysis on 2026-10-19 over [[research/architecture-metrics-tooling/architecture-metrics-tooling]] and the hill-climb ratchet reference · Updated: 2026-10-19_
