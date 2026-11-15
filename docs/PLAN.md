# Plan

The build prompt defines ten phases. This file records what the plan actually is for this
repository, what has been decided, and what is risky. It is updated as the phases land.

## Where we are

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Recon, research, test bed, baseline | research + test bed done, baseline workflow written, **CI blocked** (see D1) |
| 1 | Plugin skeleton, manifest, commands, state, config, static CI | done |
| 2 | Preflight, decision gate, tools registry, headless mode | done (preflight, gate, registry, answers, unit tests) |
| 3 | Mapping (app, prototype, wiring plan) + scanner scripts | done (scanners + skills; wiring plan generated per run) |
| 4 | Capture and diff engine | diff engine done and tested; Playwright capture written, cannot run here (D3) |
| 5 | Port loop skills and agents | skills/agents written; requires a runnable Compose toolchain (D2) |
| 6 | Engine wiring, protect hook | protect hook done and tested; wiring skill written |
| 7 | Verify/fix loop, packaging, workflow templates | verify + package done and tested; templates written |
| 8 | Full end-to-end on the test bed | blocked on D1/D2/D3 |
| 9 | Hardening, docs, release | docs in progress |

## Decisions

**D1 — GitHub Actions cannot be triggered from this session.** The repository is public and the
token can write files (verified), but it cannot read or dispatch Actions
(`/actions/workflows` returns `total_count: 0`, `/actions/permissions` returns 403). Zero workflow
runs exist. Consequence: every workflow in `.github/workflows/` and `templates/github-actions/` is
written and locally linted, but its green/red status cannot be reported from here. The user has to
enable Actions (or reconnect with a token that carries the `workflow` scope) and run them once.

**D2 — No JVM/Android toolchain in this environment.** `java` is absent, no Android SDK, 20 GB free
disk. The plugin's Kotlin side (screenshot tests, Gradle, wiring runs) therefore cannot be exercised
here; it is exercised by CI once D1 is resolved, or on the user's machine (`LOCAL_FULL`).

**D3 — Playwright browsers cannot be downloaded here.** `registry.npmjs.org` and `github.com` are
reachable; `cdn.playwright.dev`, `playwright.azureedge.net`, `storage.googleapis.com` and
`repo1.maven.org` are not. `npx playwright install chromium` fails with a download error. The
capture script therefore exits with code 7 ("browser unavailable") and the plugin re-plans capture
for CI — which is exactly the `HYBRID`/`CI_ONLY` path the product spec requires. Everything that
does not need a browser (capture planning, diffing, noise floor, packaging) is tested locally.

**D4 — Screenshot tool: Roborazzi by default.** Pure JVM (no emulator), uses the project's own
Compose version, works on the test bed (which has `jvmTest` and a desktop module). Paparazzi is the
documented fallback for Android-only projects; Google's Compose Preview Screenshot Testing stays an
option with `needs-user-input` because it is AGP-coupled and still alpha.

**D5 — Diff stack: pixelmatch + pngjs + ssim.js, all pure JavaScript.** No native builds, so the same
numbers on Windows, macOS and Linux, and a hook or CI step can run without compiling anything.

**D6 — Test bed commit strategy: plain files, trimmed.** `testbed/SimpMusic` is committed as plain
files (no nested `.git`, submodule contents inlined) with `asset/screenshot`, `fastlane` and its own
`.github` removed — 25 MB / 1545 files instead of 71 MB. Details and justification in
`testbed/SOURCES.md`.

**D7 — Versions are pinned with an age policy.** `config/tools.json` records the resolution date and
requires two weeks of public availability. That is why Playwright is 1.64.1 (31 days old) and not
1.65.1 (1 day old). `scripts/resolve-versions.mjs --check` verifies the pins against the npm
registry and reports newer stable releases without changing anything.

**D8 — Engine protection is per-directory when a directory is pure engine code, per-file when it
mixes.** The first implementation protected whole modules, which would have forbidden editing the
UI folder the plugin exists to write. Caught by a unit test that asserts the UI package is never
globbed as a whole.

## Risks

| # | Risk | Impact | Mitigation |
| --- | --- | --- | --- |
| R1 | AGP 9.5 / Gradle 9.8.1 / compileSdk 37 are very new; a runner may not have the SDK or a compatible build-tools | the baseline build fails for upstream reasons | pin JDK 21, use the project's wrapper, document the failure with the full log instead of guessing |
| R2 | Cold Gradle cache on a KMP project | first CI run is slow, minutes of downloads | `gradle/actions/setup-gradle` cache; heavy workflow on demand only |
| R3 | Google-Fonts dependencies in the prototype cannot be fetched during capture (network off by design) | wrong font metrics in the reference | download the font files into the prototype and the app; this is step 2 of every port anyway |
| R4 | Blur / blend modes render differently under JVM screenshot tools | false `blur-unsupported` residuals | documented in `docs/LIMITS.md`, masked or categorised, never silently ignored |
| R5 | `state.json` corruption mid-run | lost progress | atomic writes + quarantine + resume-safe migration, unit tested |
| R6 | Hook false positives block UI work | the port cannot proceed | pure-function decision layer with 20+ unit tests; hooks fail open on any internal error |
| R7 | Actions minutes on a public repo | cost | static + unit are cheap and cached; the test-bed build is manual-only |

## Order of work from here

1. User enables Actions (D1) → run `ci-static` and `ci-unit` → both must be green.
2. Run `ci-e2e-simpmusic.yml` manually → baseline `assembleDebug` on the test bed (R1 decides how
   much of Phase 8 is achievable).
3. With a browser available (CI or a local `LOCAL_FULL` machine), capture the prototype and measure
   the noise floor.
4. Port home, library and now-playing on phone; then one tablet layout and one desktop layout.
5. Wire to the SimpMusic engine, verify, package.
