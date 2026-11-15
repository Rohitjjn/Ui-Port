# Web library → Compose equivalent

Starting table only. Resolve the real version from the project's catalog (or Maven Central /
Google Maven) at run time and record the date. A version copied from this file is a bug.

| Web library | Used for | Compose equivalent | Notes / risk |
| --- | --- | --- | --- |
| `react`, `react-dom` | component model | Compose runtime + Material 3 | direct conceptual mapping |
| `react-router` / `react-router-dom` | navigation | `androidx.navigation:navigation-compose` (or the project's own nav, e.g. Voyager) | keep route ids identical to the prototype's paths so the wiring plan stays readable |
| `zustand` | global state | `ViewModel` + `StateFlow`, or a single app-scoped state holder | one store → one state holder; do not invent one ViewModel per widget |
| `jotai` / `recoil` | atoms | `StateFlow` per atom, or computed `derivedStateOf` | atom graphs flatten poorly; expect manual review |
| `redux` / `@reduxjs/toolkit` | reducers + actions | `ViewModel` with intent functions, or `MutableStateFlow.update` | |
| `framer-motion` | animation | `animate*AsState`, `AnimatedVisibility`, `AnimatedContent`, `Transition`, `rememberInfiniteTransition` | spring/ease mapping is approximate; freeze at capture time and diff the static frame |
| `gsap` | timeline animation | `Animatable` + `keyframes` | timelines become explicit sequences; expect hand work |
| `lottie-react` | vector animation | `compose-lottie` (`rememberLottieComposition`) | check the JSON's feature set; masks can be unsupported |
| `lucide-react` | icons | `ImageVector` from the SVG path data, or `Material Icons` where the shapes match | generate vectors with the SVG converter; never redraw by hand |
| `@radix-ui/react-*` | dialogs, sliders, tabs, tooltips | Material 3 `ModalBottomSheet`, `Slider`, `TabRow`, `PlainTooltip` | behaviour differences (focus traps, animations) must be logged |
| `@headlessui/react` | menus, dialogs | `DropdownMenu`, `AlertDialog` | |
| `embla-carousel-react` | carousels | `LazyRow` + `rememberSnapFlingBehavior` | snap behaviour differs slightly |
| `react-window` / `react-virtuoso` | virtual lists | `LazyColumn` / `LazyVerticalGrid` | item recycling semantics differ; geometry tests must account for it |
| `recharts` / `chart.js` / `d3` | charts | Compose `Canvas` drawing, or a Compose chart library | highest-risk conversion; usually needs a per-chart decision with the user |
| `clsx` / `tailwind-merge` | class composition | Kotlin conditionals, `Modifier.then(...)` | |
| `tailwindcss` | styling | design tokens → `MaterialTheme` + a local `AppTheme` object | convert tokens first, never hard-code colours per screen |
| Google Fonts (`Instrument Serif`, `Inter`, ...) | typography | the same font files bundled in `res/font` + `FontFamily` | download the exact files; fallback fonts change metrics and ruin pixel scores |

## Resolution rules

1. Prefer what the project already depends on. Adding a chart library to an app that has none
   is a bigger decision than drawing three paths with `Canvas`.
2. Prefer stable over alpha. If the only supported version is alpha, say so and give the risk.
3. Check the Kotlin/Compose versions: a library built for Compose 1.9 will not link against a
   1.12 runtime without care. Record the compatibility reasoning.
4. Every row needs a fallback. "None" is not a fallback.
