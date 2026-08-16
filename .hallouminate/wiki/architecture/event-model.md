# Event model

Cycle-breaking events must live in `domains/common/`. Placing the event in
the *emitting* slice's public API does not break the cycle — if `pricing`
must import `orders` for the event type while `orders` still imports
`pricing` for totals, the module-level cycle survives (an import-time hazard
in both Python and TypeScript barrels). Both slices import the event type
from the shared kernel instead, so neither imports the other.

## Why the emitting-slice option was removed

The doctrine originally offered two placements for a cycle-breaking event —
`common/events` *or* the emitting slice's public API — as if they were
equivalent. They are not: only the `common/` placement actually breaks the
cycle. Separately, following the doctrine's own event-usage rule immediately
triggered a premature-abstraction finding, because both the audit script and
review skill graded "an event bus with one event" as premature abstraction —
and the first cycle you break produces exactly one event plus dispatch
machinery. See ADR-002,
`docs/adr/sliced-bread-doctrine-revision-002.md` (read in full).

**Exemption:** a dispatcher introduced to break a real cross-slice cycle is
not premature abstraction, even with one event and one subscriber. This
exemption ships inside the canonical `growth-guards` block (see
[[architecture/doctrine-canonical-source]]), so every consumer carries it —
without the fix, the doctrine contradicted itself at the exact point a reader
first applied rule 5.

## Staged machinery — take the earliest stage that works

1. **Framework-native publisher.** If the framework ships one (Spring's
   `ApplicationEventPublisher`, for example), call it directly. The
   wrap-what-you-do-not-control rule is scoped to *external* dependencies; it
   does not extend to the framework's own event publisher (Spring
   Modulith's own reference code calls it directly — the only pro-wrapping
   source found in ADR-002's research was blog-tier).
2. **Domain publish port.** With no framework publisher, the domain defines a
   publish port and a minimal in-process dispatcher owned by `app/`
   implements it.
3. **Durable delivery.** Outbox records, retries, and delivery guarantees
   enter only once delivery leaves the process — not before. Whether
   in-process durability is warranted earlier than that is explicitly left
   open in ADR-002; sources disagree (kgrzybek writes an outbox record per
   event, microservices.io scopes the pattern strictly to the dual-write
   problem).

Framework-native publishers being stage one generalizes into a broader
principle — see [[architecture/framework-leaning]].

## Direct import vs. event: the rule of thumb

- **Direct import:** slice A needs data from slice B to do its work (orders
  imports pricing to calculate totals) — a natural dependency.
- **Event:** slice B needs to react to something slice A did, but slice A
  shouldn't know about slice B. If adding the import would create a cycle,
  use an event instead, and put the event type in `common/`.
