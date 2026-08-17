# Prior art: AI + structural whole-repo review tools (agent A survey)

Question: which tools (mid-2026) perform whole-repository architecture/coherence review, vs per-PR diff review? Does anything ship the human+AI seam-hunting workflow?

## Verdict

No tool ships the described human+AI whole-repo seam-hunting workflow. The job is split: coupling detection lives in non-LLM structural tools (CodeScene, NDepend, Lattix); repo-scoped LLM agents (Qodo, Greptile, CodeRabbit, DeepWiki, Cody/Amp) build full-codebase context but deliver PR comments, chat answers, or wiki pages — never a guided architecture-review session. Defunct: CodeSee (absorbed into GitKraken, May 2024), Structure101 (standalone discontinued; acquired by Sonar, Oct 2024).

## Claim table

| Tool               | Scope                                      | Boundary analysis?                                                        | Human-in-loop                    | Confidence                           | URL                                                                       |
| ------------------ | ------------------------------------------ | ------------------------------------------------------------------------- | -------------------------------- | ------------------------------------ | ------------------------------------------------------------------------- |
| CodeScene          | Repo (whole-history)                       | Yes — Change Coupling, Hotspots                                           | Dashboard + IDE + PR gate        | certain                              | codescene.com/product/behavioral-code-analysis                            |
| Sourcegraph Cody   | Repo (RAG index)                           | General Q&A, not dedicated coupling analysis                              | IDE chat                         | speculating (3rd-party sources only) | aitoolsdevpro.com/ai-tools/sourcegraph-cody-guide                         |
| Sourcegraph Amp    | Repo (autonomous agent)                    | Task execution, not a report generator                                    | CLI + VS Code                    | speculating (3rd-party sources only) | baeseokjae.github.io/posts/amp-code-review-2026                           |
| Cognition DeepWiki | Repo (indexed)                             | Yes — component/dependency graph, arch diagrams                           | Web wiki + chat, read-only       | certain                              | ai.miraheze.org/wiki/DeepWiki                                             |
| CodeRabbit         | Diff-delivered, full-repo graph as context | Cross-file impact tracing, not standalone report                          | CI PR bot                        | certain                              | docs.coderabbit.ai/changelog                                              |
| Greptile           | Diff-delivered, full-repo graph as context | Duplication/cross-file detection                                          | PR bot + chat                    | certain                              | greptile.com/docs/introduction                                            |
| Qodo               | Explicitly full-repo even for PR review    | Yes — dedicated Duplicated Logic / Architecture / Breaking Changes agents | PR bot + IDE + judge-agent merge | certain                              | docs.qodo.ai/code-review                                                  |
| Ellipsis           | Diff-scoped                                | No dedicated boundary analysis found                                      | PR bot                           | certain                              | ellipsis.dev/blog                                                         |
| Aider repo-map     | Repo-scoped context builder only           | No — pure context selection, no review output                             | CLI pair-programming             | certain                              | aider.chat/docs/repomap.html                                              |
| Cursor @codebase   | Repo (semantic index)                      | RAG chat, no dependency-graph artifact                                    | IDE chat                         | certain                              | eastondev.com/.../cursor-codebase-index-guide                             |
| Copilot Workspace  | Single issue/task, not whole-repo          | None; struggles with complex architecture per users                       | Browser workspace                | certain                              | vibecoding.app/blog/github-copilot-workspace-review                       |
| GitHub Spark       | N/A — app builder, deprecated Aug 2026     | N/A                                                                       | N/A                              | certain                              | github.blog/changelog/2026-08-04-...                                      |
| CodeSee            | Defunct (acquired/shut down May 2024)      | N/A                                                                       | N/A                              | certain                              | devopsdigest.com/gitkraken-acquires-codesee                               |
| Structure101       | Discontinued standalone (Sonar, Oct 2024)  | Was: Slice view + DSM, whole-codebase                                     | Was: desktop/web app             | certain                              | sonarsource.com/structure101                                              |
| Lattix             | Active, non-LLM, repo-scoped               | Yes — hierarchical DSM, architecture discovery/rules                      | Desktop app + web dashboard      | certain                              | docs.lattix.com/.../Working_with_the_Dependency_Structure_Matrix_DSM.html |
| NDepend            | Active, non-LLM, repo-scoped (.NET)        | Yes — Dependency Graph/Matrix, pattern detection, LINQ rules              | VS plugin + CLI + CI gate        | certain                              | ndepend.com/docs/dependency-structure-matrix-dsm                          |

## Open questions

- Cody/Amp primary vendor docs not directly fetched — re-run against sourcegraph.com / ampcode.com for primary-source certainty.
- Post-mid-2026 entrants explicitly marketing a "fan-out subagent whole-repo review" mode were not sweep-searched (searches targeted the named tools).
- Qodo Academy's competitive framings (Cody = broad context vs. Qodo = review-purpose-built) listed as vendor claims, not endorsed.

## Confidence

Certain on scope/status claims (12 of 16 tools verified against primary vendor docs or unambiguous acquisition/deprecation announcements); speculating on Cody/Amp boundary-analysis mechanics (third-party 2026 reviews only).

Note: this file was reconstructed by the parent from agent A's returned digest after a same-path overwrite; the claim table is verbatim from the agent's return.
