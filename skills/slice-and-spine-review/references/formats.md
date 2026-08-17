# Artifact formats

Schemas every `slice-and-spine-review` subagent must conform to. All dossier
artifacts are markdown files with YAML frontmatter carrying the machine
fields, plus one `session.json` index per session. Field names below are
verbatim from the approved spec's interface sketches — do not rename them.

Every dossier's frontmatter carries two common fields beyond its own schema:

- `commit`: the full commit sha the dossier was built from (staleness guard —
  a session spanning edits can detect drift by diffing this against HEAD).
- `scope`: the generating scope (`slice names | seam ids | full`) passed to
  the invocation that produced this artifact. Additive operational field —
  not part of the spec's interface sketches; every other field name below
  is verbatim from those sketches.

Dossier files land under
`.cheese/slice-and-spine/<repo>/<date>/{digests,slices,seams,verdicts}/`,
one subdirectory per artifact kind.

## FileDigest

One per file+test pair (Phase 1 fan-out unit).

| Field                  | Type                 | Notes                                                                                                                            |
| ---------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `path`                 | string               | Repo-relative path to the source file.                                                                                           |
| `role`                 | string               | One of `crust`, `internal`, `spine`, `adapter`, `port`.                                                                          |
| `surface_exposed`      | string[]             | Identifiers this file exports for external use.                                                                                  |
| `surface_used`         | string[]             | Identifiers this file imports from elsewhere.                                                                                    |
| `behavior_assertions`  | string[] \| UNTESTED | Behavior claims the file's tests actually assert. A file with no tests carries the literal marker `UNTESTED`, not an empty list. |
| `duplication_suspects` | string[]             | Paths or symbols this file's logic appears to duplicate.                                                                         |

```markdown
---
path: domains/pricing/discount.py
role: internal
surface_exposed: [calculate_discount]
surface_used: [domains.common.Money]
behavior_assertions:
  - 'applies percentage discount and floors at zero'
  - 'rejects negative discount rates'
duplication_suspects: []
commit: 4f2a9c1e8b7d3f0a6c5e2d1b9a8f7e6d5c4b3a2f
scope: full
---

Digest notes go here as prose, if any.
```

## SliceDossier

Rollup of a slice's FileDigests.

| Field            | Type     | Notes                                                               |
| ---------------- | -------- | ------------------------------------------------------------------- |
| `slice`          | string   | Slice name (crust role, e.g. `pricing`).                            |
| `crust_surface`  | string[] | Union of `surface_exposed` across the slice's FileDigests.          |
| `internal_files` | string[] | Paths of non-crust files in the slice.                              |
| `assertion_map`  | object   | Map of `path -> behavior_assertions` (or `UNTESTED`) for the slice. |
| `mass`           | number   | Slice size signal (e.g. file count or line count) used in ranking.  |

```markdown
---
slice: pricing
crust_surface: [calculate_discount, price_catalog]
internal_files: [domains/pricing/discount.py, domains/pricing/catalog.py]
assertion_map:
  domains/pricing/discount.py:
    - 'applies percentage discount and floors at zero'
  domains/pricing/catalog.py: UNTESTED
mass: 2
commit: 4f2a9c1e8b7d3f0a6c5e2d1b9a8f7e6d5c4b3a2f
scope: full
---
```

## SeamDossier

Derived from the SliceDossier(s) on slice sides plus a bare identifier and
summary for non-slice (spine, adapter/port) sides, plus co-change and
hot-path evidence.

| Field                | Type     | Notes                                                                                                                                                                                                                         |
| -------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `seam_id`            | string   | `"A<->B"` — the two sides joined by `<->`.                                                                                                                                                                                    |
| `edge_kind`          | string   | One of `slice-slice`, `spine-slice`, `adapter-port`.                                                                                                                                                                          |
| `co_change`          | number   | Change-coupling score (co-change frequency across the boundary).                                                                                                                                                              |
| `fan_in`             | number   | Static fan-in count crossing the boundary.                                                                                                                                                                                    |
| `hot_paths_crossing` | string[] | Hot-path identifiers (from caller-graph code intelligence) that cross this seam.                                                                                                                                              |
| `both_sides`         | object   | `{ a: <SliceDossier ref \| bare id + summary>, b: <SliceDossier ref \| bare id + summary> }` — a non-slice side (spine, adapter/port) carries a bare identifier plus a one-line summary string instead of a SliceDossier ref. |
| `candidates`         | string[] | Files or symbols flagged as pull-up/push-down candidates at this seam.                                                                                                                                                        |

```markdown
---
seam_id: 'pricing<->checkout'
edge_kind: slice-slice
co_change: 0.62
fan_in: 3
hot_paths_crossing: [checkout.apply_discount]
both_sides:
  a: pricing
  b: checkout
candidates: [domains/checkout/pricing_helpers.py]
commit: 4f2a9c1e8b7d3f0a6c5e2d1b9a8f7e6d5c4b3a2f
scope: full
---
```

## LinkMatrix

Ordinal link-level taxonomy over slice pairs, rendered as a DSM-style matrix
in the session report.

| Field   | Type  | Notes                                                                       |
| ------- | ----- | --------------------------------------------------------------------------- |
| `pairs` | array | List of `{ a, b, level, evidence }` entries, one per slice pair considered. |

