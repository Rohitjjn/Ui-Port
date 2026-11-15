# Recognising a residual category from a diff image

Use these to decide whether a remaining difference is a platform limit (document it) or a bug
(fix it). Sorting by eye is fast; guessing is not.

| Category | Looks like | Real cause | Verdict |
| --- | --- | --- | --- |
| `font-rasterization` | thin outline around every glyph, same shapes | hinting and grayscale AA differ between Chromium and Skia | platform limit |
| `text-rendering` | glyph shapes differ, same box | wrong family or weight resolved; ligatures enabled on one side | usually a bug — fix the font files/family first |
| `shadow-elevation` | soft halo offset under cards/bars | CSS box-shadow spreads differently than Material elevation; two-layer shadows do not exist in Material | platform limit if the shape matches, bug if the shadow is far too strong/weak |
| `blur-unsupported` | the blurred region is flat or sharp | `backdrop-filter`/blur not rendered by the screenshot tool or the API level | platform limit; log which |
| `blend-mode-unsupported` | grain/overlay missing, colour slightly off | `mix-blend-mode` has no Compose equivalent | platform limit |
| `filter-unsupported` | greyscale/sepia/saturate assets identical to source | CSS `filter` | platform limit |
| `subpixel-layout` | 0.5-1.5px edges, all inside tolerance | fractional dp vs px rounding | accepted if within geometry tolerance |
| `scrollbar` | 12-15px vertical band at the right edge | platform scrollbars | mask it, do not chase it |
| `platform-chrome` | status/navigation bar, safe area insets | system UI | excluded or masked by config |

## How to write it into the report

```
Residual differences (categorised):
- font-rasterization: every glyph edge differs by 1px AA fringe; text boxes match within 0.5dp.
  Expected: Chromium grayscale AA vs Skia. Not fixable without a font rasterizer swap.
- shadow-elevation: card shadow is softer on Android. CSS uses two shadows (0 1px 2px + 0 8px 24px);
  Compose uses one elevation. Visual intent preserved.
```

A category without a sentence is not a justification. The point of the exercise is that a human
reading the report can tell, in ten seconds, that nothing is being hidden.
