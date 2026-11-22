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

**Answered 2026-11-17 by `79bfedd`, with the mechanism identified and half the box fixed.**

The Row had `height(72.dp)` *and* `padding(vertical = 8.dp)` *and* the Column had
`padding(vertical = 8.dp)` — the NavLink's own `py-2` applied twice — leaving 56 dp for a Column
that needs 66 (8 + 32 pill + 2 gap + 16 label + 8). Compose clipped the label to exactly the 6 dp
the report measured, on all three items, which is why it looked like a rendering artefact.

The arithmetic also showed the bar is 66 dp, not 72: the reference's link measures 64x65.94 with
its bottom edge at y=851.94 in an 852 frame.

After the fix, measured on the next run: the label boxes went from **6 dp to 16 dp** tall — the full
line height, no longer clipped — and the missing paragraph now reports its box
(`ref[37,762.14 319x68.25]`).

What remains is a different bug, not this one: the label is still `34.5` wide against a reference
`64`, and the enclosing link box is not in the dump at all, so there is no 64x65.94 ancestor for
`bestBoxFor()` to match. A `Column` with `fillMaxHeight()` and `padding(vertical = 8)` measures
66x66, so the 34.5-wide leader must come from the `Text` inside it — that is the next thing to look
at, and it is now a specific question rather than "the nav is wrong".

**Measured after `c63d8ca`:** the three nav rows left the mismatch list entirely, `home`'s matched
nodes went 0 -> 3 and coverage 0% -> 30%, and `library` went 0% -> 6.82% from the same change (its
nav shares the shell). The mechanism: the DOM's labelled node for a nav item is the whole `<a>`,
while an unmerged Compose tree only emits nodes that carry text or a tag — so the link had to be
given `selectable(role = Role.Tab)` to exist as a node at all, which is also what a navigation
target should be.

**Cost, stated plainly:** the corrected bar height cost `home` 0.0906 pp (96.0406 -> 95.95) and
gained `library` 0.0454 pp (87.5961 -> 87.6415). Both are under the 0.15 regression line, which is
why the score did not fail the run and why this went unnoticed until the numbers were read side by
side — `diff-all` now reports every downward move separately from regressions, so the next such
trade is visible when it happens.

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

---

## N-5. `nowplaying`'s reference was the create-playlist sheet, behind 43 occluded nodes

**Asked** 2026-11-17, after the occlusion fix in `065737e`.

`nowplaying` compared 55 reference nodes against 14 and sat at 0% since the gate started reporting.
The cause was upstream of the port: the screen has no route (the player is an overlay), so its
reference is relabelled from whichever `*/player.png` state the capture produced, and that dump
included the entire page underneath the overlay — "Liked songs", "Your playlists", "New playlist",
"Followed artists", all hidden by the player. 43 of the 55 nodes were things the screenshot does not
show, so that reference could not have been satisfied by any amount of porting effort.

After dropping covered nodes, the reference is **12 nodes** and the candidate 14 — a fair
comparison for the first time. It is also not the player: the reference's own labels are
"Create", "Create playlist"-style sheet content at y≈483-594, i.e. the capture labelled a
create-playlist sheet as the now-playing screen.

**How to settle it:** decide what `nowplaying` is supposed to be. The port renders the full player
(`UiPortNowPlayingScreen`), so the reference must be a capture of the full player. Either the
capture spec gains an explicit `player` state with a stable selector to assert it opened, or the
screen is renamed to what the capture actually produces. Both are honest; relabelling a sheet as a
player is not.

**Status:** open. `nowplaying` cannot be scored meaningfully until this is decided — its 0% is
currently a measurement of the wrong screen, not a port defect.

---

## N-6. Seven ways the reference was wrong, and what each one cost

**Asked** 2026-11-17, over `065737e`..`a8a905d`.

Chasing `library`'s "nothing matches" turned into a list of defects on the *measuring* side. Each was
found by a row that did not make sense, and each is now a test.

