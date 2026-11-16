@file:OptIn(ExperimentalFoundationApi::class)

package com.maxrave.simpmusic.ui.uiport

import androidx.compose.foundation.ExperimentalFoundationApi
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.maxrave.simpmusic.ui.uiport.UiPortLayoutProbe.layoutProbe

/**
 * Home, ported from `testbed/prototype/src/features/home/HomeScreen.tsx`.
 *
 * Stateless by design: every value arrives as a parameter, so the screen renders in a
 * screenshot test with no ViewModel, no coroutine and no engine. Wiring to the real
 * SimpMusic engine is a separate, later step and does not change this file's layout.
 *
 * Vertical rhythm is taken from the reference's measured boxes rather than guessed: the
 * web shell is `pt-2 px-4` with `space-y-10`, the header is `pt-2` with a 32px/1.25
 * serif title, the signed-out banner is `px-4 py-3`, and the featured card is `p-5`. The
 * numbers below place the hero image at y=342 and the hero title at y=705, which is what
 * the capture reported, so a mismatch is a real regression instead of a rounding drift.
 *
 * The web original is a phone layout at the reference viewport (393x852). Breakpoint
 * behaviour (`sm:`/`lg:` classes) is deliberately not ported here; the tablet layout is a
 * separate, separately measured port.
 */
@Composable
fun UiPortHomeScreen(
    shelves: List<UiPortFixtures.Shelf> = UiPortFixtures.homeShelves,
    featured: UiPortFixtures.Album = UiPortFixtures.featuredAlbum,
    signedIn: Boolean = false,
    modifier: Modifier = Modifier,
) {
    UiPortPhoneScaffold(activeRoute = "/") {
        Column(
            modifier =
                modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = UiPortTokens.pagePadding, vertical = UiPortTokens.mainPadding),
        ) {
            HomeHeader()

            Spacer(Modifier.height(UiPortTokens.sectionGap))
            if (!signedIn) {
                UiPortLoginBanner()
                Spacer(Modifier.height(UiPortTokens.sectionGap))
            }
            FeaturedHero(featured)

            Spacer(Modifier.height(UiPortTokens.sectionGap))
            RecentlyPlayed()

            shelves.forEach { shelf ->
                Spacer(Modifier.height(UiPortTokens.sectionGap))
                ShelfSection(shelf)
            }
        }
    }
}

/**
 * `pt-2` on the header. The kicker is a div, not a captured heading, but its box decides
 * where the 80px-tall two-line title starts: 8 (main) + 8 (header) + 16 (kicker line) + 4
 * (mt-1) = 36, matching the reference's `h1 y=36`.
 */
@Composable
private fun HomeHeader() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .layoutProbe("header")
                .padding(top = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Column(modifier = Modifier.width(UiPortTokens.headerColumnWidth)) {
            Text(
                text = UiPortFixtures.FROZEN_DATE_LABEL.uppercase(),
                color = UiPortTokens.mute,
                fontSize = UiPortTokens.kickerSize,
                lineHeight = 16.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 1.1.sp,
                maxLines = 1,
            )
            Spacer(Modifier.height(4.dp))
            // The capture shows the greeting wrapping onto two 40px lines inside a 209px
            // column; the port wraps the same way rather than shrinking the type.
            Text(
                modifier = Modifier.layoutProbe("header.title"),
                text = "${UiPortFixtures.FROZEN_GREETING}, Guest",
                color = UiPortTokens.ink,
                fontSize = UiPortTokens.heroTitle,
                lineHeight = 40.sp,
                fontFamily = UiPortFonts.serif(),
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = "What is the best choice today?",
                color = UiPortTokens.mute,
                fontSize = UiPortTokens.body,
                lineHeight = 20.sp,
                fontFamily = UiPortFonts.sans(),
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            HeaderIcon("Notifications", showDot = true)
            HeaderIcon("Settings", showDot = false)
            Box(
                modifier =
                    Modifier
                        .padding(start = 4.dp)
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(UiPortTokens.sage)
                        .semantics { contentDescription = "Account" },
                contentAlignment = Alignment.Center,
            ) {
                Box(
                    modifier =
                        Modifier
                            .size(18.dp)
                            .clip(CircleShape)
                            .border(1.5.dp, UiPortTokens.paper, CircleShape),
                )
            }
        }
    }
}

