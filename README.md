# Sliced Bread Architecture

Vertical-slice architecture with organic growth: group code by business
concept, let structure emerge from pressure, and keep every dependency arrow
pointing inward.

Docs site: <https://cheeselord.dev/sliced-bread-architecture/>

```text
app/       →  domains/*  →  domains/common/
adapters/  →  domains/*
```

## What's here

| Path         | Contents                                                       |
| ------------ | -------------------------------------------------------------- |
| `reference/` | The architecture reference — rationale, anti-patterns, rubrics |
| `skills/`    | Distributable agent skills and workflows for review and audit  |
| `site/`      | The documentation website (Astro Starlight)                    |

## The five rules

1. **Import direction** — all arrows point toward domains.
2. **Crust integrity** — consumers import from a slice's public index only.
3. **Model purity** — domain code imports stdlib, `common/`, and sibling
   public APIs; infrastructure hides behind ports.
4. **Growth justification** — every directory and abstraction has 2+
   concrete uses.
5. **Event usage** — events resolve reverse dependencies, not general
   messaging.

Start with [`reference/sliced-bread.md`](reference/sliced-bread.md).

## Development

The website lives in `site/`:

```bash
cd site && npm install && npm run dev
```

PRs are gated by Prettier, markdownlint, and a site build — see
`.github/workflows/`.
