package com.maxrave.simpmusic.ui.uiport

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Design tokens ported from the web prototype (`src/index.css`, the `@theme` block).
 *
 * Values are copied one-to-one, not approximated: the whole point of a visual port is that
 * the same token produces the same pixel. Where the web uses a CSS expression that
 * Compose cannot evaluate (a `linear-gradient` over two custom properties), the resolved
 * endpoint colours are listed and the reason is recorded in docs/LIMITS.md.
 */
object UiPortTokens {
    val paper = Color(0xFFFAF8F3)
    val ivory = Color(0xFFF4F0E8)
    val card = Color(0xFFFFFFFF)
    val ink = Color(0xFF25231F)
    val charcoal = Color(0xFF555149)
    val mute = Color(0xFF969087)
    val sage = Color(0xFF71836B)
    val olive = Color(0xFFA2A58A)
    val rose = Color(0xFFC49A94)
    val sand = Color(0xFFD9CBB7)

    /** `--color-line: rgba(37, 35, 31, 0.08)` */
    val line = Color(0x1425231F)

    // Radii: --radius-xs/sm/md/lg/xl = 6/10/16/22/28 px
    val radiusXs = 6.dp
    val radiusSm = 10.dp
    val radiusMd = 16.dp
    val radiusLg = 22.dp
    val radiusXl = 28.dp

    /**
     * Type scale, in sp, straight from the prototype's `text-[Npx]` classes.
     * The prototype uses px on the web; at the reference DPR these map to dp, which is
     * what the diff compares, so the numbers are kept as they are.
     */
    val heroTitle = 32.sp
    val heroTitleLarge = 40.sp
    val featuredTitle = 34.sp
    val sectionTitle = 24.sp
    val body = 14.sp
    val subtitle = 13.sp
    val caption = 12.sp
    val display = 20.sp
    val kickerSize = 11.sp

    /** Vertical rhythm: `space-y-10` between home sections. */
    val sectionGap = 40.dp

    /**
     * Page padding on a compact (phone) viewport: the shell's `px-4`.
     *
     * The capture corroborates it three ways: the header starts at x=16, the hero cover
     * starts at 16 + 20 (card padding) + 1 (hairline) = 37, and the header row closes
     * exactly: 209 (title column) + 12 (gap-3) + 140 (two 44px icon buttons, a 40px
     * avatar and their gaps) = 361 = 393 - 2x16.
     */
    val pagePadding = 16.dp

    /**
     * Width of the header's title column.
     *
     * The web header is a flex row whose left column is not `flex-1`, so it shrinks to its
     * widest child: the 14px subtitle, whose max-content width is 209px. That is what
     * makes the 32px greeting wrap onto two 40px lines in the reference, and it is the
     * reason the card below starts at y=322 instead of y=282. Compose measures text
     * children with the full incoming width, so the column is stated explicitly.
     */
    val headerColumnWidth = 209.dp

    /** The signed-out banner's text box: the capture measured 258x57 (three 19px lines). */
    val bannerTextWidth = 258.dp

    /** The shell's `main` gets `pt-2`, which is where the first capture box (y=16) comes from. */
    val mainPadding = 8.dp
}
