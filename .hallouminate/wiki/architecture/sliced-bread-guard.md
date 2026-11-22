# Sliced Bread guard

The `sliced-bread-guard` skill enforces the slice map in CI with deterministic checks. This page records why the guard works as it does and which traps to avoid. The skill lives in `skills/sliced-bread-guard/`. It is a prototype with one backend: TypeScript and JavaScript through dependency-cruiser.

## Why it exists

[[research/architecture-metrics-tooling/deterministic-vs-llm-checks]] shows that about two-thirds of the doctrine checks need no LLM. The guard implements the boundary half of that proposal. The depth half is the `sliced-bread-depth-ratchet` skill. Judgment checks stay in `sliced-bread-review` and are never graded here.

## Design decisions

- **A human owns `slices.toml`.** An agent drafts the slice map. A human approves it. The map defines success, so an agent must never edit it to make a check pass.
- **Identity sets, not counts.** The gate compares sets of `from -> to` identities with the baseline. A count lets a fixed violation pay for a new one. Identities hold no line numbers, so a moved line does not change them.
- **A shrink-only baseline.** The baseline records adopted violations. It can lose entries and never gain them. A new violation needs a narrow `[[suppress]]` entry in `slices.toml` with a reason. Code-owner review is the only approval, because the check cannot authenticate a human.
- **SB-03 uses file edges.** The cycle rule lists each concrete file edge inside a node-level cycle. A new edge inside an old cycle still fails.
- **The guard adds SB-00.** An unresolved import hides an edge, so SB-00 fails on it. It is never baselined or suppressed, and `baseline --init` refuses to run while one exists.
- **No folder-level cycles.** dependency-cruiser offers `scope: "folder"`. The guard does not use it, because a folder is not a slice. A slice can have more than one path, and nested folders inside one slice would report false cycles.
- **Tests count as consumers.** SB-02 includes tests. SB-05 lets a test reach its own slice internals but only the crust of other slices. SB-06 ignores test edges, so a test cannot satisfy a `requires` edge.

## Trust boundary

The base ref is trusted input. These traps follow from that:

- The pre-commit hook runs `--base HEAD`. It gives local feedback only. It cannot see growth from an earlier commit made with hooks off.
- CI uses the immutable pull request base SHA. A push run uses `github.event.before`, which a force-push can move. Protect the default branch against force-pushes.
- Code-owner protection does nothing until branch protection requires code-owner review.
- A change to `slices.toml` can redefine success, for example with a wider `ignore`. The check prints `POLICY` lines for the reviewer. They inform and never fail the check.
- Computed dynamic imports, such as `import(name)`, are invisible to the check.

## Gotchas

- The skill never edits an existing dependency-cruiser config. It writes `.dependency-cruiser.sbguard.cjs`.
- Run `wire` from the skill copy. The vendored CLI has no templates, so `wire` exits 2 there.
- `wire` never overwrites a file with different content. To upgrade the vendored CLI, delete `tools/sliced-bread-guard/` and run `wire` again.
- The guard scrubs the git repository variables that `git rev-parse --local-env-vars` lists. Without that, a hook run inherits the outer repository and reads the wrong tree. It keeps `GIT_INDEX_FILE` only for the staged snapshot calls.
- The SB-07 scan does not parse string literals, so a marker inside a string can be a false positive.
- `prove` plants one violation per rule. It shows that each rule is wired. It does not show that every variant is caught.
- Distribution follows [[architecture/skill-distribution]]: the skill is invisible to harnesses until its pull request merges.

_Source: `skills/sliced-bread-guard/SKILL.md` and `references/rule-blueprints.md`; commit b87fb25 (#69) · Updated: 2026-11-22_
