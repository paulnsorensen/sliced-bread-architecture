# Sliced Bread Architecture

Vertical-slice architecture with organic growth: group code by business
concept, let structure emerge from pressure, and keep every dependency arrow
pointing in a permitted direction.

Docs site: <https://cheeselord.dev/sliced-bread-architecture/>

```text
entrypoints/   →  app/  →  domains/*  →  domains/common/
app/bootstrap  →  adapters/          (composition root only)
adapters/      →  domains/*
```

## What's here

| Path         | Contents                                                       |
| ------------ | -------------------------------------------------------------- |
| `reference/` | The architecture reference — rationale, anti-patterns, rubrics |
| `skills/`    | Distributable agent skills and workflows for review and audit  |
| `site/`      | The documentation website (Astro Starlight)                    |

## The five rules

1. **Import direction** — every arrow points in a permitted direction; only the
   composition root imports concrete adapters, and nothing imports
   `entrypoints/`.
2. **Crust integrity** — external consumers use a slice's public seam in the
   language's native form, never its internals.
3. **Model purity** — domain code imports stdlib, `common/`, and sibling
   public APIs; infrastructure hides behind ports.
4. **Growth justification** — Add directories and abstractions only after demonstrated
   pressure; two concrete consumers are the normal threshold. A cycle-breaking event
   dispatcher and a one-file positional crust are canonical exceptions.
5. **Event usage** — events resolve reverse dependencies, not general
   messaging.

Start with [`reference/sliced-bread.md`](reference/sliced-bread.md).

## Development

The website lives in `site/`:

```bash
cd site && npm install && npm run dev
```

PRs are gated by Prettier, markdownlint, `node scripts/check-contracts.mjs`,
`node --test tests/check-contracts.test.mjs`, and the protected AC-7 site
behavior gate `python3 tests/cut_sliced_bread_consistency_contracts.py ac7-site-404`.
A bare site build does not replace this generated-404 behavior check; see
`.github/workflows/`.
Run the complete copy-paste validation sequence in
[`CONTRIBUTING.md`](CONTRIBUTING.md#validate-locally).
