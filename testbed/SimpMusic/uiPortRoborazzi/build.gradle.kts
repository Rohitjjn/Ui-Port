/**
 * Render the ported Compose screens with Roborazzi (Robolectric on the JVM) and dump their
 * semantics trees, so the pixel diff and the geometry gate both have a candidate side.
 *
 * Why this module exists next to `:uiPortScreenshots` (Paparazzi) rather than replacing it:
 * Paparazzi's layoutlib clamps a snapshot to 1000 px on the long edge, so a 2x phone render
 * (786 x 1704) is impossible and every comparison had to be forced to 1x. Roborazzi renders
 * through Robolectric's own canvas at the requested size, and — the part that matters more —
 * it is driven by the Compose **test rule**, which is the only supported way to read the
 * semantics tree (`getBoundsInRoot` in dp, roles, test tags). Section B of the directive asks
 * for exactly that dump, and it cannot be produced from a layoutlib snapshot.
 *
 * Paparazzi stays in the build as the fallback documented in `config/tools.json`: an
 * Android-only project whose engine refuses Robolectric keeps a working renderer.
 */
plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.compose.compiler)
}

android {
    namespace = "com.maxrave.simpmusic.uiport.roborazzi"
    compileSdk = 37
    defaultConfig {
        minSdk = 26
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    testOptions {
        unitTests {
            // Robolectric needs the merged resources (fonts, themes) to inflate anything.
            isIncludeAndroidResources = true
            all { it.systemProperty("roborazzi.test.record", "true") }
        }
    }
    testOptions.unitTests.all {
        // Gradle swallows a test's stdout by default, which hides the one line that says how many
        // semantics nodes were dumped — the first fact needed when the geometry gate reads 0%.
        it.testLogging {
            showStandardStreams = true
            events("passed", "failed", "skipped")
        }
    }
}

dependencies {
    implementation(project(":composeApp"))
    implementation(libs.compose.ui)
    implementation(libs.compose.material3)
    implementation(libs.foundation)
    testImplementation(libs.junit)
    testImplementation(libs.robolectric)
    testImplementation(libs.roborazzi)
    testImplementation(libs.roborazzi.compose)
    testImplementation(libs.roborazzi.junit.rule)
    testImplementation(libs.compose.ui.test.junit4)
    // Supplies the activity the compose rule hosts; must be on the test runtime, not the app.
    debugImplementation(libs.compose.ui.test.manifest)
}
