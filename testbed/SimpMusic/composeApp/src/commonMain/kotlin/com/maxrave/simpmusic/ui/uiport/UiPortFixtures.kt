package com.maxrave.simpmusic.ui.uiport

/**
 * Fixture data for the ported screens.
 *
 * These are the same values the web prototype uses (`src/data/mockData.ts`), copied rather
 * than fetched, for one reason: the reference screenshot was captured with this exact
 * content, and a diff against different content measures nothing. When the screen is wired
 * to the real engine (step 4 of the port), these become the initial state of a real
 * ViewModel and disappear from the UI layer.
 *
 * Every list here is a plain immutable value, so the composables stay stateless and can be
 * rendered without a ViewModel — which is what makes the screenshot test possible at all.
 */
object UiPortFixtures {
    data class Album(
        val id: String,
        val title: String,
        val artistNames: List<String>,
        val year: Int,
        val type: String,
        val description: String,
        val palette: Int,
    )

    data class Track(
        val id: String,
        val title: String,
        val artist: String,
        val duration: Int,
        val palette: Int,
    )

    data class Playlist(
        val id: String,
        val title: String,
        val author: String,
        val description: String,
        val palette: Int,
    )

    data class Artist(
        val id: String,
        val name: String,
        val subscribers: String,
        val palette: Int,
    )

    data class Shelf(
        val id: String,
        val title: String,
        val subtitle: String?,
        val kind: String,
        val itemIds: List<String>,
        val columns: Int = 4,
    )

    /**
     * The capture happened with the page's clock frozen at 2026-01-01T10:00:00Z (see
     * `scripts/lib/browser-inject.mjs`), so the greeting and the date string in the header
     * are those of that instant, not of today.
     */
    const val FROZEN_DATE_LABEL = "Thursday, January 1"
    const val FROZEN_GREETING = "Good morning"

    val featuredAlbum =
        Album(
            id = "al1",
            title = "Chapel Weather",
            artistNames = listOf("Wren Hollis"),
            year = 2024,
            type = "Album",
            description =
                "Recorded over one winter in a deconsecrated chapel, Chapel Weather is Wren Hollis' " +
                    "most spacious record — ten songs about staying put.",
            palette = 0,
        )

    val albums: Map<String, Album> =
        listOf(
            featuredAlbum,
            Album("al2", "Snowline", listOf("Wren Hollis"), 2022, "Album", "A record of thresholds.", 8),
            Album("al3", "Brass Sunday", listOf("Marlowe & Sons"), 2023, "Album", "Horns, handclaps and harmonies.", 1),
            Album("al4", "Fragment Seven", listOf("Ilse Varga"), 2024, "Album", "Piano miniatures.", 2),
            Album("al5", "Paper Moon Hotel", listOf("The Paper Lanterns"), 2023, "Album", "Dream pop.", 3),
            Album("al6", "Velvet Hour", listOf("Cassius Reed"), 2024, "Album", "Neo-soul.", 4),
            Album("al8", "Tagus Afternoon", listOf("Odessa Blue"), 2023, "Album", "Bossa and brass.", 6),
            Album("al9", "Lantern Season", listOf("Wren Hollis"), 2025, "Single", "A single.", 13),
            Album("al11", "Fragment Eight", listOf("Ilse Varga"), 2025, "Single", "A single.", 2),
            Album("al12", "Slow Burn Avenue", listOf("Cassius Reed"), 2025, "Single", "A single.", 4),
            Album("al13", "Cello Machine", listOf("Tomas Lindqvist"), 2024, "EP", "Chamber techno.", 7),
            Album("al10", "Postcard From Nowhere", listOf("Marlowe & Sons"), 2025, "Single", "A single.", 1),
        ).associateBy { it.id }

