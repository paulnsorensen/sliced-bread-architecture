# Existing Tools for Deterministic Slice-and-Spine Calculations

Checked 2026-08-17.

## Question

Which existing tools can calculate the deterministic evidence proposed for `slice-and-spine-review`: temporal coupling, hotspots, dependency edges, fan-in/out, cycles, call-path reachability, DSM/link matrices, LOC, clones, and longitudinal change?

Loaded assumptions: the skill should work locally or in CI; machine-readable output matters; open-source and cross-language tools are preferred, but commercial one-stop products are included for comparison.

## Conclusion

No researched open-source tool owns the complete Sliced Bread workflow. The strongest reusable stack is:

1. `scc` for LOC, complexity, hotspots, and file-level temporal coupling.
2. A static graph extractor: dependency-cruiser for JavaScript/TypeScript, Grimp for Python, or Joern as the heavier cross-language option.
3. NetworkX for SCCs, cycles, reachability, dominators, fan-in/out, density, centrality, and matrix derivation once the graph is normalized.
4. `jscpd` for clone candidates.
5. A small Sliced Bread adapter for mapping files/symbols to slices, crusts, spine, and seam kinds; aggregating evidence; calculating review coverage/staleness; and emitting the pinned dossier schema.

CodeScene is the closest turnkey product for component-level temporal coupling and hotspots. DV8 is the closest DSM/modularity product. Neither removes the need for Sliced Bread role mapping and session-state calculations.

## Capability map

| Calculation                                                 | Best existing fit                                       | What remains custom                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------- |
| File LOC, blanks, comments, complexity                      | `scc`                                                   | Map files to crust/internal/spine and aggregate per slice                 |
| File-level temporal coupling                                | `scc coupling`                                          | Slice-level grouping and confidence/ranking policy                        |
| Slice/component temporal coupling                           | Code Maat `--group`; CodeScene architectural components | Convert Sliced Bread inventory to component patterns; normalize output    |
| Hotspots                                                    | `scc hotspots`; CodeScene                               | Convert file hotspots to seam/spine evidence                              |
| JS/TS import graph and cycles                               | dependency-cruiser                                      | Map modules to slice roles and count crust symbols/call sites             |
| Python import graph                                         | Grimp                                                   | Same role mapping; add NetworkX for generic graph metrics                 |
| Cross-language call/call-site graph                         | Joern                                                   | Language-front-end quality checks, entrypoint declarations, slice mapping |
| SCCs, cycles, reachability, dominators, centrality, density | NetworkX                                                | None after producing a normalized directed graph                          |
| Link-level/DSM matrix                                       | NetworkX/custom renderer; DV8 commercially              | Sliced Bread L0-L4 cascade and pinned evidence schema                     |
| Clone candidates                                            | `jscpd`                                                 | Restrict comparisons to seam sides; interpret architectural ownership     |
| Test reachability/behavior assertions                       | Language coverage tools plus symbol graph               | Cross-language test mapping and semantic assertion extraction             |
| Walk coverage, weighted coverage, dossier staleness         | No researched product matches the session schema        | Small deterministic session analyzer                                      |
| Human disposition                                           | None, intentionally                                     | Keep human/LLM guided judgment                                            |

## Findings

### `scc` already implements most of the proposed history arithmetic

The current `scc` README documents MCP tools named `analyze`, `hotspots`, and `coupling`, each returning JSON. `coupling` supports repository-wide pairs and per-file blast radius and reports the history window, shared commits, symmetric coupling degree, and directional probabilities. Its implementation:

- suppresses pairs sharing fewer than two commits;
- excludes commits touching more than 30 files from pair counting;
- folds renamed paths into their surviving path;
- retains raw `shared`, `commitsA`, and `commitsB` counts;
- calculates symmetric degree as `shared / (commitsA + commitsB - shared) * 100`.

This directly covers the previously proposed Jaccard-style co-change formula, support floor, bulk-change filtering, rename handling, history metadata, and raw-count transparency. The exposed API is file-oriented; architectural grouping is not part of the documented MCP coupling parameters.

### Code Maat already supports grouped temporal coupling

Code Maat emits coupling CSV with `entity`, `coupled`, `degree`, and `average-revs`; verbose mode includes each entity's revisions and shared revisions. Its CLI accepts a grouping file (`--group`) and exposes minimum revisions, minimum shared revisions, minimum coupling, and maximum change-set size. That grouping makes it a direct fit for mapping paths into slices before calculating co-change. Its README says the analyses evolved into CodeScene, and GitHub commit search found no commits in the year ending 2026-08-17, so it is a mature reference implementation rather than the strongest dependency for a new integration.

### CodeScene is the closest turnkey temporal/architectural product

