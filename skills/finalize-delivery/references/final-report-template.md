# FINAL-REPORT.md template

```
# ui-port final report

Project: <name> (<path>)        Run: <date>          Plugin: ui-port <version>
Case: <case>                    Mode: <execution>    Devices: <targets>
Prototype: <path or archive>    Engine commits touched: <list or none>

## Scores

| Screen | Device | Status | Pixel match | SSIM | Geometry coverage | Iterations |
| --- | --- | --- | --- | --- | --- | --- |
| home | phone | matched | 99.62% | 0.9987 | 99.1% | 2 |
| ... | | | | | | |

Noise floor: web-vs-web <x>%, compose-vs-compose <y>%.
Effective thresholds for this run: floor <a>%, goal <b>%.

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
