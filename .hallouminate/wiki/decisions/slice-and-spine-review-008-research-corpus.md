# ADR slice-and-spine-review-008: Prior-art research lives in the wiki research/ namespace [status: accepted]

- **Context:** The slice-and-spine prior-art research landed in `.cheese/research/`, which is gitignored — neither versioned nor groundable. The wiki convention was one page per ADR-backed decision, which a multi-file research report does not fit.
- **Decision:** Copy the full report set into `.hallouminate/wiki/research/<slug>/` and declare the `research/` namespace evidence-exempt from the one-page-per-decision rule (recorded in the wiki index conventions). Also created the missing repo-layer `.hallouminate/config.toml` (`[[repository]]` block), which made this repo's wiki servable at all.
- **Alternatives:** (a) Distilled single wiki page with a pointer to the machine-local report — rejected: full claim tables lost if `.cheese` is lost. (b) Indexing `.cheese/research/` as an extra corpus — rejected: groundable but unversioned and machine-local.
- **Consequences:** Research is versioned, PR-reviewable, and groundable; the wiki carries an evidence namespace distinct from decisions.
