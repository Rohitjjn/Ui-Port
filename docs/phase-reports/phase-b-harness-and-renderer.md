# Phase B — the reference harness, the renderer, and what both were hiding

Generated 2026-11-17. Every number here is copied from a CI run of
`.github/workflows/ci-port-diff.yml` or `ci-capture-reference.yml` on branch
`arena/a9a40385-ui-port` (PR #1). Nothing is estimated, and every score is a pair: the reference
capture, the candidate render, and the run that produced them.

## What B asked for

Serve fonts from local files (vendored + licensed), wait for `document.fonts.ready`, verify the
expected families, and fail loudly; put the same files in Compose `res/font`; make that the
plugin's default behaviour and document it. Re-measure all three phone screens before and after.
Emit `semantics.json` from the Compose screenshot test and geometry-compare it against the DOM
`geometry.json`, driving fixes from it. Evaluate Roborazzi or Compose Preview Screenshot Testing as
a replacement for Paparazzi (1000 px clamp), choose with evidence, update the templates.

## 1. What was actually wrong (before)

The capture aborts every request that is not same-origin. That rule is correct — a reference must
not depend on a CDN — but the prototype's only source of its typefaces was
`fonts.googleapis.com`, in `index.html`. So:

- the reference was rendered in Chromium's **fallback** stacks (`serif`, `ui-sans-serif`), and
- the Compose side rendered `FontFamily.Serif` / `FontFamily.SansSerif`.

Both sides looked plausible on their own. The comparison between them was measuring a typeface
difference that neither side reported, and no number could reveal it — the previous phase had
already discovered the symptom (`89.26%` with bundled webfonts vs `94.96%` with platform families)
and recorded it in `docs/LIMITS.md` as an open question. B answers it.

Two harness bugs were found while fixing this, and both had been silently distorting every earlier
measurement:

| Bug | Effect | Where it was caught |
| --- | --- | --- |
| Font styles were injected once per context, but each capture starts from `about:blank` | every capture after the first silently reverted to fallback fonts | reading the capture loop while adding the assertion |
| The reference was pinned to DPR 1 to work around Paparazzi's 1000 px clamp | a 393×852 image compared against a 786×1704 render | the first 2x run: `screenshot sizes differ: reference 393x852 vs candidate 1179x2556` |

## 2. What the harness does now

| Piece | Where | What it guarantees |
| --- | --- | --- |
| Font manifest | `config/fonts.json` | families, weights, files, licences, source dir, mirrors |
| Vendored files | `res/font` (+ `OFL-*.txt`) | the canonical bytes both sides must use |
| Mirroring | `scripts/vendor-fonts.mjs` | `--check` exits **8** on one-byte drift; runs before the render in CI |
| Served locally | `scripts/capture-reference.mjs` | the capture answers `/fonts/*` from disk; the page cannot reach a CDN |
| Stack override | `scripts/lib/fonts.mjs` | `--font-sans`/`--font-serif` lose every fallback family behind them |
| Load + assert | `FONT_LOAD_SCRIPT`, `FONT_ASSERT_SCRIPT` | each declared face is forced to load, then must be `status === "loaded"` with the declared weight; a failure is `font-check-failed` and the capture **refuses the screenshot** |
| Same files in the app | `UiPortFonts.kt` | `composeResources/font`, weights 400/500/600 + serif 400 declared rather than synthesised |

Evidence that it works, from `ci-capture-reference` on `6c5655d` (run
[43844146521](https://github.com/Rohitjjn/Ui-Port/actions/runs/43844146521)):

```
fonts home/default      | vendored faces loaded | rendered families: Inter,Instrument Serif
fonts library/default   | vendored faces loaded | rendered families: Inter,Instrument Serif
fonts library/player    | vendored faces loaded | rendered families: Inter,Instrument Serif
noise floor             | worst same-side match 100% (home/phone); noise 0%; effective floor 95%; deterministic: true
```

The reference now renders with the real typefaces **and** the capture is still perfectly
deterministic (100% same-side, noise 0%) — the two properties that had to hold together, because a
font that loads late enough to change is a non-deterministic reference.

## 3. Renderer decision: Roborazzi (Robolectric), Paparazzi kept as the fallback

| | Paparazzi 2.0.0-alpha05.1 (layoutlib) | Roborazzi 1.79.0 + Robolectric 4.17 |
| --- | --- | --- |
| Max image | **clamps to 1000 px on the long edge** — 786×1704 is impossible | 786×1704 rendered, measured (`render size` annotations) |
| Semantics tree | not available; only what the test itself records | `onRoot(useUnmergedTree = true)`, bounds in dp, roles, test tags |
| Fidelity | layoutlib's own resource loading; fonts from `composeResources` failed to load in the first attempt | Robolectric `GraphicsMode.NATIVE` renders real text |
| Cost | fast, one task | a JVM test run; comparable here |
| Fit for the gate | cannot produce the candidate half of the geometry gate | produces both halves in one test |

**Decision: Roborazzi is the default; Paparazzi stays wired as a documented fallback** for a
project whose engine refuses Robolectric (`config/tools.json` keeps both, with the reason). Compose
Preview Screenshot Testing was not chosen: it is AGP-coupled and alpha, and the target project is on
AGP 9.5.0, ahead of the published plugin — the same conclusion the earlier research reached, now
with the additional reason that it produces no semantics dump either.

The geometry gate is what settles it. Section A made the gate mandatory, and a screenshot tool that
cannot emit the candidate's semantics tree can only ever report "not measured", which is a failure
by the new contract. Paparazzi cannot produce it; the Compose test rule can.

## 4. The geometry gate, and two measurement bugs it exposed

`sems.json` is written by `dumpSemantics` in `testbed/SimpMusic/uiPortRoborazzi` during the same
test that renders the PNG. Getting a *meaningful* comparison out of it took three corrections, each
of which had been hiding a false verdict:

1. **`boundsInRoot` is device pixels**, not dp. Dividing by the rule's density is what makes the two
   dumps comparable (the web side measures CSS pixels).
2. **Wrapper nodes are not missing elements.** The DOM dump records every text-bearing element *and*
   every role-bearing container (home: 402 raw nodes), while Compose semantics records text leaves.
   Comparing raw lists reported hundreds of "missing" wrappers and a 0% coverage for a correct
   screen. `canonicalNodes` reduces both sides to nodes that carry their own text (plus anchored
   test-id nodes), and the report prints canonical **and** raw counts, because
   "reference 402 / candidate 380" and "reference 300 / candidate 380" mean different things.
3. **Both dumps must describe the viewport.** All three screens scroll with `verticalScroll`, so
   Compose composes and clips only the visible rows, while `getBoundingClientRect` reports elements
   far below the fold. The DOM dump is now clipped to the viewport (partially visible counts, with a
   `clipped` flag so a reviewer can tell a layout error from content that continues below the fold).

After (3) the gate started reporting real, actionable mismatches instead of an artifact:

```
geometry home | geometry-compare: 0 matched, 9 mismatched, 1 missing, coverage 0%
              | (tolerance 1 dp; reference 10 of 26 raw, candidate 16 of 16 raw)
geometry home |   What is the best choice today?   dx= 0     dy= 2.06  dw= 20   dh= 0.3
geometry home |   Library                          dx= 15    dy= 37.94 dw= 29.5 dh= 49.94
geometry home |   Search                           dx= 15    dy= 37.94 dw= 29.5 dh= 49.94
geometry home |   Home                             dx= 17    dy= 37.94 dw= 34   dh= 49.94
```

Those are the bottom-navigation items, 15–17 dp right of where the prototype puts them and ~38 dp
shorter — a real porting error that the pixel score had been absorbing (home still scores 96.0%).
This is exactly the failure mode section A's geometry gate exists for, and it was found within one
run of the gate being turned on.

## 5. Before / after, all three phone screens

Both columns are 2x (786×1704). The "before" numbers were 1x (393×852) against a fallback-font
reference; the "after" numbers are the same screens against the vendored-font reference at the
configured DPR. They are **not directly comparable as a delta** — three things changed at once
(fonts, density, dump granularity) — which is why the delta is not claimed. What the pair does show
is which screens clear the 95% floor now.

| Screen | Device | Before (1x, fallback fonts) | After (2x, vendored fonts) | Geometry | Status | Run |
| --- | --- | --- | --- | --- | --- | --- |
| home | phone | 94.8575% | **95.9995%** | 0% (10 ref / 16 cand nodes) | building | [44016202554](https://github.com/Rohitjjn/Ui-Port/actions/runs/44016202554) |
| library | phone | 86.9157% | **87.5511%** | 0% | building | [44016202554](https://github.com/Rohitjjn/Ui-Port/actions/runs/44016202554) |
| nowplaying | phone | 79.3033% | **79.8252%** | 0% | building | [44016202554](https://github.com/Rohitjjn/Ui-Port/actions/runs/44016202554) |

SSIM is reported and not gated (`0.791629`, `0.573181`, `0.531409` respectively).

Honest reading of the table: `home` now clears the pixel floor at full density with the real
typefaces, and the other two do not (87.6% / 79.8%). None of the three is accepted, because the
geometry gate is failing on all three — `home` on the nav offsets above, `library` and
`nowplaying` because the visible viewport contains most of their content and the canonical node
counts still differ, which is the next fix to make and drive from the geometry report rather than
from the image.

## 6. What changed in the plugin, not just the testbed

- `skills/capture-reference/SKILL.md`: vendoring is step 3, before capture, with the exit-code
  contract (`7` = no browser, `8` = fonts did not load) and the rule that a failed font check is
  never overridden for one screen.
- `skills/capture-reference/references/deterministic-capture.md`: the font row now describes the
  real mechanism (served from disk, stack override, asserted after `ready`).
- `templates/compose-screenshot-test/`: the Roborazzi template already documented a semantics dump;
  it is now the same code path this project runs (`UiPortSemanticsDump.kt` is the working
  implementation).
- `config/tools.json`: Roborazzi pinned to a version that exists (1.79.0), with the note that the
  pin is verified against the release feed rather than guessed.

## 7. Open, and what is next

- The nav offsets (15–17 dp, ~38 dp height) on `home` are the first geometry-driven fix; the
  prototype's bottom nav is taller and inset further than the port's.
- `library` and `nowplaying` need their visible-viewport node sets reconciled; their pixel scores
  are far from the floor, so they are the next port iterations once the harness is trusted.
- The renderer's own `@Config` surface is version-specific; the display size lives in
  `src/test/resources/robolectric.properties`, because `@Config` has no `resolution` parameter in
  Robolectric 4.17 (a compile error, not a silent fallback — recorded so it is not retried).
