# Audit tool testing

How `skills/sliced-bread-audit/sliced-bread-audit.js` is unit-tested and the
traps in its redaction, concurrency, and site-build seams.

## The script cannot be imported

The workflow script has a top-level `return` and reads harness globals
(`agent`, `log`, `phase`, `budget`, `parallel`, `args`). It stays a single
dependency-free file copied to `~/.claude/workflows/`. Tests therefore slice
the source between `// test-extract:begin <name>` and
`// test-extract:end <name>` sentinels and evaluate the slice with
`new Function`. The regions are `preamble`, `schemas`, `map`, `prompts`, and
`pipeline`. The harness `extract()` asserts that each marker occurs exactly
once on every build, so a reorder fails loudly instead of re-scoping the
system under test silently.

## Harness rules

- `auditBoundaryHarness(overrides)` accepts `DRY_RUN`, `MAX_ISSUES`,
  `MAX_CANDIDATES`, `WORKERS`, `MIN_SEVERITY`, and `SCOPE`. The
  `validateArgs` early return sits above the `preamble` region, so an invalid
  override no longer short-circuits the factory to `{ error }`.
- Any test that reaches `safeAgent` or `runBounded` sets `globalThis.agent`
  before it builds the harness and restores it in `t.after`.
- The top-level File-phase branches (no `gh`, dry run, duplicate-lookup
  failure) and the eval callback sit outside every region. They are verified
  by reading only.
- Prove a new assertion with a mutation: `verifyFindings` citation dedupe,
  the `selectIssueCandidates` early exit, and the `refuterBudget` decrement
  each have a test that fails when the guard is removed.

## Concurrency: one limiter, early release

Every `runBounded` draws from one `makeLimiter(WORKERS)` semaphore. The
evaluator callback nests a second fan-out (`verifyFindings` → refuters), which
deadlocks if the outer task holds its slot while it waits for inner slots. The
callback therefore calls the `release()` it receives right after the evaluator
leaf returns and before it enters `verifyFindings`. The citation call inside
`verifyFindings` is wrapped in `workerLimiter` so it stays bounded after that
release. Peak concurrency is `WORKERS`, not `WORKERS²`; the limiter test pins
this with a counting stub at `WORKERS: 1` and nested slices.

`refuterBudget` is a module-level counter that starts at `MAX_CANDIDATES` and
decrements synchronously before any `await`, so concurrent slices cannot
interleave past the cap. `MAX_SLICE_FINDINGS` is the separate per-slice
schema bound.

## Redaction gotchas

- `safeIssueText` redacts the whole string first and bounds once after. The
  earlier headroom pre-bound (`limit * 8`) severed a secret that straddled the
  cut into an unmatchable fragment. Redaction is linear after the bounded
  quantifiers (`{0,64}`, `{0,32}`), and `FINDINGS_SCHEMA` carries `maxLength`
  on every string field, so the pre-bound bought nothing.
- `secretValueEnd` treats `]` as a value terminator. A second `redactSecrets`
  pass over `TOKEN=[REDACTED]` therefore produced `[REDACTED]]`.
  `redactAssignedSecrets` skips a value that already starts with
  `[REDACTED]`; the idempotence test guards this.
- Unquoted values stop at whitespace, with one extra token after
  `Bearer`/`Basic`/`Token`. Unquoted values shorter than 8 characters are not
  redacted, which keeps `cache_key=user-42`, `sort_keys=true`, and
  `tokens=1500` intact. Quoted values redact regardless of length.
- `isSecretAssignmentKey` matches `SECRET_KEYWORDS` on token boundaries after
  camelCase and underscore normalization, plus unseparated spellings
  (`apikey`, `privatekey`, `pwd`, `passwd`). A substring match redacted
  `keyboard`, `author`, and `tokenizer`; the negative cases pin the rule.
- The redaction counter increments only inside the pattern replacers while
  `countingRedactions` is on, and only `sanitizeFindings` (the eval-phase pass)
  turns it on. Every later pass (`prepareForFiling`, `buildReport`) sees
  already-redacted text, so counting there always reads zero.
- Model-authored `file`/`slice` reach the report and logs only through
  `findingLocation(f)`; repo-derived text never reaches a sub-agent prompt in
  plaintext. `claim` and `evidence` travel inside the hex payload.

## Doctrine projections

The audit script projects `doctrine:arrows`, `doctrine:growth-guards`,
`doctrine:severity-cases`, and `doctrine:growth-cases`. It no longer carries
the legacy `doctrine:severity` table; the prompt grades against the
`severity-cases` matrix only. `scripts/check-contracts.mjs` lists the script's
legacy consumers accordingly. The `dry_run` sentence in the audit README and
the site skills page is a `doctrine:dry-run` contract block checked by
`checkDryRunSentence`.

## Site 404 test

`tests/site-404.test.mjs` runs a production Astro build without touching the
checkout. Astro derives its `.prerender` temp dir from `process.cwd()` and
renames it into `--outDir`, which fails with `EXDEV` across filesystems. The
test therefore runs with `cwd` set to a `mkdtemp` directory under
`os.tmpdir()`, passes `--root site`, and symlinks `site/node_modules` into the
temp tree so the prerendered SSR chunk can resolve its dependencies. Do not
delete or restore `site/.astro` or `node_modules` caches from a test.