/** `IconButton` size md = 44x44, ghost tone, 20px glyph, bell carries an 8px rose dot. */
@Composable
private fun HeaderIcon(
    label: String,
    showDot: Boolean,
) {
    Box(
        modifier =
            Modifier
                .size(36.dp)
                .semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) {
        // The web icons are lucide glyphs; a neutral rounded square keeps the same box so
        // the geometry diff compares positions rather than icon artwork (see LIMITS.md).
        Box(
            modifier =
                Modifier
                    .size(18.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(UiPortTokens.charcoal),
        )
        if (showDot) {
            Box(
                modifier =
                    Modifier
                        .align(Alignment.TopEnd)
                        .padding(top = 6.dp, end = 6.dp)
                        .size(8.dp)
                        .clip(CircleShape)
                        .background(UiPortTokens.rose),
            )
        }
    }
}

/**
 * `.paper` card: white fill, 1px hairline, `rounded-xl` (the prototype's --radius-xl = 28),
 * `p-5` padding. At the phone width the `sm:grid-cols-*` split does not apply, so the cover
 * is a full-width square above the text.
 */
@Composable
private fun FeaturedHero(album: UiPortFixtures.Album) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(UiPortTokens.radiusXl))
                .background(UiPortTokens.card)
                .border(1.dp, UiPortTokens.line, RoundedCornerShape(UiPortTokens.radiusXl))
                .layoutProbe("card")
                .padding(20.dp),
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(319.dp)
                    .layoutProbe("card.cover")
                    .clip(RoundedCornerShape(UiPortTokens.radiusSm))
                    .background(UiPortTokens.ivory)
                    .border(1.dp, UiPortTokens.ink.copy(alpha = 0.1f), RoundedCornerShape(UiPortTokens.radiusSm)),
        ) {
            UiPortArtwork.Cover(palette = album.palette)
        }
        Spacer(Modifier.height(20.dp))
        Text(
            text = "FEATURED THIS WEEK",
            color = UiPortTokens.sage,
            fontSize = UiPortTokens.kickerSize,
            lineHeight = 16.sp,
            letterSpacing = 1.1.sp,
            fontFamily = UiPortFonts.sans(),
            fontWeight = FontWeight.SemiBold,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            modifier = Modifier.layoutProbe("card.title"),
            text = album.title,
            color = UiPortTokens.ink,
            fontSize = UiPortTokens.featuredTitle,
            lineHeight = 35.sp,
            fontFamily = UiPortFonts.serif(),
        )
        Spacer(Modifier.height(4.dp))
        Text(
            text = "${album.artistNames.joinToString(", ")} · ${album.year}",
            color = UiPortTokens.charcoal,
            fontSize = 15.sp,
            lineHeight = 22.sp,
            fontFamily = UiPortFonts.sans(),
        )
        Spacer(Modifier.height(16.dp))
        // A one-line description is a fixture, not a layout: the reference's album (al1) has
        // a 168-character description that fills four 20px lines, and the whole card below
        // it is positioned from that. The character count is recorded so a fixture that is
        // too short to fill the box shows up as a number rather than as a mystery.
        Text(
            modifier = Modifier.layoutProbe("card.desc"),
            text = album.description,
            color = UiPortTokens.charcoal,
            fontSize = UiPortTokens.body,
            lineHeight = 20.sp,
            fontFamily = UiPortFonts.sans(),
        )
        Text(
            text = "DESCLEN ${album.description.length}",
            color = Color.Transparent,
            fontSize = 1.sp,
            lineHeight = 1.sp,
            modifier = Modifier.layoutProbe("card.desclen"),
        )
        Spacer(Modifier.height(20.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            // `likedAlbums` is seeded with al1 in the prototype's library store, so the
            // second button reads "Saved" in the reference capture.
            UiPortPillButton("Play", UiPortTokens.ink, UiPortTokens.paper)
            UiPortPillButton("Saved", UiPortTokens.ivory, UiPortTokens.ink)
            UiPortPillButton("Open album", Color.Transparent, UiPortTokens.ink, bordered = true)
        }
    }
}

