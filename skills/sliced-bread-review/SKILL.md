---
name: sliced-bread-review
description: >-
  Review a diff, PR, branch, or path against the Sliced Bread architecture
  rules: dependency direction, crust integrity, model purity, growth
  justification, and event usage. Use when the user asks for an architecture
  review, says "check this against sliced bread", "review the slice
  boundaries", "is this import allowed", or before merging changes that add
  directories, abstractions, or cross-slice imports. Do NOT use for general
  bug-hunting or a full repo audit — this reviews a bounded change set.
---

# Sliced Bread Review

Review the target change set against the Sliced Bread architecture. The full
rationale lives at
<https://cheeselord.dev/sliced-bread-architecture/reference/sliced-bread/>;
this skill is the operational checklist.

## Scope

Determine the review target from the invocation, in priority order:

1. An explicit path, diff, branch, or PR named by the user.
2. The current branch's diff against the default branch.
3. Uncommitted changes (`git diff HEAD`).

Review only the changed files plus any file a changed import points at.

## The Five Checks

Run every check against every changed file. Cite `file:line` and quote the
offending import or definition for each finding.

### 1. Import direction

Arrows may only point in a permitted direction. Only the composition root
(`app/bootstrap`, `main`) may import concrete adapters, and nothing imports
`entrypoints/`. A slice may import a sibling slice's public seam directly.
The arrows describe permitted direction, not required directories — a repo with
no `entrypoints/` layer is not in violation.

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

Any inversion of these arrows is a **blocker**; a use case importing a concrete
adapter is **medium**.

### 2. Crust integrity

External consumers use a slice's public seam in the language's native form —
exported identifiers in Go, the package `__init__` surface in Python, an index
module in TypeScript, a public class surface elsewhere — never its internals.
`from domains.pricing import calculate_discount` is fine;
`from domains.pricing.discount_calculator import ...` is a violation —
**high** with multiple consumers, **low** with one.

### 3. Model purity

Domain files import only stdlib, `common/`, and sibling slice public APIs.
A domain file importing an HTTP client, ORM, or queue is a violation; the fix
is a port (protocol) defined in the domain and implemented by an adapter.
**Medium**, escalating to **blocker** only when the infrastructure call
executes at import time.

### 4. Growth justification

New directories and abstractions require demonstrated pressure. Two concrete uses are the normal evidence threshold, not a hard requirement. An abstract base with one implementation, an event bus interface when no event exists yet, or a registry with one plugin is medium only when no concrete pressure justifies it. "Numeric thresholds" in the guards below means the advisory growth signals (~200 lines, 3+ concepts, 3+ clustered files), not gradeable limits. Suppress these false positives:

<!-- doctrine:growth-guards:start -->

- A single consumer does not by itself prove premature abstraction; grade whether concrete pressure exists. Two consumers are normal evidence, not a hard requirement.
- New single-file concepts that stayed single files are correct; do not flag them.
- A dispatcher introduced to break a cross-slice cycle is demonstrated pressure, even with one event and one subscriber.
- Numeric thresholds are advisory signals, not gradeable violations; grade implementation share, public-surface size, and lifetime mixing.
- In a language whose only privacy mechanism is file placement, a subdirectory marking its contents internal is demonstrated pressure for that visibility boundary, even with a single file inside.

<!-- doctrine:growth-guards:end -->

### 5. Event usage

Events exist for reverse dependencies: B reacts to A without A knowing B.
Cycles between slices must resolve via events typed in `common/`, not mutual
imports (**high**).
Events used as general-purpose messaging where a direct import is the natural
dependency are a **medium** finding.

## Severity

The severities cited in the checks above derive from this table.

<!-- doctrine:severity:start -->

| Severity | Meaning                                                                                                                                                              |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| blocker  | Inverted dependency arrow; infrastructure executing at import time in a domain file                                                                                  |
| high     | Cross-slice internal import; circular slice dependency; crust bypass with multiple consumers                                                                         |
| medium   | Model-purity drift (infrastructure imported, not executed at import time); premature abstraction; events-as-messaging; adapter imported outside the composition root |
| low      | Single-consumer crust bypass; naming drift                                                                                                                           |

<!-- doctrine:severity:end -->

## Output

Report findings grouped by severity, most severe first. Each finding:
`severity — check — file:line — quoted evidence — one-line fix`. An empty
report is a valid outcome; never manufacture findings. Do not fix anything —
this skill reviews only.
