---
status: accepted
date: 2026-08-15
last_verified: 2026-08-20
---

### ADR-005: Positional crusts for languages without native visibility; lean into a loosely coupled framework [status: accepted]

- **Context:** Revision 003 defined the crust as the public seam "in the language's native form" and listed only forms from languages that have one — Go exports, the Python `__init__` surface, TypeScript index modules, public class surfaces. Engine scripting languages such as GDScript have no native visibility form at all: every identifier in every file is reachable, so the definition was silent exactly where a checker is most needed. The first production consumer in that position (tdbr, Godot 4.7) derived the missing form itself — root-of-slice files are public, nested directories are private, enforced by an external CI checker — but its bridge implementation was a per-slice allowlist (`CRUST_SET`) that reintroduced the ceremony organic growth exists to avoid: growing a second public module meant editing CI. Separately, revision 002 exempted a framework's own event publisher from wrap-what-you-do-not-control but said nothing about the other doctrine roles a framework natively hosts — entry points, composition, egress — leaving engine-hosted applications (scenes, signals, RPC, wire and render buffers) without a doctrinal reading, and the 2+-concrete-uses growth check graded a single-file privacy subdirectory as unjustified structure.
- **Decision:** The crust definition gains the positional form: in a language whose only privacy mechanism is file placement, the slice-root files are the public seam, nested directories are internals, and an external checker enforces the mechanical rule — root is public, nested is private — never a per-slice allowlist of public filenames. A new "Leaning Into the Framework" section generalizes revision 002: when the chosen framework natively supplies a doctrine role (entry points, composition root, event publisher, egress currencies), use the framework mechanism directly, provided the framework is itself loosely coupled and composition-first; a framework that is not stays behind adapters at the seam. The growth-guards block gains the matching guard: a privacy subdirectory in a positional-visibility language is the visibility mechanism, not growth structure, exempt from the 2+-concrete-uses check even with one file inside.
- **Alternatives:** (a) Sanction allowlists as the checker shape — precise, but every public-surface change becomes a CI edit, and tdbr's own follow-up spec (`folder-root-is-public`) exists to delete that ceremony; the doctrine should not canonize the bridge it is watching a consumer dismantle. (b) Treat engine egress — scenes, signals, buffers — as adapter-mediated infrastructure: forces wrapper objects around every signal connection and scene instantiation, the same premature abstraction revision 002 rejected for framework publishers. (c) Leave the growth guard implicit: the audit would keep filing findings against single-file privacy folders, the same dead-letter contradiction revision 003 removed for numeric thresholds.
- **Consequences:** The doctrine covers engine scripting languages without contortion, and a positional slice grows a public root module organically — add the file, the mechanical checker accepts it. Cost: with no language ceremony to slow accretion, "how many public root files should this slice carry" is pure judgement under the surface test, so reviews must watch root-file count the way they watch export count elsewhere. The growth-guards block changed, so every consumer copy moves in the same commit; `scripts/check-contracts.mjs` enforces it.

## Confirmation

- `reference/sliced-bread.md` defines positional visibility mechanically: files at the slice root are public, nested directories are private, and the privacy directory is exempt from the two-consumer growth check.
- `skills/sliced-bread-audit/sliced-bread-audit.js` carries that positional growth guard and the framework-native entrypoint, composition-root, event-publisher, and egress guidance; `scripts/check-contracts.mjs` checks the growth block across its declared consumers.

## References

- `reference/sliced-bread.md` — canonical positional-crust and framework-boundary rules.
- `skills/sliced-bread-audit/sliced-bread-audit.js` — executable positional-growth and framework guidance.
- `scripts/check-contracts.mjs` — declared-consumer parity check for the growth contract.
