# SlopCodeBench: Benchmarking How Coding Agents Degrade Over Long-Horizon Iterative Tasks

SprocketLab's arXiv paper (2603.24755, version 2, verified 2026-10-19) supports one claim: coding-agent code degrades structurally as agents extend their own solutions, and prompting does not stop it.
Canonical source: [SlopCodeBench: Benchmarking How Coding Agents Degrade Over Long-Horizon Iterative Tasks](https://arxiv.org/html/2603.24755)

## SlopCodeBench benchmark design

SlopCodeBench has 36 problems and 196 checkpoints. At each checkpoint the agent extends its own earlier solution against an evolving specification. No agent fully solves any problem end to end. The best agent passes 14.8% of checkpoints. The code is in [SprocketLab/slop-code-bench](https://github.com/SprocketLab/slop-code-bench) (MIT license, 257 stars, Python 3.12+ and Docker).

## SlopCodeBench quality metrics: erosion and verbosity

SlopCodeBench scores code quality with two metrics:

- **Structural erosion** — the share of total complexity mass held in functions with cyclomatic complexity (CC) above 10. The mass of a function is CC × √SLOC. The cutoff of 10 follows the bounds of the Radon analysis tool.
- **Verbosity** — the union of lines flagged by 137 AST-grep rules and duplicated clone lines, divided by total lines of code.

The repo README documents only a CLI. Whether the metrics are importable as a standalone library is unknown.

## SlopCodeBench findings

- Structural erosion rises in 77% of trajectories, and verbosity rises in 75.5%.
- Agent code is 2.3× more verbose and 2.0× more eroded than 473 open-source Python repositories.
- An anti-slop prompt improves initial quality, but "does not remove the iterative issues".

The cheez-wiki page `projects/code-quality-benchmarks.md` states erosion rose in "77–80%" of trajectories. Version 2 of the paper states 77%.

## Relevance to Sliced Bread

Erosion is a function-level concentration metric. It is a candidate signal for the hot-path arm of the depth check, where a crust holds the hot-path implementation. See [[research/architecture-metrics-tooling/architecture-metrics-tooling]].

_Source: <https://arxiv.org/html/2603.24755> · Updated: 2026-10-19_
