# Sliced Bread Architecture — Rationale & Anti-Patterns

Supplement to the compact rules in the global agent instructions. Read this when
reviewing architecture decisions or planning new domain structure.

This file is the sole authority for the rules, severities, and growth outcomes. Every consumer must preserve the relevant marker-fenced blocks verbatim; no executable projection may override this reference.

## Why Vertical Slices?

Layered architecture (controllers → services → repositories) groups by technical role.
This means a single feature change touches every layer. Vertical slices group by
business concept — an `orders` change stays in `orders/`.

The tradeoff: cross-cutting concerns (auth, logging, caching) live in adapters or
middleware, not sprinkled across slices. If you're tempted to add auth logic inside
a domain slice, that's a signal it belongs in `app/` or `adapters/`.

## The Layers

- **`entrypoints/`** — driving adapters, one per medium (CLI, HTTP server, worker,
  scheduler). Each translates an outside trigger into a call on `app/`. Nothing
  imports `entrypoints/`.
- **`app/`** — use cases plus the composition root. Only the composition-root module
  (`app/bootstrap`, `main`) may import concrete adapters and inject them. A use case
  that imports an adapter is a violation.
- **`adapters/`** — driven adapters only: database, HTTP client, queue, filesystem.
  They implement ports the domain defines.
- **`domains/*`** — the slices. Business concepts, their models, and their ports.
- **`domains/common/`** — the shared kernel, written `common/` for short throughout
  this document: value types, cross-slice events, shared error types.

`entrypoints/` is the reference name for a role, not a mandated directory string.
Go's `cmd/` and .NET's `Web`/`API` projects satisfy it. The arrows in the
quick-check below describe permitted direction, not required directories — a repo
with no `entrypoints/` is not in violation.

## Why Organic Growth?

Pre-creating folders, abstract base classes, and registries without a concrete need is speculative architecture. It costs complexity now for flexibility that may never be needed. The growth pattern (one file → extract sibling → facade + folder) means structure emerges from actual pressure, not imagination.

**Advisory growth signals** — these prompt a look, never a graded violation:

- A file passes ~200 lines or holds 3+ distinct concepts → extract siblings
- 3+ related files cluster around a sub-concept → create subdirectory
- A file becomes an import hub for its children → it's now a facade

What tools grade instead is unsupported structure: a directory or abstraction with no demonstrated pressure. Tools also grade implementation share (crust size relative to slice size), public-surface size, and lifetime mixing.

**Not evidence of pressure:**

- "We might need this later"
- "This looks like it could be its own module"
- A single implementation created only because the pattern may be useful later

**Growth guards** — false positives to suppress when grading growth. Numeric thresholds remain advisory:

<!-- doctrine:growth-guards:start -->

- A single consumer does not by itself prove premature abstraction; grade whether concrete pressure exists. Two consumers are normal evidence, not a hard requirement.
- New single-file concepts that stayed single files are correct; do not flag them.
- A dispatcher introduced to break a cross-slice cycle is demonstrated pressure, even with one event and one subscriber.
- Numeric thresholds are advisory signals, not gradeable violations; grade implementation share, public-surface size, and lifetime mixing.
- In a language whose only privacy mechanism is file placement, a subdirectory marking its contents internal is demonstrated pressure for that visibility boundary, even with a single file inside.

<!-- doctrine:growth-guards:end -->

<!-- doctrine:growth-summary:start -->

Demonstrated pressure, not a numeric count, justifies new directories and abstractions. Two concrete consumers are the normal evidence threshold, not a hard requirement. A cycle-breaking event dispatcher and a one-file positional crust are canonical examples of pressure that can justify structure with one consumer.

<!-- doctrine:growth-summary:end -->

## Anti-Patterns

### Cross-slice internal imports

```python
# BAD — reaching past the crust
from domains.pricing.discount_calculator import DiscountCalculator

# GOOD — import from the public seam
from domains.pricing import calculate_discount
```

Why it matters: internal files can be renamed, split, or reorganized freely.
The crust is a contract; internals are implementation details.

### Domain importing infrastructure

```python
# BAD — order.py imports an HTTP client
from adapters.stripe import StripeClient

# GOOD — order.py defines a protocol, adapter implements it
class PaymentGateway(Protocol):
    async def charge(self, amount: Money) -> PaymentResult: ...
```

