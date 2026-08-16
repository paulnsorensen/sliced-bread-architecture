# Leaning into the framework

When the chosen framework natively supplies a doctrine role — entry points,
composition root, event publisher, or egress currency — use the framework's
own mechanism directly rather than wrapping it. The wrap-what-you-do-not-
control rule applies to *external* dependencies; it does not extend to the
framework the application is built on. Wrapping a framework facility with no
independent reason to abstract it is itself speculative architecture, which
the doctrine already argues against elsewhere.

## Roles a framework can satisfy directly

- **Entry points** — the framework's routing, CLI host, engine callbacks, or
  RPC surface *is* the driving adapter (see
  [[architecture/entrypoints-layer]]). A game engine's per-frame callbacks
  and RPC endpoints are entrypoints the same way an HTTP framework's
  controllers are.
- **Composition root** — the framework's DI container, singleton registry, or
  declarative composition config *is* the composition root. A Godot autoload
  registration or a serialized scene instantiating a slice's nodes is
  composition doing its job, not a boundary bypass.
- **Event publisher** — the framework-native publisher (Spring events, Godot
  signals) is stage one of the staged event ladder; call it directly. See
  [[architecture/event-model]].
- **Egress currencies** — there is no universal crust return type. A slice's
  seam legitimately emits what the framework natively speaks: an instantiated
  scene the caller parents, a resource handle, a signal, a wire buffer, a
  renderer-facing packed buffer. Standardize the contract metadata —
  ownership, lifecycle, authority to call — not the return shape.

## The qualifying criterion

Leaning in is conditional on the framework itself being loosely coupled and
composition-first. Godot's node/signal/resource model qualifies — its
mechanisms compose without forcing slices to know about each other. A
framework that demands inheritance into every class, or routes everything
through global mutable state, does **not** qualify: keep that one behind
adapters at the seam, and lean in only where the framework actually is
loosely coupled.

Engine-hosted applications multiply egress points — scenes, signals, network
replication, render buffers — and that multiplication is not itself violation
pressure. The boundary rule is unchanged (consumers use the slice's public
seam); what varies is the native form the seam's traffic takes.

## Provenance

The event-publisher exemption to wrap-what-you-do-not-control originates in
ADR-002 (`docs/adr/sliced-bread-doctrine-revision-002.md`); ADR-005
(`docs/adr/sliced-bread-doctrine-revision-005.md`) generalizes it into the
full "Leaning Into the Framework" principle, prompted by the first
engine-hosted (Godot) production consumer needing a doctrinal reading for
entry points, composition, and egress that revision 002 hadn't covered. Read
both in full for the alternatives considered.
