# Rule blueprints

The rule IDs are language-neutral.
Each backend implements each rule natively where its checker can, and in the wrapper where it cannot.
The wrapper is `scripts/sbguard_lib/`; it reads `slices.toml` and the checker's module graph.

## Rules

| ID    | Rule                                                                                                                                     | Identity (`from -> to`)                                                                        |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| SB-00 | Every import resolves. An unresolved import hides an edge. Never baselined or suppressed.                                                | importing file -> unresolved specifier                                                         |
| SB-01 | A production file outside a slice imports only that slice's crust.                                                                       | importing file -> imported internal file                                                       |
| SB-02 | A node imports only nodes in its `may_depend_on`. Tests are included.                                                                    | importing file -> imported file                                                                |
| SB-03 | No cycle between nodes, over production edges.                                                                                           | each file edge inside a node-level cycle                                                       |
| SB-04 | Every source file maps to exactly one slice or spine node, and is not a symlink.                                                         | file -> `unmapped`, `ambiguous`, or `symlink`                                                  |
| SB-05 | A test imports its own slice's internals freely, and other slices only through their crust. Production code does not import a test file. | importing file -> imported file                                                                |
| SB-06 | Every declared `requires` edge exists in production code. Test edges do not count.                                                       | slice -> required node                                                                         |
| SB-07 | No new inline suppression directive; the baseline does not grow and is not deleted.                                                      | file -> `inline:<directive>:<hash>:<n>`, or baseline -> `baseline:grew:…` / `baseline:deleted` |

SB-00 is an analysis-integrity rule that the guard adds to the seven blueprints.

"Production code" is every non-test file plus every file that production code reaches.
A file named like a test cannot hide a production cycle or satisfy a `requires` edge for production.

## Identity-set gate

The gate computes the set of current identities and compares it with the baseline set.
A current identity that is not in the baseline or in a `[[suppress]]` entry fails the check.
Identities hold no line numbers, so an edit that moves a line does not change them.
SB-03 uses concrete file edges, not the set of nodes in the cycle, so a new edge inside an old cycle still fails.

## SB-07 directive grammar

The scan reads every `//` and `/* */` comment in a source file, including multi-line comments.
A comment is a suppression directive when it holds one of these markers:

- `sbguard-ignore`, `sbguard-disable`, or `sb-guard-` variants of them.
- `dependency-cruiser-ignore` or `depcruise-ignore`.
- `eslint-disable`, `eslint-disable-line`, or `eslint-disable-next-line` with no rule list (a blanket disable).
- The same ESLint directives when the rule list names an `import/`, `import-x/`, or `boundaries/` rule.

An ESLint directive for unrelated rules, such as `no-console`, is not an SB-07 directive.
The identity hashes the comment, the line where it ends, and the next non-blank line, and adds an occurrence number.
So a copied directive and a directive moved to another import are new identities.
An edit to the suppressed line also changes the identity; that is intentional.
The scan does not parse string literals, so a marker inside a string can produce a false positive.

## Policy changes

When `slices.toml` differs from the base ref, the check prints `POLICY` lines.
They list newly ignored files, files newly classified as tests, node changes, and new suppressions.
These lines are information for the code-owner review; they do not fail the check.

## Backend support matrix

| ID    | TypeScript: dependency-cruiser 18.7                                      |
| ----- | ------------------------------------------------------------------------ |
| SB-00 | native: `to.couldNotResolve`                                             |
| SB-01 | native: one `forbidden` rule per slice                                   |
| SB-02 | native: one `forbidden` rule per node                                    |
| SB-03 | wrapper: strongly connected components over the module graph             |
| SB-04 | wrapper: `git ls-files` inventory against the slice map                  |
| SB-05 | native: one `forbidden` rule per slice, plus one production-to-test rule |
| SB-06 | wrapper: reflexion absence check over the module graph                   |
| SB-07 | wrapper: comment scan, and baseline history read from the base ref       |

dependency-cruiser can find folder-level cycles with `scope: "folder"`.
The guard does not use it, because a folder is not a slice: it reports nested folders inside one slice, and a slice can have more than one path.

## Checker settings the generator fixes

- `tsPreCompilationDeps: true`, so type-only imports are edges.
- `tsConfig` from `[policy] tsconfig`, so path aliases resolve.
- Every inventory file is passed to the checker; a file missing from its output is a setup error (exit 2).
- Glob patterns become regexes that both Python and JavaScript accept, so both engines classify a file the same way.
- dependency-cruiser rejects nested quantifiers, so `**/` becomes `(?:.*/|)`.

## Known limits

- Computed dynamic imports, such as `import(name)`, are not visible to static analysis.
- The check cannot authenticate a human approval. Required code-owner review is the control.
- A `slices.toml` change can redefine success, for example a wider `ignore`. The `POLICY` lines show it; human review decides.
- The base ref is trusted input. `--base HEAD` in the pre-commit hook is local feedback only; it cannot see growth that an earlier commit made with hooks off. CI on pull requests uses the event's immutable base SHA. A push run uses `github.event.before`, which a force-push can move.
- `prove` is mutation smoke coverage: one probe per rule. It does not prove every variant of a rule.
- A very large repository can exceed the command-line length, because every file is an argument.
