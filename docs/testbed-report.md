# Test bed report

What the plugin has to deal with, measured. Everything here was produced by the plugin's own
scanners on 2026-11-15; the numbers are reproducible with the commands quoted in each section.

## 1. The prototype (`testbed/prototype`)

Source: `simpmusic-react-web-reconstruction.zip` at the repository root, unpacked with
`unzip -q simpmusic-react-web-reconstruction.zip -d testbed/prototype` (archive untouched).

```
$ node scripts/scan-prototype.mjs testbed/prototype --json /tmp/proto.json
scanned 35 files, 23 screens, 5 libraries, 4 stores
```

| Item | Value |
| --- | --- |
| Framework / bundler | React 19.2.6 + Vite 7.3.7, TypeScript 5.9.3, build to a single HTML file |
| Styling | Tailwind CSS 4.1.17, design tokens as CSS custom properties in `src/index.css` |
| Routing | `createHashRouter` with 24 route entries (one layout shell, one redirect, one catch-all) |
| Screens | 23 (after removing the shell, the redirect and the catch-all) |
| State | 4 zustand stores: `usePlayerStore` (14 keys, 21 actions), `useLibraryStore` (15/22), `useSettingsStore`, `useUiStore` (8/11) |
| Libraries | framer-motion, lucide-react (73 icons), react-router-dom, zustand, clsx, tailwind-merge |
| Fonts | Instrument Serif (display), Inter (UI) — loaded from Google Fonts at runtime |
| Motion | 15 framer-motion components, 24 motion props, 2 CSS animations, 2 keyframes |
| Assets | 1 inline SVG data-URI (paper grain), procedurally generated artwork (`src/utils/artwork.ts`, 16 palettes, 6 shape variants) |
| Responsive | `sm`/`lg` prefixes in 17 files; structural change at `lg` (sidebar, desktop player bar); dark mode by `.dark` class toggle |
| Data | `src/data/mockData.ts` + `src/services/mockMusicService.ts` with artificial latency (400–650 ms) |
| Backend | none — this is the whole point: the engine is simulated |

### What makes it a good test bed

- **Real responsive structure.** The shell genuinely changes at `lg` (bottom nav + mini player
  become sidebar + player bar), so the tablet/desktop targets are not stretched phone layouts.
- **A real design system.** 30+ tokens, serif/sans pairing, grain overlay, custom slider styling.
- **Everything that is hard to port** is present in small doses: procedural artwork, inline SVG,
  `backdrop-filter`, `mix-blend-mode`, CSS keyframes, framer-motion page transitions, 73 icons.
- **Deterministic data.** Mock data is static, so fixtures can mirror it exactly.

### Known capture hazards

| Hazard | Where | Handling |
| --- | --- | --- |
| Google Fonts over the network | `index.html` | capture runs with the network off; the fonts must be bundled (they are the first thing the port needs) |
| Clock-dependent greeting | `HomeScreen` "Good morning" | `Date` frozen by the capture script |
| Seeded art | `src/utils/artwork.ts` | `Math.random` seeded; the port reimplements the algorithm |
| Live progress timer | player store `tick(0.5)` every 500 ms | capture freezes animations and pins time; progress region masked per screen |
| `backdrop-filter` on bottom nav and player bar | Tailwind `backdrop-blur-md` | expected `blur-unsupported` residual; must be logged, not "fixed" |

## 2. The Android app (`testbed/SimpMusic`)

```
$ node scripts/scan-app.mjs testbed/SimpMusic --json /tmp/app.json --engine-paths /tmp/engine-paths.json
scanned 1160 Kotlin files — UI 349, engine 666, shared 145; 34 screens, 35 ViewModels, 64 engine entry points
```

| Item | Value |
| --- | --- |
| Upstream | `maxrave-dev/SimpMusic` @ `f78a4fd6da9680e5771f4763194d2895d26914fd` (2026-11-14) |
| Nested `core` | `maxrave-dev/core` @ `8413a257cbe45d102a9f101f2760e35b549e4d9e` |
| License | GPL-3.0 (root and `core`) |
| Gradle | 9.8.1 wrapper |
| AGP / Kotlin | 9.5.0 / 2.4.21 |
| Compose | Compose Multiplatform 1.12.2, Compose BOM 2026.09.00, material3 1.5.0-alpha22 |
| KSP / Koin / Room | 2.3.9 / 4.2.2 / 2.8.5 |
| Android SDK | compileSdk 37, minSdk 26, targetSdk 36, `jvmTarget` 21 in the app module |
| Modules | 27 included; `composeApp` is KMP (android + jvm desktop + ios), `androidApp`, `vivoAndroidApp`, `desktopApp` |
| Code size | 1160 Kotlin files, ~25 MB with resources |

### Does the project already have a desktop target?

**Yes.** `composeApp/build.gradle.kts` declares `jvm()` and the repo has a `desktopApp` module with a
Compose Desktop `application {}` block. This matters for the device-target question: for this
project, "desktop" can be a real Compose Desktop build rather than an Android app in an expanded
window class. The plugin must detect this (it does: `modules.isMultiplatform` plus the
`desktopApp` module) and tell the user which of the two they get.

### Where UI ends and engine begins

- UI: `composeApp/src/commonMain/.../ui/` (349 files) — screens, components, theme, icons.
- Engine: `core/{common,data,domain,service,media}` (666 files) plus `composeApp/.../viewModel`
  and `.../di`.
- Navigation is engine-ish: `ui/navigation/destination/**` and `ui/navigation/graph/**` are typed
  route declarations (`@Serializable data object HomeDestination`) — a screen port rarely needs to
  change them, but a *new* screen does. The scanner protects them by default; the user can relax
  that.

### Build requirements

| Requirement | Detail | Risk for CI |
| --- | --- | --- |
| JDK 21 | upstream workflow uses Microsoft JDK 21; app module targets JVM 21 | low |
| Android SDK 37 | AGP 9.5 needs a recent build-tools; `compileSdk = 37` | medium — very new |
| `local.properties` | read for `SENTRY_AUTH_TOKEN` and Last.fm/Discord keys; **absence is tolerated** (`isFullBuild` unset → FOSS flavour, Sentry disabled) | low |
| Gradle downloads | KMP + Compose Multiplatform + KSP: hundreds of MB on a cold cache | high on first run, cached afterwards |
| `exportLibraryDefinitions` | upstream runs it before assembling (AboutLibraries JSON) | low |
| Signing | not needed for `assembleDebug` | none |
| Disk | Gradle + SDK + build outputs: ~6–8 GB | medium on GitHub runners |

### What the plugin learns from this app

- The imports map must respect **Compose Multiplatform 1.12.2 / material3 alpha** pins: an
  AndroidX-only library will not link in `commonMain`. `composeApp` already uses `org.jetbrains`
  artefacts for exactly this reason.
- Screenshot rendering happens in **JVM tests** (`composeApp/src/jvmTest`, `desktopApp`), so a JVM
  screenshot tool is viable here without an emulator.
- The engine is large and clean: 64 mapped entry points with named functions, which makes the
  wiring plan mechanical rather than speculative.

## 3. Reproducing this report

```
node scripts/scan-prototype.mjs testbed/prototype --md /tmp/prototype-map.md
node scripts/scan-app.mjs      testbed/SimpMusic  --md /tmp/app-map.md --engine-paths /tmp/engine-paths.json
```
