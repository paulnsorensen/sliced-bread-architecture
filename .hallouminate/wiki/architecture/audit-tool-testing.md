# Audit tool testing

How `skills/sliced-bread-audit/sliced-bread-audit.js` is unit-tested and the
traps in its redaction and site-build seams.

## The script cannot be imported

The workflow script has a top-level `return` and reads harness globals
(`agent`, `log`, `phase`, `budget`, `parallel`, `args`). It stays a single
dependency-free file copied to `~/.claude/workflows/`. Tests therefore slice
the source between `// test-extract:begin <name>` and
`// test-extract:end <name>` sentinels and evaluate the slice with
`new Function`. The regions are `preamble`, `schemas`, `prompts`, and
`pipeline`. `tests/audit-boundaries.test.mjs` asserts that each marker occurs
exactly once, so a reorder fails loudly instead of re-scoping the system under
test silently.

## Harness rules

- `auditBoundaryHarness(overrides)` accepts `DRY_RUN`, `MAX_ISSUES`,
  `MAX_CANDIDATES`, `WORKERS`, and `MIN_SEVERITY`. Keep
  `MAX_CANDIDATES >= MAX_ISSUES`; otherwise `validateArgs` short-circuits the
  factory to `{ error }` and every export is undefined.
- Any test that reaches `safeAgent` or `runBounded` sets `globalThis.agent`
  before it builds the harness. The stub receives the prompt and schema and
  returns the citation, refuter, or lookup result.
- The top-level File-phase branches (no `gh`, dry run, duplicate-lookup
  failure) sit outside every region. They are verified by reading only.

## Redaction gotchas

- `secretValueEnd` treats `]` as a value terminator. A second `redactSecrets`
  pass over `TOKEN=[REDACTED]` therefore produced `[REDACTED]]`.
  `redactAssignedSecrets` now skips a value that already starts with
  `[REDACTED]`; the idempotence test guards this.
- The assignment and URL-scheme regexes carry bounded quantifiers (`{0,64}`,
  `{0,32}`). Unbounded classes backtracked quadratically on unbroken base64
  runs (64 KB took 3.4 s). `safeIssueText` also bounds the input to
  `limit * REDACTION_HEADROOM_FACTOR` before it redacts, so caps bound work,
  not only output.
- `isSecretAssignmentKey` matches `SECRET_KEYWORDS` on token boundaries after
  camelCase and underscore normalization. A substring match redacted
  `keyboard`, `author`, and `tokenizer`; the negative cases in the test pin
  the boundary rule.
- Repo-derived text never reaches a sub-agent prompt in plaintext. `claim`
  and `evidence` travel inside the hex payload with the structural fields.

## Site 404 test

`tests/site-404.test.mjs` runs a production Astro build without touching the
checkout. Astro derives its `.prerender` temp dir from `process.cwd()` and
renames it into `--outDir`, which fails with `EXDEV` across filesystems. The
test therefore runs with `cwd` set to a `mkdtemp` directory under
`os.tmpdir()`, passes `--root site`, and symlinks `site/node_modules` into the
temp tree so the prerendered SSR chunk can resolve its dependencies. Do not
delete or restore `site/.astro` or `node_modules` caches from a test.
