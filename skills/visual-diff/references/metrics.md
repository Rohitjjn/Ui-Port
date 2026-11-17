# What each metric catches — and what it misses

## Pixel match percentage (pixelmatch)

`100 * (1 - changedPixels / totalPixels)`, with a per-pixel colour-distance threshold
(`0.1` by default) and anti-aliasing detection.

- **Catches:** wrong colours, missing elements, wrong spacing, wrong radii, wrong font size,
  shadows that are too strong.
- **Misses:** a one-pixel shift along a flat area (nothing to compare), and semantically wrong
  but visually identical layouts.
- **Watch out:** a single large flat area dominating the frame inflates the score. A 393x852
  phone screen with 90% paper background can hide a badly broken card. That is why geometry
  coverage is a second, independent gate.

## SSIM

Structural similarity over 11x11 windows: luminance, contrast and structure.

- **Catches:** texture and structure loss (a blurred shadow, a missing icon, a gradient that
  became flat).
- **Misses:** small-area differences, because the whole frame averages them away.
- **Use:** as a tiebreaker and a regression guard, not as the primary number.

## Geometry coverage

Matched element boxes within 1dp, as a fraction of reference nodes.

- **Catches:** the things pixels forgive — text 3px too low, a row 2dp too tall, a container
  6dp too wide, a font with the wrong line-height.
- **Misses:** anything without text, role or test tag. Decorative boxes are invisible to it.
- **Use:** required for a screen to be "matched", even at 99.9% pixels.

## Heat map

Luminance difference amplified 6x, coloured so intensity reads at a glance.

- **Catches:** *where* and *how much* — the diff image is binary, this is graded.
- **Use:** to decide the next fix. A strong band along every glyph edge means font metrics; a
  soft halo under every card means elevation/shadow; a rectangular block means a missing or
  displaced container.

## Noise floor

Two renders of the *same* side, compared. If that is not ~100%, cross-platform differences
below that level are noise. Calibrate once per machine/toolchain, store it in
`.uiport/state.json`, and adjust the *expected* numbers — never the acceptance policy.
