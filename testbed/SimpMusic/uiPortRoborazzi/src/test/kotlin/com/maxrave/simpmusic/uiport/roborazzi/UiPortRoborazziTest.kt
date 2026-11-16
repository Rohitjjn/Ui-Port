package com.maxrave.simpmusic.uiport.roborazzi

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import com.github.takahirom.roborazzi.captureRoboImage
import com.maxrave.simpmusic.ui.uiport.UiPortHomeScreen
import com.maxrave.simpmusic.ui.uiport.UiPortLibraryScreen
import com.maxrave.simpmusic.ui.uiport.UiPortNowPlayingScreen
import java.io.File
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * Renders each ported screen at the same physical size as the web reference and dumps its
 * semantics tree, which is the two inputs the diff needs from the Compose side.
 *
 *   ./gradlew :uiPortRoborazzi:testDebugUnitTest
 *   -> uiPortRoborazzi/build/ui-port-output/<device>/<screen>/default.png
 *   -> uiPortRoborazzi/build/ui-port-output/<device>/<screen>/default.semantics.json
 *
 * The qualifiers come from `config/viewports.json` (phone = 393 x 852 dp at 2x), which produces
 * the 786 x 1704 px image the reference capture takes at the same DPR. A different density is a
 * different image of the same layout and the diff would measure the density, not the port —
 * which is exactly what happened while the reference was forced to 1x by Paparazzi's clamp.
 *
 * `GraphicsMode.NATIVE` is required for text: Robolectric's legacy graphics stub draws glyphs as
 * boxes, which would make every text measurement meaningless while still producing a plausible
 * looking PNG.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w393dp-h852dp-xhdpi")
class UiPortRoborazziTest {
    @get:Rule
    val compose = createComposeRule()

    private val outputRoot = File(System.getProperty("uiport.output.dir") ?: "build/ui-port-output")

    private fun capture(
        screen: String,
        content: @Composable () -> Unit,
    ) {
        compose.setContent {
            Box(Modifier.fillMaxSize()) { content() }
        }
        compose.waitForIdle()
        val dir = File(outputRoot, "phone/$screen")
        dir.mkdirs()
        compose.onRoot().captureRoboImage(File(dir, "default.png").path)
        dumpSemantics(compose, File(dir, "default.semantics.json").path)
        println("[ui-port] rendered $screen -> ${File(dir, "default.png").path}")
    }

    @Test
    fun home() {
        capture("home") { UiPortHomeScreen() }
    }

    @Test
    fun library() {
        capture("library") { UiPortLibraryScreen() }
    }

    /**
     * Now playing is an overlay in the prototype, not a route; the port renders it as its own
     * screen, so it is captured from the same 393 x 852 viewport as the rest.
     */
    @Test
    fun nowplaying() {
        capture("nowplaying") { UiPortNowPlayingScreen() }
    }
}
