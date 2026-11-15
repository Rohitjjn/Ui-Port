# Adaptive layout: phone, tablet, desktop

The prototype answers this with Tailwind breakpoints (`sm` 640, `md` 768, `lg` 1024, `xl` 1280)
and, in this prototype family, structural changes at `lg`: sidebar instead of bottom nav, a
desktop player bar instead of a mini player, wider grids.

## Mapping

| Window width (dp) | Compose window size class | Prototype equivalent | Structure |
| --- | --- | --- | --- |
| < 600 | `compact` | phone (< `sm`/`md`) | bottom nav + mini player, single column |
| 600–839 | `medium` | tablet (`md`) | navigation rail, two-pane where the content is a list+detail |
| >= 840 | `expanded` | desktop (`lg`/`xl`) | permanent sidebar rail, wider grids, player bar |

```kotlin
val sizeClass = currentWindowAdaptiveInfo().windowSizeClass
when {
    sizeClass.windowWidthSizeClass == WindowWidthSizeClass.Expanded -> ExpandedShell()
    sizeClass.windowWidthSizeClass == WindowWidthSizeClass.Medium -> MediumShell()
    else -> CompactShell()
}
```

## Device targets in a ui-port run

- **Phone.** The default. Every screen has a phone reference.
- **Tablet.** Capture at 834x1194@2. If the prototype's layout is identical to phone (no `md`
  classes), the port must still handle the extra width: do not stretch a 393dp column to 834dp
  — centre it with a max width, matching what the web does at that width.
- **Desktop.** Detect the project type:
  - **Compose Multiplatform / Compose Desktop target present** (this test bed has one): build
    there, capture at 1440x900@1, and reuse the same composables.
  - **Android only**: build the `expanded` layout and say plainly in the report that desktop
    chrome (window title bar, mouse hover states, keyboard shortcuts, resizable window) cannot
    be reproduced inside an Android build.

## Structural rules

1. If the prototype hides/shows a *navigation mode* at a breakpoint, that is a structural
   change and must be modelled as such — not as a visibility toggle inside a phone layout.
2. Grid column counts come from the prototype's classes at each breakpoint (`sm:grid-cols-3`,
   `lg:grid-cols-5`). Compute them from width, do not hard-code per device.
3. Hover states exist on the web and not on touch. On desktop targets, `hoverable` +
   `MutableInteractionSource` can reproduce them; on phone, do not render hover visuals.
4. Safe areas: `WindowInsets.systemBars` on phone, none on desktop. Compare captures with the
   same inset policy or the geometry will be offset by the status bar height.