CodeScene lets users define architectural components from folder selections/globs and runs hotspots and change coupling at the architectural-component level. Its REST API exposes project architectural components, analyses, files, components, commits, issues, trends, and other analysis data. This avoids implementing component-level Git aggregation but introduces a commercial service/token dependency and does not replace the review's static symbol/call graph or human disposition.

### Static dependency extraction is language-sensitive

Dependency-cruiser is a maintained MIT tool for JavaScript/TypeScript/CoffeeScript. Its JSON output has a tested schema and contains visited modules, direct dependencies, circular flags/cycle paths, optional folder dependencies/metrics, and run metadata.

Grimp builds a directed import graph for one or more Python packages and exposes direct import and import-chain queries. It is a clean Python adapter rather than a cross-language answer.

Joern is an Apache-2.0 code-property-graph platform. Its call traversals expose call sites, callers, callees, locations, and recursive-call queries. `joern-export` can emit entire graphs as Neo4j CSV, GraphML, GraphSON, or DOT, allowing a neutral graph-processing step. It is substantially heavier than import-only adapters and static resolution remains an approximation in dynamic languages.

CodeQL has comparable cross-language call-graph/query power, but its CLI terms prohibit non-authorized analysis of non-open-source codebases and automated analysis outside the stated open-source/GitHub conditions unless a paid GitHub Advanced Security license applies. It should not be the skill's default backend.

### NetworkX should perform graph arithmetic after extraction

NetworkX provides directed connectivity and strongly connected components, cycles, boundaries, centrality, shortest paths, DAG closure/reduction, and immediate-dominator algorithms. It is suitable for deterministic fan-in/out, SCC/cycle flags, entrypoint reachability, path share, dominators, density, and ranking features once every language adapter emits the same normalized edge schema.

### Existing small tools cover mass and clone evidence

`scc --by-file --format json` reports per-file code, comment, blank, complexity, and byte counts across many languages, eliminating LLM-estimated `mass`.

`jscpd` supports many source formats and emits JSON containing clone ranges plus total sources, tokens, clone count, duplicated lines, and duplication percentage. It can supply `duplication_suspects`; the review must still filter clones to the two sides of a seam and interpret ownership.

### DV8 covers DSM/modularity when a commercial dependency is acceptable

DV8 accepts custom dependency data in JSON or XML and can import/export its dependency and clustering formats. Its output includes system modularity measures, propagation cost, anti-patterns, hotspots, roots, maintenance-cost CSVs, and correlation matrices. This is the closest researched fit for an off-the-shelf DSM/link-matrix and modularity engine, but it is licensed commercial software and still needs a Sliced Bread-specific input mapping.

## Claim-level evidence

| Claim                                                                             | Evidence                                                                                                                                         | Source type                | Freshness             | Confidence | Caveat                                                        |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- | --------------------- | ---------- | ------------------------------------------------------------- |
| `scc` exposes JSON MCP tools for LOC, hotspots, and coupling                      | README documents `analyze`, `hotspots`, and `coupling` with JSON results.[^scc]                                                                  | Official repository        | live 2026-08-17       | `certain`  | New coupling support landed in July 2026                      |
| `scc` calculates Jaccard-style degree and handles sparse/bulk/rename noise        | Implementation defines min shared 2, max 30 files/commit, rename folding, and `shared/(a+b-shared)`.[^scc-pr]                                    | Merged source diff         | 2026-07-20            | `certain`  | File-level, not arbitrary architectural groups                |
| Code Maat supports grouped temporal coupling                                      | CLI documents `--group`, coupling thresholds, max change-set size, CSV and verbose counts.[^code-maat]                                           | Official repository README | live 2026-08-17       | `certain`  | No commits found in prior year; in-memory processing          |
| CodeScene runs hotspots/change coupling at architectural-component level          | Architectural docs define components and component-level analyses; API exposes components and analyses.[^codescene-architecture][^codescene-api] | Vendor docs                | live 2026-08-17       | `certain`  | Commercial/token dependency                                   |
| dependency-cruiser provides schema-validated JS/TS dependency JSON and cycle data | Official output-format docs and repository description.[^dependency-cruiser]                                                                     | Official repository        | live 2026-08-17       | `certain`  | JS/TS ecosystem only                                          |
| Grimp provides a directed Python import graph                                     | Usage docs define `ImportGraph`, direct imports, and import chains.[^grimp]                                                                      | Official docs              | live 2026-08-17       | `certain`  | Python only; import graph, not full semantic call graph       |
| Joern can expose calls and export neutral graph formats                           | Official calls and export docs show call traversals and GraphML/GraphSON/Neo4j CSV/DOT.[^joern-calls][^joern-export]                             | Official docs              | live 2026-08-17       | `certain`  | Heavy installation; language precision varies                 |
| NetworkX supplies the required graph algorithms                                   | Official algorithm index lists boundaries, centrality, SCCs, cycles, DAG reachability, and dominance.[^networkx]                                 | Official docs              | 2025-12-08 docs build | `certain`  | Requires a normalized graph from another tool                 |
| `jscpd` emits machine-readable clone evidence                                     | JSON reporter documents file ranges and total clone/line/token statistics.[^jscpd]                                                               | Official docs/repository   | live 2026-08-17       | `certain`  | Syntactic clone candidates, not ownership judgment            |
| DV8 can analyze custom dependency matrices and emit architecture metrics          | Vendor input/output docs list JSON/XML custom dependencies, modularity, propagation cost, hotspots, CSVs, and matrices.[^dv8-input][^dv8-output] | Vendor docs                | live 2026-08-17       | `certain`  | Commercial license                                            |
| CodeQL is unsuitable as an unrestricted default for private repositories          | Official CLI terms restrict non-open-source and automated analysis absent paid authorization.[^codeql-license]                                   | Official license           | live 2026-08-17       | `certain`  | Paid GitHub Advanced Security rights can change applicability |

