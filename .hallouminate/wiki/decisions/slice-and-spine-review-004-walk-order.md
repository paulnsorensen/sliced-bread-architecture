# ADR slice-and-spine-review-004: Change-coupling-first walk order [status: accepted]

- **Context:** Seam stops must be ranked so a stopped-early session still covered the riskiest seams.
- **Decision:** Rank by change coupling — git co-change frequency across the boundary — with static fan-in (dependency graph) and sliced-bread-depth verdicts as tiebreakers; hot paths feed the composite. Formula stays tunable in-spec.
- **Alternatives:** (a) Static fan-in/size only — rejected as primary: misses seams quiet in structure but hot in change. (b) Depth verdicts first — rejected: couples this skill to running depth beforehand. (c) No ranking (human picks) — rejected as default; scope argument still allows it.
- **Consequences:** Requires git history depth; shallow clones degrade to fan-in ranking, and the skill must say so rather than fail. Evidence base: CodeScene's behavioral code analysis, per the prior-art survey.
