package com.example.uiport.screenshots

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import com.github.takahirom.roborazzi.captureRoboImage
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Renders one screen at the exact viewport/density of the web reference capture.
 *
 * Template: copy next to the screen's test sources and replace [SCREEN] with the real
 * composable plus its fixture state. One test method per device target, because the
 * qualifiers must match `config/viewports.json` exactly.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], qualifiers = "w393dp-h852dp-xxhdpi") // phone 393x852 @2x
class ScreenCaptureTest {
    @get:Rule
    val compose = createComposeRule()

    @Test
    fun home_phone_default() {
        capture("home", "phone") {
            // Replace with: HomeScreen(state = HomeFixtures.populated, ...)
            //
            // Screen(state = Fixtures.defaultState, onEvent = {}, modifier = Modifier.fillMaxSize())
        }
    }

    private fun capture(screen: String, device: String, content: @Composable () -> Unit) {
        compose.setContent {
            Box(Modifier.fillMaxSize()) { content() }
        }
        val out = System.getProperty("uiport.output.dir")
            ?: "build/uiport/output"
        // PNG for the pixel diff
        compose.onRoot().captureRoboImage("$out/$device/$screen/default.png")
        // Semantics dump for the geometry diff
        dumpSemantics(compose, "$out/$device/$screen/default.semantics.json")
    }
}