| Defect | Effect on the reference | Found by |
| --- | --- | --- |
| Occluded nodes counted | `nowplaying` compared 55 nodes, 43 hidden under the overlay | 55 vs 14 with no way to pass |
| Decorative wrapper is a node | `"Most played 10 items"` — one string from two spans | same text, no candidate, 22 of 44 rows |
| Container re-announces its child | 11 of 33 nodes were duplicates of their own children | `ref=33` for a screen with 22 labels |
| Semantic container named by concatenation | 8 tiles "missing" while all 8 rendered | `"Most played 10 items" ref[16,257.94 174.5x70]` |
| Block box measured as text | every `<span class="block">` looked 40 dp too wide | `"4 items" ref w=83.97` vs `cand 42.5` |
| ...then applied to targets | all three nav rows broke; `home` 33.33% → 0 | run `44142920347`, whole screen at 0 |
| Leaf box used when no box matched | a 2 dp chip read as a 17 dp height error | `d=(17.27,10.56,30.47,17)` on a 36 dp chip |

**The one that cost a run:** applying the text-extent rule to buttons and links collapsed the nav
`<a>` from 64 to 56 dp and took all three screens to 0%. It was reverted within one commit. The rule
that survives is the one the duplicate check already used — a target is a box, a text run is text —
and the test now asserts `SEMANTIC` is declared *before* the extent IIFE reads it, because a
temporal-dead-zone throw there would have taken the whole dump down silently.

**Net effect on the numbers:** `library` 9.09% → 11.54%, `home` 33.33% held. That is a small move for
this much work, and the honest reading is that most of it bought *diagnosis*, not score: the
remaining rows are now real port defects rather than the capture disagreeing with itself.

**Status:** the capture is defensible for these three screens. `nowplaying` remains blocked on N-5.

---

## N-7. A thing you can click is a node — three times over

**Asked** 2026-11-17, over `e64469e`..`0e141c8`.

The same defect appeared three times on `library` and once on `home`, each time dressed differently:

| Element | Prototype | Port had | Reported as |
| --- | --- | --- | --- |
| nav item | `<a>` 64x65.94 | bare `Text` 34.5x16 | `d dy=41.94 dh=49.94` |
| filter chip | `<button class="h-9">` | inert 36 dp `Box` | `dh=17` on a correct height |
| playlist card | `<button>` 150x197.69 | inert `Column` | `dy=172.06` on a correctly placed card |
| album / artist card | `<button>` | inert `Column` | same |

The dump emits a node only when it carries text, a content description or a testId, and an unmerged
Compose tree does not fold a child's text into its parent. So a container with a role and a child
`Text` produces *only the child*, and the comparator then measures a label against a card.

**The lesson worth keeping:** in all four cases the port had made something inert that the prototype
made clickable. A `clickable`/`selectable` is not a semantic nicety added to please the gate — it is
the behaviour the screen was supposed to have, and the gate noticed its absence because a clickable
target and a text run are different shapes.

**Measured effect of the card fix alone:** `dy` on both playlist cards fell from 172.06 to 12.06 with
`dw=dh≈0`, which finally made the 16 dp carousel offset visible. Fixing that offset (`0e141c8`) moved
`library` pixel **87.6415 → 88.6675** (+1.026) and SSIM **0.5821 → 0.6075** — the largest single
improvement in the whole port so far, and it came from a 1-line padding change that was invisible
until the cards had a box to measure.

## N-8. The +2 dp text box, and a failed first attempt

Every text row carries `dh ≈ +2`: `"Good morning, Guest"` ref 80 / cand 82, `"Your playlists"` ref 30
/ cand 32, `"Late Shift"` dh 0.69 on a 197.69 box. Compose's default `includeFontPadding = true` adds
the font's ascent/descent slack; Chromium's line box is the line-height. That explains it, and it is
worth fixing.

**Attempted and reverted (`bfd00bc` → `449af33`).** A `UiPortTextStyle` helper setting
`PlatformTextStyle(includeFontPadding = false)` compiled and then broke the renderer:
`:uiPortRoborazzi:testDebugUnitTest` failed and all three screens reported `missing-candidate` — the
port stopped being measured entirely. The exception could not be read, because the job's ten-notice
budget is consumed by gradle output before the `What went wrong` block and `gh run view --log` returns
empty here.

**Status:** open, with the mechanism identified but unproven. The next attempt must be able to
*confirm* the fix independently — dumping one known text box in a test assertion, so a
`missing-candidate` cannot hide behind an unreadable log — before it is spread over 52 call sites.
Reverting was the right call over iterating blind: an unmeasured screen is worse than a 2 dp one.
