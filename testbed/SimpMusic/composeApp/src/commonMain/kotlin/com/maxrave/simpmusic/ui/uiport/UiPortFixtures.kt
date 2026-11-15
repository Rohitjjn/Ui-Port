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
}
