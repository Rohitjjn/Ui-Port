package com.maxrave.simpmusic.ui.uiport

import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import org.junit.Rule
import org.junit.Test
import java.io.File

/**
 * Renders each ported screen on the desktop JVM at the exact viewport the web reference was
 * captured at, and writes the image where the ui-port diff expects it.
 *
 * The device config is not "a phone": it is 393 x 852 dp at a density of 2.75, which is
 * what `config/viewports.json` says the phone target is and what the Playwright capture
 * used. Rendering at any other density measures a different layout, and the diff would be
 * meaningless.
 *
 * Run:
 *   ./gradlew :composeApp:recordPaparazziJvmTest --tests "*UiPortScreenshotTest*"
 * Output:
 *   composeApp/build/ui-port-output/phone/<screen>/default.png
 */
class UiPortScreenshotTest {
    private val outRoot = File("build/ui-port-output")

    /** 393 x 852 dp; Paparazzi takes pixels, so the size is dp * density. */
    private val phone =
        DeviceConfig(
            screenWidth = 1080,
            screenHeight = 2340,
            density = 2.75f,
            xdpi = 440,
            ydpi = 440,
            softButtons = false,
            screenRound = false,
            statusBarHeight = 0,
        )

    @get:Rule
    val paparazzi = Paparazzi(deviceConfig = phone, showSystemUi = false)

    private fun capture(
        screen: String,
        content: @androidx.compose.runtime.Composable () -> Unit,
    ) {
        val dir = File(outRoot, "phone/$screen")
        dir.mkdirs()
        // Written straight to the path the diff consumes: a copy step between capture and
        // diff is one more place for a stale file to hide.
        paparazzi.snapshot(name = "default") { content() }
        val produced = File("build/reports/paparazzi/jvm/images/phone/$screen/default.png")
        if (produced.exists()) {
            produced.copyTo(File(dir, "default.png"), overwrite = true)
        }
    }

    @Test
    fun home() {
        capture("home") { UiPortHomeScreen() }
    }
}