Why it matters: domain models are the most stable code. Coupling them to
infrastructure means infrastructure changes ripple into business logic.

### Use case importing a concrete adapter

```python
# BAD — app/use_cases/checkout.py picks its own infrastructure
from adapters.stripe import StripeClient

# GOOD — the use case takes the port; app/bootstrap injects the adapter
def checkout(orders: OrderRepository, payments: PaymentGateway) -> None: ...
```

Why it matters: the composition root is the one place that knows which concrete
things exist. A use case that reaches for an adapter is the same coupling model
purity prevents one layer down, and it makes the use case untestable without the
real infrastructure.

### Circular dependencies between slices

```text
# orders imports pricing, pricing imports orders — cycle
```

Resolution: use domain events. `orders` emits `OrderPlaced`, `pricing` subscribes.
The event lives in `common/` — both slices import it from the shared kernel, so
neither imports the other. Placing the event in the emitting slice's public API does
not break the cycle: the subscriber still imports the emitter.

### Adapters importing app layer

```python
# BAD — adapter depends on a use case or handler
from app.use_cases.checkout import Checkout

# GOOD — adapters only know about domain ports
from domains.orders import OrderRepository
```

Why it matters: driven adapters implement domain contracts. They shouldn't know how
the application orchestrates those contracts. Code that does need to call the
application is a driving adapter and belongs in `entrypoints/`.

### Premature abstraction

```python
# BAD — AbstractRepositoryFactory with one concrete implementation
# BAD — EventBus interface when no event exists yet
# BAD — PluginRegistry with a single plugin

# GOOD — just use the concrete thing until you need the abstraction
```

A dispatcher introduced to break a real cross-slice cycle is not an instance of this
anti-pattern, even with one event and one subscriber.

## Boundary Decisions

### What is a slice's crust?

A slice's crust is its public seam in the language's native form: exported identifiers
in Go, the package `__init__` surface in Python, an index module in TypeScript, a
public class surface elsewhere. It is not a barrel file as such — Go has no barrels,
and current TypeScript build tooling discourages them.

The test is a surface test: can a consumer see a small, obvious set of externally
usable operations at the top level, with no digging into internals and no
hundred-symbol entry point?

Some languages have no native visibility form at all — engine scripting languages
like GDScript expose every identifier in every file. There the crust is positional:
the files sitting directly at the slice root are the public seam, nested directories
are internals, and an external checker enforces what the language cannot. Keep the
checker's rule mechanical — root is public, nested is private — never a per-slice
allowlist of public filenames: a slice then grows a second public root module by
adding the file, not by editing CI. The surface test above still governs how many
root files a slice should carry.

Slices stay local and roughly DDD until application infrastructure requires the
hexagonal seams. Don't fit a slice with ports and adapters before it talks to
anything outside the process.

### When does something belong in `common/`?

- Value types used across 2+ slices (Money, UserId, Timestamp)
- Domain events that multiple slices produce or consume
- Shared exceptions or error types

**Not common:** anything used by only one slice. Don't pre-promote to common
"just in case" another slice might need it. Cycle-breaking events are the stated
exception: they live in `common/` because that is what breaks the cycle.

### When do you introduce an adapter?

When domain code needs to talk to something external (database, API, filesystem,
message queue). The domain defines a protocol (port), the adapter implements it, and
the composition root wires the two together.

Don't create an adapter for in-process utilities (string formatting, date math,
pure computation). Those are just functions.

### When does a use case belong in `app/` vs inside a slice?

- **Inside the slice:** operations on a single domain concept (create order,
  update order status). These are domain services or methods on the entity.
- **Straight against a sibling slice:** in-process queries and calculations. A slice
  may import a sibling's public seam directly for these; it is a natural dependency,
  not orchestration.
- **In `app/use_cases/`:** the operation needs an entrypoint (it is triggered from
  outside) or a gateway (it must reach outside through a port). Orchestration across
  2+ slices lands here too — the use case imports from multiple slice public seams
  and receives its adapters from the composition root.

### When do you use events vs direct imports?

- **Direct import:** slice A needs data from slice B to do its work (orders imports
  pricing to calculate totals). This is a natural dependency.
- **Events:** slice B needs to react to something slice A did, but slice A shouldn't
  know about slice B. This prevents cycles and keeps the emitter independent.

