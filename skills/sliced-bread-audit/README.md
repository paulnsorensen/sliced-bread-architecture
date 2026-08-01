# sliced-bread-audit

Deep slice-by-slice audit of a Sliced Bread codebase, packaged as a Claude
Code **workflow script** (not a `SKILL.md` skill — it orchestrates a
multi-agent fan-out via the Workflow tool).

What it does:

1. **Map** — discover slices; in parallel, set up GitHub labels and load
   existing audit issues.
2. **Evaluate** — one evaluator agent per slice plus a concurrent cross-slice
   dependency pass.
3. **Verify** — batch citation-check every finding, then an adversarial
   refuter on blocker/high findings.
4. **File** — dedupe against existing issues and open labeled GitHub issues
   in batches.

## Install

Copy the script into your Claude Code workflows directory:

```bash
cp sliced-bread-audit.js ~/.claude/workflows/
```

## Usage

```text
/sliced-bread-audit [scope]
```

Or with object args:

```text
{ scope?: string, min_severity?: 'blocker'|'high'|'medium'|'low',
  dry_run?: boolean, max_issues?: number, workers?: number }
```

Requires `gh` auth in the target repo. Pass `{ dry_run: true }` to preview
without filing issues. The architecture rubric is inlined in the script, so
it runs in any repo without external files.
