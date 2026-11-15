# Testbed sources

Everything in `testbed/` is here to develop and prove the plugin against real code. **No plugin
code may depend on anything inside `testbed/`**, and `testbed/` can be deleted at any time
(see `docs/CLEANUP.md`).

## 1. `testbed/prototype/` — the web UI prototype

| Field | Value |
| --- | --- |
| Source | `simpmusic-react-web-reconstruction.zip` (repo root, unmodified) |
| Unpacked to | `testbed/prototype/` |
| Stack | React 19.2.6, Vite 7.3.7, Tailwind CSS 4.1.17, TypeScript 5.9.3, react-router-dom 7.x, zustand 5.x, framer-motion 14.x, lucide-react 1.x |
| Fonts | Instrument Serif, Inter (Google Fonts via `index.html`) |
| Backend | none — `src/services/mockMusicService.ts` + `src/data/mockData.ts` |
| License | none declared in the archive; authored as an independent re-creation that contains no SimpMusic source code (see its `README.md`) |
| Usage | read-only test fixture; unzipped with `unzip -q simpmusic-react-web-reconstruction.zip -d testbed/prototype` |

`testbed/prototype/node_modules/` and `testbed/prototype/dist/` are git-ignored.

## 2. `testbed/SimpMusic/` — the open-source Android app used as the target project

| Field | Value |
| --- | --- |
| Upstream | https://github.com/maxrave-dev/SimpMusic |
| Commit SHA (root repo) | `f78a4fd6da9680e5771f4763194d2895d26914fd` (2026-11-14) |
| Commit SHA (nested `core` submodule) | `8413a257cbe45d102a9f101f2760e35b549e4d9e` (https://github.com/maxrave-dev/core) |
| License | **GPL-3.0** (`testbed/SimpMusic/LICENSE` kept unmodified; `core/LICENSE` likewise) |
| Build | Gradle 9.8.1 wrapper, AGP 9.5.0, Kotlin 2.4.21, Compose Multiplatform 1.12.2, compileSdk 37, minSdk 26, JVM 17/21 |
| Modules | `androidApp`, `vivoAndroidApp`, `composeApp` (KMP: android + jvm desktop + ios), `desktopApp`, plus in-repo `core/{common,data,domain,service,media}` |
| Size committed here | ~25 MB, 1545 files (see decision below) |

### How it was copied

1. `git clone --depth 1 https://github.com/maxrave-dev/SimpMusic.git` (root repo, commit above).
2. `git clone --depth 1 https://github.com/maxrave-dev/core.git` (the `core` git submodule).
3. Both trees copied as **plain files**, without any nested `.git`, `.gitmodules` removed, and the
   `core` submodule contents placed at `testbed/SimpMusic/core/` so `settings.gradle.kts` resolves
   exactly as upstream expects.

### Decision: commit as plain files (default), and what was excluded

Committed as plain files so CI is reproducible without network access to a third repo and without
submodule-recursion edge cases. To keep the commit honest but small, three pure-metadata trees that
Gradle never consumes for a **debug assemble** were excluded:

- `asset/screenshot/` (1.2 MB of README screenshots — `asset/` other files are kept)
- `fastlane/` (15 MB of F-Droid store metadata and screenshots; not on any Gradle task path)
- `.github/` of SimpMusic (its own workflows; irrelevant here and it would double-run in our CI)
- `changelogs/` screenshots if any (text changelogs kept)

Nothing else was removed, no code was modified. Repo size impact: ~25 MB, 1545 files.

GPL-3.0 obligations: the copy is unmodified, keeps its LICENSE, is clearly separated in `testbed/`,
and is not linked into, merged with, or distributed as part of the MIT plugin. Release ZIPs and the
plugin marketplace package exclude `testbed/` (see `docs/CLEANUP.md`).

### Can it build in our CI?

See `docs/testbed-report.md` §Build requirements. Short version: `androidApp:assembleDebug` needs
JDK 21 + Android SDK 37 + the Gradle cache warm; it reads `local.properties` for optional Sentry and
Last.fm keys but tolerates their absence (`isFullBuild` unset → FOSS flavor, no Sentry SDK). The
biggest unknown for our CI is that AGP 9.5 / Gradle 9.8.1 / compileSdk 37 are very new — this is
tracked as risk R1 in `docs/PLAN.md`.
