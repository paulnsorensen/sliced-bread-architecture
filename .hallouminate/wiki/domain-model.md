# Domain model — sliced-bread-architecture

Cumulative ubiquitous language for this project. Merged per mold session; context-specific terms only.

**Slice** — a vertical domain module with a public crust.
_Avoid_: vertical, module
_Code_: domains/* (doctrine role)

**Crust** — a slice's public seam in the language's native form.
_Avoid_: facade, barrel, index
_Code_: per [[architecture/crust-definition]]

**Spine** — the orchestration layer threading slices together: app/use_cases plus the composition root.
_Avoid_: app layer, orchestrator
_Code_: NEW ENTITY (doctrine role app/; coined in specs/slice-and-spine-review)

**Seam** — a crossing edge between slices, spine, or adapter-port bindings; the unit the slice-and-spine review walks.
_Avoid_: boundary, Feathers seam (test-substitution sense)
_Code_: NEW ENTITY (specs/slice-and-spine-review)

**Disposition** — the human verdict at a seam stop: pull-up, push-down, rethink-seam, or healthy.
_Avoid_: severity
_Code_: NEW ENTITY (Verdict schema, skills/slice-and-spine-review/references/formats.md)

**Link level** — ordinal L0-L4 interweaving grade per slice pair, with numeric evidence, rendered as a DSM-style matrix.
_Avoid_: coupling score
_Code_: NEW ENTITY (LinkMatrix schema)

**Change coupling** — git co-change frequency across a seam; the primary seam-walk ranking signal.
_Avoid_: temporal coupling
_Code_: NEW ENTITY (SeamDossier.co_change)

**Hot path** — a high-traffic caller chain derived from code intelligence; feeds seam ranking, dossiers, and spine visit order.
_Avoid_: critical path
_Code_: NEW ENTITY (SeamDossier.hot_paths_crossing)
