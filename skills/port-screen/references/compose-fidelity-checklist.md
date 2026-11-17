# Compose fidelity checklist

The last 1% is almost never "the layout is wrong". It is these.

## Typography

- [ ] The exact font files are bundled (`res/font/`), same weights, same optical sizes. A
      substituted family changes every text box.
- [ ] `lineHeight` is set explicitly from the CSS `line-height` (CSS often uses unitless 1.45,
      Compose's default differs).
- [ ] `letterSpacing` converted: CSS `letter-spacing: 0.1em` at 11px → `0.1 * 11 = 1.1sp`.
- [ ] `fontFeatureSettings = "tnum"` where the web used `font-variant-numeric: tabular-nums`.
- [ ] No `fontPadding`: `TextStyle(platformStyle = PlatformTextStyle(includeFontPadding = false))`
      when matching CSS boxes exactly, or accept the extra padding and log it.
- [ ] Uppercase "kickers" are `text-transform: uppercase` on the web; render the string upper
      case or use a `TextStyle` with the right tracking — but keep the semantics text as-is.
- [ ] Ellipsis: `maxLines` + `TextOverflow.Ellipsis` where CSS had `truncate`.

## Spacing and size

- [ ] Paddings are exact integers from the geometry dump, not rounded to the nearest 4.
- [ ] `dp` vs `sp`: sizes in `dp`, text in `sp`, at `fontScale = 1.0` for the diff.
- [ ] Dividers are 1px CSS = `1.dp` at dpr 2? No: 1 CSS px = dpr physical px; use
      `Modifier.height(1.dp)` only if the geometry dump says 1 CSS px, and note the hairline
      difference on high-density screens.
- [ ] Corner radii: CSS `border-radius: 22px` → `22.dp`, not `RoundedCornerShape(50%)`.

## Colour

- [ ] Tokens, not literals. Alpha values preserved (`rgba(37,35,31,0.08)` → `Color(0x14231F... )`).
- [ ] Dark mode from the prototype's dark token map, not `Color.LightGray` inversions.
- [ ] Scrim/gradient stops copied exactly.

## Structure

- [ ] The scroll container matches: a CSS `overflow-y: auto` column → `LazyColumn` (with
      `contentPadding`, not inner `padding`, so scroll edges match).
- [ ] Horizontal carousels → `LazyRow` with the same item width and gap; snap behaviour only if
      the prototype snaps.
- [ ] Sticky headers → `stickyHeader` (experimental) with the same elevation change.
- [ ] Grid columns come from the prototype's breakpoint table, not from a guess.

## Shadows and elevation

- [ ] CSS `box-shadow: 0 1px 2px rgba(...), 0 8px 24px -12px rgba(...)` has no Material
      equivalent. Options: `Modifier.shadow(elevation, shape, ambientColor, spotColor)`, a custom
      `drawBehind` with `Paint.setShadowLayer`, or accept the difference and log it under
      `shadow-elevation`.
- [ ] Never use `Card`'s default elevation when the web says 0.

## Platform chrome

- [ ] System bars excluded from the capture; the Compose side uses the same insets so content
      starts at the same y.
- [ ] No `Scaffold` padding surprises: `Scaffold` adds insets — read the geometry and compare.

## What to do when the number stops moving

1. Check the harness before the UI: right DPR, right font file, frozen animations, no scroll.
2. Compare the geometry report, not the pixels, to find the biggest box error.
3. Fix one thing; a diff after three fixes tells you nothing.
