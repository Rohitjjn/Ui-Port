# Phase C — size assessment: a tier you can check

Generated 2026-11-17. Every number below is either printed by a committed script or read from a
committed config file, and the commands that produce them are in the text. Nothing here is
estimated. The one place a number is *not* measured is called out in §6.

## What C asked for

SIMPLE / MEDIUM / LARGE must be **measured, not guessed**, with budgets calibrated from the test
beds, and a per-tier strategy (batch / slices / strangler) wired into the skills so the verdict
changes how the work is done rather than only how the report reads.

## 1. Why the tier matters enough to measure

The tier decides the shape of the entire run: one batch, journey-sized slices each verified on
its own, or a strangler migration behind a per-route flag. Those are not stylistic variants. A
six-screen port cut into three batches spends more on state, worklogs and per-slice diffs than it
saves; a forty-screen port of an app with sixty-four navigation destinations done in one pass
produces a branch nobody can review and a half-ported app nobody can ship. So the verdict has to
be defensible to the person approving it, and it has to be reproducible by a later reader who
suspects it was chosen to fit a narrative.

## 2. What is counted, and where it comes from

`scripts/size-assessment.mjs` does not walk the tree itself. It calls the two scanners the maps
are already built from — `scanPrototype` and `scanApp` — so the assessment cannot disagree with
the map the port is actually built on. `config/tiers.json` holds the budgets; the script only
counts, compares and explains.

```
node scripts/uiport.mjs size assess testbed/prototype --app testbed/SimpMusic
```

## 3. The measurements

Run on the committed test beds at `8cb67f8`:

| Subject | Screens | Files | Source lines | Components / composables | Stores / ViewModels | Engine files | Nav destinations | DI modules |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `testbed/prototype` (React 19.2.6 / Vite 7.3.7) | 23 | 35 | 4,952 | 58 | 4 / — | — | — | — |
| `testbed/SimpMusic` (AGP 9.5.0, Kotlin 2.4.21) | 37 | 1,567 | 1,175 Kotlin | 666 | — / 35 | 666 | 64 | 11 |

The prototype's extra dimensions, for the wiring plan rather than the budgets: 14 libraries,
50 event handlers, 43 motion items, 2 image assets.

## 4. The verdict, and the dimension that drives it

```
Verdict: `LARGE` — Strangler, per-route flag (strategy: `strangler`)
Driven by `SimpMusic`: exceeds the MEDIUM budget in 4 dimensions.
```

| Metric | SIMPLE | MEDIUM | prototype | SimpMusic |
| --- | --- | --- | --- | --- |
| screens | 6 | 20 | **23** (over SIMPLE) | **37** (over both) |
| files | 120 | 400 | 35 | **1,567** (over both) |
| sourceLines | 2,500 | 12,000 | **4,952** (over SIMPLE) | — |
| components | 15 | 60 | 58 (inside MEDIUM, 97% of it) | — |
| navDestinations | 10 | 25 | — | **64** (over both) |
| engineFiles | 40 | 200 | — | **666** (over both) |

So each subject has its own answer: the **prototype is MEDIUM** — over the MEDIUM budget in one
dimension (screens, 23 against 20) and within three of it in another (components, 58 of 60), so it
is pressed against the ceiling without being a large job; the **app is LARGE** — over MEDIUM in
four. The run's strategy follows the
larger subject, because the cost of the port is dominated by the app's constraints (navigation,
DI, engine risk), not by how much UI there is to draw. Both tiers are printed, because the
prototype's tells you how much UI work is in front of you and the app's tells you how it has to be
delivered.

Note the one that stays MEDIUM despite being over budget. `components` at 58 of 60 is inside the
budget, `screens` is not, and under the escalation rule below a single over-budget dimension is
not enough to promote anything. That is the rule doing what it was written to do, and it is
recorded next to the verdict rather than hidden.

## 5. Two rules that are decisions, not details

**Escalate on two dimensions, not one.** A single over-budget metric is usually the heuristic
misreading something: a prototype carrying a large generated fixture has many files and four
screens. Two is a pattern. A single dimension stays MEDIUM and carries a note saying what nearly
moved it, so the reader sees the near-miss instead of having to guess.

**A dimension the subject does not report is skipped, never counted as zero.** Apps report
`navDestinations` and `engineFiles`; prototypes do not. Treating the missing ones as zero would
make every app automatically fit SIMPLE on those dimensions, which is worse than not measuring
them at all. There is a test for exactly this (`dimensions a subject does not report are skipped,
not counted as zero`).

## 6. What the numbers cannot see — and the override

