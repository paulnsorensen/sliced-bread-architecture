# Architecture metrics tooling — research synthesis

Date: 2026-10-19. Question: has anyone codified Martin's package metrics, connascence, reflexion models and dependency structure matrices (DSMs), or architectural fitness functions into libraries, CLIs, linters, or agent skills? The Sliced Bread repo wants measurable static checks for slice depth and seam coupling.

## Verdict

All four ideas exist as code, at very different maturity levels.

- **Martin's package metrics** have the most mature tooling. Maintained tools compute the full Ca/Ce/I/A/D set in Java (ArchUnit), PHP (PDepend), Python (pyscn), and TypeScript (ArchUnitTS). dependency-cruiser computes only Ca/Ce/I. See [[research/architecture-metrics-tooling/martin-package-metrics]].
- **Connascence** has only small, new tools: two CLIs and two Claude skills, with 0–3 GitHub stars each. See [[research/architecture-metrics-tooling/connascence]].
- **Reflexion-style conformance** is common as forbidden-edge rules (import-linter, tach, dependency-cruiser, ArchUnit). Only `tach check --exact` reports the reflexion "absence" case. See [[research/architecture-metrics-tooling/reflexion-models-and-dsm]].
- **Fitness functions** are a framing, not a library. ArchUnit-family libraries are the usual executable form. See [[research/architecture-metrics-tooling/fitness-functions]].
- **No tool computes an Ousterhout-style module-depth number.** The implementation-share ratio in `skills/sliced-bread-depth/SKILL.md:45-84` has no external equivalent in the sources checked.
- **SlopCodeBench** measures how agent code degrades over iterations with an erosion metric (CC × √SLOC mass). See [[sources/slopcodebench]].

## Relation to earlier research

The slice-and-spine prior-art survey defines these concepts as review vocabulary. See [[research/slice-spine-review-prior-art/literature]] for the definitions and primary citations. This research adds the tooling layer: which code computes each concept today.

## Fit with the doctrine

The doctrine grades implementation share, public-surface size, and lifetime mixing (ADR-003, `docs/adr/sliced-bread-doctrine-revision-003.md:11-13`). The external metrics are complements, not replacements:

- Martin's I applies to a crust: a crust should have high afferent coupling and low instability.
- Connascence gives the rule for what may cross a crust: only weak forms (name, type).
- tach `interfaces` plus `check --exact` is the closest existing tool for crust-only imports with absence detection.

These are research observations, not decisions. A `/mold` spec owns any adoption choice.

## Open questions

- Which language does Sliced Bread tooling target first? Each language has a different metric tool.
- Does Martin's abstractness fit a facade crust? ArchUnit already redefines A to count public classes.
- Is Khononov's balanced-coupling model (cargo-coupling) a better fit for slice seams than Martin's I/A/D?

## Confidence

`speculating`. Tool existence and maintenance are confirmed through primary docs and the GitHub API. Most capability claims rest on a single README or doc page. No tool was run.

## Coverage gaps

The run did not cover eslint-plugin-boundaries capabilities, deptrac, go-arch-lint, PhpMetrics, cargo-modules, Sonargraph, or jRMTool. The authors' primary text on fitness functions was not retrieved.

_Source: briesearch run `codified-architecture-metrics-tools-skills` (6 researcher sub-agents, 2 waves) · Updated: 2026-10-19_
