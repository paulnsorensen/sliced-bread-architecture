# ADR slice-and-spine-review-006: Verdicts become session report + ADR wiki pages [status: accepted]

- **Context:** Session verdicts (pull-up / push-down / rethink-seam / healthy) are durable decisions; where they land determines whether future sessions re-derive them.
- **Decision:** Every stop logs to a session report under `.cheese/slice-and-spine/`; each consequential verdict also becomes an ADR-backed wiki page, per this wiki's one-page-per-durable-decision convention.
- **Alternatives:** (a) GitHub issues — rejected: `sliced-bread-audit` owns autonomous filing; duplicating that channel blurs ownership. (b) Session report only — rejected: machine-local file goes stale silently.
- **Consequences:** Verdict rationale is groundable cross-session; the ADR namespace question (decisions/ vs architecture/) resolves at first close-out.