    /**
     * `recentlyAdded` as the prototype seeds it: `["t31", "t13", "t21"]` (`libraryStore.ts:62`).
     *
     * Taken from `mockData.ts` rather than invented — t31 "Evensong" 221s palette 12, t13 "Fragment
     * VII" 182s palette 10, t21 "Sunday Hands" 215s palette 11. Note `tracks["t31"]` above says
     * "Lantern Season" 191s, which is the drift N-2 records: the hand-written fixture map and the
     * prototype's data disagree, and the map is wrong. This list uses the prototype's values, and
     * that entry should be corrected to match when the fixture map is next regenerated.
     */
    val recentlyAddedTracks: List<Track> =
        listOf(
            Track("t31", "Evensong", "Wren Hollis", 221, 12),
            Track("t13", "Fragment VII", "Ilse Varga", 182, 10),
            Track("t21", "Sunday Hands", "Cassius Reed", 215, 11),
        )

    val tracks: Map<String, Track> =
        listOf(
            Track("t18", "Velvet Hour", "Cassius Reed", 214, 4),
            Track("t1", "Chapel Weather", "Wren Hollis", 236, 0),
            Track("t25", "Tagus Afternoon", "Odessa Blue", 198, 6),
            Track("t10", "Fragment Seven", "Ilse Varga", 187, 2),
            Track("t6", "Brass Sunday", "Marlowe & Sons", 203, 1),
            Track("t14", "Paper Moon Hotel", "The Paper Lanterns", 221, 3),
            Track("t20", "Slow Burn Avenue", "Cassius Reed", 245, 4),
            Track("t31", "Lantern Season", "Wren Hollis", 191, 13),
            Track("t9", "Sunday Hands", "Marlowe & Sons", 178, 1),
            Track("t12", "Fragment Nine", "Ilse Varga", 165, 2),
            Track("t26", "Azulejo Blue", "Odessa Blue", 209, 6),
            Track("t4", "Snowline", "Wren Hollis", 252, 8),
        ).associateBy { it.id }

    val playlists: Map<String, Playlist> =
        listOf(
            Playlist("pl_r1", "Paper Mornings", "SimpMusic Editorial", "Slow light, warm coffee, soft strings.", 13),
            Playlist("pl_r4", "Focus: Piano & Tape", "SimpMusic Editorial", "Minimal piano with a low hum.", 2),
            Playlist("pl_r3", "Night Train Dream Pop", "Community", "Reverb for the last carriage.", 15),
            Playlist("pl_r2", "Brass & Handclaps", "SimpMusic Editorial", "Horn sections for walking faster.", 14),
            Playlist("pl_r5", "Sleep Garden", "SimpMusic Editorial", "Long pieces, nothing sudden.", 5),
            Playlist("pl_r6", "Lisbon Afternoons", "Community", "Bossa, brass and tram bells.", 6),
        ).associateBy { it.id }

    val artists: Map<String, Artist> =
        listOf(
            Artist("ar5", "Cassius Reed", "3.1M", 4),
            Artist("ar1", "Wren Hollis", "1.2M", 0),
            Artist("ar7", "Odessa Blue", "1.9M", 6),
            Artist("ar3", "Ilse Varga", "2.4M", 2),
            Artist("ar2", "Marlowe & Sons", "860K", 1),
            Artist("ar4", "The Paper Lanterns", "540K", 3),
            Artist("ar6", "Juniper Sky", "420K", 7),
            Artist("ar8", "Tomas Lindqvist", "690K", 8),
        ).associateBy { it.id }

    val homeShelves: List<Shelf> =
        listOf(
            Shelf(
                "quick",
                "Quick picks",
                "Start radio from a song",
                "tracks",
                listOf("t18", "t1", "t25", "t10", "t6", "t14", "t20", "t31", "t9", "t12", "t26", "t4"),
            ),
            Shelf("recent", "Listen again", null, "albums", listOf("al1", "al6", "al8", "al4", "al5")),
            Shelf("new", "New releases", "Albums and singles from this month", "albums", listOf("al9", "al11", "al12", "al1", "al13", "al10")),
            Shelf("foryou", "Playlists for you", "Curated on paper, every morning", "playlists", listOf("pl_r1", "pl_r4", "pl_r3", "pl_r2", "pl_r5", "pl_r6")),
            Shelf("trending", "Trending songs", null, "tracks", listOf("t20", "t18", "t6", "t9", "t31", "t14", "t29", "t13")),
            Shelf("artists", "Top artists", null, "artists", listOf("ar5", "ar1", "ar7", "ar3", "ar2", "ar4", "ar6", "ar8")),
            Shelf("mixes", "Mixed for you", null, "playlists", listOf("mix1", "mix2", "mix3")),
        )

