---
status: accepted
date: 2026-08-24
last_verified: 2026-08-24
supersedes: ADR-004
amends: ADR-003
---

### ADR-006: The reference owns executable projections; growth is pressure-first [status: accepted]

- **Context:** ADR-004 made `reference/sliced-bread.md` the single doctrine authority and rejected a machine-readable rules file because generated prose would create needless machinery. The later consistency work exposed a narrower need: finite severity and growth cases require stable IDs, first-match order, and outcomes that tools can compare exactly. At the same time, the 2+-consumer shorthand had hardened into a counting rule even though the architecture's stated principle is structure emerging from demonstrated pressure. Cycle-breaking dispatch and positional privacy already proved that pressure can exist before a second consumer.
- **Decision:** `reference/sliced-bread.md` remains the sole authority for rules, severities, and growth outcomes. `reference/doctrine-contracts.json` declares that reference as its source and acts only as an executable projection of the marked finite cases. The checker validates generic schema and exact rendered projections; it does not infer prose semantics or create a second authority. Growth is pressure-first: concrete pressure justifies structure, while two concrete consumers are the normal evidence threshold rather than a hard requirement. A one-consumer abstraction with no demonstrated pressure is medium. Named allow cases are canonical examples, not an exhaustive exception registry.
- **Alternatives:** (a) Split authority between Markdown and JSON — rejected because disagreement would have no principled winner. (b) Keep a hard 2+ rule with enumerated exceptions — rejected because every new form of concrete pressure would require ceremony before the architecture could express it. (c) Remove the executable projection — rejected because ordered outcomes would again drift across tools. (d) Generate all prose from JSON — rejected because JSON cannot carry the doctrine's architectural rationale and would hide authored review changes.
- **Consequences:** Case additions change the reference, JSON projection, and rendered consumer tables together. The checker stays small and generic rather than hardcoding every case ID. Reviewers must cite demonstrated pressure or its absence instead of treating a count as the conclusion. ADR-004 is superseded; ADR-003's numeric-signal decision remains, but its 2+-consumer interpretation is amended.

## Confirmation

- `reference/sliced-bread.md` states sole authority and contains the pressure-first summary plus ordered case tables.
- `reference/doctrine-contracts.json` declares `reference/sliced-bread.md` as `source`.
- `scripts/check-contracts.mjs` validates generic case data and exact projections without parsing prose semantics.
- `skills/sliced-bread-review/SKILL.md`, the audit rubric, README, site, and wiki use pressure-first language.

## References

- `docs/adr/sliced-bread-doctrine-revision-003.md` — advisory numeric signals and the amended growth interpretation.
- `docs/adr/sliced-bread-doctrine-revision-004.md` — superseded single-authority implementation decision.
- `reference/sliced-bread.md` — authoritative doctrine.
- `reference/doctrine-contracts.json` — executable case projection.
- `scripts/check-contracts.mjs` — projection and lifecycle checker.
