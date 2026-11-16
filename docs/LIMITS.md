# Conversion limits

What a web prototype can do that Compose cannot reproduce exactly, what to do about it, and how to
log it so the residual difference is explained rather than hidden.

Every residual in a diff report must carry one of the `category` values below. These are the same
values `config/thresholds.json` allows for `accepted-with-notes`.

---

## 0. Why the acceptance floor is 95% and not 100%

The floor is **95% pixel match**, the goal is **~99%**, and both numbers come from the engines rather
than from taste. This section is the rationale the floor is required to carry.

**Chrome and Android do not rasterise text the same way.** The reference is Chromium/Skia on desktop;
the candidate is Skia on Android through Paparazzi's layoutlib. Same font file, same size, same
colour — still a different rasteriser build, different hinting, different gamma-corrected blending,
different gamma for the AA fringe. A single 16sp glyph in a 393dp-wide screen is ~1.4% of the width
of a text column; a screen with 40–60 text runs has thousands of edges, and *every* edge whose
antialiasing lands differently is a changed pixel under the diff threshold. Text alone therefore
costs a couple of percent on a text-dense screen even when the layout is identical.

**Shadows and elevation** are computed by a different model (CSS `box-shadow` with spread and
multiple layers vs. `RenderEffect`/`ElevationOverlay`), and soft shadows spread over a large area —
one card's shadow is hundreds of pixels of low-amplitude difference.

**Blur, filters and blend modes** cannot be reproduced at all under layoutlib (sections 1–3), which
sets a hard ceiling per screen: a glass header over artwork is a large, deliberately unexplained
region.

**Why not 100%:** a 100% floor would only be reachable by making the Compose screen a bitmap of the
reference, which is not a port. **Why not 85%:** below ~90% the pixel metric stops being sensitive to
*real* errors — a 12dp vertical shift of a whole content column, a missing divider, or a wrong
font weight still scores in the high 80s on a busy screen. The floor has to sit above the engine
noise and below the size of a layout mistake. Measured on the three phone screens of this project,
engine-only noise (identical layout, different rasteriser) lands in the low-to-mid 90s, and the real
defects we found and fixed — a mis-sized hero banner, a wrongly-wrapped title — scored 79–87%. 95%
separates those two populations with margin on both sides.

**Therefore pixel match alone is not acceptance.** A 95% score can hide a wrong layout: the content
of a screen is a minority of its pixels, so moving a whole column by 20dp, or swapping two
sections, still leaves the background, chrome and gaps matching. So `ACCEPTED` requires all three of:

1. **pixel match ≥ 95%** (`acceptanceFloorPct`, goal `goalPixelMatchPct` = 99);
2. **the geometry gate passes** — the Compose semantics dump is compared node-by-node against the
   DOM geometry dump, and the report states the *percentage of reference nodes matched within
   1dp*; the gate needs ≥ 90% coverage, and **an unmeasured screen is not a pass**
   ("could not check" is a distinct, failing state);
3. **every remaining residual is explained by a declared category** from the list below.

**SSIM is reported and tracked, never gated.** It is a structural comparison and it is genuinely
useful as a trend, but it is not monotonic with perceived similarity here: a screen whose text
re-wraps from 3 lines to 4 can *improve* SSIM while being obviously wrong, and a one-pixel border
shift barely moves it. Until its noise floor is calibrated per project (`--calibrate` writes
`noise-floor.json`), gating on it would be a number we cannot defend. `config/thresholds.json` keeps
`ssim.gate: false` with the reason attached, so the decision travels with the config.

**Iteration budget.** At most **5 port iterations per screen per device**, enforced in
`.uiport/state.json` (`scripts/lib/state.mjs` `bumpIteration`, exit code 7 at the cap) rather than by
asking nicely in a prompt. A screen that hits the cap is `BLOCKED` with the blocker written down —
not silently retried, and not accepted. **Harness fixes do not spend this budget**: fixing the
capture (fonts, viewport, diff config, a mask) is repair of the measuring instrument, so it is
logged under `harnessFixes` with a reason and excluded from the count. If we spent the budget on our
own bugs, a screen could be declared blocked having never been ported once.

---

## 1. Blur and glass — `blur-unsupported`

