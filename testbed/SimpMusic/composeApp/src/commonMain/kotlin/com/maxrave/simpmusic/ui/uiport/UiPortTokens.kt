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

    /** Page padding on a compact (phone) viewport: `px-4`. */
    val pagePadding = 16.dp
}
