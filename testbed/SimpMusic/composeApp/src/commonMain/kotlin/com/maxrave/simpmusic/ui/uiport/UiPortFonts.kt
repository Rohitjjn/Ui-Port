package com.maxrave.simpmusic.ui.uiport

import androidx.compose.ui.text.font.FontFamily

/**
 * Typefaces used by the ported screens.
 *
 * The prototype's `--font-serif` stack is "Instrument Serif", "Cormorant Garamond", Georgia,
 * serif. The reference capture was taken with whatever the browser resolved, and the app
 * ships no Instrument Serif, so the port uses the generic serif family the stack falls back
 * to. That difference is a documented, measured residual (`font-rasterization`) rather than
 * something hidden: text metrics are the first thing the pixel diff will show.
 */
object UiPortFonts {
    val serif: FontFamily = FontFamily.Serif
    val sans: FontFamily = FontFamily.SansSerif
}
