# sliced-bread-architecture

Reference repository for the Sliced Bread doctrine — a vertical-slice
architecture with organic growth — plus the agent skills, audit tooling, and
docs site that consume it.

## Conventions

- One wiki page per durable, ADR-backed decision — not per session or per
  file touched.
- [[architecture/doctrine-canonical-source]] governs how the doctrine text
  itself may be edited: the arrows/severity/growth-guards blocks originate
  in `reference/sliced-bread.md`; every consumer copy moves verbatim in the
  same commit, CI-checked for drift.
- `research/` holds imported prior-art research reports (briesearch
  output) — cited claim tables, one directory per research slug. Exempt
  from the one-page-per-decision rule; pages there are evidence, not
  decisions.

## Sections

- [[architecture/doctrine-canonical-source]] — why the reference is the sole doctrine authority and how its executable projection prevents consumer drift
- [[architecture/entrypoints-layer]] — why `entrypoints/` exists as a fourth
  layer and why only the composition root may import concrete adapters
- [[architecture/crust-definition]] — what a slice's public seam is,
  including the positional crust for languages with no native visibility
  mechanism
- [[architecture/event-model]] — why cycle-breaking events must live in
  `common/` and how event machinery is staged by how far delivery travels
- [[architecture/growth-signals-advisory]] — why the numeric growth
  thresholds are advisory signals, not gradeable violations
- [[architecture/framework-leaning]] — when a framework's own mechanism
  satisfies a doctrine role directly, instead of being wrapped
- [[research/slice-spine-review-prior-art/slice-spine-review-prior-art]] —
  prior-art survey for the slice-and-spine review aspect: no existing
  tool/OSS/methodology combines human-guided sessions, whole-repo scope,
  per-file+test fan-out, and seam-disposition verdicts; terms of art and
  claim tables in sub-reports
