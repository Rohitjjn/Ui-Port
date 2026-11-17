package com.maxrave.simpmusic.ui.uiport

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
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
 * Height of the bottom bar.
 *
 * The NavLink is `flex flex-col gap-0.5 py-2` around an `h-8` pill and an 11px/16px label:
 * 8 + 32 + 2 + 16 + 8 = 66, and the reference measures the link at 64x65.94 with its bottom
 * edge at y=851.94 in an 852-tall frame — so the bar *is* the link's height, 66 dp, and the
 * link fills it.
 *
 * This used to be 72 with an extra `padding(vertical = 8.dp)` on the Row, which left 56 dp
 * for a Column that needs 66: the label was clipped to exactly 6 dp, measured as
 * `cand[310.5,830 34.5x6]` against `ref[295.5,786.06 64x65.94]` for all three items. The
 * padding is the link's own `py-2`, so applying it on the Row as well both shrank the box
 * and double-counted it.
 */
private val navBarHeight = 66.dp

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
                    .height(navBarHeight)
                    .layoutProbe("nav.row"),
            horizontalArrangement = Arrangement.SpaceAround,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            items.forEach { item ->
                val active = item.route == activeRoute
                // The prototype's NavLink is `flex min-w-[64px] flex-col items-center gap-0.5
                // py-2`: the link is at least 64 dp wide and 8 dp of padding sits above and
                // below the icon+label pair. Both were missing here, and the geometry gate is
                // what found it — the labels sat 38 dp high in a box 50 dp too short while the
                // pixel score still read 96%. Position and size come from the class list, not
                // from what looks close.
                // `fillMaxHeight` because the link is the full height of the bar: the reference
                // measures the link at 65.94 dp in a 66 dp bar, not a 66 dp link floating inside
                // a taller one. Without it the box is only as tall as its content and the
                // comparator has nothing to match the reference's 64x65.94 against.
                Column(
                    modifier =
                        Modifier
                            .defaultMinSize(minWidth = 64.dp)
                            .fillMaxHeight()
                            .padding(vertical = 8.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(2.dp),
                ) {
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
            modifier = Modifier.weight(1f),
            onTextLayout = { UiPortLayoutProbe.recordText("banner.text", it.lineCount, it.size) },
        )
        Box(
            modifier =
                Modifier
                    .height(36.dp)
                    .clip(RoundedCornerShape(percent = 50))
                    .background(UiPortTokens.sage)
                    .padding(horizontal = 16.dp)
                    .semantics { contentDescription = "Log in" },
            contentAlignment = Alignment.Center,
        ) {
            Text("Log in", color = UiPortTokens.paper, fontSize = UiPortTokens.subtitle, fontWeight = FontWeight.Medium)
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