## Open questions

- Should the skill prefer a zero-configuration external binary (`scc`) or a Python library stack (`PyDriller` + NetworkX) that can calculate slice-level coupling in one process?
- Is a commercial backend adapter worthwhile for organizations already using CodeScene or DV8?
- Should the static graph layer use one heavy cross-language backend (Joern) or small language-native adapters with a shared JSON contract?
- Should the skill treat file-level `scc` coupling as sufficient evidence, or require commit-level regrouping by slice to avoid double-counting file pairs?

## Integration shape supported by the evidence

A conservative integration would define an analyzer-backend protocol rather than hard-code one vendor:

```text
history backend  -> file/slice touch counts and co-change
static backend   -> directed module/symbol/call edges
metric backend   -> LOC and clone candidates
normalizer       -> Sliced Bread nodes and seam edges
NetworkX         -> SCCs, reachability, fan-in/out, centrality, DSM facts
session analyzer -> rank, coverage, staleness, longitudinal deltas
```

Default candidate stack: `scc` + language-specific dependency extractor + NetworkX + `jscpd`. Optional adapters: Code Maat for grouped history, CodeScene for hosted architecture history, DV8 for DSM/modularity, and Joern for deeper cross-language call graphs.

## Verification log

- Read current target skill and pinned dossier schemas before external research.
- Verified official/vendor documentation pages for CodeScene, Joern, Grimp, NetworkX, jscpd, and DV8.
- Verified repository metadata and license files for dependency-cruiser, Joern, jscpd, PyDriller, and `scc` through GitHub.
- Inspected merged `scc` PR #733 source for the coupling formula and filtering behavior.
- Checked local executable availability: none of `scc`, `joern`, `jscpd`, `depcruise`, or `code-maat` is currently installed.

## Agent resolution

Research executed inline. No subagent was dispatched because session policy disallows delegation unless the user explicitly requests it. Primary-source bodies were read directly and retained only as cited URLs and session artifacts.

## References

[^scc]: <https://github.com/boyter/scc> (fetched 2026-08-17).

[^scc-pr]: <https://github.com/boyter/scc/pull/733> (fetched 2026-08-17).

[^code-maat]: <https://github.com/adamtornhill/code-maat> (fetched 2026-08-17).

[^codescene-architecture]: <https://codescene.io/docs/guides/architectural/architectural-analyses.html> (fetched 2026-08-17).

[^codescene-api]: <https://codescene.io/docs/integrations/rest-api.html> (fetched 2026-08-17).

[^dependency-cruiser]: <https://github.com/sverweij/dependency-cruiser/blob/main/doc/output-format.md> (fetched 2026-08-17).

[^grimp]: <https://grimp.readthedocs.io/en/stable/usage.html> (fetched 2026-08-17).

[^joern-calls]: <https://docs.joern.io/cpgql/calls/> (fetched 2026-08-17).

[^joern-export]: <https://docs.joern.io/export/> (fetched 2026-08-17).

[^networkx]: <https://networkx.org/documentation/stable/reference/algorithms/index.html> (fetched 2026-08-17).

[^jscpd]: <https://jscpd.dev/reporters/json> (fetched 2026-08-17).

[^dv8-input]: <https://archdia.com/pages/user-guide-dv8-standard-input> (fetched 2026-08-17).

[^dv8-output]: <https://docs.archdia.net/dv8-analysis-result.html> (fetched 2026-08-17).

[^codeql-license]: <https://github.com/github/codeql-cli-binaries/blob/main/LICENSE.md> (fetched 2026-08-17).

_Source: briesearch tool survey · Updated: 2026-08-17 · Supersedes: none._