**Web:** `backdrop-filter: blur(20px)`, `filter: blur(...)`.
**Compose:** `Modifier.blur()` exists from API 31 and is a real render effect, but:

- it blurs the *content of the modifier's own layer*, not what is behind it, so a true
  "backdrop blur" needs a `RenderEffect` chain or a graphics-layer capture;
- it does **not** render under JVM screenshot tools (Robolectric/layoutlib), so the diff will show a
  sharp surface where the reference is blurred.

**Do:** use a translucent scrim with the same colour and alpha (`Color.copy(alpha = 0.72f)`), which
is what the eye reads most of the time. Where the blur is structural (a glass bar over art), bake a
blurred asset for the reference data.
**Loss:** the frosted look is approximated; screenshots of blurred regions differ measurably.
**Log:** `blur-unsupported: <element>` plus what was used instead.

## 2. Blend modes — `blend-mode-unsupported`

**Web:** `mix-blend-mode: multiply | screen | overlay`, `background-blend-mode`.
**Compose:** `BlendMode` exists on `Canvas` and in `drawWithContent`, but there is no
`mix-blend-mode` for a composable against arbitrary content behind it without capturing that content.

**Do:** bake the composite into an asset (the prototype's paper grain over a paper background is a
single tiled PNG multiplied once, not a live blend).
**Loss:** interactions between the overlay and changing content (artwork behind the grain) are lost.
**Log:** `blend-mode-unsupported: <element>`, plus the baked asset path.

## 3. CSS filters — `filter-unsupported`

`grayscale`, `sepia`, `saturate`, `brightness`, `contrast` map to `ColorFilter.colorMatrix` on a
`Painter`, which is fine for images and **not** available for arbitrary composable subtrees.
**Do:** apply to the image painter; for a subtree, restructure or accept.
**Log:** `filter-unsupported` with the matrix used or "dropped".

## 4. Shadows and elevation — `shadow-elevation`

CSS `box-shadow` supports multiple shadows per element, spread, and inset. Material elevation is a
single platform-shaped shadow driven by `elevation` + colours.
**Do:** pick one of (a) `Modifier.shadow`, (b) a custom `drawBehind` with
`Paint.setShadowLayer`, (c) a baked 9-patch. Dark mode and scaling must be checked for (c).
**Loss:** softness/spread differ, especially the second (large, soft) layer of editorial shadows.
**Log:** `shadow-elevation` with the CSS value and the approach.

## 5. Font metrics and text rendering — `font-rasterization`, `text-rendering`

Even with the exact font files, Chromium and Skia differ in hinting, grayscale AA, and how they round
`line-height`. `includeFontPadding` adds vertical space Compose needs and CSS does not have.
**Do:** bundle the exact files, set `lineHeight` and `letterSpacing` explicitly from the CSS,
`PlatformTextStyle(includeFontPadding = false)` when the box must match exactly, `tnum` for tabular
numbers.
**Loss:** 1px AA fringes on every glyph; occasionally a 1–2dp line-height difference.
**Log:** `font-rasterization` (unavoidable) or `text-rendering` (wrong family/weight — a bug, fix it).

**Measured on this project (2026-11-15).** "Bundle the exact files" is the right advice and it
made the port *worse* here, which is worth recording. `scripts/capture-reference.mjs` aborts
every request that is not same-origin, so the prototype's Google Fonts stylesheet never loads
and the reference is captured with the browser's **fallback** stacks (`serif`,
`ui-sans-serif`), not with Instrument Serif and Inter. Bundling the real webfonts
(`composeResources/font/uiport_*`, SIL OFL, with the licence texts) scored 89.26% against
94.96% for the platform families, because the webfont metrics differ from the fallback's and
line counts changed with them: the banner broke into 3 lines where the capture has 3 but at a
different width, the hero title into 1 line where the capture has 2 and the hero description
into 3 where the capture has 4.

Two ways out, both cheap, and the choice is the capture owner's rather than the port's:
(a) allow same-origin font resources in the capture so the reference uses the webfonts, then
switch `UiPortFonts` to the bundled families; or (b) declare the fallback metrics the
specification and delete the bundled files. Until then `UiPortFonts` uses the platform
families and this file records why.

