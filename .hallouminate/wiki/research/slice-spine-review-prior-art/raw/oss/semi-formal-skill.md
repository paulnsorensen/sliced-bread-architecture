---
name: semi-formal-architecture-review
description: >
  Use when the user asks to review an ADR, spec, design doc, plan, system seam,
  feature shape, or any cross-cutting solutions architecture decision. Apply a
  semi-formal architecture-review workflow: trace decision lineage, map
  relationships across subsystems, check invariants and commitments,
  pressure-test user-value claims, and produce a structured findings-first
  verdict that names what to keep, reshape, or reverse.
---

<!-- Verbatim third-party copy from mikewolfd/semi-formal-architecture-review (see oss-workflows.md), retrieved for prior-art evidence. -->
<!-- Not a skill of this repo. -->

# Semi-Formal Architecture Review

Use this skill when the user asks for a review of an architectural decision, design, ADR, spec, plan, system seam, or any cross-cutting solution that spans more than one subsystem.

This skill is informed by _Agentic Code Reasoning_ by Shubham Ugare and Satish Chandra (`arXiv:2603.01896v2`, March 4, 2026), bundled in this skill directory as `Agentic Code Reasoning - arXiv 2603.01896v2.pdf`. The paper does not publish an architecture-review certificate, but it does support the underlying method: structured premises, evidence-cited claims, traced reasoning paths, formal conclusions with counterexample obligations, and verdicts that follow evidence. This skill adapts that method to solutions architecture — re-keying the paper's execution traces to decision lineage and its semantic properties to commitments.

The difference from `semi-formal-code-review`: the unit of analysis is a decision, not a patch. Traces are conceptual lineage and cross-subsystem relationships, not function calls. "Tests" have no full analog — the enforcement work the paper's test suites do falls to the opposite-verdict probe, with falsifiability questions and counterfactuals as softer stand-ins. "Invariants" are commitments and named seams. The output verdict directs reshape, reverse, or defer — not approve/reject of a diff.

One caveat carried honestly: the paper's gains are measured against hard ground truth (test execution for patch equivalence, known buggy lines for fault localization) or expert rubrics (code question answering). Architecture review has neither oracle. What transfers is the discipline — numbered evidence chains, forced enumeration, falsifiable conclusions — not the measured numbers. The paper also reports the cost side: semi-formal reasoning cost extra steps (about 2.8× on its curated patch-equivalence set, 1.4–2.1× on its other tasks), its gains shrank as the base model got stronger, and on one fault-localization sample the weaker model actually regressed under the structured format. That is why phases may be skipped when genuinely vacuous — spend the discipline where the decision's blast radius justifies it.

## Trigger

Activate when the user asks for a step-back review of a decision or design, for example:

- "review this ADR"
- "review this spec"
- "review this design doc"
- "review this plan"
- "review this architecture"
- "review this decision"
- "cross-cutting review"
- "solutions architecture review"
- "step back and review"
- "audit this design"
- "is this the right approach?"
- "does this make sense architecturally?"
- "trace this decision"
- "question the assumptions here"
- "why does this exist?"

Do not activate for routine code review (use `semi-formal-code-review` if installed; otherwise review the diff conventionally) or for implementation help.

## Non-Negotiables

