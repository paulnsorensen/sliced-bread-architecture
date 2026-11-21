# Crust presentation for deep modules — research (master synthesis)

Date: 2026-08-20. Question: how should a crust present a truly deep module so behavior (operations) reads clearly — per the doctrine itself, Ousterhout (APOSD), and Python `__init__`/`__all__` conventions? Triggering case: the football repo's `domains/forecasting/__init__.py`, a 27-name alphabetical `__all__` that hides the one operation (`OpponentForecaster`) among dataclasses; imported from `~/Dev/football/.cheese/research/deep-module-crust-presentation/`.

## Verdict

The doctrine grades public-surface size and its depth skill already says "group and narrow the surface," but nowhere prescribes a _presentation form_ for the crust — how operations are distinguished from the currencies they consume and return. APOSD supplies the principle (interface cost = everything a caller must learn, formal + informal; interface comments are the sanctioned vehicle for the informal part) but no ordering/grouping guidance (scoped absence across 9 sources). The Python ecosystem has three observed forms, none doctrine-blessed: small-flat alphabetical `__all__` (httpx, attrs), no-`__all__` pure `X as X` re-exports with a small surface (fastapi, ~19 names, supporting types off the top level), and large comment-sectioned `__all__` with Ruff's RUF022 opted out (pydantic, ~150 names). Grouping an `__all__` fights RUF022 permanently — it cannot preserve sections (astral-sh/ruff#20952 open, unimplemented) — which favors the `X as X` form when grouping is wanted.

## Local prior art (this repo)

- `reference/sliced-bread.md:160-168` + [[architecture/crust-definition]] — the surface test counts "externally usable **operations** at the top level… no hundred-symbol entry point." Operations are the unit of the test; the doctrine never says how to make them visually primary.
- `reference/sliced-bread.md:52-54` (ADR-003) — graded axes: implementation share, public-surface size, lifetime mixing.
- `skills/sliced-bread-depth/SKILL.md:74-76,102` — "a wide crust over thirty deep modules has an API-clustering problem — **group and narrow** the surface"; `narrow` verdict = "depth exists; cluster and shrink the public surface." Measurement is by LOC ratio (crust LOC ÷ slice LOC) plus an approximate public-surface count — size proxies, not behavior-vs-currency composition.
- `skills/sliced-bread-depth/SKILL.md:77-78` — "respect documented intent": a crust docstring declaring its surface intentional gets a soft-no. A start-here docstring already has standing; no format is specified.
- Gaps (absence, scope: `reference/`, `docs/adr/`, `.hallouminate/wiki/architecture/`): no crust presentation form; no single-file "how to use this crust" documentation convention; no "delivery crust" concept — consumer repos (football `AGENTS.md`) have drifted into using "crust" for the delivery layer.

## Cross-source synthesis

**Ousterhout / APOSD ([ousterhout.md](ousterhout.md))** — deep module = functionality per unit of interface cost; cost includes the informal interface (everything a caller must know), so a legibility pass is a depth improvement with zero capability change. Fewer exported names is a _symptom_ of a more general-purpose interface, never the goal. "Overexposure" (forcing callers to confront rarely-used surface) is the case for keeping leaf/supporting types off the seam — likely genuine but only secondary-sourced. Interface comments outrank all other comments; no APOSD content found on ordering/grouping of interface elements. Confidence: moderate — primary text inaccessible; core claims corroborated across 3+ independent summaries plus an Ousterhout interview transcript.

**Python conventions and exemplars ([python-surface-conventions.md](python-surface-conventions.md))** — PEP 8: `__all__` declares the public API; leading underscore = internal (files too — httpx underscore-prefixes _every_ implementation module). Typing spec blesses `import X as X` as explicit re-export. RUF022 enforces flat isort-style order and cannot preserve comment-delimited sections (fix merely becomes "unsafe"; grouping requires `noqa` per line or dropping `RUF`); pydantic simply omits `RUF` from its Ruff select. fastapi ships no `__all__` at all — role-groupable `X as X` imports, ~19 names, supporting types importable only from submodules. No primary authority found for a numeric surface-size rule (observed variance 19–150+). Confidence: certain — primary docs and raw source fetched directly.

## Implications proposed for this repo (decisions pending, not made here)

1. **Crust presentation form** — a doctrine statement (ADR candidate) that the crust should present behavior first: operations visually and structurally primary, currencies subordinate, supporting/leaf types off the seam when consumers don't use them. In Python the `X as X` no-`__all__` form allows role grouping without a permanent RUF022 exemption.
2. **Single-file crust documentation style** — a structured start-here convention (module docstring + role-grouped exports: operations / ports / config / currencies) that both humans and tools can read. If machine-parseable, it lets `sliced-bread-depth` measure depth-vs-width by surface composition (behavior vs currency counts) instead of LOC-ratio proxies.
3. **Terminology** — "crust" is defined only for slices; the delivery-layer usage in consumer repos needs a doctrine-level name or an explicit disambiguation.

## Open questions

1. Prescribe one presentation form per language, or state the principle (behavior-first, currencies subordinate) and list acceptable forms?
2. `X as X` costs: repetitive lines; star-import semantics change without `__all__`; no machine-readable surface list unless the doc convention supplies one.
3. APOSD ch. 9/13 unverified against primary text for member-ordering guidance; "Overexposure" definition unverified by extract.
4. polars `__init__.py` structure unverified (fetch 404).

## Provenance

Imported 2026-08-20 from `~/Dev/football/.cheese/research/deep-module-crust-presentation/` (briesearch; two researcher sub-agents + inline doctrine grounding). Sub-reports carry the claim tables and citations verbatim.
