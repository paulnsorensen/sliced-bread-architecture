# Slice-and-Spine Review — prior-art research (master synthesis)

Date: 2026-08-17. Question: has anyone built an agentic-assisted architectural coherence review — a human in an IDE with an AI sidecar, subagents fanning out to summarize each file plus its tests (the behavior assertions they make), the review focused on module seams (duplicated or leaky logic on either side; verdicts: pull complexity up, push it down, or rethink the seam)?

## Verdict

No product, OSS project, or named methodology combines all four elements — human-guided session, whole-repo scope, per-file+test fan-out, seam-disposition verdicts. Every element exists separately; the composition is unclaimed.

## Local prior art (this repo)

- `skills/sliced-bread-review` — change-set compliance against the five checks; diff-scoped, rule-based.
- `skills/sliced-bread-depth` — whole-repo deep-module scoring (crust shape, implementation share; extract/narrow/watch/healthy/intent verdicts). Closest local ancestor of "identify the monolithic parts."
- `skills/sliced-bread-audit` — autonomous Workflow fan-out: evaluator per slice + cross-slice dependency pass → GitHub issues.
- Gaps vs. slice-and-spine: none is human-in-the-loop; none reads tests as behavior assertions; none issues seam-coherence dispositions. "Spine" appears nowhere in repo or wiki — new coinage (plausible referent: `app/use_cases` + composition root, the cross-slice orchestration layer).

## Cross-source synthesis

**Terminology ([literature.md](literature.md))** — no single term names the composite. Closest formal ancestor: software reflexion models (Murphy & Notkin): compare intended vs. actual architecture at the boundaries. Supporting vocabulary: ATAM/SAAM/ARID (scenario-based review); coupling/cohesion metrics and connascence (the "why it leaks" vocabulary); Ousterhout's deep modules / pull complexity downward (the push-down disposition); Feathers seams (adjacent but distinct sense — test-substitution points); shearing layers (why a seam belongs where it is); fitness functions (making the review repeatable). Active 2024–26 LLM architecture-recovery literature: ArchAgent (ICASSP 2026, verified) targets architectural drift; a 2025 multivocal review catalogs the architecture-debt tool ecosystem (Arcan, Designite, DV8, CodeScene) that LLM approaches augment, noting LLM+RAG helps on small debt cases and struggles on complex ones.

**Products ([tools.md](tools.md))** — the seam question is answered only by non-LLM structural tools: CodeScene (change coupling, hotspots), Lattix and NDepend (dependency structure matrices) — no LLM reasoning layer. Repo-scoped LLM tools (Qodo, Greptile, CodeRabbit, DeepWiki, Cody/Amp) build whole-repo context but deliver PR comments, wiki pages, or chat — not a guided review session. Qodo is the nearest LLM analogue (dedicated Duplicated Logic and Architecture agents), still PR-delivered. CodeSee and Structure101 are defunct.

**OSS workflows ([oss-workflows.md](oss-workflows.md))** — no project fans out per file+tests and then critiques seams. Composable pieces: RepoAgent (bottom-up, dependency-ordered per-object LLM fan-out — the closest fan-out mechanism); Aider's repo-map (tree-sitter symbol graph + personalized PageRank — cheap deterministic coupling signal, no LLM); mikewolfd/semi-formal-architecture-review (only hit treating "seam" as a first-class reviewed concept — but ADR-granularity, and it explicitly declines tests as evidence). Claude Code agent catalogs (architect-reviewer, code-archaeologist) are single-pass checklists, no fan-out. Tests-as-behavior-assertions is the biggest gap: BDD living-doc tools (Pickles/Concordion/SpecFlow+ LivingDoc) render human-authored Gherkin; nothing found infers behavior assertions from ordinary test code as a review input (absence claim, bounded search).

## Terms of art (search/communication vocabulary)

- software reflexion models; architecture conformance checking
- architectural drift / erosion / decay
- change coupling (behavioral code analysis)
- dependency structure matrix (DSM)
- connascence

## Open questions (merged)

- Vertical Slice Architecture cited by sources as an alternative decomposition axis — a scoping question, not adopted here.
- Cody/Amp boundary-analysis mechanics rest on third-party 2026 reviews only.
- Post-mid-2026 entrants marketing subagent-fan-out whole-repo review were not sweep-searched.
- wshobson/agents seam-content code search cut short by a GitHub rate limit — absence not confirmed.
- No dedicated academic search for "test-derived behavior specification extraction" was run; that absence claim is bounded to Tavily + partial gh search.
- Three literature leads (SemRef, Pandini et al., ROS 2 case study) located via secondary pointers only; re-fetch before citing.

## Confidence

High on classical literature and tool scope/status claims (primary-sourced); moderate on the 2024–26 LLM architecture-recovery slice (2 of 5 recent items directly verified); speculative only on the flagged absence claims.

## Recommended next step

`/mold` a spec for the slice-and-spine review aspect, consuming this report. Design questions the spec must settle: session shape (human-in-IDE + agentic sidecar), fan-out unit (file+test pair vs. slice), seam-verdict vocabulary (pull up / push down / rethink the seam), and reuse of `sliced-bread-depth`'s measuring pass, `sliced-bread-audit`'s workflow skeleton, and `/steel-thread`'s spine tracing.

## Agent resolution

Three read-only, fresh-context researcher sub-agents ran in parallel (tools / literature / OSS); digests merged by the parent. literature.md was re-emitted by its agent after a same-path overwrite incident; tools.md was reconstructed verbatim from agent A's returned digest.

## Files

- [tools.md](tools.md) — AI + structural tool survey (agent A)
- [literature.md](literature.md) — terminology and literature claims (agent B)
- [oss-workflows.md](oss-workflows.md) — OSS agent-workflow survey (agent C)
- raw/ — archived source bodies
