# Doctrine canonical source

`reference/sliced-bread.md` remains the human doctrine authority.
`reference/doctrine-contracts.json` is the canonical executable representation
of the approved severity and growth scenarios: IDs, conditions, first-match
order, outcomes, and rationales. Neither representation may silently override
the other.

Authored consumers carry checker-rendered `doctrine:severity-cases` and
`doctrine:growth-cases` tables. Change a scenario in both authorities in the
same commit, copy the rendered table byte-for-byte to every declared consumer,
and run `node scripts/check-contracts.mjs`.

## Why the authority is split

The doctrine used to live in hand-maintained prose copies with no executable
case contract. Two consumers had already diverged on model-purity severity, and
one had invented a growth violation that other consumers suppressed. Markdown
is still the right place for rationale and architectural meaning; JSON makes
the finite cases, precedence, and outcomes mechanically comparable without
turning prose into generated output.

This is intentionally check-only. `scripts/check-contracts.mjs` does not
rewrite doctrine or consumers. A generator would make JSON the de facto prose
authority and hide reviewable authored changes.

## Enforced surfaces

The dependency-free checker fails closed when a declared file or marker block
is missing, malformed, or divergent. It verifies:

- the strict `doctrine-contracts.v1` schema and ordered case IDs;
- rendered severity tables in the canonical and published references, bounded
  review, and automated audit;
- rendered growth tables in both references, bounded review, automated audit,
  and depth scoring;
- the retained prose blocks for arrows, severity guidance, and growth guards;
- exact four-tool parity between the local and published skill catalogs;
- pressure-first README and site growth summaries, including both canonical
  exceptions;
- the combined audit's ten dimensions and architecture/quality labels; and
- accepted ADR lifecycle metadata plus non-empty Confirmation and References.

CI runs both the checker and its fixture-backed Node suite. The suite executes
the CLI against isolated repository trees so missing consumers and invalid
contracts cannot be mistaken for an optional local configuration.

## Gotchas

- **Marker tables are authored outputs, not a second decision source.** Runtime
  guidance should point to the checked table instead of restating outcomes in
  nearby prose.
- **Missing consumers fail.** The previous checker skipped absent files and
  silently reduced coverage; `scripts/check-contracts.mjs` rejects them.
- **Keep marker bodies Prettier-stable.** Verbatim comparison is deliberate.
  Format affected JS/Markdown consumers before running the checker.
- **Catalog scope is semantic.** Both catalogs must contain exactly bounded
  review, automated audit, depth scoring, and human-led slice-and-spine review,
  with descriptions that distinguish their scopes.

See also [[architecture/growth-signals-advisory]] for the rationale behind the
growth cases.
