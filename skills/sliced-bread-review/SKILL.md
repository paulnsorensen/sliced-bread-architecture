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
rationale lives in [`reference/sliced-bread.md`](../../reference/sliced-bread.md);
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

Arrows may only point inward:

```text
app/       →  domains/*  →  domains/common/
adapters/  →  domains/*
```

Never: `domains/* → adapters/*`, `domains/* → app/*`, `adapters/* → app/*`,
`common/ → sibling domains`. Any inversion is a **blocker**.

### 2. Crust integrity

External consumers import only from a slice's index/barrel file, never its
internals. `from domains.pricing import calculate_discount` is fine;
`from domains.pricing.discount_calculator import ...` is a violation —
**high** with multiple consumers, **low** with one.

### 3. Model purity

Domain files import only stdlib, `common/`, and sibling slice public APIs.
A domain file importing an HTTP client, ORM, or queue is a violation; the fix
is a port (protocol) defined in the domain and implemented by an adapter.
**Medium**, or **blocker** if the infrastructure call executes at import time.

### 4. Growth justification

Every new directory or abstraction needs 2+ concrete uses. An abstract base
with one implementation, an event bus with one event, or a registry with one
plugin is premature abstraction — **medium**. New single-file concepts that
stayed single files are correct; do not flag them.

### 5. Event usage

Events exist for reverse dependencies: B reacts to A without A knowing B.
Cycles between slices must resolve via events, not mutual imports (**high**).
Events used as general-purpose messaging where a direct import is the natural
dependency are a **medium** finding.

## Severity

| Severity | Meaning                                                              |
| -------- | -------------------------------------------------------------------- |
| blocker  | Inverted dependency arrow; infrastructure executing in a domain file |
| high     | Cross-slice internal import; circular slice dependency               |
| medium   | Model-purity drift; premature abstraction; events-as-messaging       |
| low      | Single-consumer crust bypass; naming drift                           |

## Output

Report findings grouped by severity, most severe first. Each finding:
`severity — check — file:line — quoted evidence — one-line fix`. An empty
report is a valid outcome; never manufacture findings. Do not fix anything —
this skill reviews only.
