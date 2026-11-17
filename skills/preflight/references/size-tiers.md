# Size tiers: what they change, and how to disagree with one

`uiport size assess` measures the prototype and the target app and applies `config/tiers.json`.
The point is not to label a project. The point is that the label decides how the work is shaped,
and getting that decision wrong is expensive in both directions: a six-screen port sliced into
three batches wastes more time on bookkeeping than it saves, and a forty-screen port of an app
with sixty-four navigation destinations that is ported in one batch produces a branch nobody can
review and a half-ported app nobody can ship.

## The tiers

| Tier | Budget (any one exceeded moves you up) | Strategy |
| --- | --- | --- |
| SIMPLE | 6 screens, 120 files, 2,500 source lines, 15 components, 10 nav destinations, 40 engine files | **Batch** — one pass over every screen, one diff-all at the end |
| MEDIUM | 20 screens, 400 files, 12,000 source lines, 60 components, 25 nav destinations, 200 engine files | **Slices** — every 3–8 related screens, each independently buildable and diffable |
| LARGE | beyond MEDIUM in **at least two** dimensions | **Strangler** — a per-route flag, old UI still renders until the slice is accepted |

Two rules that look like details and are not:

- **The escalation needs two dimensions.** One metric over budget is usually the heuristic
  misreading something — a prototype carrying a large generated fixture has many files and four
  screens. Two is a pattern. A single over-budget dimension stays MEDIUM with the note recorded
  next to the verdict, so the reader sees what nearly moved it.
- **The strategy follows the larger subject.** Twenty-three screens of UI in an app with 666
  engine files and 64 destinations is a LARGE port: the cost is in the app's constraints, not in
  how much UI there is to draw. The prototype's own tier is still printed, because it tells you
  how much UI work is in front of you.

## What each strategy actually requires

**Batch.** One commit-sized change per screen, no flag, no slice ordering. `diff-all` runs once
at the end and every screen has to pass before delivery. Rollback is a revert.

**Slices.** Slice by *user journey*, not by folder: home → album → now playing is one slice, all
of settings is another. Each slice builds, renders, diffs and passes the geometry gate on its own,
and the old screen is deleted in the slice that replaces it. Order matters — a slice may depend on
a shared component an earlier slice introduced, never the reverse.

**Strangler.** Everything in *slices*, plus a per-route runtime flag: each route records which
side renders it, the default is the old UI, and the flag is flipped only after that slice's diff
passes. Add a flag-off smoke test to the checks. The old composable is not deleted until the slice
is accepted — if a slice cannot be rolled back by flipping one flag, it is not a strangler.

## Recording an override

Take the computed verdict to the gate. If the human disagrees, they are probably right about
something the counts cannot see. Record it in `.uiport/answers.json`:

```json
"sizeOverride": { "tier": "MEDIUM", "reason": "twelve of the twenty-three screens are variants of one list" }
```

- The reason is required and must be longer than a couple of words: an override without a
  sentence is a shrug, and a shrug cannot be reviewed later.
- The override changes the strategy, not the numbers. `.uiport/size-assessment.json` keeps the
  measured verdict, `resolveTier()` returns both tiers and both reasons, and the worklog records
  the disagreement. `uiport size assess` prints it as *"the run is MEDIUM, not the computed
  LARGE"* followed by both reasons.
- Never lower the acceptance bar as a side effect of an override. A MEDIUM override changes how
  the work is batched; the 95 floor, the geometry tolerance and the iteration cap stay where they
  are.

## When the numbers move

Re-run the assessment when the maps are built, not only at preflight: the scanners see the app as
it is *now*, and a run that adds modules moves the tier. If the tier changes mid-run, say so in the
worklog and re-plan the remaining slices — silently finishing under a strategy that no longer fits
is how a LARGE port becomes an unreviewable branch.
