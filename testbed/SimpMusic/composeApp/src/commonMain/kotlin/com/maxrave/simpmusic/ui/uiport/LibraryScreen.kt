package com.maxrave.simpmusic.ui.uiport

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.offset
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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.maxrave.simpmusic.ui.uiport.UiPortLayoutProbe.layoutProbe

/**
 * Library, ported from `testbed/prototype/src/features/library/LibraryScreen.tsx`.
 *
 * Stateless: the chip, the tile counts and the collections all arrive as parameters, which
 * is what lets the screenshot test render it with the prototype's seed data and no engine.
 *
 * The screen is the second-most-visited surface in the prototype and the one where the
 * grid behaves differently from home: the tiles are a two-column `grid-cols-2` of `.paper`
 * cards at phone width, and the carousels reuse the same cards as home, so those two are
 * imported rather than re-implemented.
 */
@Composable
fun UiPortLibraryScreen(
    initialChip: String = "your_library",
    onOpen: (String) -> Unit = {},
    tiles: List<UiPortFixtures.LibraryTile> = UiPortFixtures.libraryTiles,
    playlists: List<UiPortFixtures.Playlist> = UiPortFixtures.localPlaylists,
    savedAlbums: List<UiPortFixtures.Album> = UiPortFixtures.savedAlbums,
    followedArtists: List<UiPortFixtures.Artist> = UiPortFixtures.followedArtists,
    recentlyAdded: List<UiPortFixtures.Track> = UiPortFixtures.recentlyAddedTracks,
    modifier: Modifier = Modifier,
) {
    // The prototype's chips are `<button>`s that switch the filter; without state the parameter
    // could never change, so the chips were inert boxes and the semantics dump emitted only the
    // 19 dp text run inside them — reported against a 36 dp `h-9` reference as a 17 dp height error.
    var activeChip by rememberSaveable { mutableStateOf(initialChip) }
    UiPortPhoneScaffold(activeRoute = "/library") {
        // Horizontal padding is applied per section, not here.
        //
        // The prototype's carousels are `-mx-4` on the section and `px-4` on the track: the track
        // spans the whole 393 dp viewport and restores the page inset *inside* itself, so the first
        // card starts flush at x=0. Padding the scroll container instead makes every child resolve
        // to a 361 dp content width, and no amount of `offset` widens it again — the clip stays at
        // 361, which is what cut the "Create" card's label away at x=386.55 while the card itself
        // sat at exactly the reference's position.
        Column(
            modifier =
                modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(vertical = UiPortTokens.mainPadding),
        ) {
            Column(modifier = Modifier.padding(horizontal = UiPortTokens.pagePadding)) {
                LibraryHeader(onCreatePlaylist = { onOpen("new-playlist") })

                Spacer(Modifier.height(32.dp).layoutProbe("gap.chips"))
                ChipRow(activeChip, onPick = { activeChip = it })

                // The chip row is `space-y-8` from the header and the grid is 32px below it.
                Spacer(Modifier.height(32.dp).layoutProbe("gap.tiles"))
                TileGrid(tiles)
            }

            // `space-y-8` on the page wrapper: every gap between sections is 32 dp, not the 40 dp
            // `sectionGap` token. The reference proves it arithmetically — three 70 dp tile rows
            // with two 12 dp gaps end at y=409.94, and "Your playlists" starts at 441.94, which is
            // exactly 32 later. The 8 dp excess plus the 2 dp font padding is the 10.06 the gate
            // reported on the heading, and it propagated to every card below it.
            Spacer(Modifier.height(32.dp).layoutProbe("gap.playlists"))
            CollectionSection(title = "Your playlists", action = "See all", probe = "playlists") {
                // The track is the full 393 dp viewport (`-mx-4` cancels the page inset on the
                // section) with the inset restored as content padding, and the first card flush at
                // x=0. Because the padding is now inside a full-width track rather than around it,
                // the clip is at 393 and the "Create" card's label at 386.55 is drawn.
                LazyRow(
                    modifier = Modifier.fillMaxWidth(),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(start = 0.dp, end = UiPortTokens.pagePadding),
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    items(playlists) { playlist -> PlaylistCard(playlist, onOpen = onOpen) }
                    item { CreatePlaylistCard(onCreate = { onOpen("new-playlist") }) }
                }
            }

            Spacer(Modifier.height(32.dp).layoutProbe("gap.albums"))
            // The prototype has four sections here, not three, and this was the missing one:
            // `<section><SectionHeader title="Recently added"/>{recentlyAdded.slice(0,5)}</section>`
            // between the playlists carousel and the saved albums. Its absence was reported for
            // several runs as `"Recently added" ... has no candidate node` with a reference box at
            // y=721.63 — the *tile* whose label happens to share the words, 500 dp away.
            CollectionSection(title = "Recently added", probe = "recent") {
                // Not a carousel: these rows scroll with the page, so they keep the page inset the
                // prototype's `-mx-4 px-4` pair nets out to for a full-width block.
                Column(modifier = Modifier.fillMaxWidth().padding(horizontal = UiPortTokens.pagePadding)) {
                    recentlyAdded.take(5).forEachIndexed { index, track -> TrackRow(index = index, track = track) }
                }
            }

            Spacer(Modifier.height(32.dp).layoutProbe("gap.savedAlbums"))
            CollectionSection(title = "Saved albums", probe = "albums") {
                LazyRow(
                    modifier = Modifier.fillMaxWidth(),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(start = 0.dp, end = UiPortTokens.pagePadding),
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    items(savedAlbums) { album -> AlbumCard(album, onOpen = onOpen) }
                }
            }

            Spacer(Modifier.height(32.dp).layoutProbe("gap.artists"))
            CollectionSection(title = "Followed artists", action = "See all", probe = "artists") {
                LazyRow(
                    modifier = Modifier.fillMaxWidth(),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(start = 0.dp, end = UiPortTokens.pagePadding),
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    items(followedArtists) { artist -> ArtistCard(artist, onOpen = onOpen) }
                }
            }
        }
    }
}

