package com.maxrave.simpmusic.ui.uiport

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.maxrave.simpmusic.ui.uiport.UiPortLayoutProbe.layoutProbe

/**
 * The phone app shell, ported from `src/app/AppShell.tsx`.
 *
 * The web reference screenshot is the *whole* page, not just the routed screen: a fixed
 * bottom navigation, and (on a signed-out profile) a login banner inside the screen. A port
 * that renders only the screen content can never match it, no matter how accurate the
 * screen itself is — which is exactly what the first measured diff reported (80.12%).
 *
 * The desktop sidebar (`lg:flex`) and the desktop player bar are not part of the phone
 * layout and are ported separately for the desktop target.
 */
object UiPortShell {
    data class NavItem(
        val route: String,
        val label: String,
    )

    /**
     * The prototype's own defaults: `showMixTab = false`, `showAnalyticsTab = false`, so a
     * fresh install has three tabs. Hard-coding five would add two items the reference does
     * not have.
     */
    val defaultNav = listOf(NavItem("/", "Home"), NavItem("/search", "Search"), NavItem("/library", "Library"))
}

/**
 * The bottom bar is not given a fixed height: it is `py-2` + an `h-8` icon pill + an
 * 11px/1.45 label, which is 8 + 32 + 16 + 8 = 64, plus the 1px hairline. The capture put
 * the nav links at y=786 in an 852-tall frame (66px, including the hairline), so the bar
 * takes its own height from its content and the scroll area above it stops where it stops.
 * `safe-bottom` is `env(safe-area-inset-bottom)`, which resolves to 0 at DPR 1.
 */

@Composable
fun UiPortBottomNav(
    items: List<UiPortShell.NavItem> = UiPortShell.defaultNav,
    activeRoute: String = "/",
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(UiPortTokens.paper),
    ) {
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(UiPortTokens.line))
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .windowInsetsPadding(WindowInsets.navigationBars)
                    .padding(vertical = 8.dp)
                    .layoutProbe("nav.row"),
            horizontalArrangement = Arrangement.SpaceAround,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            items.forEach { item ->
                val active = item.route == activeRoute
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(
                        modifier =
                            Modifier
                                .size(width = 56.dp, height = 32.dp)
                                .clip(RoundedCornerShape(percent = 50))
                                .background(if (active) UiPortTokens.ivory else androidx.compose.ui.graphics.Color.Transparent),
                        contentAlignment = Alignment.Center,
                    ) {
                        // Icon glyphs are lucide on the web. A filled dot keeps the same box
                        // so the geometry comparison measures position, not artwork.
                        Box(
                            modifier =
                                Modifier
                                    .size(20.dp)
                                    .clip(CircleShape)
                                    .background(if (active) UiPortTokens.ink else UiPortTokens.mute),
                        )
                    }
                    Text(
                        text = item.label,
                        color = if (active) UiPortTokens.ink else UiPortTokens.mute,
                        fontSize = 11.sp,
                        lineHeight = 16.sp,
                        fontFamily = UiPortFonts.sans(),
                        fontWeight = FontWeight.Medium,
                    )
                }
            }
        }
    }
}

/** The signed-out banner the prototype shows inside the home screen. */
@Composable
fun UiPortLoginBanner(modifier: Modifier = Modifier) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(UiPortTokens.radiusSm))
                .background(UiPortTokens.ivory)
                .layoutProbe("banner")
                .padding(horizontal = 16.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = "Log in to YouTube Music for a personalised home, your playlists and liked songs.",
            color = UiPortTokens.charcoal,
            fontSize = UiPortTokens.subtitle,
            lineHeight = 19.sp,
            fontFamily = UiPortFonts.sans(),
            modifier = Modifier.weight(1f),
            onTextLayout = { UiPortLayoutProbe.recordText("banner.text", it.lineCount, it.size) },
        )
        // `Button size="sm"`: h-9 (36px) with a 13px label, per the capture's 55x36 box.
        Box(
            modifier =
                Modifier
                    .height(36.dp)
                    .clip(RoundedCornerShape(percent = 50))
                    .background(UiPortTokens.sage)
                    .padding(horizontal = 12.dp)
                    .semantics { contentDescription = "Log in" },
            contentAlignment = Alignment.Center,
        ) {
            Text(
                "Log in",
                color = UiPortTokens.paper,
                fontSize = UiPortTokens.subtitle,
                lineHeight = 19.sp,
                fontFamily = UiPortFonts.sans(),
                fontWeight = FontWeight.Medium,
            )
        }
    }
}

/**
 * Screen + fixed bottom navigation. The content scrolls; the nav does not.
 */
@Composable
fun UiPortPhoneScaffold(
    activeRoute: String = "/",
    content: @Composable () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize().background(UiPortTokens.paper)) {
        Box(modifier = Modifier.weight(1f).fillMaxWidth()) { content() }
        UiPortBottomNav(activeRoute = activeRoute)
    }
}