Rule of thumb: if adding the import would create a cycle, use an event, and put the
event type in `common/`.

Event machinery is staged — take the earliest stage that works:

1. **Framework-native publisher.** If the framework ships one (Spring's
   `ApplicationEventPublisher`, for example), call it directly. The
   wrap-what-you-do-not-control rule applies to external dependencies; it does not
   extend to a framework's own event publisher.
2. **Domain publish port.** With no framework publisher, the domain defines a publish
   port and a minimal in-process dispatcher owned by `app/` implements it.
3. **Durable delivery.** Outbox records, retries, and delivery guarantees enter only
   when delivery leaves the process.

## Leaning Into the Framework

The staged event model generalizes: when the chosen framework natively supplies a
doctrine role, use the framework mechanism directly. The wrap-what-you-do-not-control
rule applies to external dependencies, not to the framework the application is built
on — wrapping a framework facility you had no reason to abstract is speculative
architecture.

Framework mechanisms that satisfy doctrine roles directly:

- **Entry points** — the framework's routing, CLI host, engine callbacks, or RPC
  surface is the driving adapter. A game engine's per-frame callbacks and RPC
  endpoints are entrypoints the same way an HTTP framework's controllers are.
- **Composition root** — the framework's DI container, singleton registry, or
  declarative composition config is the composition root. A Godot autoload
  registration or a serialized scene instantiating a slice's nodes is composition
  doing its job, not a boundary bypass.
- **Event publisher** — the framework-native publisher (Spring events, Godot
  signals) is stage one of the event ladder; call it directly.
- **Egress currencies** — there is no universal crust return type. A slice's seam
  legitimately emits what the framework natively speaks: an instantiated scene the
  caller parents, a resource handle, a signal, a wire buffer, a renderer-facing
  packed buffer. Standardize the contract metadata — ownership, lifecycle, authority
  to call — not the return shape.

The criterion for leaning in is that the framework is itself sliced-bread-friendly:
loosely coupled, composition-first, small stable interfaces. Godot's
node/signal/resource model qualifies — its mechanisms compose without forcing slices
to know each other. A framework that demands inheritance into every class or routes
everything through global mutable state does not; keep that one behind adapters at
the seam and lean in only where it is loosely coupled.

Engine-hosted applications multiply egress points — scenes, signals, network
replication, render buffers — and that is not violation pressure. The boundary rule
is unchanged: consumers use the slice's public seam. What varies is the native form
the seam's traffic takes.

## Dependency Direction Quick-Check

<!-- doctrine:arrows:start -->

```text
entrypoints/   ->  app/  ->  domains/*  ->  domains/common/
app/bootstrap  ->  adapters/          (composition root only)
adapters/      ->  domains/*          (implement domain ports)

Never:
  app/use_cases/*  ->  adapters/*
  domains/*        ->  adapters/ | app/ | entrypoints/
  adapters/*       ->  app/ | entrypoints/
  common/          ->  sibling domains
  anything         ->  entrypoints/
```

<!-- doctrine:arrows:end -->

## Reviewing Against Sliced Bread

When reviewing code for architecture compliance, check:

1. **Import direction** — do all arrows point in a permitted direction? Only the
   composition root imports concrete adapters, and nothing imports `entrypoints/`.
2. **Crust integrity** — are external consumers using the slice's public seam rather
   than reaching into internals?
3. **Model purity** — do domain files import only stdlib, common, and sibling public APIs?
4. **Growth justification** — does demonstrated pressure justify each directory/abstraction? Two concrete consumers are the normal evidence threshold, not a hard requirement.
5. **Event usage** — are events used for reverse deps, not passed around as general-purpose messaging?

### Severity

<!-- doctrine:severity:start -->

| Severity | Meaning                                                                                                                                                              |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| blocker  | Inverted dependency arrow; infrastructure executing at import time in a domain file                                                                                  |
| high     | Cross-slice internal import; circular slice dependency; crust bypass with multiple consumers                                                                         |
| medium   | Model-purity drift (infrastructure imported, not executed at import time); premature abstraction; events-as-messaging; adapter imported outside the composition root |
| low      | Single-consumer crust bypass; naming drift                                                                                                                           |

<!-- doctrine:severity:end -->