/** `header`: kicker + 32px serif title on the left, a `size="sm"` button on the right. */
@Composable
private fun LibraryHeader(onCreatePlaylist: () -> Unit = {}) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .layoutProbe("header")
                .padding(top = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.Bottom,
    ) {
        Column {
            Text(
                text = "COLLECTION",
                color = UiPortTokens.mute,
                fontSize = UiPortTokens.kickerSize,
                lineHeight = 16.sp,
                fontFamily = UiPortFonts.sans(),
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 1.1.sp,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                modifier = Modifier.layoutProbe("header.title"),
                onTextLayout = { UiPortLayoutProbe.recordText("header.title", it.lineCount, it.size) },
                text = "Your Library",
                color = UiPortTokens.ink,
                fontSize = UiPortTokens.heroTitle,
                // The capture measures this title as a single 40px line (163x40) — unlike
                // the home greeting, which wraps in its narrower column. One line-height of
                // 40 rather than the glyph height keeps the box at exactly 40.
                lineHeight = 40.sp,
                maxLines = 1,
                fontFamily = UiPortFonts.serif(),
            )
        }
        // `Button size="sm"`: `h-9 px-4 rounded-full`, and a `<button>` in the prototype. Without a
        // click this is a 36 dp Row whose only emitted node is the 13px label, which the gate read
        // as an inert 77x19 text run against a 131.5x36 button — the fourth instance of the
        // clickable-is-a-node pattern (N-7).
        Row(
            modifier =
                Modifier
                    .height(36.dp)
                    .clip(RoundedCornerShape(percent = 50))
                    .background(UiPortTokens.ivory)
                    .clickable(role = Role.Button) { onCreatePlaylist() }
                    .padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Box(
                modifier =
                    Modifier
                        .size(16.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(UiPortTokens.charcoal),
            )
            Text(
                text = "New playlist",
                color = UiPortTokens.ink,
                fontSize = UiPortTokens.subtitle,
                lineHeight = 19.sp,
                fontFamily = UiPortFonts.sans(),
                fontWeight = FontWeight.Medium,
            )
        }
    }
}


/** `Chip`: h-9, px-4, 13px medium; active is ink on paper, inactive is charcoal on ivory. */
@Composable
private fun ChipRow(activeChip: String, onPick: (String) -> Unit = {}) {
    LazyRow(
        modifier =
            Modifier
                .fillMaxWidth()
                .layoutProbe("chips"),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items(UiPortFixtures.libraryChips) { chip ->
            val active = chip.id == activeChip
            Box(
                modifier =
                    Modifier
                        .height(36.dp)
                        .clip(RoundedCornerShape(percent = 50))
                        .background(if (active) UiPortTokens.ink else UiPortTokens.ivory)
                        .selectable(selected = active, role = Role.Tab, onClick = { onPick(chip.id) })
                        .padding(horizontal = 16.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = chip.label,
                    color = if (active) UiPortTokens.paper else UiPortTokens.charcoal,
                    fontSize = UiPortTokens.subtitle,
                    lineHeight = 19.sp,
                    fontFamily = UiPortFonts.sans(),
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                )
            }
        }
    }
}

