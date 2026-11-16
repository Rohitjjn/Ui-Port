package com.maxrave.simpmusic.ui.uiport

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.maxrave.simpmusic.ui.uiport.UiPortLayoutProbe.layoutProbe

/**
 * Now playing, ported from `testbed/prototype/src/components/player/FullPlayer.tsx`.
 *
 * The prototype has no `/now-playing` route: the full player is an overlay that the mini
 * player opens, and the capture reaches it through that same click (state `player` in the
 * capture spec). It is therefore modelled as a screen that owns the whole viewport rather
 * than a screen inside the shell — the bottom nav is behind it, not beside it.
 *
 * Tabs (Lyrics/Queue/Related/Info) change only the panel below the transport, so the
 * selected tab is a parameter and the panel is a slot: the screenshot test renders the
 * default lyrics panel, exactly what the capture shows.
 */
@Composable
fun UiPortNowPlayingScreen(
    track: UiPortFixtures.Track = UiPortFixtures.nowPlayingTrack,
    albumTitle: String = "Chapel Weather",
    isPlaying: Boolean = true,
    progress: Float = 0.32f,
    activeTab: String = "lyrics",
    lyrics: List<UiPortFixtures.LyricLine> = UiPortFixtures.lyricLines,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxSize()
                .background(UiPortTokens.paper)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = UiPortTokens.pagePadding),
    ) {
        PlayerHeader(albumTitle)

        Spacer(Modifier.height(8.dp))
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(361.dp)
                    .layoutProbe("art")
                    .clip(RoundedCornerShape(UiPortTokens.radiusMd))
                    .background(UiPortTokens.ivory),
        ) {
            UiPortArtwork.Cover(palette = track.palette)
        }

        Spacer(Modifier.height(24.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    modifier = Modifier.layoutProbe("title"),
                    onTextLayout = { UiPortLayoutProbe.recordText("title", it.lineCount, it.size) },
                    text = track.title,
                    color = UiPortTokens.ink,
                    fontSize = 24.sp,
                    lineHeight = 30.sp,
                    fontFamily = UiPortFonts.serif,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = "${track.artist} · $albumTitle",
                    color = UiPortTokens.mute,
                    fontSize = UiPortTokens.subtitle,
                    lineHeight = 19.sp,
                    fontFamily = UiPortFonts.sans,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            RoundIconButton("Like", filled = true, tint = UiPortTokens.rose)
            RoundIconButton("More", filled = false, tint = UiPortTokens.charcoal)
        }

        Spacer(Modifier.height(20.dp))
        ProgressBar(progress)
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(
                text = formatTime((progress * track.duration).toInt()),
                color = UiPortTokens.mute,
                fontSize = UiPortTokens.caption,
                fontFamily = UiPortFonts.sans,
            )
            Text(
                text = "-${formatTime((track.duration * (1 - progress)).toInt())}",
                color = UiPortTokens.mute,
                fontSize = UiPortTokens.caption,
                fontFamily = UiPortFonts.sans,
            )
        }

        Spacer(Modifier.height(16.dp))
        Transport(isPlaying)

        Spacer(Modifier.height(24.dp))
        TabRow(activeTab)
        Spacer(Modifier.height(16.dp))
        when (activeTab) {
            "lyrics" -> LyricsPanel(lyrics)
            else -> EmptyPanel(activeTab)
        }
        Spacer(Modifier.height(24.dp))
    }
}

/** Chevron-down, the record label, and the options button: `pt-2`, 44px controls. */
@Composable
private fun PlayerHeader(albumTitle: String) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .layoutProbe("header")
                .padding(top = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        RoundIconButton("Close", filled = false, tint = UiPortTokens.ink)
        Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "PLAYING FROM",
                color = UiPortTokens.mute,
                fontSize = UiPortTokens.kickerSize,
                lineHeight = 16.sp,
                letterSpacing = 1.1.sp,
                fontFamily = UiPortFonts.sans,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = albumTitle,
                color = UiPortTokens.ink,
                fontSize = UiPortTokens.subtitle,
                lineHeight = 19.sp,
                fontFamily = UiPortFonts.sans,
                fontWeight = FontWeight.Medium,
                maxLines = 1,
            )
        }
        RoundIconButton("More", filled = false, tint = UiPortTokens.ink)
    }
}

