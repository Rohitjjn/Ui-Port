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

## Why Roborazzi by default

- Pure JVM: works on CI without an emulator, in minutes not tens of minutes.
- Uses the project's own Compose version, so what it renders is what ships.
- `@Config(qualifiers = ...)` reproduces exact dp sizes and densities.
- Known gap: blur/backdrop effects (`Modifier.blur`) may not render under Robolectric. If a screen
  depends on them, either use Paparazzi or mask the region and log `blur-unsupported`.
