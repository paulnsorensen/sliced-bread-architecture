# ADR slice-and-spine-review-005: Ordinal L0-L4 slice link levels [status: accepted]

- **Context:** The user asked for a "slice link level" showing how slices are interwoven; the grading scheme needed a shape.
- **Decision:** An ordinal taxonomy per slice pair — L0 none, L1 event-linked, L2 crust import, L3 multi-symbol import, L4 co-change hot — each cell carrying numeric evidence (import count, co-change score, crossing hot paths), rendered as a DSM-style matrix.
- **Alternatives:** (a) Single composite 0-100 score — rejected: unexplainable at a glance. (b) Unordered kind flags — rejected: no notion of "more interwoven".
- **Consequences:** Levels are legible and comparable across pairs; the taxonomy must stay stable across sessions for trend reading. DSM precedent: Lattix/NDepend/Structure101 per the prior-art survey.
