package com.maxrave.simpmusic.ui.uiport

import androidx.compose.ui.text.font.FontFamily
import org.jetbrains.compose.resources.ExperimentalResourceApi
import androidx.compose.ui.text.font.FontWeight
import org.jetbrains.compose.resources.Font
import simpmusic.composeapp.generated.resources.Res
import simpmusic.composeapp.generated.resources.uiport_instrument_serif
import simpmusic.composeapp.generated.resources.uiport_inter_medium
import simpmusic.composeapp.generated.resources.uiport_inter_regular
import simpmusic.composeapp.generated.resources.uiport_inter_semibold

/**
 * Typefaces used by the ported screens, and the reason they are bundled.
 *
 * The prototype's `--font-serif` stack is "Instrument Serif", "Cormorant Garamond", Georgia,
 * serif and its `--font-sans` stack starts with Inter; the reference capture was taken with
 * the real webfonts loaded. Compose's `FontFamily.Serif`/`SansSerif` are *different*
 * typefaces, and the difference is not cosmetic: line breaks change. With platform fonts
 * the 13px login banner fitted on two lines where the reference has three, the 14px hero
 * description fitted on two where the reference has four, and the greeting fitted on one
 * line of 32px type where the reference has two. Every one of those differences moves the
 * whole page below it, so a band of the screenshot cannot match no matter how carefully the
 * layout is written.
 *
 * Both families are Open Font License, and the licence texts ship next to the binaries in
 * `composeResources/font/OFL-*.txt`.
 */
@OptIn(ExperimentalResourceApi::class)
object UiPortFonts {
    /** "Instrument Serif" regular, as loaded by the web page. */
    val serif: FontFamily = FontFamily(Font(Res.font.uiport_instrument_serif, FontWeight.Normal))

    /** Inter 400/500/600, the three weights the prototype's `font-medium`/`font-semibold` use. */
    val sans: FontFamily =
        FontFamily(
            Font(Res.font.uiport_inter_regular, FontWeight.Normal),
            Font(Res.font.uiport_inter_medium, FontWeight.Medium),
            Font(Res.font.uiport_inter_semibold, FontWeight.SemiBold),
        )
}
