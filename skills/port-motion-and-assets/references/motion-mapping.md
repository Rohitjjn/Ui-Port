# Motion mapping: framer-motion / CSS → Compose

## Page transitions

```tsx
<motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} />
```

```kotlin
AnimatedContent(
    targetState = route,
    transitionSpec = {
        (fadeIn(tween(180)) + slideInVertically(tween(180)) { it / 20 })
            .togetherWith(fadeOut(tween(180)) + slideOutVertically(tween(180)) { -it / 30 })
    },
    label = "route",
) { route -> Screen(route) }
```

`y: 8` on a 852px viewport is a fraction; `it / 20` approximates the same proportion. Copy the
duration exactly.

## Enter/exit of a conditional element

```tsx
<AnimatePresence>{open && <motion.div .../>}</AnimatePresence>
```

```kotlin
AnimatedVisibility(
    visible = open,
    enter = fadeIn(tween(180)) + expandVertically(tween(220)),
    exit = fadeOut(tween(120)) + shrinkVertically(tween(180)),
) { Panel() }
```

## Springs

framer-motion `type: "spring"` defaults ≈ `stiffness 100`, `damping 10`. Compose:
`spring(dampingRatio = 0.8f, stiffness = Spring.StiffnessMediumLow)` is a close match for UI
motion that should not overshoot.

## Gestures

| Web | Compose |
| --- | --- |
| drag to dismiss a sheet | `Modifier.draggable` + `AnchoredDraggable` (M3 `ModalBottomSheet` handles it) |
| swipe left/right on a row | `SwipeToDismissBox` |
| long-press to multi-select | `combinedClickable(onLongClick = ...)` |
| pull to refresh | `PullToRefreshBox` (M3) |
| pinch to zoom artwork | `Modifier.transformable` + `detectTransformGestures` |

## Loops

Equaliser bars, shimmer skeletons, pulsing "live" dots: `rememberInfiniteTransition` with
per-bar phase offsets from `keyframes`. Do not use `LaunchedEffect` + `delay` loops — they do not
survive recomposition and stop in previews.

## Lists and scroll

Web smooth-scroll and scroll-snap have no exact equivalent:
`rememberSnapFlingBehavior(lazyListState = state)` approximates snapping; momentum and bounce
differ by platform and are logged as `platform-chrome` when visible in a diff.

## Verification

- Static frame: diffed automatically.
- Timing: record a short screen capture on an emulator for the worklog when the user asks for
  motion review. Never claim motion parity from a screenshot.
