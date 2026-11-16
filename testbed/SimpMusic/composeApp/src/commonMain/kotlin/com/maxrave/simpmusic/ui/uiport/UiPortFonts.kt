package com.maxrave.simpmusic.ui.uiport

import androidx.compose.ui.text.font.FontFamily

/**
 * Typefaces used by the ported screens — and why these are the platform families.
 *
 * The prototype's stylesheet asks for "Instrument Serif" and "Inter", but the reference
 * capture never gets them: `scripts/capture-reference.mjs` aborts every request that is not
 * same-origin ("the prototype must be self-contained"), so the Google Fonts stylesheet is
 * blocked and the browser resolves the stacks to their generic fallbacks: `serif` and
 * `ui-sans-serif`/`system-ui`.
 *
 * That is measured, not assumed. With the real webfonts bundled the score fell from
 * 94.96% to 89.26%: the greeting stayed two lines (209x82) but the banner fitted three
 * lines where the capture has four, the hero title fitted one line where the capture has
 * two, and the hero description fitted three where the capture has four. Every one of those
 * is a line-count difference, and line counts are exactly what the pixel diff sees.
 *
 * So the port uses the platform families, because the platform families are what the
 * reference actually rendered with. The bundled webfont resources stay in the repository
 * (`composeResources/font/uiport_*`, SIL OFL) for the case where the capture is later
 * changed to allow same-origin bundled fonts: the intent is recorded in docs/LIMITS.md and
 * switching back is a two-line change in this file.
 */
object UiPortFonts {
    /** The web stack's fallback for "Instrument Serif": `serif`. */
    val serif: FontFamily = FontFamily.Serif

    /** The web stack's fallback for "Inter": `ui-sans-serif, system-ui`. */
    val sans: FontFamily = FontFamily.SansSerif
}
