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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Home, ported from `testbed/prototype/src/features/home/HomeScreen.tsx`.
 *
 * Stateless by design: every value arrives as a parameter, so the screen renders in a
 * screenshot test with no ViewModel, no coroutine and no engine. Wiring to the real
 * SimpMusic engine is a separate, later step and does not change this file's layout.
 *
 * The web original is a phone layout at the reference viewport (393x852). Breakpoint
 * behaviour (`lg:` classes) is deliberately not ported here; the tablet layout is a
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
                    .padding(horizontal = UiPortTokens.pagePadding),
        ) {
            HomeHeader()

            if (!signedIn) {
                Spacer(Modifier.height(24.dp))
                UiPortLoginBanner()
            }

            Spacer(Modifier.height(24.dp))
            FeaturedHero(featured)

            shelves.forEach { shelf ->
                Spacer(Modifier.height(UiPortTokens.sectionGap))
                ShelfSection(shelf)
            }
        }
    }
}

@Composable
private fun HomeHeader() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(top = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = UiPortFixtures.FROZEN_DATE_LABEL.uppercase(),
                color = UiPortTokens.mute,
                fontSize = UiPortTokens.kickerSize,
                fontWeight = FontWeight.Medium,
                letterSpacing = 1.2.sp,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = "${UiPortFixtures.FROZEN_GREETING}, Guest",
                color = UiPortTokens.ink,
                fontSize = UiPortTokens.heroTitle,
                lineHeight = 38.sp,
                fontFamily = UiPortFonts.serif,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = "What is the best choice today?",
                color = UiPortTokens.mute,
                fontSize = UiPortTokens.body,
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
                Text("G", color = UiPortTokens.paper, fontSize = 16.sp, fontWeight = FontWeight.Medium)
            }
        }
    }
}

@Composable
private fun HeaderIcon(label: String, showDot: Boolean) {
    Box(
        modifier =
            Modifier
                .size(40.dp)
                .semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) {
        // The web icons are lucide glyphs; a neutral rounded square keeps the same box so
        // the geometry diff compares positions rather than icon artwork (see LIMITS.md).
        Box(
            modifier =
                Modifier
                    .size(20.dp)
                    .clip(RoundedCornerShape(UiPortTokens.radiusXs))
                    .background(UiPortTokens.charcoal.copy(alpha = 0.7f)),
        )
        if (showDot) {
            Box(
                modifier =
                    Modifier
                        .align(Alignment.TopEnd)
                        .padding(top = 10.dp, end = 10.dp)
                        .size(8.dp)
                        .clip(CircleShape)
                        .background(UiPortTokens.rose),
            )
        }
    }
}

@Composable
private fun FeaturedHero(album: UiPortFixtures.Album) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(UiPortTokens.radiusLg * 0.72f))
                .background(UiPortTokens.card)
                .padding(20.dp),
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(300.dp)
                    .clip(RoundedCornerShape(UiPortTokens.radiusSm))
                    .background(UiPortTokens.ivory),
        ) {
            UiPortArtwork.Cover(palette = album.palette)
        }
        Spacer(Modifier.height(20.dp))
        Text(
            text = "FEATURED THIS WEEK",
            color = UiPortTokens.sage,
            fontSize = UiPortTokens.kickerSize,
            letterSpacing = 1.2.sp,
            fontWeight = FontWeight.Medium,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            text = album.title,
            color = UiPortTokens.ink,
            fontSize = UiPortTokens.featuredTitle,
            lineHeight = 36.sp,
            fontFamily = UiPortFonts.serif,
        )
        Spacer(Modifier.height(4.dp))
        Text(
            text = "${album.artistNames.joinToString(", ")} · ${album.year}",
            color = UiPortTokens.charcoal,
            fontSize = 15.sp,
        )
        Spacer(Modifier.height(16.dp))
        Text(
            text = album.description,
            color = UiPortTokens.charcoal,
            fontSize = UiPortTokens.body,
            lineHeight = 22.sp,
        )
        Spacer(Modifier.height(20.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            UiPortButton("Play", UiPortTokens.sage, UiPortTokens.paper)
            UiPortButton("Save", UiPortTokens.ivory, UiPortTokens.ink)
            UiPortButton("Open album", Color.Transparent, UiPortTokens.ink, bordered = true)
        }
    }
}

