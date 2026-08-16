# Growth signals are advisory, not gradeable

The numeric growth triggers in the doctrine — a file passing ~200 lines, a
file holding 3+ distinct concepts, 3+ related files clustering around a
sub-concept — are **advisory signals that prompt a look**, never graded
violations. The only growth check that stays gradeable is 2+ concrete uses
for a directory or abstraction. What review tools actually grade instead is
implementation share (crust size relative to slice size), public-surface
size, and lifetime mixing.

## Why

Two things collided. First, `reference/sliced-bread.md` defined these
numeric triggers, but neither the audit script nor the review skill actually
implemented them — both graded only "2+ concrete uses" — so the most
checkable-looking criteria in the doctrine were dead letters that nothing
enforced. Second, PR #17 declared a 250-line crust healthy because it
constituted 100% of a pure-factory leaf slice, directly contradicting the
~200-line trigger read as a limit. See ADR-003,
`docs/adr/sliced-bread-doctrine-revision-003.md` (read in full).

Making ~200 lines an enforceable limit was considered and rejected: it grades
length rather than depth and would fire on legitimately long leaf files, and
PR #17's calibration would have had to bend to a number with no evidentiary
basis. Dropping the numbers entirely was also rejected — the concrete
calibration is what makes the growth rule teachable, even though it isn't
what tooling grades.

## Practical effect for review

When citing a growth finding, cite the ratio (implementation share) and
surface count as evidence — not "the file is over 200 lines" as if that were
itself a violation. The numbers remain useful as a prompt for a human or
audit pass to _look_, not as the grading criterion.

## Growth guards (false positives to suppress)

The `growth-guards` marker-fenced block (kept in sync across consumers per
[[architecture/doctrine-canonical-source]]) lists false positives to
suppress when grading growth:

- A new single-file concept that stayed a single file is correct, not a
  finding.
- A dispatcher introduced to break a cross-slice cycle is not premature
  abstraction, even with one event and one subscriber — see
  [[architecture/event-model]].
- The numeric thresholds are advisory signals, not gradeable violations;
  grade implementation share, public-surface size, and lifetime mixing
  (scoped to the numeric signals — the 2+-concrete-uses check stays
  gradeable).
- In a language whose only privacy mechanism is file placement, a
  subdirectory marking its contents internal is the visibility mechanism,
  not growth structure — see [[architecture/crust-definition]].