/** `IconButton` md: 44x44, rounded-full; `tone="soft"` fills it with ivory. */
@Composable
private fun RoundIconButton(
    label: String,
    filled: Boolean,
    tint: Color,
) {
    Box(
        modifier =
            Modifier
                .size(44.dp)
                .clip(CircleShape)
                .background(if (filled) UiPortTokens.ivory else Color.Transparent),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier =
                Modifier
                    .size(20.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(tint),
        )
    }
}

/** The web slider: a 20px track with a sand rail and an ink fill. */
@Composable
private fun ProgressBar(progress: Float) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(20.dp),
            contentAlignment = Alignment.Center,
        ) {
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(4.dp)
                        .clip(RoundedCornerShape(percent = 50))
                        .background(UiPortTokens.sand),
            )
            Row(modifier = Modifier.fillMaxWidth()) {
                Box(
                    modifier =
                        Modifier
                            .fillMaxWidth(progress.coerceIn(0f, 1f)),
                ) {
                    Box(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .height(4.dp)
                                .clip(RoundedCornerShape(percent = 50))
                                .background(UiPortTokens.ink),
                    )
                }
            }
        }
    }
}

/** Shuffle, previous, a 72px ink play button, next, repeat — `justify-between`. */
@Composable
private fun Transport(isPlaying: Boolean) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        TransportIcon("Shuffle", active = false)
        TransportIcon("Previous", active = true, large = true)
        Box(
            modifier =
                Modifier
                    .size(72.dp)
                    .layoutProbe("play")
                    .clip(CircleShape)
                    .background(UiPortTokens.ink),
            contentAlignment = Alignment.Center,
        ) {
            Box(
                modifier =
                    Modifier
                        .size(if (isPlaying) 16.dp else 22.dp)
                        .clip(RoundedCornerShape(3.dp))
                        .background(UiPortTokens.paper),
            )
        }
        TransportIcon("Next", active = true, large = true)
        TransportIcon("Repeat", active = false)
    }
}

@Composable
private fun TransportIcon(
    label: String,
    active: Boolean,
    large: Boolean = false,
) {
    Box(
        modifier =
            Modifier
                .size(if (large) 56.dp else 44.dp),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier =
                Modifier
                    .size(if (large) 28.dp else 20.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(if (active) UiPortTokens.ink else UiPortTokens.mute),
        )
    }
}

/** Four tabs; the active one is ink with an underline, the rest are mute. */
@Composable
private fun TabRow(activeTab: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        UiPortFixtures.playerTabs.forEach { tab ->
            val active = tab.id == activeTab
            Box(
                modifier =
                    Modifier
                        .weight(1f)
                        .height(40.dp)
                        .clip(RoundedCornerShape(UiPortTokens.radiusXs))
                        .background(if (active) UiPortTokens.ink else Color.Transparent),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = tab.label,
                    color = if (active) UiPortTokens.paper else UiPortTokens.charcoal,
                    fontSize = UiPortTokens.subtitle,
                    lineHeight = 19.sp,
                    fontFamily = UiPortFonts.sans,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                )
            }
        }
    }
}

/** Lyrics: a centred column where the line being sung is ink and the rest are mute. */
@Composable
private fun LyricsPanel(lines: List<UiPortFixtures.LyricLine>) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(UiPortTokens.radiusMd))
                .background(UiPortTokens.ivory)
                .border(1.dp, UiPortTokens.line, RoundedCornerShape(UiPortTokens.radiusMd))
                .padding(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        lines.forEach { line ->
            Text(
                text = line.text,
                color = if (line.active) UiPortTokens.ink else UiPortTokens.mute,
                fontSize = if (line.active) 22.sp else 17.sp,
                lineHeight = if (line.active) 28.sp else 24.sp,
                fontFamily = UiPortFonts.serif,
                fontWeight = if (line.active) FontWeight.Medium else FontWeight.Normal,
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
private fun EmptyPanel(tab: String) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(160.dp)
                .clip(RoundedCornerShape(UiPortTokens.radiusMd))
                .background(UiPortTokens.ivory),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = "${tab.replaceFirstChar { it.uppercase() }} panel",
            color = UiPortTokens.mute,
            fontSize = UiPortTokens.body,
            fontFamily = UiPortFonts.sans,
        )
    }
}

/** `fmtTime`: m:ss, rounding down, as the prototype prints it. */
internal fun formatTime(seconds: Int): String {
    val safe = seconds.coerceAtLeast(0)
    return "${safe / 60}:${(safe % 60).toString().padStart(2, '0')}"
}
