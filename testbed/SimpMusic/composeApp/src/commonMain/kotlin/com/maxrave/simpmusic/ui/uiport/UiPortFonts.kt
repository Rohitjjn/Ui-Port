package com.maxrave.simpmusic.ui.uiport

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
// org.jetbrains.compose.resources.Font, not androidx.compose.ui.text.font.Font: the
// composeResources accessors (`Res.font.*`) are FontResource values and only this overload
// accepts them. The androidx one takes a path + AssetManager and fails with "argument type
// mismatch" — which is exactly how this was found.
import org.jetbrains.compose.resources.Font
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
    // Reading a composeResources font is a @Composable operation (it needs the resource
    // environment), so the families are remembered per composition rather than built as
    // top-level `val`s. The screens are the only consumers, so this costs one allocation per
    // screen and removes the alternative — a global that silently needs a Context.
    @Composable
    fun serif(): FontFamily {
        // `Font(...)` is itself @Composable, so it cannot be called inside a `remember` lambda
        // (which is not composable). Read the font first, then remember the family keyed on it.
        val font = Font(Res.font.uiport_instrument_serif, FontWeight.Normal, FontStyle.Normal)
        return remember(font) { FontFamily(font) }
    }

    @Composable
    fun sans(): FontFamily {
        val regular = Font(Res.font.uiport_inter_regular, FontWeight.Normal, FontStyle.Normal)
        val medium = Font(Res.font.uiport_inter_medium, FontWeight.Medium, FontStyle.Normal)
        val semibold = Font(Res.font.uiport_inter_semibold, FontWeight.SemiBold, FontStyle.Normal)
        return remember(regular, medium, semibold) { FontFamily(regular, medium, semibold) }
    }
}
