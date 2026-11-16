# FINAL-REPORT.md template

```
# ui-port final report

Project: <name> (<path>)        Run: <date>          Plugin: ui-port <version>
Case: <case>                    Mode: <execution>    Devices: <targets>
Prototype: <path or archive>    Engine commits touched: <list or none>

## Scores

One row per screen **per device** — never average devices into one number, and never a row without
the run it came from.

| Screen | Device | Status | Accepted | Pixel | SSIM (not gated) | Geometry | Iterations | Residual category |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| home | phone | matched | yes | 99.62% | 0.9987 | 99.1% | 2 | font-rasterization |
| library | tablet | building | no | 91.30% | 0.9210 | 88.0% | 4 | unmeasured |
| ... | | | | | | | | |

Score provenance (a score is a pair of inputs plus the run that produced them, never a bare number):

| Screen | Device | Reference | Candidate | Run |
| --- | --- | --- | --- | --- |
| home | phone | `.uiport/reference/phone/home/default.png` (captured <date>) | Paparazzi `<build>/ui-port-output/phone/home/default.png` | <url/id> |

Noise floor: web-vs-web <x>%, compose-vs-compose <y>% (`--calibrate` → `noise-floor.json`).
Effective thresholds for this run: floor <a>%, goal <b>% (`config/thresholds.json`).
Acceptance = pixel ≥ floor **and** geometry gate passed (measured, ≥ 90% coverage) **and** every
residual categorised. SSIM is reported only. A `BLOCKED` row carries the blocker and the number of
iterations spent; max 5 port iterations per screen per device, harness fixes excluded.

## Residual differences

### home / phone — accepted-with-notes
- font-rasterization: 1px AA fringe on every glyph edge; text boxes within 0.4dp. Chromium
  grayscale AA vs Skia. Not fixable without swapping rasterizers.
- shadow-elevation: card shadow softer on Android (Material elevation vs CSS two-layer shadow).
  Visual intent preserved.

## What was wired

| Flow | Engine entry point | Test |
| --- | --- | --- |
| play from shelf | PlayerViewModel.setQueue | HomeWiringTest.playFromShelf |
| favourite | LibraryViewModel.toggleFavorite | HomeWiringTest.toggleFavourite |

## Feature gaps and decisions

| Prototype feature | Engine support | Decision | Follow-up |
| --- | --- | --- | --- |
| canvas video | none | remove-from-ui | re-add when CanvasRepository exists |
| sleep timer | partial | build-in-engine | SleepTimerRepository + tests (done) |

## Engine files touched

| File | Change | Approval |
| --- | --- | --- |
| core/.../LibraryRepositoryImpl.kt | + delete(ids) | user, 2026-11-15, worklog step-4 |

## How to run

    ./gradlew :androidApp:assembleDebug
    ./gradlew :androidApp:testDebugUnitTest
    ./gradlew :composeApp:recordRoborazziDebug   # re-record screenshots

Screenshot tests live in <paths>. Baselines in .uiport/baseline.json.

## Known limits and remaining risks

- <list, each with the category and the practical consequence>

## Worklog

.uiport/worklog/step-0-preflight.md … step-5-verify.md, plus CHANGELOG.md.
```

## Rules

- Every number must be reproducible from `.uiport/output/**/report.json`.
- Every engine file listed must have an approval reference.
- "Known limits" must be specific to this port, not a copy of `docs/LIMITS.md`.
- If a screen is blocked, it appears in the table with its status and the report says exactly what
  is needed to unblock it.