@Composable
private fun UiPortButton(
    label: String,
    background: Color,
    content: Color,
    bordered: Boolean = false,
) {
    Box(
        modifier =
            Modifier
                .height(40.dp)
                .clip(RoundedCornerShape(percent = 50))
                .background(background)
                .then(if (bordered) Modifier.borderLine() else Modifier)
                .padding(horizontal = 18.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, color = content, fontSize = UiPortTokens.body, fontWeight = FontWeight.Medium)
    }
}

private fun Modifier.borderLine(): Modifier = this.border(1.dp, UiPortTokens.ink.copy(alpha = 0.35f), RoundedCornerShape(percent = 50))

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
                    fontFamily = UiPortFonts.serif,
                )
                if (shelf.subtitle != null) {
                    Text(text = shelf.subtitle, color = UiPortTokens.mute, fontSize = UiPortTokens.subtitle)
                }
            }
            val action =
                when {
                    shelf.kind == "tracks" -> "Play all"
                    shelf.id == "artists" -> null
                    else -> "See all"
                }
            if (action != null) {
                Text(text = action, color = UiPortTokens.sage, fontSize = UiPortTokens.subtitle, fontWeight = FontWeight.Medium)
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

@Composable
private fun AlbumCard(album: UiPortFixtures.Album) {
    Column(modifier = Modifier.width(150.dp)) {
        Box(
            modifier =
                Modifier
                    .size(150.dp)
                    .clip(RoundedCornerShape(2.dp)),
        ) {
            UiPortArtwork.Cover(palette = album.palette)
        }
        Spacer(Modifier.height(8.dp))
        Text(album.title, color = UiPortTokens.ink, fontSize = UiPortTokens.subtitle, fontWeight = FontWeight.Medium, maxLines = 1)
        Text(album.artistNames.first(), color = UiPortTokens.mute, fontSize = UiPortTokens.caption, maxLines = 1)
    }
}

@Composable
private fun PlaylistCard(playlist: UiPortFixtures.Playlist) {
    Column(modifier = Modifier.width(150.dp)) {
        Box(
            modifier =
                Modifier
                    .size(150.dp)
                    .clip(RoundedCornerShape(2.dp)),
        ) {
            UiPortArtwork.Cover(palette = playlist.palette)
        }
        Spacer(Modifier.height(8.dp))
        Text(playlist.title, color = UiPortTokens.ink, fontSize = UiPortTokens.subtitle, fontWeight = FontWeight.Medium, maxLines = 1)
        Text(playlist.author, color = UiPortTokens.mute, fontSize = UiPortTokens.caption, maxLines = 1)
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
        Text(artist.name, color = UiPortTokens.ink, fontSize = UiPortTokens.subtitle, fontWeight = FontWeight.Medium, maxLines = 1)
        Text(artist.subscribers, color = UiPortTokens.mute, fontSize = UiPortTokens.caption)
    }
}

@Composable
private fun TrackRow(
    index: Int,
    track: UiPortFixtures.Track,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(56.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            modifier =
                Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(2.dp)),
        ) {
            UiPortArtwork.Cover(palette = track.palette, seed = index)
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(track.title, color = UiPortTokens.ink, fontSize = UiPortTokens.body, fontWeight = FontWeight.Medium, maxLines = 1)
            Text(track.artist, color = UiPortTokens.mute, fontSize = UiPortTokens.caption, maxLines = 1)
        }
        Text(
            text = "${track.duration / 60}:${(track.duration % 60).toString().padStart(2, '0')}",
            color = UiPortTokens.mute,
            fontSize = UiPortTokens.caption,
        )
    }
}
