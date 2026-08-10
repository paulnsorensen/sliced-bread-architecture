# Agent Skills

Distributable Claude Code skills and workflows for working with Sliced Bread
codebases.

| Skill                 | Kind            | Purpose                                            |
| --------------------- | --------------- | -------------------------------------------------- |
| `sliced-bread-review` | Skill           | Review a bounded change set against the five rules |
| `sliced-bread-audit`  | Workflow script | Multi-agent full-repo audit that files GH issues   |
| `sliced-bread-depth`  | Skill           | Score each slice as a deep module; flag fat crusts |

## Installing a skill

```bash
cp -r skills/sliced-bread-review ~/.claude/skills/
```

Workflow scripts install into `~/.claude/workflows/` instead — see each
skill's README.
