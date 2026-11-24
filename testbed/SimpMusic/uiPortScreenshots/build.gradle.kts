/**
 * Render the ported Compose screens for pixel comparison against the web reference.
 *
 * This is a separate Android library module for one reason: Paparazzi only resolves on an
 * Android JVM test source set. `:composeApp` is a Kotlin Multiplatform module, so putting
 * the render there is rejected at configuration time ("Paparazzi must not be declared in
 * 'jvmTestImplementation'"). testImplementation is cheap — Gradle keeps it out of every
 * shipped artifact, including the APK.
 */
plugins {
    alias(libs.plugins.android.library)
    // No kotlin-android alias here: the root project already puts the Kotlin plugin on the
    // build classpath (through the KMP modules), and re-requesting it with a version is
    // rejected. The Android plugin compiles Kotlin sources in this module.
    alias(libs.plugins.compose.compiler)
    alias(libs.plugins.paparazzi)
}

android {
    namespace = "com.maxrave.simpmusic.uiport.screenshots"
    compileSdk = 37
    defaultConfig {
        minSdk = 26
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation(project(":composeApp"))
    implementation(libs.compose.ui)
    implementation(libs.compose.material3)
    implementation(libs.foundation)
    testImplementation(libs.junit)
    testImplementation(libs.paparazzi)
}
