# ADR slice-and-spine-review-002: Prep + guided seam-walk session [status: accepted]

- **Context:** The skill is defined by human-in-the-loop review; the shape of that participation drives coverage, cost, and anchoring risk.
- **Decision:** Subagent fan-out builds dossiers first; the session then walks seams in ranked order, the human interrogating freely at each stop and issuing the disposition.
- **Alternatives:** (a) Free-roam sidecar (human browses, agent answers ad hoc) — rejected as primary: coverage depends entirely on the human; retained inside each stop as free interrogation. (b) Pre-baked findings triage (accept/reject agent findings) — rejected: anchors the human on agent claims rather than code; prior art shows autonomous findings skew plausible-but-shallow.
- **Consequences:** Full recorded coverage with stop-anytime semantics; costs more human time per seam than triage.
