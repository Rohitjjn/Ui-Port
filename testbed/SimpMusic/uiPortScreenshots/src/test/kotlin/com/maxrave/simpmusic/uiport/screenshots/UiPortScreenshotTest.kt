package com.maxrave.simpmusic.uiport.screenshots

import app.cash.paparazzi.DeviceConfig
import com.android.resources.Density
import com.android.resources.ScreenRound
import app.cash.paparazzi.Paparazzi
import com.maxrave.simpmusic.ui.uiport.UiPortHomeScreen
import com.maxrave.simpmusic.ui.uiport.UiPortLayoutProbe
import org.junit.Rule
import org.junit.Test
import java.io.File

/**
 * Renders each ported screen at the exact viewport the web reference was captured at.
 *
 * The device config is not "a phone": it is 393 x 852 dp at density 2.75, which is what
 * `config/viewports.json` declares for the phone target and what the Playwright capture
 * used. Rendering at any other density measures a different layout and the diff would be
 * meaningless, so the numbers are literal rather than a named preset.
 *
 *   ./gradlew :uiPortScreenshots:recordPaparazzi
 *   -> uiPortScreenshots/build/ui-port-output/phone/home/default.png
 */
class UiPortScreenshotTest {
    // 393dp * 2 = 786px, 852dp * 2 = 1704px: the reference capture used deviceScaleFactor 2
    // (config/viewports.json), so the render must use the same factor. Rendering at
    // xxhdpi (2.75) would produce a different image for the same layout and every diff
    // would measure the density difference instead of the port.
    // No status bar or system UI: the web reference has no platform chrome.
    // The reference for this workflow is captured at DPR 1 (Paparazzi clamps a snapshot
    // to 1000 px on its long edge, so it cannot produce a 2x 786x1704 image at all).
    // xdpi/ydpi = 160 with density MEDIUM means 1 px per dp, so the rendered PNG has the
    // same 393 x 852 extent as the reference and the two are directly comparable.
    private val phone =
        DeviceConfig(
            screenWidth = 393,
            screenHeight = 852,
            density = Density.MEDIUM,
            xdpi = 160,
            ydpi = 160,
            softButtons = false,
            screenRound = ScreenRound.NOTROUND,
        )

    @get:Rule
    val paparazzi = Paparazzi(deviceConfig = phone, showSystemUi = false, maxPercentDifference = 100.0)

    private fun capture(
        screen: String,
        content: @androidx.compose.runtime.Composable () -> Unit,
    ) {
        val dir = File("build/ui-port-output/phone/$screen")
        dir.mkdirs()
        // Paparazzi writes into its own snapshot folder; the file is copied to the path the
        // ui-port diff consumes so no manual step sits between render and measurement.
        UiPortLayoutProbe.reset()
        paparazzi.snapshot(name = screen) { content() }
        // Paparazzi names the file after the test class, the test method and the snapshot
        // name: ..._UiPortScreenshotTest_home_home.png. Search rather than hard-code that
        // pattern; a silent name change would otherwise turn into "missing render".
        val produced =
            sequenceOf(File("src/test/snapshots/images"), File("build/reports/paparazzi"))
                .flatMap { root -> root.walkTopDown().filter { it.isFile && it.extension == "png" } }
                .firstOrNull { it.name.contains("UiPortScreenshotTest_$screen") }
        check(produced != null) { "paparazzi produced no image for screen \"$screen\"; looked under src/test/snapshots and build/reports/paparazzi" }
        produced.copyTo(File(dir, "default.png"), overwrite = true)
        // Publish the achieved size: a size mismatch is the most common reason two images
        // cannot be compared, and it should be visible without opening the artifact.
        val size =
            javax.imageio.ImageIO.read(File(dir, "default.png"))?.let { "${it.width}x${it.height}" } ?: "unknown"
        println("[ui-port] rendered $screen at $size (expected 393x852)")
        // The reference side already records exact boxes; printing the candidate's own
        // boxes is what turns "the card looks high" into "the card is 39px high".
        // Written to a file as well as printed: Gradle swallows a test's stdout unless
        // testLogging is raised for every task, and a file travels with the artifact.
        File(dir, "layout.txt").writeText(UiPortLayoutProbe.dump().joinToString("\n", postfix = "\n"))
        UiPortLayoutProbe.dump().forEach { println("[ui-port] box $screen $it") }
    }

    @Test
    fun home() {
        capture("home") { UiPortHomeScreen() }
    }
}
