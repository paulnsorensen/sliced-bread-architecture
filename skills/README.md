# Agent Skills

Distributable Claude Code skills and workflows for working with Sliced Bread
codebases.

<!-- skills:catalog:start -->

| Tool                     | Scope                                         |
| ------------------------ | --------------------------------------------- |
| `slice-and-spine-review` | Human-led whole-repository coherence review   |
| `sliced-bread-audit`     | Automated full-repository ten-dimension audit |
| `sliced-bread-depth`     | Slice deep-module and crust-shape review      |
| `sliced-bread-review`    | Bounded diff architecture review              |

<!-- skills:catalog:end -->

## Installing a skill

```bash
cp -r skills/sliced-bread-review ~/.claude/skills/
```

Workflow scripts install into `~/.claude/workflows/` instead — see each
skill's README.
