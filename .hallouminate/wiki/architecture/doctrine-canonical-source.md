# Doctrine canonical source

`reference/sliced-bread.md` is the sole authority for doctrine, including severity and growth outcomes. `reference/doctrine-contracts.json` names that file as its source and provides an executable projection of the finite ordered cases. JSON never overrides the reference.

Authored consumers carry checker-rendered `doctrine:severity-cases` and `doctrine:growth-cases` tables. Change the authoritative reference and its JSON projection in the same commit, copy the rendered table byte-for-byte to every declared consumer, and run `node scripts/check-contracts.mjs`.

## Why an executable projection exists

The doctrine used to rely only on prose copies. Consumers diverged on model-purity severity, and one invented a growth violation that other consumers suppressed. Exact case projections make IDs, order, outcomes, and rationales mechanically comparable while keeping architectural meaning and decision ownership in Markdown.

This is intentionally check-only. `scripts/check-contracts.mjs` does not rewrite doctrine or consumers. A generator would hide reviewable authored changes; split authority would recreate the ambiguity ADR-004 tried to remove. ADR-006 supersedes ADR-004 only where it rejected an executable projection.

## Enforced surfaces

The dependency-free checker fails closed when a declared file or marker block is missing, malformed, or divergent. It verifies:

- the generic `doctrine-contracts.v1` schema, source declaration, unique case IDs, ordered arrays, and outcome vocabularies;
- rendered severity tables in the canonical and published references, bounded review, and automated audit;
- rendered growth tables in those same four consumers;
- retained prose blocks for arrows, severity guidance, and growth guards;
- exact pressure-first growth-summary projections in the README and site index;
- catalog parity with the skill directories actually shipped; and
- ADR lifecycle metadata plus non-empty Confirmation and References.

CI runs the checker and its fixture-backed Node suite. The generated site 404 has a separate behavior gate.

## Gotchas

- **The reference owns decisions.** JSON is a projection, not a second authority.
- **Marker tables are authored outputs.** Runtime guidance points to them instead of restating outcomes nearby.
- **Missing consumers fail.** Deleting a consumer cannot silently reduce coverage.
- **Keep marker bodies Prettier-stable.** Verbatim comparison is deliberate.
- **Catalog membership is derived.** Adding a skill directory requires a matching catalog row on both surfaces.

See [[architecture/growth-signals-advisory]] for the pressure-first growth decision.
