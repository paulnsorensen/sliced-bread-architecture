# Doctrine canonical source

`reference/sliced-bread.md` is the sole authority for doctrine, including severity and growth outcomes. No executable projection overrides it.

Consumers carry the marker-fenced `doctrine:arrows`, `doctrine:severity`, `doctrine:growth-guards`, and `doctrine:growth-summary` blocks verbatim. Change the authoritative reference, copy the changed block byte-for-byte to every declared consumer, and run `node scripts/check-doctrine-sync.mjs`.

## Why a drift checker exists

The doctrine used to rely only on prose copies. Consumers diverged on model-purity severity, and one invented a growth violation that other consumers suppressed. Comparing marker-fenced blocks verbatim keeps the copies mechanically identical while keeping architectural meaning and decision ownership in Markdown.

This is intentionally check-only. `scripts/check-doctrine-sync.mjs` does not rewrite doctrine or consumers.

## Enforced surfaces

The dependency-free checker reads `reference/sliced-bread.md` as canonical and, for each declared consumer file that exists, compares its listed marker-fenced blocks against the canonical text byte-for-byte. It verifies:

- the canonical file's arrows, severity, growth-guards, and growth-summary blocks are each present exactly once and non-empty;
- every declared consumer's listed blocks match the canonical text verbatim;
- `.github/workflows/lint.yml` runs the checker on every pull request and push to `main`.

## Gotchas

- **The reference owns decisions.** No projection overrides it.
- **Marker blocks are authored outputs.** Runtime guidance points to them instead of restating outcomes nearby.
- **Missing consumers are skipped, not failed.** A declared consumer file that does not exist logs `skipped (not present)`; deleting a consumer does not fail the check.
- **Keep marker bodies Prettier-stable.** Verbatim comparison is deliberate.

See [[architecture/growth-signals-advisory]] for the pressure-first growth decision.
