# sliced-bread-audit

Deep slice-by-slice audit of a Sliced Bread codebase, packaged as a Claude
Code **workflow script** (not a `SKILL.md` skill — it orchestrates a
multi-agent fan-out via the Workflow tool).

What it does:

1. **Map** — discover slices; in parallel, validate GitHub access and ensure audit labels.
2. **Evaluate** — one evaluator agent per slice plus a concurrent cross-slice dependency pass.
3. **Verify** — batch citation-check every finding, then run an adversarial refuter on blocker/high findings.
4. **File** — inspect at most `max_candidates` confirmed findings for duplicates, select at most `max_issues` fresh findings, and open labeled GitHub issues in batches.

## Install

Copy the script into your Claude Code workflows directory:

```bash
cp skills/sliced-bread-audit/sliced-bread-audit.js ~/.claude/workflows/
```

## Usage

```text
/sliced-bread-audit [scope]
```

Or with object args:

```text
{ scope?: string, min_severity?: 'blocker'|'high'|'medium'|'low',
  dry_run?: boolean, max_issues?: number, max_candidates?: number, workers?: number }
```

| Arg              | Default  | Accepted values                                                                                                     |
| ---------------- | -------- | ------------------------------------------------------------------------------------------------------------------- |
| `scope`          | `.`      | Any path string.                                                                                                    |
| `min_severity`   | `medium` | `blocker`, `high`, `medium`, or `low`. Findings below it are dropped, so `low` findings appear only when requested. |
| `dry_run`        | `false`  | `true` or `false`.                                                                                                  |
| `max_issues`     | `25`     | An integer from 1 to 100.                                                                                           |
| `max_candidates` | `100`    | An integer from 1 to 500, and at least `max_issues`.                                                                |
| `workers`        | `4`      | An integer from 1 to 16.                                                                                            |

An invalid value returns `{ error: ... }` and the run stops before it starts any work.

Requires `gh` auth in the target repo. Findings return as one flat `confirmed` list; every record carries `area: architecture | quality`. The architecture rubric is inlined, so the workflow runs without reading external doctrine files.

<!-- doctrine:dry-run:start -->

With `dry_run`, it performs the read-only duplicate lookup and returns the fresh-issue locations without creating labels or issues.

<!-- doctrine:dry-run:end -->
