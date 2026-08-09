---
name: sliced-bread-depth
description: >-
  Score each slice of a Sliced Bread codebase as a deep module: classify its
  crust shape, measure where implementation mass sits relative to the crust,
  and recommend which crusts to break down. Use when the user asks "are our
  slices deep", "review the crusts", "which modules should we break down",
  "is this facade too fat", or after a compliance review passes but a slice
  still feels monolithic. Do NOT use for boundary compliance on a change set
  (sliced-bread-review) or a rule-violation sweep (sliced-bread-audit) — this
  skill measures depth, not compliance.
---

# Sliced Bread Depth

Score every slice as a deep module: a small, stable public surface hiding
substantial implementation. A slice can pass every boundary check while its
crust _is_ the implementation — a 900-line barrel over two trivial helpers is
compliant but shallow. The full rationale lives in
[`reference/sliced-bread.md`](../../reference/sliced-bread.md); this skill is
the measuring pass.

## Scope

Default to every slice in the repo. If the user names slices, measure only
those but still list the full inventory so ratios have context. Include
documented crust exceptions (e.g. a singleton that is the slice's seam) —
classify them; do not flag their existence.

## Step 1 — Inventory

Find each slice's crust (the index/barrel/public-API file) and classify its
shape:

| Shape           | Signature                                                              |
| --------------- | ---------------------------------------------------------------------- |
| Thin facade     | Re-exports, factories, catalogs; little or no logic of its own         |
| Framework-bound | The crust must subclass a framework base (scene node, view, component) |
| Service/sim     | The crust owns a hot loop or long-lived process (step, tick, dispatch) |

## Step 2 — Measure

Per slice, compute with code (not estimation):

- **Crust LOC** and **slice total LOC** — the key ratio is the
  **implementation share**: crust LOC ÷ slice total LOC.
- **Internal module count and LOC** — the deep layer the crust is hiding.
- **Public surface** — approximate count of exported/non-underscore
  functions, methods, and events/signals on the crust.
- **Lifetime mix** — whether the public surface mixes unrelated lifetimes
  (one-time setup vs per-frame/per-request vs UI wiring).

## Step 3 — Assess

Recommend breaking a crust down (extract internals — never add a second
public seam) when **both** hold:

- **(a)** the crust file holds the hot-path implementation, and
- **(b)** the deep layer is empty or thin (implementation share heavily
  crust-side), **or** the public surface mixes unrelated lifetimes.

Calibrations that keep the metric fair:

- **The ratio is the metric, not absolute LOC.** A 250-line crust that is
  100% of a pure-factory leaf slice is healthy; a 900-line crust holding 85%
  of its slice's mass is the smell.
- **Framework-bound crusts get a cohesion allowance.** Framework callbacks
  (lifecycle, physics, render) must live on the subclass; extraction targets
  are plain helper objects the crust owns, not a second barrel.
- **Many internal files is not a finding.** A wide crust over thirty deep
  modules has an API-clustering problem — group and narrow the surface — not
  a depth problem. Do not recommend splitting the slice.
- **Respect documented intent.** A crust whose docstring or comments declare
  its surface intentional gets a soft-no with the citation, not a finding.
- **Dual seams** (live singleton + pure-helper facade) are a
  clarify-don't-split: recommend documenting which seam owns what, not
  inventing a second crust.
- **Compare siblings.** Two slices implementing the same pattern with
  opposite depth (one delegates its hot loop, one inlines it) is the
  highest-confidence finding — the repo already contains the target shape.

## Verdicts

| Verdict | Meaning                                                           |
| ------- | ----------------------------------------------------------------- |
| extract | Both heuristic arms hold; peel internals out of the crust         |
| narrow  | Depth exists; cluster and shrink the public surface               |
| watch   | Trending fat but single-axis; revisit when the next feature lands |
| healthy | Depth where it belongs; no action                                 |
| intent  | Wide by documented design; soft-no with citation                  |

## Output

Report three sections, read-only — this skill never edits code:

1. **Catalog** — one table: slice, shape, crust LOC, internal modules,
   implementation share, public surface.
2. **Assessment** — one table: verdict per slice, ordered extract → narrow →
   watch, each with a one-line why citing `file:line`.
3. **Top 3 extractions by ROI** — concrete: what leaves the crust, where it
   goes, and the in-repo precedent to mirror if one exists. Prefer mechanical
   wins with existing precedent over speculative restructuring.

An all-healthy catalog is a valid outcome; never manufacture findings.
