---
title: Agent Skills
description: Distributable Claude Code skills and workflows for Sliced Bread codebases.
---

The [`skills/`](https://github.com/paulnsorensen/sliced-bread-architecture/tree/main/skills)
directory ships agent tooling that enforces the architecture:

<!-- skills:catalog:start -->

| Tool                     | Scope                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `sliced-bread-review`    | Bounded diff architecture review against the five Sliced Bread rules; reports findings without filing issues. |
| `sliced-bread-audit`     | Automated full-repository ten-dimension audit that verifies findings and files deduplicated GitHub issues.    |
| `sliced-bread-depth`     | Deep-module scoring that measures each slice's crust shape and implementation share.                          |
| `slice-and-spine-review` | Human-led whole-repository seam review that walks slices, spine, and integration seams with verdicts.         |

<!-- skills:catalog:end -->

## sliced-bread-review

A Claude Code skill that reviews a diff, PR, branch, or path against the five
checks — import direction, crust integrity, model purity, growth
justification, and event usage — and reports findings grouped by severity
with `file:line` citations.

```bash
cp -r skills/sliced-bread-review ~/.claude/skills/
```

## sliced-bread-audit

A multi-agent Workflow script for full-repo audits: it maps the slices, runs
one evaluator per slice plus a cross-slice dependency pass, verifies every
finding with a citation check and an adversarial refuter, then files
deduplicated GitHub issues.

```bash
cp skills/sliced-bread-audit/sliced-bread-audit.js ~/.claude/workflows/
```

Invoke with `/sliced-bread-audit [scope]`.

<!-- doctrine:dry-run:start -->

With `dry_run`, it performs the read-only duplicate lookup and returns the fresh-issue locations without creating labels or issues.

<!-- doctrine:dry-run:end -->

## sliced-bread-depth

A Claude Code skill that scores every slice as a deep module: it classifies
each crust's shape (thin facade, framework-bound, service/sim), measures the
implementation share (crust LOC ÷ slice total LOC), and recommends which
crusts to break down — extract, narrow, watch, healthy, or wide-by-intent.
Complements the other two: `sliced-bread-review` gates changes,
`sliced-bread-audit` sweeps rules, and `sliced-bread-depth` scores depth.

```bash
cp -r skills/sliced-bread-depth ~/.claude/skills/
```

## slice-and-spine-review

A human-led whole-repository coherence review. It inventories every slice and the spine, walks ranked integration seams with the human issuing a disposition at each stop, then checks the spine for orchestration drift.

```bash
cp -r skills/slice-and-spine-review ~/.claude/skills/
```