/** `Button` md: h-11, px-5, text-sm (14), font-medium, rounded-full. */
@Composable
private fun UiPortPillButton(
    label: String,
    background: Color,
    content: Color,
    bordered: Boolean = false,
) {
    Box(
        modifier =
            Modifier
                .height(44.dp)
                .clip(RoundedCornerShape(percent = 50))
                .background(background)
                .then(if (bordered) Modifier.border(1.dp, UiPortTokens.sand, RoundedCornerShape(percent = 50)) else Modifier)
                .padding(horizontal = 20.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label,
            color = content,
            fontSize = UiPortTokens.body,
            lineHeight = 20.sp,
            fontFamily = UiPortFonts.sans(),
            fontWeight = FontWeight.Medium,
            maxLines = 1,
        )
    }
}

/** `SectionHeader`: serif 24px title, 13px mute subtitle, `mb-3`. */
@Composable
private fun ShelfSection(shelf: UiPortFixtures.Shelf) {
    Column {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Bottom,
        ) {
            Column {
                Text(
                    text = shelf.title,
                    color = UiPortTokens.ink,
                    fontSize = UiPortTokens.sectionTitle,
                    lineHeight = 28.sp,
                    fontFamily = UiPortFonts.serif(),
                )
                if (shelf.subtitle != null) {
                    Text(
                        text = shelf.subtitle,
                        color = UiPortTokens.mute,
                        fontSize = UiPortTokens.subtitle,
                        lineHeight = 19.sp,
                        fontFamily = UiPortFonts.sans(),
                    )
                }
            }
            val action =
                when {
                    shelf.kind == "tracks" -> "Play all"
                    shelf.id == "artists" -> null
                    else -> "See all"
                }
            if (action != null) {
                Text(
                    text = action,
                    color = UiPortTokens.sage,
                    fontSize = UiPortTokens.subtitle,
                    fontFamily = UiPortFonts.sans(),
                    fontWeight = FontWeight.Medium,
                )
            }
        }
        Spacer(Modifier.height(12.dp))
        when (shelf.kind) {
            "albums" ->
                LazyRow(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    items(shelf.itemIds) { id ->
                        UiPortFixtures.albums[id]?.let { AlbumCard(it) }
                    }
                }

            "tracks" ->
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    shelf.itemIds.take(shelf.columns * 2).forEachIndexed { index, id ->
                        UiPortFixtures.tracks[id]?.let { TrackRow(index = index, track = it) }
                    }
                }

            "artists" ->
                LazyRow(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    items(shelf.itemIds) { id ->
                        UiPortFixtures.artists[id]?.let { ArtistCard(it) }
                    }
                }

            else ->
                LazyRow(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    items(shelf.itemIds) { id ->
                        UiPortFixtures.playlists[id]?.let { PlaylistCard(it) }
                    }
                }
        }
    }
}

/**
 * "Recently played". The prototype renders it only when the listening history is not
 * empty; the capture's store starts empty, so this section is absent from the reference
 * and is driven by a parameter rather than assumed.
 */