Each `pairs` entry:

| Field      | Type   | Notes                                                                       |
| ---------- | ------ | --------------------------------------------------------------------------- |
| `a`        | string | First slice name.                                                           |
| `b`        | string | Second slice name.                                                          |
| `level`    | string | One of `L0`, `L1`, `L2`, `L3`, `L4` (see levels below).                     |
| `evidence` | object | `{ imports, co_change, hot_paths }` — the numeric evidence backing `level`. |

Levels:

- `L0` — none: no detected relationship.
- `L1` — event-linked: connected only via a typed event, no direct import.
- `L2` — crust import: one slice imports the other's public seam.
- `L3` — multi-symbol import: crust import spanning multiple symbols.
- `L4` — co-change hot: high co-change score or crossing hot paths; no
  import requirement.

Every cell carries its numeric evidence — never assert a `level` without the
`evidence` object populated.

```markdown
---
pairs:
  - a: pricing
    b: checkout
    level: L4
    evidence:
      imports: 3
      co_change: 0.62
      hot_paths: 1
  - a: pricing
    b: inventory
    level: L1
    evidence:
      imports: 0
      co_change: 0.05
      hot_paths: 0
  - a: checkout
    b: inventory
    level: L2
    evidence:
      imports: 1
      co_change: 0.1
      hot_paths: 0
commit: 4f2a9c1e8b7d3f0a6c5e2d1b9a8f7e6d5c4b3a2f
scope: full
---
```

## Verdict

One per seam-walk stop or spine-review stop.

| Field         | Type     | Notes                                                                       |
| ------------- | -------- | --------------------------------------------------------------------------- |
| `seam_id`     | string   | The seam this verdict resolves (`"A<->B"`, or the spine stop's identifier). |
| `disposition` | string   | One of `pull-up`, `push-down`, `rethink-seam`, `healthy`.                   |
| `rationale`   | string   | The human's stated reasoning for the disposition.                           |
| `followups`   | string[] | Follow-up work items spawned by this verdict, if any.                       |

```markdown
---
seam_id: 'pricing<->checkout'
disposition: pull-up
rationale: >-
  Discount math duplicated in checkout should live in pricing's crust; both
  call sites already treat it as pricing's responsibility.
followups: ['pull discount calc into pricing.calculate_discount']
commit: 4f2a9c1e8b7d3f0a6c5e2d1b9a8f7e6d5c4b3a2f
scope: full
---
```

## Session report

Location: `.cheese/slice-and-spine/<repo>/<date>.md`.

Markdown (no required frontmatter schema beyond `commit` and `scope`)
containing:

- Stops walked, in ranked order.
- The verdict issued at each stop.
- The rendered link-level matrix (DSM-style table from `LinkMatrix.pairs`).
- Coverage: seams visited vs. total seams identified in Phase 0.

```markdown
---
commit: 4f2a9c1e8b7d3f0a6c5e2d1b9a8f7e6d5c4b3a2f
scope: full
---

# slice-and-spine-review — sliced-bread-architecture — 2026-08-17

## Stops

1. pricing<->checkout — pull-up

## Link-level matrix

|           | pricing | checkout | inventory |
| --------- | ------- | -------- | --------- |
| pricing   | —       | L4       | L1        |
| checkout  | L4      | —        | L2        |
| inventory | L1      | L2       | —         |

## Coverage

1 of 3 seams visited.
```

## session.json

The one JSON index for the session. Location:
`.cheese/slice-and-spine/<repo>/<date>.session.json`.

| Field         | Type     | Notes                                                                     |
| ------------- | -------- | ------------------------------------------------------------------------- |
| `commit`      | string   | Commit sha the session was built from.                                    |
| `scope`       | string   | Invocation scope (`slice names \| seam ids \| full`).                     |
| `walk_order`  | string[] | Seam ids in ranked walk order.                                            |
| `pointers`    | object   | Paths to the dossier files this session produced, keyed by artifact kind. |
| `seam_status` | object   | Map of `seam_id -> status` (`pending \| visited \| skipped`).             |

```json
{
  "commit": "4f2a9c1e8b7d3f0a6c5e2d1b9a8f7e6d5c4b3a2f",
  "scope": "full",
  "walk_order": ["pricing<->checkout", "checkout<->inventory"],
  "pointers": {
    "file_digests": [
      ".cheese/slice-and-spine/sliced-bread-architecture/2026-08-17/digests/domains-pricing-discount.md"
    ],
    "slice_dossiers": [
      ".cheese/slice-and-spine/sliced-bread-architecture/2026-08-17/slices/pricing.md"
    ],
    "seam_dossiers": [
      ".cheese/slice-and-spine/sliced-bread-architecture/2026-08-17/seams/pricing-checkout.md"
    ],
    "verdicts": [
      ".cheese/slice-and-spine/sliced-bread-architecture/2026-08-17/verdicts/pricing-checkout.md"
    ],
    "session_report": ".cheese/slice-and-spine/sliced-bread-architecture/2026-08-17.md"
  },
  "seam_status": {
    "pricing<->checkout": "visited",
    "checkout<->inventory": "pending"
  }
}
```