The heuristic cannot tell that twelve of twenty-three screens are variants of one list. A human
can. That is what the override is for, and it is the only part of this phase that is deliberately
not measured:

```json
"sizeOverride": { "tier": "MEDIUM", "reason": "twelve of the twenty-three screens are variants of one list" }
```

- A reason longer than a shrug is required; a two-word reason is rejected by the validator.
- The override changes the strategy, not the numbers. `.uiport/size-assessment.json` keeps the
  computed verdict, `resolveTier()` returns both tiers and both reasons, and the CLI prints
  *"the run is MEDIUM, not the computed LARGE"* followed by both.
- It does not lower the acceptance bar. The 95 floor, the geometry tolerance and the five-iteration
  cap are untouched by a tier override; it only changes how the work is batched.

`config/tiers.json` also carries an `advisory` block — screen count, nav destinations, engine
files and DI modules weighted for the human's context — and a `cannotSee` list that names
sourceLines as the thing it counts but cannot judge. Both are explicitly outside the computation.

## 7. The strategies, as the skills now state them

| Tier | Strategy | What it requires |
| --- | --- | --- |
| SIMPLE | batch | one ordered list, no flag, `diff-all` once at the end, rollback = revert |
| MEDIUM | slices | 3–8 screens per slice, sliced by user journey, each builds + renders + diffs + passes geometry on its own, old screen deleted in the same slice, rollback = revert the slice |
| LARGE | strangler | 2–5 screens per slice, dependency-ordered, per-route runtime flag defaulting to the old UI, flag-off smoke test per batch, old composable kept until the slice is accepted, rollback = flip the flag |

Wired into the skills, not just documented:

- `skills/preflight` runs the assessment and puts the tier in the approval batch, with the
  dimension that drove it and what it implies.
- `skills/plan-screens` re-runs it at map time (the preflight verdict can be stale) and writes
  `.uiport/maps/run-plan.md` whose shape is chosen by the governing tier — including the flag
  table for a strangler and the per-slice checks.
- `skills/port-screen` reads that plan first: a screen outside the current slice is out of scope
  even if it is right there, and the old composable is never deleted before its gates pass.
- `skills/preflight/references/size-tiers.md` and
  `skills/plan-screens/references/run-plan-template.md` carry the detail.

## 8. Tests, and what they caught

`npm test` → **231 pass / 0 fail** (20 new), plus `validate-plugin` OK (11 skills) and
`lint-markdown` OK (69 files).

The tests were written against the implementation and immediately caught two contradictions in
`config/tiers.json` itself:

1. `rules.classifyBy` claimed that exceeding any single budget promotes the subject, while the
   escalation rule requires two. The escalation is the deliberate, newer rule; the prose was
   stale. Fixed in the config, not papered over in code.
2. A `signals` block called `sourceLines` "ignored" — while `sourceLines` is one of the six
   budgets. It is now `advisory`, explicitly outside the computation, with a `cannotSee` list that
   says what it cannot judge rather than pretending to ignore it.

Both were documentation-vs-behaviour disagreements that would have shipped silently: the config
is read by humans at the gate and by no parser, so nothing but a test would ever have noticed.

## 9. Open, and what is next

- **N-1** (below-fold scroll extent) still blocks `library` and `nowplaying` at the geometry gate.
- **N-2** (1 dp tolerance for text at 2x) and **N-3** (`font-bold` at 700 with no vendored 700)
  remain open in `.uiport/notes/decisions.md`.
- Section D (the port of the three phone screens under the strangler strategy) is next. The
  run-plan template is written for exactly this subject, so D starts by filling it in against the
  maps, flag table first.

## 10. A provenance bug found while writing this report

Run `44038847626` reported `provenance :: commit 1fff22b`, which is not a commit on the branch and
does not exist in the local clone. `git ls-remote` explains it: on a `pull_request` run
`actions/checkout` checks out **`refs/pull/1/merge`** — GitHub's synthetic merge of the branch into
`main` (`1fff22b4d6…`) — not the branch head (`29163b6`). The annotation was therefore accurate and
useless: the SHA it named is ephemeral, disappears when the PR closes, and cannot be checked out by
anyone reading the report later.

The step now names both and labels the synthetic one, so a score can be traced to the tree that
produced it:

```
commit <branch head> (PR head; checked out <merge sha> = github synthetic merge, not a branch commit)
```

This matters more than it looks. Every number in this document is supposed to be traceable to a
commit, and a provenance line that looks precise while pointing at a merge commit nobody can
re-fetch is exactly the kind of claim this project's rules forbid — precise-looking and
unverifiable.
