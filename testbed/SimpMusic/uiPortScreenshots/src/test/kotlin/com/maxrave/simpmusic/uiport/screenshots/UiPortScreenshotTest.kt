package com.maxrave.simpmusic.uiport.screenshots

import app.cash.paparazzi.DeviceConfig
import androidx.compose.ui.unit.Density
import app.cash.paparazzi.Paparazzi
import com.maxrave.simpmusic.ui.uiport.UiPortHomeScreen
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
    // 393dp * 2.75 = 1080px, 852dp * 2.75 = 2340px. No status bar: the web reference has
    // none (the capture hides platform chrome), so including one would shift every element.
    // Paparazzi 2.x takes a Density here, not a bare float (1.x took the float).
    private val phone =
        DeviceConfig(
            screenWidth = 1080,
            screenHeight = 2340,
            density = Density(2.75f),
            xdpi = 440,
            ydpi = 440,
            softButtons = false,
            screenRound = false,
            statusBarHeight = 0,
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
        paparazzi.snapshot(name = screen) { content() }
        val produced =
            listOf(
                File("src/test/snapshots/images/${nameFor(screen)}.png"),
                File("build/reports/paparazzi/images/${nameFor(screen)}.png"),
            ).firstOrNull { it.exists() }
        if (produced != null) produced.copyTo(File(dir, "default.png"), overwrite = true)
    }

    private fun nameFor(screen: String) = "com.maxrave.simpmusic.uiport.screenshots.UiPortScreenshotTest_${screen}.png"

    @Test
    fun home() {
        capture("home") { UiPortHomeScreen() }
    }
}
