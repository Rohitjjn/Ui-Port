# Verification matrix — what each check actually proves

| Check | Proves | Does not prove |
| --- | --- | --- |
| `ktlintCheck` / `detekt` | formatting and a class of static issues | that anything works |
| `assembleDebug` | the app compiles and links against the real Compose/Kotlin versions | runtime behaviour, appearance |
| unit tests | logic in the ViewModels/repositories | that the UI calls them correctly |
| wiring tests | a user action reaches the engine (call recorded / state changed) | that the result is displayed |
| screenshot tests (record + diff) | appearance matches the reference at a fixed viewport and density | motion, gestures, real data |
| geometry comparison | layout boxes are right | that content is semantically correct |
| smoke test on a device/emulator | the app launches and survives the main journeys | pixel fidelity |
| lint of Markdown/JSON/plugin manifests | the plugin itself is well formed | that a run behaves correctly |

## The evidence rule

A claim in the final report must name the command that produced it and the number or exit code.
"Builds cleanly" is not evidence; "`./gradlew :androidApp:assembleDebug` — BUILD SUCCESSFUL in
3m 12s" is.

## Regression baselines

`.uiport/baseline.json`:

```json
{
  "schemaVersion": 1,
  "run": "2026-11-15T10:00:00Z",
  "scores": { "home::phone": 99.62, "search::phone": 98.91, "home::tablet": 99.10 }
}
```

The regression check fails when `current < baseline - tolerance` (default 0.15 percentage
points). Baselines are updated deliberately, with a worklog note explaining why a screen got
worse — never automatically to make CI green.
