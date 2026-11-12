# Reflexion models and DSMs — conformance tools for slice boundaries

Reflexion models and dependency structure matrices (DSMs) compare intended architecture with actual dependencies. Modern linters implement the divergence half as forbidden-edge rules. Only `tach check --exact` reports the absence half.

## Reflexion model triple

Murphy and Notkin's reflexion model (1995) has three inputs: a declared high-level model, a mapping from source files to model boxes, and the extracted source dependencies. The tool classifies each edge:

- **Convergence** — the edge is declared and present.
- **Divergence** — the edge is present but not declared. This is a violation.
- **Absence** — the edge is declared but not present. The model is stale or wrong.

## Dependency structure matrix

A DSM is a square module-by-module grid in which each cell marks a dependency. When rows follow layer order, cells above the diagonal are back-edges, and cycles appear as blocks. A DSM is the visual form of a conformance check.

## Conformance tool capabilities for Sliced Bread checks

Capabilities from primary docs read on 2026-10-19 (y = yes, partial, ? = not read):

| Tool                                                                                  | Crust-only imports                         | Layer direction          | Sibling independence / cycles                    | DSM or graph output                  | Absence / unused rule                            |
| ------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------ | ------------------------------------------------ | ------------------------------------ | ------------------------------------------------ |
| [import-linter](https://github.com/seddonym/import-linter) (Python)                   | partial: `protected` allow-lists importers | y: `layers`              | y: `independence`, `acyclic_siblings`            | ?                                    | partial: unmatched `ignore_imports` alert        |
| [tach](https://github.com/gauge-sh/tach) (Python, v0.35.3)                            | y: `[[interfaces]] expose`                 | ?                        | partial: `depends_on` allow-list                 | y: `show`, `map`, `report`           | **y: `tach check --exact`**                      |
| [dependency-cruiser](https://github.com/sverweij/dependency-cruiser) (JS/TS, v18.6.0) | partial: path regex rules                  | partial: path rules      | y: `circular`, `reachable`                       | y: dot, mermaid, d2, csv/html matrix | partial: `required`, `orphan`, `reachable:false` |
| [ArchUnit](https://www.archunit.org/userguide/html/000_Index.html) (Java, v1.5.1)     | y: custom conditions                       | y: `layeredArchitecture` | y: `slices().matching(..)` with `beFreeOfCycles` | partial: metrics only                | partial: `adhereToPlantUmlDiagram`               |

import-linter has five contract types: forbidden, protected, layers, independence, and acyclic_siblings. Its `protected` type allow-lists importers. It is not an "expose only X" rule.

`tach check --exact` raises an error when `tach.toml` declares a dependency that the code does not use. This is the only reflexion-absence check found in this run.

ArchUnit `adhereToPlantUmlDiagram` checks code against a declared component diagram. Whether it reports declared-but-unused edges is not confirmed.

## Commercial DSM and reflexion tools

- **NDepend** (.NET) has a Dependency Matrix with HTML, Excel, and PNG export, plus the CQLinq rule engine.
- **Lattix** uses a DSM as its main view, with layering and independent-component algorithms.
- **Axivion** (Qt Group; spin-off of the Bauhaus research project) checks code against an architecture model in PlantUML or Python.

The NDepend, Lattix, and Axivion pages read do not use the words convergence, divergence, or absence.

## Not covered

eslint-plugin-boundaries (the doc read was a stub), deptrac, go-arch-lint, Sonargraph, jQAssistant capabilities, and jRMTool were not checked. No agent skill or MCP server for architecture conformance was found. The searches found only project-local skills that call import-linter (PostHog, usethis).

## Related pages

- [[research/architecture-metrics-tooling/architecture-metrics-tooling]] — synthesis of this research.
- [[research/slice-spine-review-prior-art/literature]] — reflexion model and DSM definitions with primary citations.
- [[architecture/crust-definition]] — the seam that crust-only import rules protect.

_Source: briesearch run `codified-architecture-metrics-tools-skills`; tool docs listed above · Updated: 2026-10-19_