/**
 * `grid grid-cols-2 gap-3` of `.paper` cards: an 44px ivory icon plate, a 14px label and a
 * 12px count. The prototype gives the plate a tint per tile; the tint is carried in the
 * fixture so the colour is data, not a branch in the layout.
 */
@Composable
private fun TileGrid(tiles: List<UiPortFixtures.LibraryTile>) {
    if (tiles.isEmpty()) return
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        tiles.chunked(2).forEachIndexed { rowIndex, rowTiles ->
            Row(
                modifier = Modifier.layoutProbe("tilerow.$rowIndex"),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                rowTiles.forEach { tile ->
                    Row(
                        modifier =
                            Modifier
                                .weight(1f)
                                .shadow(2.dp, RoundedCornerShape(UiPortTokens.radiusSm))
                                .clip(RoundedCornerShape(UiPortTokens.radiusSm))
                                .background(UiPortTokens.card)
                                .border(1.dp, UiPortTokens.line, RoundedCornerShape(UiPortTokens.radiusSm))
                                .layoutProbe("tile")
                                // 1px border + 12px padding on each side: the capture
                                // measures the tile at 175x70, and the border is part of
                                // that box on the web (border-box), so the padding that
                                // reproduces it is 13, not 12.
                                .padding(13.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Box(
                            modifier =
                                Modifier
                                    .size(44.dp)
                                    .clip(RoundedCornerShape(UiPortTokens.radiusXs))
                                    .background(UiPortTokens.ivory),
                            contentAlignment = Alignment.Center,
                        ) {
                            Box(
                                modifier =
                                    Modifier
                                        .size(20.dp)
                                        .clip(RoundedCornerShape(6.dp))
                                        .background(tile.tint),
                            )
                        }
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = tile.label,
                                color = UiPortTokens.ink,
                                fontSize = 14.sp,
                                lineHeight = 20.sp,
                                fontFamily = UiPortFonts.sans(),
                                fontWeight = FontWeight.Medium,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                            Text(
                                text = "${tile.count} items",
                                color = UiPortTokens.mute,
                                fontSize = UiPortTokens.caption,
                                lineHeight = 17.sp,
                                fontFamily = UiPortFonts.sans(),
                                maxLines = 1,
                            )
                        }
                    }
                }
                // Keep the last odd tile at half width instead of stretching it across.
                if (rowTiles.size == 1) Spacer(Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun CollectionSection(
    title: String,
    action: String? = null,
    probe: String,
    content: @Composable () -> Unit,
) {
    Column(modifier = Modifier.layoutProbe("section.$probe")) {
        // The heading carries the page inset; the track below does not, because the prototype's
        // `-mx-4` cancels it on the section and only the header's own `px-4` restores it.
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = UiPortTokens.pagePadding),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Bottom,
        ) {
            Text(
                text = title,
                color = UiPortTokens.ink,
                fontSize = UiPortTokens.sectionTitle,
                // `leading-tight` on 24px is 1.25em = 30px. At 28 the heading box is 2 dp short,
                // which the gate reported as ref h=30 against cand h=32 and which also pushed
                // every carousel 2 dp down.
                lineHeight = 30.sp,
                fontFamily = UiPortFonts.serif(),
            )
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
        // `mb-3` on the header: 12 px between the heading block and the track.
        Spacer(Modifier.height(12.dp))
        content()
    }
}

/** `border border-dashed border-sand` placeholder at the end of the playlists carousel. */
@Composable
private fun CreatePlaylistCard(onCreate: () -> Unit = {}) {
    // A `<button>` in the prototype, like every other card: without a click its only node is the
    // "Create" label, which the gate reported as missing while the card was on screen.
    //
    // Height is 197, not 150. The class list says `aspect-square`, but the button is a flex child of
    // the carousel and the carousel's default `align-items: stretch` makes it as tall as the tallest
    // sibling — the 150 + 10 + 20 + 17 = 197 dp playlist card. The reference proves it: its label
    // sits at y=588.36, which is 483.94 + 74.43 + 30, i.e. vertically centred in a 197.69 box, not in
    // a square. Compose's LazyRow does not stretch items, so the height has to be stated.
    Column(
        modifier =
            Modifier
                .width(150.dp)
                .height(197.dp)
                .clip(RoundedCornerShape(UiPortTokens.radiusSm))
                .border(1.dp, UiPortTokens.sand, RoundedCornerShape(UiPortTokens.radiusSm))
                .clickable(role = Role.Button) { onCreate() },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(
            modifier =
                Modifier
                    .size(22.dp)
                    .clip(CircleShape)
                    .background(UiPortTokens.sand),
        )
        Spacer(Modifier.height(8.dp))
        Text("Create", color = UiPortTokens.mute, fontSize = UiPortTokens.subtitle, fontFamily = UiPortFonts.sans())
    }
}

/**
 * 150dp playlist card: cover, 14px medium title, 12px mute author (`mt-2.5`).
 *
 * The prototype's card is a `<button>` — `CardBase` — that navigates on click, and that matters to
 * the comparison and not only to behaviour: the reference node for "Late Shift" is the whole
 * 150x197.69 card, while a Column carrying no semantics produces only its 63.5x20 title run. The
 * gate reported that as `d=(16,172,86.5,177.69)`, which reads as "the card is 172 dp too low" when
 * the card was in the right place and the comparison simply had no card to compare against.
 */
@Composable
private fun PlaylistCard(playlist: UiPortFixtures.Playlist, onOpen: (String) -> Unit = {}) {
    Column(
        modifier =
            Modifier
                .width(150.dp)
                .clickable(role = Role.Button) { onOpen(playlist.id) },
    ) {
        Box(
            modifier =
                Modifier
                    .size(150.dp)
                    .clip(RoundedCornerShape(UiPortTokens.radiusSm)),
        ) {
            UiPortArtwork.Cover(palette = playlist.palette)
        }
        Spacer(Modifier.height(10.dp))
        Text(
            playlist.title,
            color = UiPortTokens.ink,
            fontSize = 14.sp,
            lineHeight = 20.sp,
            fontFamily = UiPortFonts.sans(),
            fontWeight = FontWeight.Medium,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            playlist.author,
            color = UiPortTokens.mute,
            fontSize = UiPortTokens.caption,
            lineHeight = 17.sp,
            fontFamily = UiPortFonts.sans(),
            maxLines = 1,
        )
    }
}

@Composable
private fun AlbumCard(album: UiPortFixtures.Album, onOpen: (String) -> Unit = {}) {
    Column(
        modifier =
            Modifier
                .width(150.dp)
                .clickable(role = Role.Button) { onOpen(album.id) },
    ) {
        Box(
            modifier =
                Modifier
                    .size(150.dp)
                    .clip(RoundedCornerShape(UiPortTokens.radiusSm)),
        ) {
            UiPortArtwork.Cover(palette = album.palette)
        }
        Spacer(Modifier.height(10.dp))
        Text(
            album.title,
            color = UiPortTokens.ink,
            fontSize = 14.sp,
            lineHeight = 20.sp,
            fontFamily = UiPortFonts.sans(),
            fontWeight = FontWeight.Medium,
            maxLines = 1,
        )
        Text(
            album.artistNames.firstOrNull() ?: "",
            color = UiPortTokens.mute,
            fontSize = UiPortTokens.caption,
            lineHeight = 17.sp,
            fontFamily = UiPortFonts.sans(),
            maxLines = 1,
        )
    }
}

/** `w-[128px]` card with a circular cover. */
@Composable
private fun ArtistCard(artist: UiPortFixtures.Artist, onOpen: (String) -> Unit = {}) {
    Column(
        modifier =
            Modifier
                .width(128.dp)
                .clickable(role = Role.Button) { onOpen(artist.id) },
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier =
                Modifier
                    .size(128.dp)
                    .clip(CircleShape),
        ) {
            UiPortArtwork.Cover(palette = artist.palette)
        }
        Spacer(Modifier.height(10.dp))
        Text(
            artist.name,
            color = UiPortTokens.ink,
            fontSize = 14.sp,
            lineHeight = 20.sp,
            fontFamily = UiPortFonts.sans(),
            fontWeight = FontWeight.Medium,
            maxLines = 1,
        )
        Text(
            artist.subscribers,
            color = UiPortTokens.mute,
            fontSize = UiPortTokens.caption,
            lineHeight = 17.sp,
            fontFamily = UiPortFonts.sans(),
        )
    }
}
