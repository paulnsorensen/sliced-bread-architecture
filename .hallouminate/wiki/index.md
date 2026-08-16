# sliced-bread-architecture

Reference repository for the Sliced Bread doctrine — a vertical-slice
architecture with organic growth — plus the agent skills, audit tooling, and
docs site that consume it.

## Conventions

- One wiki page per durable, ADR-backed decision — not per session or per
  file touched.
- [[architecture/doctrine-canonical-source]] governs how the doctrine text
  itself may be edited: `reference/sliced-bread.md` is the only place the
  arrows/severity/growth-guards blocks may change; every other consumer
  carries a verbatim copy, CI-checked for drift.

## Sections

- [[architecture/doctrine-canonical-source]] — why the doctrine has one
  canonical source and how drift across four copies is CI-checked, not
  regenerated
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
