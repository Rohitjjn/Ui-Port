# Assets and effects

## Vector art and icons

- Source of truth is the SVG path data. Convert with `scripts/svg-to-compose.mjs`; it handles
  `path`, `circle`, `ellipse`, `rect`, `line`, `polyline`, `polygon`, `g`, `fill-rule`,
  `stroke`, `stroke-width`, `transform` (translate/scale/rotate) and linear/radial gradients.
- `ImageVector` is right for monochrome icons and simple filled art. For complex multi-colour
  illustrations, prefer a vector drawable (`res/drawable/*.xml`) so the platform can cache it.
- Verify the rendered size: SVG `viewBox="0 0 24 24"` + `width: 20` means 20dp, not 24dp.
- Stroke-only icons: set `strokeLineWidth` in the vector's units, not dp.

## Procedural artwork

If the prototype generates artwork deterministically (seeded shapes on a canvas/`<svg>`), port
the *algorithm*, then diff. Screenshotting it bakes in one instance and breaks as soon as the
data changes.

## Colour effects

| CSS | Compose |
| --- | --- |
| `linear-gradient` | `Brush.linearGradient(colorStops = ...)` |
| `radial-gradient` | `Brush.radialGradient` |
| `background: url(grain)` + `opacity` | a tiled `Image`/`drawWithContent` overlay, or `Modifier.drawBehind` with a noise bitmap |
| `mix-blend-mode: multiply/screen` | **no equivalent**: bake into the image, or accept and log `blend-mode-unsupported` |
| `filter: grayscale/brightness` | `ColorFilter.colorMatrix(ColorMatrix().apply { setToSaturation(0f) })` on the painter |
| `backdrop-filter: blur(20px)` | `Modifier.blur(20.dp)` (API 31+, needs `RenderEffect`; not rendered by JVM screenshot tools) |

The paper-grain overlay in this prototype's family (`body::before` with an SVG turbulence filter
and `mix-blend-mode: multiply`) is the classic blend-mode case: bake a small tiled PNG with the
grain already multiplied, apply at the same opacity. This keeps the look and needs no blend mode.

## Shadows

Material elevation is not CSS box-shadow. Three options, in order of fidelity:

1. Custom `drawBehind` with `android.graphics.Paint` + `setShadowLayer` — closest to CSS, Android
   only, and it needs a software layer.
2. `Modifier.shadow(elevation, shape, ambientColor, spotColor)` — cheap, but the spread is fixed
   by the platform.
3. A baked 9-patch/PNG shadow — pixel-exact, brittle for dark mode and scaling.

Pick one per surface, log the choice, and make sure the diff's residual is categorised.

## Images and fonts

- Raster assets go to `res/drawable-*` with density variants, or `composeResources/drawable` in
  Multiplatform projects.
- Fonts: `res/font/*.ttf|otf` + `FontFamily(Font(R.font.x, weight = FontWeight.Medium))`. Match
  the *file*, not the family name. Download the exact weights the prototype requests.
- Any asset whose licence is unclear is reported to the user before it is committed.
