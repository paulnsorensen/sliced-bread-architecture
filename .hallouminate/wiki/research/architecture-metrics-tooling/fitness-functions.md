# Architectural fitness functions — definition and executable libraries

An architectural fitness function is any objective, automatable check of an architectural property. ArchUnit-family libraries are the usual way to run fitness functions as unit tests.

## Fitness function taxonomy

Neal Ford, Rebecca Parsons, and Patrick Kua define fitness functions in _Building Evolutionary Architectures_. Secondary sources classify them on three axes:

- **Atomic vs. holistic** — one property in one context, or several properties together.
- **Triggered vs. continual** — runs on an event such as CI, or runs all the time in production.
- **Static vs. dynamic** — a fixed pass/fail threshold, or a threshold that shifts with context.

A typical atomic fitness function is a unit test of coupling or cyclomatic complexity. The authors' primary chapter was not retrieved (O'Reilly blocked the fetch), so this taxonomy wording is secondary.

## Fitness functions for Sliced Bread

Each metric on the related pages becomes a fitness function when it gets a threshold and runs in CI. Examples: "no cycles between slices", "crust instability below 0.3", "no import of another slice's internals", "no strong connascence crosses a crust".

## Executable fitness-function libraries

| Library       | Language   | Metrics beyond dependency rules       | Last push (2026-10-19 check) |
| ------------- | ---------- | ------------------------------------- | ---------------------------- |
| ArchUnit      | Java       | Martin Ca/Ce/I/A/D, Lakos, visibility | v1.5.1, 2026-09-25           |
| ArchUnitNET   | .NET       | not checked                           | 2026-10-16                   |
| NetArchTest   | .NET       | not checked                           | 2024-07-29                   |
| Konsist       | Kotlin     | not checked                           | 2026-10-15                   |
| PyTestArch    | Python     | none in README                        | 2026-10-18                   |
| pytest-archon | Python     | not checked                           | 2025-09-19                   |
| ArchUnitTS    | TypeScript | LCOM, cyclomatic complexity, A, I, D  | 2026-10-17                   |
| ts-arch       | TypeScript | not checked                           | 2026-03-26                   |

## Agent skills for fitness functions

One mcpmarket listing, "Architectural Fitness Functions", describes periodic system-wide degradation checks. It was seen as a search snippet only and is unverified.

## Related pages

- [[research/architecture-metrics-tooling/architecture-metrics-tooling]] — synthesis of this research.
- [[research/architecture-metrics-tooling/martin-package-metrics]] — metrics that become fitness-function thresholds.
- [[research/slice-spine-review-prior-art/literature]] — the fitness-function definition row.

_Source: briesearch run `codified-architecture-metrics-tools-skills`; secondary taxonomy sources and GitHub API metadata · Updated: 2026-10-19_
