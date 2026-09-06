# Doctrine canonical source

`reference/sliced-bread.md` is the sole authority for doctrine, including severity and growth outcomes. `reference/doctrine-contracts.json` provides an executable projection of the finite ordered severity and growth cases. JSON never overrides the reference.

Authored consumers carry checker-rendered `doctrine:severity-cases` and `doctrine:growth-cases` tables, plus the legacy `doctrine:arrows`, `doctrine:severity`, `doctrine:growth-guards`, and `doctrine:growth-summary` blocks. Change the authoritative reference and its JSON projection in the same commit, copy the rendered table or changed block byte-for-byte to every declared consumer, and run `node scripts/check-contracts.mjs`.

## Why an executable projection exists

The doctrine used to rely only on prose copies. Consumers diverged on model-purity severity, and one invented a growth violation that other consumers suppressed. Exact case projections make IDs, order, outcomes, and rationales mechanically comparable while keeping architectural meaning and decision ownership in Markdown.

This is intentionally check-only. `scripts/check-contracts.mjs` does not rewrite doctrine or consumers.

## Enforced surfaces

The dependency-free checker fails closed when a declared file or marker block is missing, malformed, or divergent. It verifies:

- the contract's schema fields (`schema_version`), unique case IDs, ordered arrays, and outcome vocabularies;
- rendered severity and growth case tables across the reference, its site twin, the review skill, and the audit script;
- the legacy arrows, severity, and growth-guards blocks across those same consumers plus the depth skill's growth-guards copy;
- exact pressure-first growth-summary projections in the README, site index, and the reference's site twin;
- catalog parity between the skill directories actually shipped and the skills README and site catalog; and
- ADR lifecycle metadata (status, dates, supersession links) plus non-empty Confirmation and References sections.

CI runs `node scripts/check-contracts.mjs` and its fixture-backed Node suite on every pull request and push to `main`.

## Gotchas

- **The reference owns decisions.** JSON is a projection, not a second authority. When the reference's case block and the JSON render disagree, the checker reports `reference/doctrine-contracts.json … diverges from reference/sliced-bread.md`; every other consumer is compared against the reference block, never against the render.
- **Divergence errors name the first differing line.** Each message ends with `(expected: … | actual: …)`; there is no regeneration command, so fix the consumer by hand from that line.
- **Marker tables and blocks are authored outputs.** Runtime guidance points to them instead of restating outcomes nearby.
- **Missing consumers fail.** A declared consumer file that does not exist logs a missing-file error and the check exits non-zero; deleting a consumer cannot silently reduce coverage.
- **Keep marker bodies Prettier-stable.** Verbatim comparison is deliberate.
- **Catalog membership is derived.** Adding a skill directory requires a matching catalog row on both surfaces.
- **In a stacked PR, describe only the tooling on your own layer.** PR #35's ADR Confirmation sections described the contracts checker that lands in PR #36; on `main` between merges those citations dangle. The layer that adds a checker also owns the ADR and wiki sentences that cite it.

See [[architecture/growth-signals-advisory]] for the pressure-first growth decision.

## Provenance

ADR-004 (`docs/adr/sliced-bread-doctrine-revision-004.md`, superseded) first made the reference canonical, requiring byte-verbatim consumer copies with no executable check. ADR-006 (`docs/adr/sliced-bread-doctrine-revision-006.md`) supersedes it: the reference stays sole authority, and `reference/doctrine-contracts.json` adds the checked executable projection described above instead of relying on hand-verified verbatim copies alone. Read both in full for the alternatives considered.