## 6. Sub-pixel layout — `subpixel-layout`

CSS lays out in fractional CSS pixels; Compose rounds to device pixels. A 0.5px border becomes 1 or 0.
**Do:** prefer integer dp from the geometry dump; accept ≤1dp differences inside tolerance.
**Log:** `subpixel-layout`, only when a measurement is inside the tolerance but visibly present.

## 7. CSS grid edge cases

`grid-template-areas`, `subgrid`, `auto-fit` with `minmax()` and dense packing have no direct Compose
equivalent.
**Do:** compute columns from width (`LazyVerticalGrid(GridCells.Fixed(n))` or `Adaptive`), and lay
out named areas with `Row`/`Column` nesting. Verify with the geometry report, not by eye.
**Log:** the structural decision in the screen's worklog entry.

## 8. Scroll physics and scrollbars — `scrollbar` / `platform-chrome`

Web momentum, bounce and scrollbar width have no equivalent. Desktop browsers reserve/overlay 15px.
**Do:** mask the scrollbar band in the capture spec; never compare a scrolled web page with an
unscrolled Compose list.

## 9. Sticky and fixed positioning; `100vh` and safe areas

Web `100vh` includes browser chrome inconsistently; mobile `100dvh` changes with the URL bar.
Compose has `WindowInsets` and no viewport-relative units.
**Do:** capture with the bars excluded (config), use `WindowInsets.systemBars` for content bounds,
replace sticky headers with `stickyHeader` and log the elevation change.

## 10. Animation — framer-motion, GSAP, CSS

No equivalent for: spring physics tuned by hand, `layoutId` shared elements across unrelated trees,
GSAP timelines with callbacks, `scroll-timeline`.
**Do:** map to `animate*AsState`/`AnimatedVisibility`/`AnimatedContent` with the same duration and an
approximate easing; freeze at a defined time for the diff; review motion by device capture, never by
screenshot.
**Log:** each unmapped transition with its prototype source line.

## 11. Lottie

`lottie-react` → `compose-lottie`. Unsupported features (`<mask>`, some matte modes, expressions) fail
silently and render wrong.
**Do:** render the JSON with both engines and compare a few frames before committing.

## 12. Charts

`recharts`, `chart.js`, `d3` → `Canvas` drawing or a Compose chart library. Live/tooltip behaviour is
where the cost is.
**Do:** per-chart decision with the user: reimplement, simplify, or drop. Never screenshot a chart.
**Log:** the decision, in the gate answers.

## 13. Icon libraries

`lucide-react` and friends export SVG. Convert with `scripts/svg-to-compose.mjs`; do not redraw.
Check stroke widths against the reference size (they are in viewBox units).
**Log:** converted count, and any icon that needed a manual path.

## 14. Images and SVG

Raster → density buckets (`drawable-mdpi` … `xxxhdpi`) or a single `drawable` at 2x if the source is
resolution-limited. Complex SVG → `res/drawable/*.xml` (out of scope for a path-only converter).
Licences: an icon set is not licensed by the app's licence. Check before committing.

## 15. Dark mode

The prototype's dark tokens are a second palette, not an inversion. `useTheme()` toggling a `.dark`
class maps to a theme state holder + `isSystemInDarkTheme()`, and both palettes must be diffed (the
capture config chooses `colorScheme`; a full run captures both where the prototype supports it).
**Log:** which mode was measured in the score table — never average them.

## 16. RTL

CSS logical properties (`padding-inline-start`) and `dir` map to `LayoutDirection.Rtl` and
`Modifier.padding(start = ...)`. Mirroring is automatic for `start/end`, **not** for `left/right`.
**Do:** audit for absolute left/right usage when the app ships RTL locales; capture one RTL reference
if the prototype supports it.

---

## Reading a residual

| Category | Is it a bug? |
| --- | --- |
| `font-rasterization`, `subpixel-layout`, `scrollbar`, `platform-chrome` | no, unavoidable |
| `blur-unsupported`, `blend-mode-unsupported`, `filter-unsupported`, `shadow-elevation` | no, but the *approximation* must be documented |
| `text-rendering` | usually yes: wrong font file, weight or feature setting |
| anything uncategorised | yes until proven otherwise |