@Composable
private fun RecentlyPlayed(tracks: List<UiPortFixtures.Track> = emptyList()) {
    if (tracks.isEmpty()) return
    Column {
        Text(
            text = "Recently played",
            color = UiPortTokens.ink,
            fontSize = UiPortTokens.sectionTitle,
            lineHeight = 28.sp,
            fontFamily = UiPortFonts.serif(),
        )
        Text("From your listening history", color = UiPortTokens.mute, fontSize = UiPortTokens.subtitle, lineHeight = 19.sp)
        Spacer(Modifier.height(12.dp))
        LazyRow(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            items(tracks) { track ->
                Column(modifier = Modifier.width(120.dp)) {
                    Box(
                        modifier =
                            Modifier
                                .size(120.dp)
                                .clip(RoundedCornerShape(UiPortTokens.radiusSm)),
                    ) {
                        UiPortArtwork.Cover(palette = track.palette)
                    }
                    Spacer(Modifier.height(8.dp))
                    Text(
                        track.title,
                        color = UiPortTokens.ink,
                        fontSize = UiPortTokens.subtitle,
                        fontWeight = FontWeight.Medium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(track.artist, color = UiPortTokens.mute, fontSize = UiPortTokens.caption, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
        }
    }
}

@Composable
private fun AlbumCard(album: UiPortFixtures.Album) {
    Column(modifier = Modifier.width(150.dp)) {
        Box(
            modifier =
                Modifier
                    .size(150.dp)
                    .clip(RoundedCornerShape(UiPortTokens.radiusSm)),
        ) {
            UiPortArtwork.Cover(palette = album.palette)
        }
        Spacer(Modifier.height(8.dp))
        Text(album.title, color = UiPortTokens.ink, fontSize = UiPortTokens.subtitle, fontFamily = UiPortFonts.sans(), fontWeight = FontWeight.Medium, maxLines = 1)
        Text(album.artistNames.first(), color = UiPortTokens.mute, fontSize = UiPortTokens.caption, fontFamily = UiPortFonts.sans(), maxLines = 1)
    }
}

@Composable
private fun PlaylistCard(playlist: UiPortFixtures.Playlist) {
    Column(modifier = Modifier.width(150.dp)) {
        Box(
            modifier =
                Modifier
                    .size(150.dp)
                    .clip(RoundedCornerShape(UiPortTokens.radiusSm)),
        ) {
            UiPortArtwork.Cover(palette = playlist.palette)
        }
        Spacer(Modifier.height(8.dp))
        Text(playlist.title, color = UiPortTokens.ink, fontSize = UiPortTokens.subtitle, fontFamily = UiPortFonts.sans(), fontWeight = FontWeight.Medium, maxLines = 1)
        Text(playlist.author, color = UiPortTokens.mute, fontSize = UiPortTokens.caption, fontFamily = UiPortFonts.sans(), maxLines = 1)
    }
}

@Composable
private fun ArtistCard(artist: UiPortFixtures.Artist) {
    Column(modifier = Modifier.width(120.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            modifier =
                Modifier
                    .size(120.dp)
                    .clip(CircleShape),
        ) {
            UiPortArtwork.Cover(palette = artist.palette)
        }
        Spacer(Modifier.height(8.dp))
        Text(artist.name, color = UiPortTokens.ink, fontSize = UiPortTokens.subtitle, fontFamily = UiPortFonts.sans(), fontWeight = FontWeight.Medium, maxLines = 1)
        Text(artist.subscribers, color = UiPortTokens.mute, fontSize = UiPortTokens.caption, fontFamily = UiPortFonts.sans())
    }
}

/** `TrackRow`: 48px cover, `py-2`, title 15/13, duration in the subtitle line. */
@Composable
private fun TrackRow(
    index: Int,
    track: UiPortFixtures.Track,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            modifier =
                Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(UiPortTokens.radiusSm)),
        ) {
            UiPortArtwork.Cover(palette = track.palette, seed = index)
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(track.title, color = UiPortTokens.ink, fontSize = 15.sp, lineHeight = 20.sp, fontFamily = UiPortFonts.sans(), maxLines = 1)
            Text(
                text = "${track.artist} · ${track.duration / 60}:${(track.duration % 60).toString().padStart(2, '0')}",
                color = UiPortTokens.mute,
                fontSize = 13.sp,
                lineHeight = 18.sp,
                fontFamily = UiPortFonts.sans(),
                maxLines = 1,
            )
        }
    }
}
