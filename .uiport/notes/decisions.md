# Open questions — the port's own run

Recorded as they came up, with what would settle each one. Section E asks for a `.uiport/notes/`
directory; this is the first entry, and it exists because a decision that lives only in a chat
message is not a decision the next run can honour.

---

## N-1. How should the geometry gate treat content below the fold?

**Asked** 2026-11-17, during phase B, after the gate's numbers became trustworthy.

**The problem.** The Compose screens scroll with `verticalScroll`, so they compose and clip only
the rows inside the 852 dp viewport. Chromium's `getBoundingClientRect` reports every element in
the document, including those far below it. The DOM dump is now clipped to the viewport, which
makes the two dump sets comparable, but the *reference* still has a taller scroll container: for
`library` the reference yields 82 canonical nodes and the candidate 28, and the difference is
section content the port has laid out (and would show on scroll) but cannot have rendered inside
the frame.

That is a measurement question, not a porting defect, and it blocks `library` and `nowplaying` from
ever passing the gate at this viewport.

**Options.**

| Option | What it means | Cost |
| --- | --- | --- |
| A. Compare at a shared scroll extent | Capture the reference with the container scrolled to a defined offset and render the candidate at the same offset. Needs a `--scroll` state in the capture spec and a scroll parameter in the screenshot test. | One spec field, one test parameter, one re-capture per screen. Compares what a user sees at that scroll position. |
| B. Compare only the first frame, and say so | Keep the viewport clip, and record the unmeasured-below-fold area as a declared limit per screen (a note, not a residual category). | Cheapest. Makes the gate silent about everything below 852 dp — a missing section would go unnoticed. |
| C. Capture full-page on both sides | `fullPage: true` for the reference; render the Compose screen at its measured content height. | Largest change; loses the "what the device shows" property, and Paparazzi-style tools cannot render an unbounded height. |

**Recommendation: A**, because it keeps the gate honest (a missing section is still caught) and it
is the only option that measures the same thing on both sides. B should be refused: a gate that
cannot see below the fold is the pixel-metric problem again, one dimension over.

**Status:** open, and now quantified. The per-node tables show how much of each screen's reference
set the candidate cannot reach inside the viewport:

| Screen | Reference nodes | Candidate nodes | Missing | Reading |
| --- | --- | --- | --- | --- |
| `home` | 10 | 16 | 1 | the one missing node ("Recorded over one winter…") is a paragraph inside a card that is laid out |
| `library` | 44 | 28 | 22 | half the reference's labels have no counterpart in the frame |
| `nowplaying` | 55 | 14 | 51 | the candidate has a seventh of the reference's labels |

Some of that is below-fold content (option A's subject). All of it cannot be: `nowplaying` has 14
candidate nodes against 55 reference nodes, and the screen is 852 dp tall, so its top frame should
hold far more than that. N-4 records what else is going on there. Until both are resolved, this
note's recommendation (compare at a shared scroll extent) remains the right fix for the part that
is genuinely below the fold, and it is not sufficient on its own.

---

## N-4. The nav bar reports 6 dp tall, and it is not a rendering artefact

**Asked** 2026-11-17, from the first per-node geometry table for `home`.

The three bottom-nav items come back as `cand[310.5,830 34.5x6]` against a reference
`ref[295.5,786.06 64x65.94]`. A 6 dp height on a nav label is not a rounding difference: it is the
height of a text box whose parent has clipped it, and the same 6 dp appears on all three items
(`Home`, `Search`, `Library`), each offset by ~15 dp horizontally.

This is the same nav item that `d51a113` fixed a month of CI ago (the `min-w-[64px] py-2` port), and
the pixel score rose when it landed. So either the Compose tree changed after that fix, or the
semantics dump records the `Text` inside a fixed-height clipping parent and the box is real but the
*measured* node is the wrong one for comparison.

**How to settle it:** the candidate dump carries `ancestors` for exactly this reason. If an ancestor
box matches `ref[295.5,786.06 64x65.94]` within tolerance, the comparator's `bestBoxFor()` will use
it and the row disappears from the mismatches; it did not, so no ancestor matches either. That
points at the Compose layout, not the dump — the first thing to check is whether the nav row is
inside a parent that constrains its height (72 dp bar, 56 dp pill), because a 6 dp box is what a
`Text` looks like when its parent has no room for the line.

**Status:** open. Blocks `home`, and blocks the other two screens' nav rows for the same reason.

---

## N-2. Is the 1 dp geometry tolerance right for 2x rendering?

**Asked** 2026-11-17.

The tolerance is expressed in dp and the dumps are in dp, so the 2x change should not affect it.
What is unverified is whether 1 dp is *achievable* for text boxes once the real fonts are in play:
Chromium and Skia round line boxes differently, and the reference's own boxes are fractional
(`dy=2.06` on one node). A systematic 2 dp offset on text would fail the gate for a correct layout.

**How to settle it:** the noise floor for geometry, not pixels. Render the same screen twice
through the two renderers and compare the dumps against themselves — there is no tool for that yet,
only for images (`--calibrate`). Until it exists, any repeated ~2 dp text offset should be read as
tolerance, not as a defect, and the gate's `worst` report will show it as a cluster rather than an
outlier.

**Status: answered by measurement, 2026-11-17 — and the answer is "not this".** The geometry
summary now classifies every failing screen by signature, and all three came back `scattered`, i.e.
no dominant offset: the nodes are not moving together, so a systematic text-metrics shift is not
what this is. The per-node tables (job `geometry-detail`, one job per screen) then gave the numbers:

| Screen | Nearest node | Furthest | Representative rows |
| --- | --- | --- | --- |
| `home` | 0.06 dp | 139 dp | nav items `34.5x6` vs `64x65.94`; heading 20 dp narrow; a paragraph missing |
| `library` | 2.41 dp | 59.94 dp | 22 of 44 reference nodes have no counterpart at all |
| `nowplaying` | 125.06 dp | 125.06 dp | only 14 of 55 reference nodes exist |

The 2.41 dp and 0.06 dp rows are the near-misses this note was worried about, and they are a
minority. The bulk of the 0% is content that is not there. So the tolerance question stays open in
principle but is not what is failing the gate, and it must not be loosened to make it pass: a
tolerance that accepts a 2.41 dp text offset would also accept a missing section, which is exactly
the trade this note exists to refuse.

The real finding is that coverage is 0% even where boxes are within a pixel, because the gate's
coverage counts *matched* nodes and every screen has at least one missing node plus many
near-misses. That is the gate working as specified (all three must pass) and the port being far
from done — not a measurement problem.

---

## N-3. Which font weight does the prototype's `font-medium` resolve to?

**Asked** 2026-11-17.

`config/fonts.json` vendors Inter at 400/500/600 and the prototype uses `font-medium` (500) and
`font-semibold` (600). It also uses `font-bold` in one place (`components/cards/index.tsx`, the
explicit-content badge, `text-[9px]`). No 700 file is vendored, so that badge is either
synthesised by the browser (faux bold) or falling back — which would be a `text-rendering`
residual on a 9 px glyph, invisible in the score but wrong.

**How to settle it:** add Inter 700 to the manifest if the prototype really renders it; otherwise
remove `font-bold` from the prototype's badge. The capture's `usedButNotVendored` report answers it
in one run — it lists every family the page rendered that is not in the manifest.

**Status:** open, small. The badge is 9 px and does not affect any current score materially.
