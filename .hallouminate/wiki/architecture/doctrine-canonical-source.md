# Doctrine canonical source

`reference/sliced-bread.md` is the single canonical source for the doctrine's
rules **and** their severities. Three sections of it are wrapped in
HTML-comment markers — `<!-- doctrine:arrows:start/end -->`,
`doctrine:severity`, and `doctrine:growth-guards` — and every other place the
doctrine is restated must carry those blocks verbatim. Never hand-edit a copy;
edit the canonical file and let the blocks propagate.

## Why this exists

The doctrine used to live in four hand-maintained copies with no symlink, no
build step, and no drift check: the reference itself, its byte-identical site
twin, the audit script's inlined rubric, and the skills README table. Two had
already diverged on output that matters — model-purity carried three
different verdicts across the review skill and the audit script, and a
false-positive growth guard existed in only one copy, so the audit was filing
issues the review skill explicitly said to suppress (see ADR-004 in
`docs/adr/sliced-bread-doctrine-revision-004.md`, read in full).

A machine-readable `rules.yml` that generated every copy was considered and
rejected as build machinery the doctrine's own YAGNI principle argues
against, for only three consumers. The chosen shape is deliberately the
cheapest one that still prevents drift: one canonical file, verbatim copies,
and a checker.

## The checker

`scripts/check-doctrine-sync.mjs` (read in full) is dependency-free, runs in
CI, and is **check-only** — there is no `--fix` or regeneration mode, by
design (see ADR-004's alternatives). It currently tracks these consumers:

- `site/src/content/docs/reference/sliced-bread.md` (all three blocks)
- `skills/sliced-bread-review/SKILL.md` (all three blocks)
- `skills/sliced-bread-audit/sliced-bread-audit.js` (all three blocks)
- `skills/sliced-bread-depth/SKILL.md` (`growth-guards` only)

## Gotchas

- **A missing consumer file is skipped, not failed.** The checker logs
  `skipped (not present)` for a file that doesn't exist rather than erroring.
  This means a consumer that gets deleted (or lives only on an unmerged
  branch) degrades the sync guarantee silently — `main` stays green with one
  fewer copy actually being checked. ADR-004 names this as an accepted cost,
  not an oversight.
- **The marker-fenced blocks must be plain ASCII and Prettier-stable.** They
  are embedded verbatim inside a Prettier-formatted JS string array in
  `sliced-bread-audit.js`. A Prettier reformat of that array is enough to trip
  the drift check even with no semantic change — so an edit to the canonical
  blocks should be followed by re-running Prettier on the consumer file
  before committing.
- If you're editing rule text or severities, the workflow is: edit
  `reference/sliced-bread.md` between the markers, copy the block verbatim
  into every listed consumer, then run the checker locally
  (`node scripts/check-doctrine-sync.mjs`) before opening a PR.

See also [[architecture/growth-signals-advisory]] for what's inside the
`growth-guards` block this mechanism protects.
