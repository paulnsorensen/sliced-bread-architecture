---
title: Agent Skills
description: Distributable Claude Code skills and workflows for Sliced Bread codebases.
---

The [`skills/`](https://github.com/paulnsorensen/sliced-bread-architecture/tree/main/skills)
directory ships agent tooling that enforces the architecture:

| Skill                 | Kind            | Purpose                                            |
| --------------------- | --------------- | -------------------------------------------------- |
| `sliced-bread-review` | Skill           | Review a bounded change set against the five rules |
| `sliced-bread-audit`  | Workflow script | Multi-agent full-repo audit that files GH issues   |

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

Invoke with `/sliced-bread-audit [scope]`; pass `{ dry_run: true }` to
preview without filing issues.
