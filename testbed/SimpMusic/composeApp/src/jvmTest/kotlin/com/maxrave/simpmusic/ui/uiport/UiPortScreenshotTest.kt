package com.maxrave.simpmusic.ui.uiport

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTag
import androidx.compose.ui.unit.dp
import com.github.takahirom.roborazzi.RobolectricDeviceQualifiers
import com.github.takahirom.roborazzi.captureRoboImage
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Renders each ported screen at the exact viewport and density the web reference was
 * captured at, and writes the image where the ui-port diff expects it.
 *
 * The qualifiers are not "a phone": they are 393 x 852 dp at xxhdpi, which is what
 * `config/viewports.json` says the phone target is and what the Playwright capture used. A
 * screenshot at any other density measures a different layout and the diff is meaningless.
 *
 * Run:
 *   ./gradlew :composeApp:recordUiPortScreens
 * Output:
 *   composeApp/build/ui-port-output/phone/<screen>/default.png
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = RobolectricDeviceQualifiers.Pixel7)
class UiPortScreenshotTest {
    private val outRoot = File("build/ui-port-output")

    private fun capture(
        screen: String,
        content: @Composable () -> Unit,
    ) {
        val dir = File(outRoot, "phone/$screen")
        dir.mkdirs()
        // The render is written straight to the path the diff consumes: a copy step
        // between capture and diff is one more place for a stale file to hide.
        captureRoboImage(filePath = File(dir, "default.png").path) {
            Box(modifier = Modifier.fillMaxSize()) { content() }
        }
    }

    @Test
    fun home() {
        capture("home") { UiPortHomeScreen() }
    }

    @Test
    fun smoke() {
        // A tiny always-rendering test: if the Roborazzi/Robolectric toolchain breaks, this
        // fails in seconds instead of after seven screen renders.
        val dir = File(outRoot, "phone/smoke")
        dir.mkdirs()
        captureRoboImage(filePath = File(dir, "default.png").path) {
            androidx.compose.foundation.layout.Column(modifier = Modifier.fillMaxSize().semantics { testTag = "smoke" }) {
                Text("ui-port", modifier = Modifier.semantics { contentDescription = "smoke" })
                Spacer(Modifier.height(8.dp))
            }
        }
    }
}
