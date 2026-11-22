package com.maxrave.simpmusic.ui.uiport

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.TextUnit
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

/**
 * Text style for the ported screens, with Android's legacy font padding turned off.
 *
 * This is a measured difference, not a preference. Compose's default `includeFontPadding = true`
 * adds the font's ascent/descent slack above and below every line, so a 30 dp `lineHeight` measured
 * 32 dp on screen and a 80 dp heading measured 82. The browser has no equivalent: Chromium's line
 * box *is* the line-height, which is why every single text row in the report carried a `dh` of
 * about +2 (home's "Good morning, Guest" 80 → 82, library's "Your playlists" 30 → 32, the chips'
 * 17.39 → 17 on the short side). Turning the padding off is what makes a Compose line box
 * comparable to a CSS one at all.
 *
 * Keeping it here rather than at 52 call sites means the next screen inherits it, and it is a single
 * place to change if the assumption is ever wrong.
 */
@Composable
fun UiPortTextStyle(
    fontSize: TextUnit,
    lineHeight: TextUnit,
    fontFamily: FontFamily,
    color: Color = Color.Unspecified,
    fontWeight: FontWeight = FontWeight.Normal,
    letterSpacing: TextUnit = TextUnit.Unspecified,
): TextStyle =
    TextStyle(
        color = color,
        fontSize = fontSize,
        lineHeight = lineHeight,
        fontFamily = fontFamily,
        fontWeight = fontWeight,
        letterSpacing = letterSpacing,
        platformStyle = PlatformTextStyle(includeFontPadding = false),
    )
