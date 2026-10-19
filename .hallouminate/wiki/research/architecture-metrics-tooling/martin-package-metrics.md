# Martin package metrics — definitions and tools that compute them

Robert C. Martin's package metrics measure how a package sits in the dependency graph. ArchUnit, PDepend, pyscn, and ArchUnitTS compute the full Ca/Ce/I/A/D set. dependency-cruiser computes Ca/Ce/I only.

## Definitions of the Martin metrics

Martin defines five numbers per package or component (_Agile Software Development_, 2002):

- **Ca, afferent coupling** — the count of outside modules that depend on this package (incoming).
- **Ce, efferent coupling** — the count of outside modules this package depends on (outgoing).
- **I, instability = Ce / (Ca + Ce)** — 0 is maximally stable (many dependents, no dependencies, hard to change); 1 is maximally unstable (free to change).
- **A, abstractness** — the ratio of abstract types (interfaces, abstract classes) to all types in the package.
- **D, distance from the main sequence = |A + I − 1|** — the main sequence is the line from (A=1, I=0) to (A=0, I=1).

Two zones sit far from the main sequence:

- **Zone of Pain** (low A, low I) — concrete code that many modules depend on. It is rigid.
- **Zone of Uselessness** (high A, high I) — abstractions that nothing depends on.

Two principles govern the metrics. The Stable Dependencies Principle says to depend in the direction of stability. The Stable Abstractions Principle says a stable package should be abstract.

## Martin metrics applied to Sliced Bread crusts

A crust is the stable seam of a slice, so it should show high Ca and low I. Martin's A fits a facade crust poorly, because a facade is concrete, not abstract. ArchUnit already redefines A to count public classes, which is closer to a crust surface count.

## Tools that compute the Martin metrics

| Tool                                  | Language   | Computes                                                                        | Status (2026-10-19)                 | Evidence                                                                                                                                   |
| ------------------------------------- | ---------- | ------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| ArchUnit `ComponentDependencyMetrics` | Java       | Ca Ce I A D (normalized D), plus Lakos CCD/ACD/RACD/NCCD and visibility metrics | v1.5.1, released 2026-09-25         | [ArchUnit user guide §8.7](https://www.archunit.org/userguide/html/000_Index.html)                                                         |
| PDepend                               | PHP        | Ca Ce I A D, plus an abstraction-instability chart                              | v3.0.0, 2026-10-01                  | [PDepend A-I chart docs](https://pdepend.org/documentation/handbook/reports/abstraction-instability-chart.html)                            |
| pyscn                                 | Python     | Ca Ce I A D per module; main-sequence threshold 0.2, zone threshold 0.5         | v1.32.5, 2026-10-15                 | [pyscn](https://github.com/ludo-technologies/pyscn) `internal/analyzer/coupling_metrics.go` (PR 407, merged 2026-05-05); not in the README |
| ArchUnitTS                            | TypeScript | abstractness, instability, distance, LCOM, cyclomatic complexity                | last push 2026-10-17                | README only                                                                                                                                |
| dependency-cruiser `--metrics`        | JS/TS      | Ca Ce I per folder and module                                                   | v18.6.0, 2026-10-11                 | [doc/cli.md](https://github.com/sverweij/dependency-cruiser/blob/main/doc/cli.md); A and D not found in the doc                            |
| JDepend                               | Java       | Ca Ce I A D                                                                     | release 2.10, 2020-03; unmaintained | [clarkware/jdepend](https://github.com/clarkware/jdepend)                                                                                  |
| Effrit                                | Go         | stability only                                                                  | 2019 blog post                      | [author blog](https://skarlso.github.io/2019/04/21/efferent-and-afferent-metrics-in-go)                                                    |
| cargo-coupling                        | Rust       | Khononov strength/distance/volatility; not Martin I/A/D                         | pushed 2026-10-13                   | [nwiizo/cargo-coupling](https://github.com/nwiizo/cargo-coupling)                                                                          |

dependency-cruiser maps Martin's components and classes to folders and modules. Its docs quote Martin's stability rule: a folder's instability should be larger than that of the folders it depends on.

## Agent skills for the Martin metrics

The `dependency-mapper` skill in [michaelalber/ai-toolkit](https://github.com/michaelalber/ai-toolkit) states the Ca/Ce/I/A/D formulas as LLM prompt text. It computes nothing. No skill or MCP server that runs a metric tool was found (one `gh search code` query).

## Related pages

- [[research/architecture-metrics-tooling/architecture-metrics-tooling]] — synthesis of this research.
- [[research/slice-spine-review-prior-art/literature]] — the original definition row and primary citation.

_Source: briesearch run `codified-architecture-metrics-tools-skills`; primary docs and source listed above · Updated: 2026-10-19_
