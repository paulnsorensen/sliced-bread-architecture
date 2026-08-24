# Agent Skills

Distributable Claude Code skills and workflows for working with Sliced Bread
codebases.

<!-- skills:catalog:start -->

| Tool                     | Scope                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `sliced-bread-review`    | Bounded diff architecture review against the five Sliced Bread rules; reports findings without filing issues. |
| `sliced-bread-audit`     | Automated full-repository ten-dimension audit that verifies findings and files deduplicated GitHub issues.    |
| `sliced-bread-depth`     | Deep-module scoring that measures each slice's crust shape and implementation share.                          |
| `slice-and-spine-review` | Human-led whole-repository seam review that walks slices, spine, and integration seams with verdicts.         |

<!-- skills:catalog:end -->

## Installing a skill

```bash
cp -r skills/sliced-bread-review ~/.claude/skills/
```

Workflow scripts install into `~/.claude/workflows/` instead — see each
skill's README.
