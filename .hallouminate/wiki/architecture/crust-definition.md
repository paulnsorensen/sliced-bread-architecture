# Crust definition

A slice's crust is its public seam **in the language's native form** —
exported identifiers in Go, the package `__init__` surface in Python, an
index module in TypeScript, a public class surface elsewhere. It is not a
barrel file as such: Go has no barrels, and current TypeScript tooling
actively discourages them. The test is a surface test — can a consumer see a
small, obvious set of externally usable operations at the top level, with no
digging into internals and no hundred-symbol entry point?

## Why the definition moved off "barrel file"

The doctrine originally framed crust integrity around an index/barrel file
("the barrel file is the contract"). That framing is language-parochial: Go
has no barrel concept at all (the package *is* the crust), and the current
TypeScript ecosystem discourages barrel files for build-performance and
tree-shaking reasons — Next.js ships `optimizePackageImports` specifically to
mitigate them. See ADR-003,
`docs/adr/sliced-bread-doctrine-revision-003.md` (read in full).

## The positional crust, for languages with no native visibility

Some languages have no native visibility mechanism at all — engine scripting
languages like GDScript expose every identifier in every file. For those, the
crust is **positional**: files sitting directly at the slice root are the
public seam, nested directories are internals, and an external checker
enforces what the language cannot. See ADR-005,
`docs/adr/sliced-bread-doctrine-revision-005.md` (read in full) — the first
production consumer to hit this gap (a Godot 4.7 project) derived the missing
form itself.

**Keep the checker mechanical.** The rule must stay "root is public, nested
is private" — never a per-slice allowlist of public filenames (e.g. a
`CRUST_SET` list). An allowlist reintroduces the exact ceremony organic
growth exists to avoid: growing a second public module then means editing CI
instead of just adding the file. ADR-005 records that the first real
consumer's own bridge implementation was such an allowlist, and that its
own follow-up spec exists specifically to delete it.

A single-file privacy subdirectory in a positional-visibility language is the
*visibility mechanism itself*, not growth structure — it is exempt from the
2+-concrete-uses growth check even with only one file inside. This exemption
lives in the shared `growth-guards` block; see
[[architecture/growth-signals-advisory]] and
[[architecture/doctrine-canonical-source]] for how that block stays in sync
across consumers.

## When to reach for hexagonal seams

Slices stay local and roughly DDD until application infrastructure actually
requires ports and adapters. Don't fit a slice with ports and adapters before
it talks to anything outside the process.
