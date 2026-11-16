# Phase B.4 — phone screens ported and measured

Generated 2026-11-15. Every number below is copied from a CI run of
`.github/workflows/ci-port-diff.yml` on branch `arena/a9a40385-ui-port`
(PR #1). No number in this file was estimated.

## What B.4 asks for

Port the phone screens (`home`, `library`, now-playing) to Compose through the plugin's
own procedure (stateless composables + fixtures first), run the Compose screenshot tests in
CI, diff them against the Playwright reference, and loop — recording pixel match, SSIM,
geometry and the heat map for every iteration.

## The measurement harness (built in this phase, all of it in the repo)

| Piece | Where | What it does |
| --- | --- | --- |
| Reference capture | `scripts/capture-reference.mjs` | Playwright screenshots of the prototype at 1x (393x852) + a `default.geometry.json` box dump per screen. Same-origin requests only. |
| Compose render | `testbed/SimpMusic/uiPortScreenshots` | Paparazzi, `DeviceConfig(393, 852, Density.MEDIUM, xdpi 160, ydpi 160)` = 1 px per dp, so the PNG extent equals the reference's. |
| Diff | `scripts/diff-all.mjs`, `scripts/lib/diff.mjs` | pixelmatch percentage, SSIM, geometry coverage; writes `summary.json`, `summary.md`, per-screen `.report.json`, and a heat map. |
| Readable diagnostics | `scripts/diff-map.mjs` | coarse divergence map, horizontal bands with mean colours, surface bands, compact probes — printed because logs/artifacts are not readable from every environment. |
| Layout probes | `composeApp/.../uiport/UiPortLayoutProbe.kt` | records the candidate's own boxes and paragraph line counts during layout; the screenshot test writes them to `layout.txt` and CI publishes them as annotations. |

Two facts the harness established and that the port depends on:

- **Paparazzi 2.0.0-alpha05.1 clamps a snapshot to 1000 px on its long edge**, so a 2x
  786x1704 render is impossible. Both sides are therefore compared at **1x**.
- `capture-reference.mjs` takes DPR from `--viewports`, not from the capture spec, so the
  same 1x file has to be passed to both `plan-capture.mjs` and `capture-reference.mjs`.

## Iterations — `library`, phone, 393x852

First pair scored 85.157% (`home` was already at 94.96% by then). The corrections below all
came from the reference digest, whose numbers are quoted in the commit messages.

| # | Change | Pixel match | Run |
| --- | --- | --- | --- |
| 1 | First pair: header, chips, tile grid, three carousels | 85.1572% | 43805387223 |
| 2 | `space-y-8` instead of the home rhythm, one-line 40px title, 36px chips, paper shadow on the tiles | 85.7393% | 43805902225 |
| 3 | Carousels bleed edge-to-edge (`-mx-4` + `px-4`), `space-y-10` between collections | 86.4814% | 43807081816 |
| 4 | Tile padding 13 (border-box), probes on every tile row | 86.9157% | 43809265671 |
| 5 | (regression, found and fixed) a leaked player overlay in the next screen's reference | 68.2612% | 43834780085 |
| 6 | Every capture starts from a cold document | 86.9157% | 43835551613 |

Where it now matches the capture exactly: the title's box (one 40px line at y=36), the chip row
at y=108 with 36px chips on an 8px gutter, the first `.paper` tile at y=176 measuring 175x70 with
its 44px icon plate, and the second column at x=203.

Where it does not: the tile grid is 68px tall per row where the capture has 70, the carousel
cards' shadow and the artwork's vector shapes differ, and the reference's 122-node layout has
entries the port draws as one node.

## Iterations — `home`, phone, 393x852

Each row is one CI run. `Δ` is against the previous row. "geometry" is `-` because the
reference geometry dump and the Compose semantics dump are not yet compared (see
Open items).

| # | Change | Pixel match | SSIM | Run |
| --- | --- | --- | --- | --- |
| 1 | First comparable pair: whole-page reference vs the routed screen only | 80.1189% | 0.427569 | 43694743801 |
| 2 | Port the shell: fixed bottom nav (3 tabs) + signed-out login banner; render at 1x1 | 80.4618% | 0.439217 | 43792712420 |
| 3 | Place the screen on the reference's measured grid: `space-y-10`, `.paper` hero card, 319px cover, 2-line greeting, nav from its content height | **94.9580%** | **0.741883** | 43795122804 |
| 4 | Side inset 12px (hypothesis: `-mx-4` bleed) | 85.1548% | 0.518332 | 43797010963 |
| 5 | Inset back to 16px **and** header column pinned to 209px | 85.4983% | 0.555613 | 43797818753 |
| 6 | Bundle the real webfonts (Instrument Serif + Inter) | 89.2123% | 0.586864 | 43800871100 |
| 7 | Banner button 36px + hero title line box 35px | 89.2571% | 0.586061 | 43801439798 |
| 8 | Platform families instead of webfonts (see below) | 85.1695% | 0.544158 | 43803224074 |
| 9 | Banner text width pinned to the captured 258px box | 85.1844% | 0.544294 | 43804040247 |
| 10 | Restore the best state, keep 36px icon boxes and the probes | 94.8575% | 0.738113 | 43804629278 |

Runs 4–9 are the ones that did not pay off. They are listed because a port that only
reports its successes is not measured, it is advertised.

## What moved the score, and what it proves

1. **The reference is the whole shell, not the routed screen** (iteration 1 → 2, +0.3):
   the web page always renders a fixed bottom navigation and, signed out, a login banner.
   Porting the screen alone can never match it.
2. **The layout, not the drawing, was the problem** (iteration 2 → 3, +14.5): iteration 3
   placed every block on the reference's measured boxes — `pt-2 px-4` main, `space-y-10`
   between sections, a `.paper` hero card (white, 1px hairline, 28px radius, `p-5`), a
   319px cover, and a bottom bar sized by its own content.
3. **The embedded fonts in the prototype never load in the capture.** `capture-reference.mjs`
   aborts every non-same-origin request so the prototype stays self-contained, which blocks
   the Google Fonts stylesheet; the browser then resolves the stacks to `serif` and
   `ui-sans-serif`. That is why iteration 6 (real Instrument Serif + Inter) scored *worse*
   than the platform families: the reference is the fallback, not the webfont.
4. **Text metrics are the residual, and they are measured, not suspected.** With the
   platform families the port reports `header.title` at 2 lines (`209x80`, matching the
   capture) but `banner.text` at 2 lines/38px where the capture has 3/57px. Compose's
   platform sans is narrower than the capture host's fallback, and 40px of downstream
   offset follows from that single paragraph.

## Honest position on `home`

- Best measured: **94.958% pixel match, SSIM 0.742** (run 43795122804) — below the
  project's 98.5% acceptance floor, so the screen is reported as `building`, not accepted.
- Current tree: **94.858%, SSIM 0.738** (run 43804629278) with the hero card landing at
  y=322 and its cover at y=342, both exactly where the capture puts them.
- **The iteration budget for this screen was exceeded.** The plan allowed 5 iterations per
  screen per device; `home` used 10. Stopping here is a decision, not a completion: the
  residual is one paragraph's line break plus the artwork's vector shapes, not a missing
  block or a wrong grid.
- `geometry` coverage is still not measured: the reference writes `default.geometry.json`,
  the Compose side has no `default.semantics.json` yet, so the diff reports `-`. The
  candidate boxes published as annotations are the interim substitute.

## Now playing

The overlay is scored: **79.303% pixel, SSIM 0.431** (run 43835731014). Getting a real number
out of it took five fixes, all of them found by the harness refusing to lie:

1. The `player` state did not exist in `applyState`'s switch, so the capture "succeeded" and
   wrote a screenshot of the plain home page.
2. One script cannot click twice: React needs a tick between starting a track and the mini
   player existing, so it became two evaluations with a wait between them.
3. The state was dropped by the capture plan: state inference reads the screen's own file, and
   the player is mounted by the shell. Shell states are now a named set in `capture-spec.mjs`.
4. "The first button in main" is the header's Notifications control — clicking it navigated to
   `/notifications` and the state reported `state-not-reproducible`. A track row is now found by
   what it renders: cover art and a duration.
5. The overlay opened for the player state stayed open across captures, so `library`'s next
   reference was taken with the player on top and fell from 86.9% to 68.3%. Every capture now
   starts from `about:blank`.

The ported screen reports its own boxes: `header` 361x52 at y=0, `art` 361x361 at y=60, `title`
183x30 at y=445, `play` 72x72 at y=564. The remaining 20.7 points are concentrated in the
header and the lyrics panel, not in the transport.

## Open items, in the order they should be done

1. Emit `default.semantics.json` from the screenshot test (`SemanticsNodeInteraction` dump
   or the layout probe's boxes mapped to the reference's roles) so `geometry` stops being
   `-` and the 1 dp / 90% coverage criteria can be evaluated.
2. Decide the font question with the capture owner: either allow same-origin bundled fonts
   in `capture-reference.mjs` and switch `UiPortFonts` to the bundled families (two lines),
   or accept that the reference's text metrics are the host's fallbacks and keep the
   platform families. Bundling is already done and licensed.
3. `library` and now-playing need the same treatment; their iterations start from the
   harness and the probes built here, which is why they are not 10 iterations each.
4. Then B.5 (tablet + desktop), B.6 (engine wiring), B.7 (APK artifact + delivery ZIP).
