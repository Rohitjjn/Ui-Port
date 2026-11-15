# Geometry dump and how Compose matches it

Pixel comparison cannot tell "the button is 4dp lower" from "the shadow is slightly wrong".
The geometry dump answers the first question directly.

## Web side (`<state>.geometry.json`)

For every visible element matching `h1..h6, p, span, a, button, input, textarea, label, li, img,
svg, [role], [data-testid]`:

```json
{
  "text": "Good morning",
  "role": "heading",
  "testId": null,
  "x": 16, "y": 24, "w": 232.5, "h": 32,
  "fontSize": "28px", "fontWeight": "400",
  "color": "rgb(37, 35, 31)",
  "background": "rgba(0, 0, 0, 0)",
  "radius": "0px"
}
```

Zero-sized, hidden, `display:none` and fully transparent elements are dropped, as are exact
duplicates (same role, text and position).

## Compose side (`<state>.semantics.json`)

Produced by the screenshot test helper (`templates/compose-screenshot-test/`): every
`SemanticsNode` with a text, content description or test tag, converted from dp to the same
CSS-pixel space as the web dump:

```json
{ "text": "Good morning", "role": "heading", "testId": "greeting", "x": 16, "y": 24, "w": 232, "h": 32 }
```

The conversion is `px = dp * dpr`, applied once, in the test helper — never in the diff.

## Matching and tolerances (`scripts/lib/diff.mjs`)

1. Match by exact `testId` (score 5), then normalised text (3), then role (1). Highest score
   wins; each Compose node is used at most once.
2. A node matches when `|dx|, |dy|, |dw|, |dh| <= 1.0` (configurable in
   `config/thresholds.json`).
3. Report coverage as `matched / reference nodes`. Below 90% the screen fails even if pixels
   look right — that is how "it happens to look the same because everything is a picture"
   gets caught.

## Practical notes

- Give key nodes a `Modifier.testTag("...")` in Compose and a matching `data-testid` on the web
  side where the prototype allows it. Matching by text alone breaks on repeated labels.
- `y` is viewport-relative on both sides. Do not compare document coordinates against a
  scrolled Compose list; capture both at scroll offset 0 unless the screen spec says otherwise.
- Lists virtualise differently. For long lists, compare the first N items and mask the rest.
