---
status: accepted
date: 2026-08-09
last_verified: 2026-08-20
---

### ADR-003: Crust is the language-native public seam; numeric growth thresholds are advisory [status: accepted]

- **Context:** The doctrine defined crust integrity in terms of an index/barrel file — "the barrel file is the contract". That framing is language-parochial: Go has no barrels (the package _is_ the crust), and the current TypeScript ecosystem actively discourages barrel files for build-performance and tree-shaking reasons, to the point that Next.js ships `optimizePackageImports` to mitigate them. Separately, `reference/sliced-bread.md:23-33` defined operational growth triggers (~200 lines, 3+ distinct concepts, 3+ clustered files) that neither tool implemented — both graded only "2+ concrete uses" — so the most checkable criteria in the doctrine were dead letters. PR #17 then declared a 250-line crust healthy when it constituted 100% of a pure-factory leaf slice, directly contradicting the ~200-line trigger.
- **Decision:** A slice's crust is its public seam in the language's native form — exported identifiers in Go, the package `__init__` surface in Python, an index module in TypeScript, a public class surface elsewhere. The test is a surface test: can a consumer see a small, obvious set of externally usable operations at the top level, with no digging into internals and no hundred-symbol entry point? Slices stay local and roughly DDD until application infrastructure requires the hexagonal seams. Numeric growth triggers become explicitly advisory — signals that prompt a look, never gradeable violations. What tools grade is implementation share, public-surface size, and lifetime mixing. PR #17's calibration therefore stands unchanged.
- **Alternatives:** (a) Make ~200 lines enforceable doctrine — would give the tools a crisp check, but grades length rather than depth and would fire on legitimately long leaf files; PR #17 would have had to bend its calibration to a number with no evidentiary basis. (b) Drop the numbers entirely — nothing to drift and nothing to enforce, but the concrete calibration is what makes the growth rule teachable. (c) Keep barrel-file framing and add per-language footnotes — pushes the parochialism into the footnotes rather than fixing the definition.
- **Consequences:** The crust rule now applies to Go and modern TypeScript without contortion, and the depth skill's ratio-based metric becomes the doctrine's measurement story rather than a competing one. Cost: a surface test is more judgement-dependent than a line count, so review findings under this rule need the ratio and the surface count cited as evidence, not asserted. The reference must say out loud that the numbers are advisory, or the next reader will re-derive the same contradiction.

## Confirmation

- `reference/sliced-bread.md` defines the crust as each language's native public seam and labels line-count, concept-count, and clustering thresholds advisory rather than gradeable.
- `skills/sliced-bread-depth/SKILL.md` measures implementation share and public-surface size directly; `skills/sliced-bread-review/SKILL.md` requires consumers to use the public seam rather than internals.

## References

- `reference/sliced-bread.md` — canonical crust and organic-growth rationale.
- `skills/sliced-bread-depth/SKILL.md` — ratio-based depth assessment and crust-shape scoring.
- `skills/sliced-bread-review/SKILL.md` — bounded public-seam review check.
