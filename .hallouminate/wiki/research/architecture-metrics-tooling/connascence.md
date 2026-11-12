# Connascence — forms, axes, and tools that detect it

Connascence is a coupling taxonomy: two parts are connascent when a change to one forces a change to the other. Two CLIs and two Claude skills detect it. All four are new, with 0–3 GitHub stars and no releases.

## Connascence forms

Meilir Page-Jones defined connascence in 1992, and Jim Weirich popularized it. [connascence.io](https://connascence.io/) lists nine forms.

Static forms are visible in source code:

- **Name** — parts must agree on a name.
- **Type** — parts must agree on a type.
- **Meaning** (convention) — parts must agree on the meaning of a value, such as a magic number.
- **Position** — parts must agree on an order, such as argument order.
- **Algorithm** — parts must use the same algorithm, such as the same hash.

Dynamic forms are visible only at runtime:

- **Execution order** — calls must happen in a set order.
- **Timing** — calls must happen within a time window.
- **Value** — values must change together.
- **Identity** — parts must reference the same instance.

The list runs from weakest (Name) to strongest (Identity), per the in8finity skill's ordering.

## Connascence axes: strength, degree, locality

connascence.io evaluates each instance of connascence on three axes:

- **Strength** — stronger connascence is harder to discover or refactor.
- **Degree** — an entity connascent with many others is a bigger issue than one connascent with a few.
- **Locality** — connascent elements close together are better than elements far apart.

The working rule is: keep strong connascence local, and let only weak connascence cross a boundary. Refactoring reduces strength, reduces degree, or increases locality. For Sliced Bread, this means only name- and type-level connascence should cross a crust.

## Tools and skills that detect connascence

| Tool                                                                                                        | Kind                                     | Forms                                        | Notes                                                                                                                                                                                           | Last push  |
| ----------------------------------------------------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| [kegesch/connascence](https://github.com/kegesch/connascence)                                               | TS/JS CLI                                | 7 (no Execution, no Timing)                  | Scores strength 1–9, degree, locality. JSON/HTML/SARIF output. Threshold flags exit 1 for CI. `diff` reports only new coupling between git refs. `--format=agent` output. Language-agnostic IR. | 2026-09-22 |
| [DNYoussef/connascence-safety-analyzer](https://github.com/DNYoussef/connascence-safety-analyzer)           | Python CLI (PyPI `connascence-analyzer`) | claims all 9                                 | SARIF, VSCode extension, MCP server with CLI fallback. Bundles unrelated analyzers.                                                                                                             | 2026-08-29 |
| [in8finity/connascence](https://github.com/in8finity/connascence)                                           | Claude Code skill                        | 9                                            | Adapters emit a TraceDoc; severity = strength × degree × locality. Static forms from a call graph; dynamic forms need a runtime trace. Algorithm detector is provisional.                       | 2026-06-07 |
| [johncoleman-thoughtworks/connascence-skill](https://github.com/johncoleman-thoughtworks/connascence-skill) | Claude Code / Agent SDK skill            | 7 (leaves Name and Type to the type checker) | LLM review. Reports a finding only when strong connascence crosses a boundary.                                                                                                                  | 2026-08-04 |

All capability claims come from READMEs. No detector was run or checked against code.

## Not found

A `gh search repos connascence` query and one Tavily query found no ESLint, Ruff, Pylint, or crates.io connascence linter. PyPI, npm, and academic papers were not searched directly.

## Related pages

- [[research/architecture-metrics-tooling/architecture-metrics-tooling]] — synthesis of this research.
- [[research/slice-spine-review-prior-art/literature]] — connascence as seam-repair vocabulary.

_Source: briesearch run `codified-architecture-metrics-tools-skills`; connascence.io and tool READMEs listed above · Updated: 2026-10-19_
