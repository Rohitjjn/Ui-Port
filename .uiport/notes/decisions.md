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

**Status:** open. `home` is unaffected (its content fits without scrolling), so the fix can land
without blocking the rest of the run.

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

**Status:** open, informational. No action unless the report shows a repeated ±2 dp pattern.

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
