# ADR slice-and-spine-review-003: Fan-out over file+test pairs [status: accepted]

- **Context:** The prep fan-out needed a unit: per-file, per-slice, or per-seam. Prior-art research ([[research/slice-spine-review-prior-art/slice-spine-review-prior-art]]) found no existing tool that treats a file's tests as first-class behavior assertions — the genuinely novel layer.
- **Decision:** One subagent per file+test pair produces a FileDigest (including behavior_assertions | UNTESTED); rollups produce SliceDossiers; SeamDossiers derive from rollups.
- **Alternatives:** (a) Slice-level digests + per-seam agents (~10x cheaper) — rejected: loses per-file assertion coverage, weakening "humans look over all of the code". (b) Seam-first only — rejected: cheapest but reviews only the seams.
- **Consequences:** Highest fan-out cost (mitigated by scope argument); the assertion layer becomes extractable as a standalone building block (follow-up F003).