- Treat the review as static analysis of the decision space; do not propose alternative implementations until the design under review has been traced and evaluated on its own terms.
- Never guess. Every substantive claim must cite source: `file:line` for code, `file:section` for documents, commit SHA or PR for events. If a cited prior artifact cannot be located, state the gap explicitly and lower confidence.
- Maintain the evidence chain end to end. Number every premise (`P[N]`), hypothesis (`H[N]`), observation (`O[N]`), invariant (`INVARIANT [N]`), and finding (`FINDING [N]`) with numbering that is global across the review, never restarted per artifact. Each finding must cite the `O[N]` / `INVARIANT [N]` IDs it rests on — and intent-vs-shape or user-value findings must also cite the `P[N]` premise they contradict; each verdict line must cite the finding IDs that support it. This is the paper's premise → claim → prediction chain: a conclusion that cannot be traced back through numbered claims to observed evidence is unsupported.
- Read the body, not the title. ADR / spec / plan titles are advertisement; the actual shape is in the body and in the artifact it lands as.
- Trace lineage at least two hops upward (the parent, and the constraints the parent itself inherits — drift across two hops is common) and one level outward (what subsystems and consumers it touches).
- Treat ADRs as lineage, provenance, and intent evidence. Do not treat an ADR citation as a substitute for normative spec text; if a spec needs an ADR to be understood, that is a finding.
- Distinguish stated intent from actual shape. Surface every divergence.
- Apply the user-value test before the elegance test. A pristine design that does not change a user-visible outcome is suspect.
- Verdicts follow evidence. Hedging language ("could be improved", "might benefit from") is not a verdict — name the change.
- If a required section cannot be completed, state the gap explicitly instead of filling it with speculation.

## Scope Discovery

Determine the artifact under review from the user request:

- **ADR**: read the ADR file, every ADR it cites or supersedes, the commits / PRs implementing it, and the spec section it lands in.
- **Spec / design doc**: read the doc, prior versions in git history, sibling sections, and the implementation it claims to constrain.
- **Plan / roadmap row**: read the row, parent ADR / vision section, and current implementation status.
- **Code seam / system boundary**: read both sides of the seam, the contract documents declaring it, and the consumers that cross it.
- **Feature / capability**: read the artifact (spec section, code module, design doc) and the user-visible outcome it claims to enable.
- **A spawned plan from a prior decision**: read both the parent decision and the plan; check whether the plan still serves the parent's intent.

If the user does not specify scope, ask once — do not guess. If the user gives a path, treat it as authoritative and start there.

Vocabulary note: terms like ADR, ratified spec, layer vision document, and conformance level name document _roles_, not required filenames. Map them to whatever the project actually uses; where no equivalent exists, treat the commitment as undeclared rather than inventing one.

## Exploration Protocol

Use the source paper's structured exploration format — the hypothesis / observation cycle from its Appendix B, the same one `semi-formal-code-review` uses — adapted for architectural artifacts.

Before reading an artifact:

```text
HYPOTHESIS H[N]: [decision claim, relationship, or invariant being tested]
EVIDENCE: [what prior artifact or prompt motivates this]
CONFIDENCE: high | medium | low
```

After reading:

```text
OBSERVATIONS from [artifact]:
  O[N]: [observation, with file:line or file:section]

HYPOTHESIS UPDATE:
  H[N]: CONFIRMED | REFUTED | REFINED — [explanation]

UNRESOLVED:
  - [open questions, sibling artifacts to read, seam ambiguities]

NEXT ACTION RATIONALE: [why read another, or why enough evidence exists]
```

During exploration:

- Keep `H[N]` and `O[N]` numbering global across the whole review — these IDs are what findings cite later, so they must stay stable and unique.
- Read every artifact the decision cites, plus the parent ADR / spec / vision section it derives from.
- For every cross-subsystem edge, locate the seam document declaring the contract; if none exists, that is a finding.
- For every claimed invariant or commitment, locate where it is stated; phantom invariants are findings.
- Inspect sibling artifacts that could subsume, conflict with, or be subsumed by the one under review.
- If the artifact spawned implementation plans, check whether those plans still serve the parent intent or have drifted.

## Phased Reasoning

Proceed through six phases. Skip a phase only when the artifact's scope makes it genuinely vacuous, and state the skip explicitly with reason.

### Phase 1 — Decision Frame

Pin the artifact in space:

- File path, section, commit SHA, or PR number
- Stated problem
- Stated decision or shape
- Claimed beneficiary (which user role, which subsystem)
- User-visible outcome (what becomes possible that wasn't before)
- Architectural commitments touched (cite the project's governing documents where they exist — goal or vision docs, development philosophy, active ADRs, ratified specs, layer vision documents; if no document declares a claimed commitment, say so — that gap is itself evidence)
- Category: product surface (user-facing capability) | proof infrastructure (verification machinery that protects a product outcome) | ops scaffolding (build, deploy, observability) | research (exploratory; no committed outcome yet)

Then restate the artifact's own claims as numbered premises — the analog of the paper's opening `P1/P2` premise statements:

```text
PREMISE P[N]: [one claim the artifact makes — its stated problem, stated decision, claimed beneficiary, or claimed outcome, with citation]
```

`P[N]` numbering is global like `O[N]`. A later finding that alleges intent-vs-shape divergence or a failed value claim must cite the specific `P[N]` it contradicts, alongside the `O[N]` evidence contradicting it — divergence claims are premise-vs-observation, never prose-vs-prose.

### Phase 2 — Lineage Trace

Trace where the decision came from:

- Prior ADRs / specs / commits that established constraints this honors or breaks
- Inherited assumptions (named or unstated — surface the unstated ones)
- What this supersedes, refines, or contradicts (with explicit citations)
- Whether stated intent matches the artifact's actual shape — any divergence is a finding
- Whether ratification or implementation has happened yet; pre-implementation decisions are reshapable, post-implementation decisions accumulate debt

### Phase 3 — Relationship Trace

Map the surroundings:

- Downward dependencies (substrate, contracts, primitives the decision relies on)
- Upward dependencies (consumers, projections, downstream commitments that will rely on this)
- Sibling artifacts (anything adjacent that could subsume, conflict, or be subsumed by this)
- Seam crossings (every cross-layer / cross-spec edge the decision touches — name each seam, cite where it is defined, flag any unnamed ones)
- Ownership (which subsystem or owner is responsible for each piece — diffuse ownership is a finding)

### Phase 4 — Invariant And Commitment Check

For each architectural invariant or commitment the artifact touches, state:

- The invariant or commitment (e.g., "dependency direction is engine → core, never reverse"; "single source of truth for X is artifact Y")
- Whether the artifact PRESERVES, BREAKS, RELIES-UPON, or NEWLY-INTRODUCES it
- Evidence (citation)
- Failure mode if the invariant is violated, and the concrete consumer or seam that would exercise it — a failure mode nothing exercises cannot ground a CONCERN

Include single-source-of-truth, named-seam, conformance, trust-posture, dependency-direction, and ratification commitments. Distinguish authority tiers: treat commitments carried by active ADRs and ratified specs as load-bearing; treat advisory-tier documents (ops conventions, internal style guidance) as advisory unless the project or user has elevated them — and name the tier when applying a commitment.

### Phase 5 — User-Value Check

This phase is the skill's own doctrine — the paper contains no user-value analysis.

Evaluate against the project's stated priority frame if one is on record (cite it — e.g., a documented formula weighing importance, user value, and future architectural debt). If none exists, apply the default frame: the user-visible outcome must justify the conceptual debt added, weighted by how hard that debt is to reverse later.

- What user-visible outcome changes if this lands? If none, state so explicitly.
- Does the user-visible outcome justify the conceptual debt added or paid down?
- Is the artifact product surface, proof infrastructure, or ops scaffolding? Label it; the bar for proof infrastructure is lower but it must still trace to a product outcome.
- Is there a smaller / different shape that delivers the same outcome with less debt or fewer seams?
- Falsifiability test — what observation, six months from now, would prove this work did not deliver the value it claimed?
- Greenfield-first sanity check: if the contract being asserted is wrong, the default recommendation is to reshape the contract, not to paper over it with adapter layers. This is a rebuttable default, not a law: live consumers can justify a temporary shim, but the review must then name the shim as debt with a retirement condition.

### Phase 6 — Counterfactual Check

Pressure-test the decision from the outside. The five probes below are this skill's own counterfactual battery — they are not from the paper:

- Kill criterion: what concrete observation would invalidate this design?
- Counter-decision: what would the artifact look like if the opposite decision were made? What would break, what would simplify?
- Removal probe: if this artifact were removed entirely, what consumer breaks first, and how loudly?
- Sibling subsumption: is there an existing artifact that already does enough of this that the new one is duplicative?
- Six-month-future critic: what does a reviewer reading this in six months most likely flag?

Then run the opposite-verdict probe — the one probe here that is the paper's own (its alternative hypothesis check, adapted from answers to verdicts). This is an evidence protocol, not speculation: you must actually search, and record what you searched for and what you found.

```text
OPPOSITE-VERDICT PROBE:
  If the opposite verdict were correct, what evidence would exist?
  Searched for: [what you looked for — artifacts, sections, consumers]
  Found: [what you found, with artifact:section citations — or "nothing"]
  Conclusion: REFUTED | SUPPORTED — [what this does to the emerging verdict]
```

If the probe SUPPORTS the opposite verdict, the emerging verdict must change or the review must explain, with citations, why the probe evidence is outweighed.

## Review Structure

Produce a findings-first review with the eight sections below. `references/templates.md` is the single normative source for each section's fillable format — read it before writing output; the summaries here say only what each section carries. The delivered review is the certificate: it must be self-contained, meaning a reader can dereference every `P[N]`, `O[N]`, `INVARIANT [N]`, and `FINDING [N]` ID without replaying the exploration.

- **0. Coverage And Observation Log** — the artifacts-read table (each with its `O[N]` observations, one line apiece, cited), the artifacts-NOT-read list with why each omission is safe, and every hypothesis's final status. Where the universe is discoverable (documents citing this artifact, consumers of a named seam), enumerate it by recorded search — `Searched for / Found` — so the not-read list is the residue of a logged search, not a self-report. Confidence must scale with this section, not with formatting.
- **1. Artifact Summary** — path / section / commit, stated problem and decision, the artifact's own claims as numbered `P[N]` premises (each cited), category, subsystems touched, prior artifacts cited (and ones it should have cited but didn't), implementation status.

- **2. Lineage And Relationship Tables** — the prior-artifact lineage table (type, relation, citation), the component/seam table (owner, dependencies, seam named where?), and stated-intent-vs-actual-shape with any divergence graded against the `P[N]` contradicted.
- **3. Invariants And Commitments** — one `INVARIANT [N]` block per invariant touched: statement, source, PRESERVED | BROKEN | RELIED-UPON | NEWLY-INTRODUCED, evidence, and the failure mode with the concrete consumer or seam that would exercise it.
- **4. User-Value Analysis** — outcome, beneficiary, named debt added / paid down, category, the falsifiability observation, smaller-shape candidates, and the greenfield-first check (rebuttable default).
- **5. Counterfactual Analysis** — the five counterfactual probes (kill criterion, counter-decision shape, removal probe, sibling subsumption, six-month critic) plus the opposite-verdict probe with its recorded `Searched for / Found / Conclusion` lines.

- **6. Findings** — `FINDING [N]` blocks ordered by severity (BLOCKER | CONCERN | OBSERVATION | OPTIONAL), each with category, location, terse description, evidence chain, and a KEEP | RESHAPE | REVERSE | DEFER recommendation. Prioritize commitment violations, unnamed seams, intent-vs-shape divergence, and user-value failures over surface concerns.
- **7. Verdict** — APPROVE | RECONSIDER | REJECT | NEEDS DISCUSSION, stated `— by D[N]` against the verdict definitions in templates.md, with one ID-cited justification line per criterion and, for APPROVE, the no-counterexample argument.

Hard rules, whatever the section:

- **Evidence chain**: a finding whose evidence chain cites no `O[N]` or `INVARIANT [N]` ID is speculation, not a finding — go gather the observation or drop it. Intent-vs-shape and user-value findings also cite the `P[N]` premise they contradict. Every verdict justification line cites the `FINDING` / `INVARIANT` IDs supporting it (e.g., `Commitment status: BROKEN — FINDING 1, INVARIANT 2`); a line with no finding behind it is unsupported — write the finding or change the line.
- **Relevance scoping** (the paper's "only analyze edge cases that the ACTUAL tests exercise", adapted): a BLOCKER or CONCERN must name the concrete consumer, seam, or artifact that exercises its failure mode, with citation. A failure mode nothing exercises is an OBSERVATION, however alarming it sounds.
- **Verdict precedence**: evaluate the definitions in order D3 (REJECT), then D4 (NEEDS DISCUSSION), then D2 (RECONSIDER), then D1 (APPROVE); the verdict is the first whose conditions hold. This keeps the derivation mechanical — a function of the findings, never a choice among applicable definitions.
- **Dual counterexample obligation**: a negative verdict needs a counterexample — the BLOCKER or CONCERN finding. APPROVE needs an affirmative closure argument, mirroring the paper's required "NO COUNTEREXAMPLE EXISTS … because [reason]": name the seams, consumers, and siblings checked (per Section 0) and state why no unchecked one could flip the verdict. Surviving the opposite-verdict probe is necessary but not sufficient.
- **Recommendation discipline**: a CONCERN or BLOCKER with no recommendation belongs in OBSERVATION. If the verdict is RECONSIDER, name the specific reshape — not "rethink scope" but "merge this into ADR-NNNN and delete the standalone artifact" or "rename the seam to X and move ownership to subsystem Y."

## Anti-Patterns To Avoid

These are this skill's review doctrine — defaults distilled from practice, not claims sourced from the paper (the one exception, structured-but-incomplete, is the paper's own observed failure mode). Treat them as rebuttable defaults: a project's documented commitments outrank them.

- **Title-trusting**: never assume an ADR / spec / plan does what its title implies; read the body and the shape it actually lands as.
- **Citation-by-vibes**: every claim about a prior artifact requires a section or line citation; "the vision says" without a citation is a phantom premise.
- **Implementation-first deference**: if the contract is wrong, recommend reshaping the contract rather than papering over it with adapter layers, compatibility shims, or feature flags as an end state. A temporary shim is acceptable only when the review names it as debt with a retirement condition — greenfield-first applies to platform contracts as a rebuttable default.
- **ADR-as-truth**: not every ADR carries the same authority; advisory-tier documents (ops conventions, style guidance) do not gate a verdict the way ratified specs do. Evaluate scope by user value and core product purpose, not by ADR citation alone, and name the authority tier when applying one.
- **Phantom commitments**: do not claim an invariant or commitment exists without citing where it is stated; "we usually do X" is not a commitment.
- **Sibling-blindness**: always check adjacent artifacts that could subsume or conflict with the one under review.
- **Happy-path lineage**: trace not just the parent ADR but the constraints the parent inherits — drift across two hops is common.
- **Hedging verdicts**: APPROVE / RECONSIDER / REJECT / NEEDS DISCUSSION — not "looks fine but could be tightened." If the verdict is RECONSIDER, name the change.
- **Phased-delivery findings**: do not split a finding into "phase 1: ... phase 2: ..." Phasing pressure is evidence about the parent decision — surface it as a finding on the parent, recommend the first concrete change, and let the owner sequence the rest.
- **Premature verdict**: do not anchor on a verdict before tracing lineage and invariants.
- **Structured-but-incomplete**: a thorough-looking trace can still miss the one downstream artifact that flips the conclusion, and the source paper's error analysis observed that elaborate but incomplete reasoning chains can produce _more confident_ wrong answers, not safer ones. The template is not the verification — the opposite-verdict probe and the consumers you have not yet read are. Before concluding, name what you did not read and why that is safe.

## Step Budget

Use up to 100 tool-use steps — the cap the paper set for all its experiments (§2.1); its semi-formal runs averaged roughly 20–43 steps. Aim for 25 to 50 on typical architecture reviews. Spend more when the artifact crosses subsystem boundaries, supersedes a prior decision, rewrites a load-bearing seam, or has already spawned implementation plans whose drift must be measured.

## Additional Resources

### Reference Files

- **`references/templates.md`** — Fillable output templates for every review section.
- **`references/anti-patterns.md`** — Extended anti-pattern catalog with worked examples.
