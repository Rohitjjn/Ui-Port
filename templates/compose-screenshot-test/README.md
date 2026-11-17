# Compose screenshot test template

Renders a Compose screen on the JVM (Robolectric + Roborazzi) at exactly the viewport and density
used for the web reference, so the two images can be compared pixel for pixel.

Copy into the target project, next to the screen's tests:

```
app/src/test/java/<pkg>/screenshots/ScreenCaptureTest.kt
app/src/test/java/<pkg>/screenshots/SemanticsDump.kt
```

Gradle (Kotlin DSL, app module):

```kotlin
plugins {
    id("io.github.takahirom.roborazzi") version "<resolved at run time>"
}

android {
    testOptions {
        unitTests {
            isIncludeAndroidResources = true
            all { it.systemProperty("roborazzi.test.record", "true") }
        }
    }
}

dependencies {
    testImplementation("org.robolectric:robolectric:<resolved>")
    testImplementation("io.github.takahirom.roborazzi:roborazzi:<resolved>")
    testImplementation("io.github.takahirom.roborazzi:roborazzi-compose:<resolved>")
    testImplementation("androidx.compose.ui:ui-test-junit4:<from the project's Compose BOM>")
    debugImplementation("androidx.compose.ui:ui-test-manifest:<from the project's Compose BOM>")
}
```

Run:

```
./gradlew :app:recordRoborazziDebug --tests '*ScreenCaptureTest*'
```

Outputs land in `app/build/outputs/roborazzi/` — copy them to
`.uiport/output/<device>/<screen>/` before diffing. The helper writes
`<screen>.semantics.json` next to each PNG; that file is what the geometry comparison consumes.

## The semantics dump is not optional

`SemanticsDump.kt` writes the candidate half of the geometry gate. Three details decide whether
the numbers mean anything, and all three were learned the hard way (see
`docs/phase-reports/phase-b-harness-and-renderer.md`):

- `rule.onRoot(useUnmergedTree = true)`. The merged tree folds a row's texts into the clickable row
  that owns them, so 165 text runs report as 16 nodes.
- `node.boundsInRoot` is **device pixels**. Divide by `rule.density.density` once, at the dump, or
  every box is 2x too large and the tolerance is meaningless.
- Robolectric's display size is set in `src/test/resources/robolectric.properties`
  (`qualifiers=...`), not in `@Config`: there is no `resolution` parameter, and the qualifiers alone
  decide how the layout is *computed*, not how large the image is.

The reference side is clipped to the viewport, so the candidate side is too: a `verticalScroll`
screen only composes its visible rows, and comparing them against a DOM dump of the whole document
scores a correct screen at 0%.

## Why Roborazzi by default

- Pure JVM: works on CI without an emulator, in minutes not tens of minutes.
- Uses the project's own Compose version, so what it renders is what ships.
- `@Config(qualifiers = ...)` reproduces exact dp sizes and densities.
- Known gap: blur/backdrop effects (`Modifier.blur`) may not render under Robolectric. If a screen
  depends on them, either use Paparazzi or mask the region and log `blur-unsupported`.
- **Paparazzi cannot be the default for this plugin.** It clamps a snapshot to 1000 px on the long
  edge, so a 2x phone render is impossible, and its layoutlib path produces no semantics tree —
  which means the geometry gate can only report "not measured", and "not measured" is a failure
  by `config/thresholds.json`. Keep it as the fallback for a project whose engine refuses
  Robolectric, and render it into its own `1x` device directory so a 1x image is never compared
  against a 2x reference.
