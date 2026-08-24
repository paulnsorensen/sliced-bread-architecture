---
status: superseded
date: 2026-08-09
last_verified: 2026-08-24
superseded_by: ADR-006
---

### ADR-004: reference/sliced-bread.md is canonical for rules and severities; drift is CI-checked, not regenerated [status: accepted]

- **Superseded by:** ADR-006 retains one human authority while adding a checked executable projection.

- **Context:** The doctrine existed in four hand-maintained copies — the reference, its byte-identical site twin, the audit script's inlined `RUBRIC`, and the skills README table — with no symlink, no build step, and no drift check. Two had already diverged on the output that matters: model-purity carried three verdicts across `SKILL.md:58`, `SKILL.md:78`, and `sliced-bread-audit.js:74-77`, and the growth-justification false-positive guard existed in one copy only, so the audit filed issues the review skill explicitly said to suppress. Severity is the actionable output of both tools — it gates a PR in one and gates issue filing in the other, where `MIN_SEVERITY` defaults to `medium`. The repo's own baseline review recommended making `SKILL.md`'s severity table canonical.
- **Decision:** `reference/sliced-bread.md` is canonical for the rules **and** their severities. Three blocks in it — the dependency arrows, the severity table, and the growth-justification guards — are fenced with HTML-comment markers, and every other consumer carries those blocks verbatim. A dependency-free Node script asserts the copies match and fails CI on divergence. The guard is check-only: no `--fix` or regeneration mode. Model-purity resolves to medium, escalating to blocker only when the infrastructure call executes at import time, with the qualifier carried inside the table row so the table alone cannot over-grade.
- **Alternatives:** (a) The baseline's split authority — reference owns rules, `SKILL.md` owns severity — rejected: it leaves two files that must agree and already do not, and parking severity in one of two skills makes the other skill a second-class consumer. (b) A machine-readable `rules.yml` generating every copy — structurally kills drift, but adds build machinery to a docs repo for three consumers, against the YAGNI rule the doctrine itself preaches. (c) CI diff only, no canonical restructuring — catches drift without ever preventing it, and does not resolve which of three model-purity verdicts is correct. (d) A `--fix` regeneration mode on the same script — deferred as speculative for three consumers; revisit if hand-syncing proves painful.
- **Consequences:** A rule can no longer change in one place and silently rot in three; the repo whose product is a rule set stops shipping contradictory copies. Cost: the marker-fenced blocks must be plain ASCII and Prettier-stable, since they are embedded verbatim inside a Prettier-formatted JS string array, and a Prettier reformat of that array would otherwise trip the check. Absent consumer files are skipped rather than failed, so the check passes on `main` while the depth skill lives only on the PR #17 branch — the cost being that a deleted consumer degrades silently.

## Confirmation

- `reference/sliced-bread.md` identifies itself as the canonical source and carries the marker-fenced severity and growth blocks consumed by the other copies.
- `scripts/check-contracts.mjs` loads `reference/doctrine-contracts.json`, renders the expected case blocks, and checks the listed reference, site, review, audit, and depth consumers plus the public catalog; `.github/workflows/lint.yml` runs `node scripts/check-contracts.mjs`.

## References

- `reference/doctrine-contracts.json` — executable severity and growth case authority.
- `scripts/check-contracts.mjs` — lossless consumer, catalog, summary, and ADR contract checker.
- `.github/workflows/lint.yml` — CI wiring for the contract checker and its tests.
