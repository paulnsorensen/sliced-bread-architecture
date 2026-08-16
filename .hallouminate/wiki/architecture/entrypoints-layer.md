# Entrypoints layer and the composition root

`entrypoints/` is a top-level layer holding **driving** adapters only — one
per medium (CLI, HTTP server, worker, scheduler) — each translating an
outside trigger into a call on `app/`. Nothing imports `entrypoints/`, and
only the composition-root module (e.g. `app/bootstrap`, `main`) may import
concrete adapters and inject them. `adapters/` means **driven** adapters
exclusively (database, HTTP client, queue, filesystem) — they implement
ports the domain defines, and never import `app/` or `entrypoints/`.

## Why this exists

The original dependency quick-check permitted `app/ → domains/*`,
`adapters/ → domains/*`, and `domains/* → domains/common/`, while forbidding
`domains/* → adapters/|app/`, `adapters/* → app/`, and `common/ → sibling
domains`. Read as exhaustive, that rule set makes a composition root
unrepresentable — no layer is legally permitted to instantiate a concrete
adapter and inject it — and the blanket `adapters/* → app/` ban conflated
driven adapters (implement domain ports) with driving ones (call into the
application), leaving HTTP servers, CLIs, schedulers, and message consumers
with no legal home in the model. See ADR-001,
`docs/adr/sliced-bread-doctrine-revision-001.md` (read in full), which cites
Cockburn's own driving/driven split and the Cosmic Python repo layout as
precedent.

## The use-case discriminator

Not every cross-slice operation belongs in `app/use_cases/`. Per
`reference/sliced-bread.md`:

- **Inside the slice:** operations on a single domain concept.
- **Direct import of a sibling's public seam:** in-process queries and
  calculations against another slice — a natural dependency, not
  orchestration.
- **In `app/use_cases/`:** the operation needs an entrypoint (triggered from
  outside) or a gateway (must reach outside through a port), or it
  orchestrates across 2+ slices — receiving its adapters from the
  composition root.

## Naming is a role, not a mandated string

`entrypoints/` is the reference name for a role, not a required directory.
Go's `cmd/` and .NET's `Web`/`API` projects satisfy it — the doctrine is
language-agnostic on this point the same way the crust rule is (see
[[architecture/crust-definition]]). The same reading applies to the
composition root: `app/bootstrap` and `main` are example homes, not mandated
modules, and in a qualifying framework the framework's own composition
mechanism — a DI container, a Godot autoload registration, a declarative
composition config — _is_ the composition root (see
[[architecture/framework-leaning]]). The arrows describe permitted
direction, not required directories: a repo with no `entrypoints/` folder is
not in violation merely for lacking the name.
