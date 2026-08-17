# ADR slice-and-spine-review-001: Spine = app/use_cases + composition root [status: accepted]

- **Context:** The slice-and-spine-review skill needed a code referent for "spine" — a term coined in this spec, appearing nowhere in prior doctrine. The referent determines what Phase 3 reviews and what the pull-up/push-down dispositions mean.
- **Decision:** Spine = the orchestration layer: `app/use_cases` plus the composition root (`app/bootstrap`).
- **Alternatives:** (a) Everything non-domain (app + entrypoints + adapter wiring) — rejected: entrypoints/adapters are thin by doctrine, most stops would be no-ops. (b) The steel threads (dynamic execution flows) — rejected: turns a layer review into per-thread tracing, session-costly.
- **Consequences:** Pull-up/push-down map directly onto the orchestration boundary (pull up = slice logic that belongs in a use case; push down = orchestration detail that belongs in a crust). Entrypoint/adapter incoherence is out of the walk unless a seam edge reaches it.
