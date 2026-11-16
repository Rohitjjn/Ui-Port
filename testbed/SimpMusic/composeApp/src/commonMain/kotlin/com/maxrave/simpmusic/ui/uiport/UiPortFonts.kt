package com.maxrave.simpmusic.ui.uiport

import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import simpmusic.composeapp.generated.resources.Res
import simpmusic.composeapp.generated.resources.uiport_instrument_serif
import simpmusic.composeapp.generated.resources.uiport_inter_medium
import simpmusic.composeapp.generated.resources.uiport_inter_regular
import simpmusic.composeapp.generated.resources.uiport_inter_semibold

/**
 * Typefaces used by the ported screens: the exact files the reference capture serves.
 *
 * The prototype's `--font-sans` stack is `"Inter", ui-sans-serif, ...` and `--font-serif` is
 * `"Instrument Serif", ...`. The browser's network is blocked during capture on purpose, so those
 * names only resolve because `config/fonts.json` vendors the files into `res/font` and the capture
 * injects matching `@font-face` rules from that directory. The same files are mirrored into
 * `composeResources/font` and loaded here, which is the only way a text box can be expected to
 * match: two rasterisers with one font file differ by AA fringes, two rasterisers with two font
 * files differ by layout.
 *
 * `scripts/vendor-fonts.mjs --check` fails CI if the mirrors drift, and the capture refuses to
 * screenshot a page whose families did not load. Neither side can quietly fall back.
 *
 * Weights are declared, not synthesised: Inter 400/500/600 and Instrument Serif 400 are the only
 * weights vendored, so a weight the prototype asks for and this file does not declare is a bug to
 * fix in the screen, not something Compose should fake by shearing glyphs.
 */
object UiPortFonts {
    val serif: FontFamily =
        FontFamily(
            Font(Res.font.uiport_instrument_serif, FontWeight.Normal, FontStyle.Normal),
        )

    val sans: FontFamily =
        FontFamily(
            Font(Res.font.uiport_inter_regular, FontWeight.Normal, FontStyle.Normal),
            Font(Res.font.uiport_inter_medium, FontWeight.Medium, FontStyle.Normal),
            Font(Res.font.uiport_inter_semibold, FontWeight.SemiBold, FontStyle.Normal),
        )
}