    /** One library tile: the prototype's `tiles` array, with its tint carried as data. */
    data class LibraryTile(
        val id: String,
        val label: String,
        val count: Int,
        val tint: androidx.compose.ui.graphics.Color,
    )

    data class LibraryChip(
        val id: String,
        val label: String,
    )

    data class LyricLine(
        val text: String,
        val active: Boolean = false,
    )

    data class PlayerTab(
        val id: String,
        val label: String,
    )

    /**
     * The prototype's `CHIPS` array, in order. The first is active on load, so the capture
     * shows "Your library" selected.
     */
    val libraryChips: List<LibraryChip> =
        listOf(
            LibraryChip("your_library", "Your library"),
            LibraryChip("local_playlists", "Your playlists"),
            LibraryChip("favorite_playlists", "Favorite playlists"),
            LibraryChip("downloaded_playlists", "Downloaded"),
            LibraryChip("favorite_podcasts", "Podcasts"),
            LibraryChip("charts", "SimpMusic charts"),
            LibraryChip("wrapped", "Wrapped"),
            LibraryChip("mix_for_you", "Mix for you"),
            LibraryChip("youtube_playlists", "YouTube playlists"),
        )

    /**
     * Tile counts come from the prototype's persisted seed: favourites t1/t18/t25/t10 (4),
     * followed artists ar1/ar5 (2), play counts (10 keys), downloads marked downloaded (4),
     * cached (5), recently added (3).
     */
    val libraryTiles: List<LibraryTile> =
        listOf(
            LibraryTile("favorite", "Liked songs", 4, UiPortTokens.rose),
            LibraryTile("followed", "Followed artists", 2, UiPortTokens.sage),
            LibraryTile("most_played", "Most played", 10, UiPortTokens.charcoal),
            LibraryTile("downloaded", "Downloaded", 4, UiPortTokens.sage),
            LibraryTile("cached", "Cached", 5, UiPortTokens.charcoal),
            LibraryTile("recently_added", "Recently added", 3, UiPortTokens.charcoal),
        )

    /** The two local playlists the prototype seeds (lp1, lp2). */
    val localPlaylists: List<Playlist> =
        listOf(
            Playlist("lp1", "Kitchen Table Songs", "You", "For slow breakfasts.", 13),
            Playlist("lp2", "Late Shift", "You", "", 10),
        )

    /** `likedAlbums: ["al1"]` in the prototype's seed. */
    val savedAlbums: List<Album> get() = listOfNotNull(albums["al1"])

    /** `followedArtists: ["ar1", "ar5"]`. */
    val followedArtists: List<Artist> get() = listOfNotNull(artists["ar1"], artists["ar5"])

    /**
     * The track the capture opens: the prototype's mini player appears only once something
     * is queued, and clicking any track queues its shelf context. t1 is the first track of
     * the featured album, so "Chapel Weather" is the playing track and the album title in
     * the header is the album the user tapped it from.
     */
    val nowPlayingTrack: Track
        get() = tracks["t1"] ?: Track("t1", "Chapel Weather", "Wren Hollis", 254, 0)

    /** `TABS` in `FullPlayer.tsx`, in order; lyrics is the default panel. */
    val playerTabs: List<PlayerTab> =
        listOf(
            PlayerTab("lyrics", "Lyrics"),
            PlayerTab("queue", "Queue"),
            PlayerTab("related", "Related"),
            PlayerTab("info", "Info"),
        )

    /** The lyric sheet the prototype shows for a track without timecoded lyrics. */
    val lyricLines: List<LyricLine> =
        listOf(
            LyricLine("Static on the window", false),
            LyricLine("A kettle finding its note", false),
            LyricLine("Chapel weather", true),
            LyricLine("and the light comes slow", false),
            LyricLine("Over the flagstones", false),
            LyricLine("where the choir used to stand", false),
        )
}
