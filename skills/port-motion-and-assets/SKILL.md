---
name: port-motion-and-assets
description: Use for everything in a ported screen that is not plain layout — framer-motion/GSAP/CSS animations and transitions, gestures, Lottie, vector and SVG art, icons, gradients, shadows, blur and glass effects, fonts and images. Triggers on "port the animations", "the icons are missing", "convert this SVG", "the blur does not work", or as the second pass of Step 3 of a ui-port run.
---

# Motion and assets

One job: convert the things that a layout port silently drops. Each item gets a decision, an
implementation and a re-diff.

## Procedure

1. Work from `.uiport/maps/motion-and-assets.md`. Each entry names the item, the source, the
   proposed conversion and the risk.

2. **Order matters.** Icons and static vectors first (they affect every screenshot), then
   gradients/shapes, then shadows, then animation, then effects (blur/blend).

3. **Icons and SVG.** Convert path data to `ImageVector`:

   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/svg-to-compose.mjs <input.svg|dir> --out <dir> --package <pkg>
   ```

   Verify the generated vector renders at the reference size. A stroke-only icon converted with
   the wrong `strokeLineWidth` reads as "slightly bold" in every diff.

4. **Animations.** One Compose primitive per web intent:

   | Web | Compose |
   | --- | --- |
   | `framer-motion` opacity+y page transition | `AnimatedContent` with `fadeIn() + slideInVertically(8.dp)` |
   | `AnimatePresence` mount/unmount | `AnimatedVisibility(visibleState = remember { MutableTransitionState(false) })` |
   | spring | `spring(dampingRatio = Spring.DampingRatioNoBouncy, stiffness = Spring.StiffnessMediumLow)` |
   | `whileHover`/`whileTap` scale | `animateFloatAsState(if (pressed) 0.97f else 1f)` |
   | `layoutId` shared element | `SharedTransitionLayout` (or accept a crossfade and log it) |
   | CSS `@keyframes` loop (equaliser bars, shimmer) | `rememberInfiniteTransition` + `keyframes {}` |

   Duration and easing are copied from the prototype's `transition={{duration: 0.18}}`, not
   invented.

5. **Re-diff after each batch.** Animations are diffed at a *defined frozen time* (capture
   config `freezeAnimations`); the static frame is the acceptance criterion. Motion quality is
   reviewed by eye on a device/emulator, and that review is recorded in the worklog.

6. **Effects that cannot be reproduced** (blur, blend modes, CSS filters) are logged with the
   category from `docs/LIMITS.md`, plus what was done instead (approximation, static asset,
   dropped). Never silently omit.

## Rules

- Never ship a screenshot of an icon. Convert the vector or draw it.
- Never add a heavy dependency for one animation. Compose's animation APIs cover the vast
  majority of framer-motion usage.
- Blur has a real fallback ladder: `Modifier.blur()` (API 31+, and not rendered by JVM
  screenshot tools), then a translucent scrim, then a static blurred asset. Pick, then log.
- Every converted asset gets a licence check. An icon set's licence is not the app's licence.

## References

- `references/motion-mapping.md` — fuller mapping table with code snippets.
- `references/assets-and-effects.md` — vectors, icons, gradients, shadows, blur, blend modes.
- `../port-screen/SKILL.md` — the loop these changes feed into.
