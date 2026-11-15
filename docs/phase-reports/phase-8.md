# Phase 8 — Full end-to-end on the test bed

## Status: blocked, with the blockers named

The prompt asks for a full headless run of Steps 0–5 on `testbed/SimpMusic` with the prototype. That
requires three things this environment does not have:

| Blocker | Evidence | Consequence |
| --- | --- | --- |
| B1 — Actions cannot be dispatched | `gh api repos/.../actions/workflows` → `total_count: 0`; `/actions/permissions` → 403; `gh run list` empty, although file writes succeed | no CI evidence for any workflow |
| B2 — No browser | `npx playwright install chromium` → download failure from `cdn.playwright.dev` (host unreachable) | no web reference capture here |
| B3 — No JVM / Android SDK | `java` not found; no SDK; `sdkmanager` absent | no Compose render, no Gradle build here |

What *was* executed end-to-end, as the closest available proof:

1. Preflight detector on this repository (mode `LIMITED`→`HYBRID` path, project case detected,
   tool plan produced) — `node scripts/uiport.mjs preflight --save`.
2. Prototype scan → capture plan → 66 capture units / 102 screenshots planned across three devices.
3. App scan → 1 160 files classified, 249 protected globs proposed, UI package verified not protected.
4. Diff engine on synthetic pairs and on a real directory layout, including regression detection and
   the noise-floor calibration path.
5. ZIP packaging of a synthetic project, archive inspected with `unzip -Z1`.
6. Reset/cleanup behavior of `state.json` (corrupt file quarantined, resume hint printed).

## What the first real run should do

1. Enable Actions (B1) → `ci-static`, `ci-unit` green.
2. `ci-e2e-simpmusic.yml` (manual) → `assembleDebug` on the test bed; this is also the R1 answer.
3. `uiport-capture.yml` (manual) → reference screenshots + noise floor for phone.
4. Port `home`, `library`, `now-playing` on phone (Phases 3–5 procedure), diff in CI.
5. One tablet layout (expanded window class) and one desktop layout (the project has a real Compose
   Desktop target).
6. Wire to the SimpMusic engine (Phase 6), verify (Phase 7), package.

Expected cost: three to five Actions runs of 20–45 minutes for the builds, plus a handful of short
screenshot runs.

## Honest summary

Nothing about the *plugin* is left unbuilt at this point; what is missing is execution evidence, which
needs a machine with a JDK, an Android SDK and a browser — or a repository whose Actions are enabled.
