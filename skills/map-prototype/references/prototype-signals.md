# Prototype signals and what they mean for the port

| Signal in `prototype-map.json` | How it is detected | What it implies |
| --- | --- | --- |
| `screens[].responsive` | Tailwind `sm:`/`md:`/`lg:`/`xl:` prefixes, `@media`, `matchMedia` | which device targets this screen actually changes for; a screen with no `md`/`lg` classes is identical on tablet/desktop except for layout width |
| `responsive.darkMode` | `.dark` class toggled from JS, or `prefers-color-scheme` | if `class-toggle`, the Compose side needs a real theme switch, not just `isSystemInDarkTheme()` |
| `responsive.usesContainerQueries` | `@container` | Compose has no container queries; re-implement with `BoxWithConstraints` per component |
| `motion.items` | `motion.*`, `AnimatePresence`, `initial/animate/exit/transition`, CSS `@keyframes` | each item becomes a task in `motion-and-assets.md`; capture the frozen frame for the static diff |
| `motion.libraries` | imports | decide animation strategy before porting screens, not after |
| `assets.items` | `url(data:image/svg+xml…)`, `<svg viewBox>`, file references | inline SVG → `ImageVector` conversion; raster → `res/drawable`; log anything that is generated at run time (canvas, procedural art) |
| `fonts` | `font-family`, Google Fonts `<link>`, `--font-*` tokens | bundle the exact files; a substituted font changes every text box |
| `designTokens` | CSS custom properties, split into light and dark | becomes `AppColors`/`Dimens`; the dark map is the dark theme, not a variant |
| `dataShapes` | exported TS interfaces | the exact fields the engine must supply; mismatches become feature-gap questions |
| `handlers` | `onX={...}`, `handleX` | candidate actions to wire; anything with no engine equivalent is a decision-gate question |
| `libraries[].kind` | import classification | `charts`, `motion`, `icons`, `ui` are the risky kinds; `utility` and `styling` convert trivially |

## Rules of thumb that keep the port honest

- A screen that never changes at `lg` still gets a desktop capture: the *layout width and
  sidebar presence* change, which is a real visual difference.
- Procedurally generated artwork (canvas, seeded SVG) must be ported as an algorithm, not as
  a screenshot. Log it as a conversion task with its own diff.
- Text rendered with `font-variant-numeric: tabular-nums` needs `FontFeatureSettings("tnum")`
  in Compose, or the numbers will bounce.
