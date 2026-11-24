import type {
  Album,
  Artist,
  ChartCountry,
  HomeShelf,
  LyricLine,
  Mood,
  NotificationItem,
  Playlist,
  Podcast,
  Track,
} from "@/types";

/* ---------- Artists ---------- */
export const ARTISTS: Artist[] = [
  { id: "ar1", name: "Wren Hollis", subscribers: "1.2M", description: "Wren Hollis writes hushed, orchestral folk from a converted chapel in Devon. Her records braid pedal steel with string quartets and field recordings of weather.", albumIds: ["al1", "al2"], singleIds: ["al9"], topTrackIds: ["t1", "t2", "t3", "t4", "t5"], relatedIds: ["ar3", "ar5", "ar6"], palette: 0 },
  { id: "ar2", name: "Marlowe & Sons", subscribers: "860K", description: "A family band in the loosest sense — three brothers and a cousin — making sunlit indie pop with brass sections and handclaps.", albumIds: ["al3"], singleIds: ["al10"], topTrackIds: ["t6", "t7", "t8", "t9"], relatedIds: ["ar4", "ar7"], palette: 1 },
  { id: "ar3", name: "Ilse Varga", subscribers: "2.4M", description: "Budapest-born pianist and producer. Her minimalist piano miniatures sit next to late-night electronic pieces built from the same motifs.", albumIds: ["al4"], singleIds: ["al11"], topTrackIds: ["t10", "t11", "t12", "t13"], relatedIds: ["ar1", "ar8"], palette: 2 },
  { id: "ar4", name: "The Paper Lanterns", subscribers: "540K", description: "Dream-pop quartet from Kyoto by way of Portland. Reverb, tremolo and lyrics about trains.", albumIds: ["al5"], singleIds: [], topTrackIds: ["t14", "t15", "t16", "t17"], relatedIds: ["ar2", "ar6"], palette: 3 },
  { id: "ar5", name: "Cassius Reed", subscribers: "3.1M", description: "Neo-soul vocalist whose warm baritone is backed by a live band that never plays a song the same way twice.", albumIds: ["al6"], singleIds: ["al12"], topTrackIds: ["t18", "t19", "t20", "t21"], relatedIds: ["ar1", "ar7"], palette: 4 },
  { id: "ar6", name: "Juniper Sky", subscribers: "420K", description: "Ambient guitarist and composer. Long-form pieces for gardens, galleries and sleep.", albumIds: ["al7"], singleIds: [], topTrackIds: ["t22", "t23", "t24"], relatedIds: ["ar3", "ar4"], palette: 5 },
  { id: "ar7", name: "Odessa Blue", subscribers: "1.9M", description: "Jazz-inflected pop from Lisbon with bossa nova rhythms and brass arrangements recorded live to tape.", albumIds: ["al8"], singleIds: [], topTrackIds: ["t25", "t26", "t27", "t28"], relatedIds: ["ar5", "ar2"], palette: 6 },
  { id: "ar8", name: "Tomas Lindqvist", subscribers: "690K", description: "Swedish producer who turns chamber instruments into club music, slowly.", albumIds: [], singleIds: ["al13"], topTrackIds: ["t29", "t30"], relatedIds: ["ar3"], palette: 7 },
];

/* ---------- Tracks ---------- */
const t = (id: string, title: string, artistIds: string[], albumId: string, duration: number, palette: number, extra: Partial<Track> = {}): Track => ({
  id,
  title,
  artistIds,
  artistNames: artistIds.map((a) => ARTISTS.find((x) => x.id === a)!.name),
  albumId,
  duration,
  palette,
  plays: 120000 + ((id.charCodeAt(1) * 7919 + duration * 131) % 9000000),
  bpm: 70 + ((duration * 13) % 90),
  key: ["C maj", "G maj", "D min", "A min", "F maj", "E♭ maj", "B min"][duration % 7],
  ...extra,
});

export const TRACKS: Track[] = [
  t("t1", "Chapel Weather", ["ar1"], "al1", 254, 0, { year: 2024 }),
  t("t2", "Pedal Steel Hymn", ["ar1"], "al1", 231, 0, { year: 2024 }),
  t("t3", "Lantern Season", ["ar1"], "al1", 198, 0, { year: 2024, isExplicit: true }),
  t("t4", "Snowline", ["ar1"], "al2", 276, 8, { year: 2022 }),
  t("t5", "The Orchard Letter", ["ar1", "ar3"], "al2", 302, 8, { year: 2022 }),
  t("t6", "Brass Sunday", ["ar2"], "al3", 211, 1, { year: 2023 }),
  t("t7", "Postcard From Nowhere", ["ar2"], "al3", 189, 1, { year: 2023 }),
  t("t8", "Handclap Parade", ["ar2"], "al3", 203, 1, { year: 2023, isVideo: true }),
  t("t9", "Linen & Light", ["ar2"], "al10", 226, 9, { year: 2024 }),
  t("t10", "Nocturne for Tape", ["ar3"], "al4", 318, 2, { year: 2023 }),
  t("t11", "Danube Loop", ["ar3"], "al4", 267, 2, { year: 2023 }),
  t("t12", "Small Hours", ["ar3"], "al4", 244, 2, { year: 2023 }),
  t("t13", "Fragment VII", ["ar3"], "al11", 182, 10, { year: 2025 }),
  t("t14", "Last Train to Arashiyama", ["ar4"], "al5", 289, 3, { year: 2021 }),
  t("t15", "Tremolo Garden", ["ar4"], "al5", 233, 3, { year: 2021, isVideo: true }),
  t("t16", "Pale Signal", ["ar4"], "al5", 257, 3, { year: 2021 }),
  t("t17", "Paper Moon Hotel", ["ar4"], "al5", 301, 3, { year: 2021 }),
  t("t18", "Velvet Hour", ["ar5"], "al6", 236, 4, { year: 2024, isExplicit: true }),
  t("t19", "Slow Burn Avenue", ["ar5"], "al6", 272, 4, { year: 2024 }),
  t("t20", "Honey & Smoke", ["ar5", "ar7"], "al6", 248, 4, { year: 2024, isVideo: true }),
  t("t21", "Sunday Hands", ["ar5"], "al12", 215, 11, { year: 2025 }),
  t("t22", "Greenhouse I", ["ar6"], "al7", 612, 5, { year: 2020 }),
  t("t23", "Greenhouse II", ["ar6"], "al7", 548, 5, { year: 2020 }),
  t("t24", "Moss Study", ["ar6"], "al7", 421, 5, { year: 2020 }),
  t("t25", "Tagus Afternoon", ["ar7"], "al8", 228, 6, { year: 2022 }),
  t("t26", "Saudade Brass", ["ar7"], "al8", 241, 6, { year: 2022 }),
  t("t27", "Tram 28", ["ar7"], "al8", 197, 6, { year: 2022, isVideo: true }),
  t("t28", "Azulejo", ["ar7"], "al8", 263, 6, { year: 2022 }),
  t("t29", "Cello Machine", ["ar8"], "al13", 334, 7, { year: 2024 }),
  t("t30", "Oboe at 4AM", ["ar8", "ar3"], "al13", 298, 7, { year: 2024 }),
  t("t31", "Evensong", ["ar1"], "al9", 221, 12, { year: 2025 }),
  t("t32", "Blue Hour Radio", ["ar7", "ar5"], "al8", 254, 6, { year: 2022 }),
];

/* ---------- Albums ---------- */
export const ALBUMS: Album[] = [
  { id: "al1", title: "Chapel Weather", artistIds: ["ar1"], artistNames: ["Wren Hollis"], year: 2024, type: "Album", trackIds: ["t1", "t2", "t3"], description: "Recorded over one winter in a deconsecrated chapel, Chapel Weather is Wren Hollis' most spacious record — ten songs about staying put.", palette: 0 },
  { id: "al2", title: "Snowline", artistIds: ["ar1"], artistNames: ["Wren Hollis"], year: 2022, type: "Album", trackIds: ["t4", "t5"], description: "A record of thresholds.", palette: 8 },
  { id: "al3", title: "Brass Sunday", artistIds: ["ar2"], artistNames: ["Marlowe & Sons"], year: 2023, type: "Album", trackIds: ["t6", "t7", "t8"], description: "Horns, handclaps and harmonies.", palette: 1 },
  { id: "al4", title: "Small Hours", artistIds: ["ar3"], artistNames: ["Ilse Varga"], year: 2023, type: "Album", trackIds: ["t10", "t11", "t12"], description: "Piano miniatures and their electronic shadows.", palette: 2 },
  { id: "al5", title: "Paper Moon Hotel", artistIds: ["ar4"], artistNames: ["The Paper Lanterns"], year: 2021, type: "Album", trackIds: ["t14", "t15", "t16", "t17"], description: "Dream pop for night trains.", palette: 3 },
  { id: "al6", title: "Velvet Hour", artistIds: ["ar5"], artistNames: ["Cassius Reed"], year: 2024, type: "Album", trackIds: ["t18", "t19", "t20"], description: "Live-to-tape soul.", palette: 4 },
  { id: "al7", title: "Greenhouse", artistIds: ["ar6"], artistNames: ["Juniper Sky"], year: 2020, type: "Album", trackIds: ["t22", "t23", "t24"], description: "Three long pieces for plants and people.", palette: 5 },
  { id: "al8", title: "Tagus Afternoon", artistIds: ["ar7"], artistNames: ["Odessa Blue"], year: 2022, type: "Album", trackIds: ["t25", "t26", "t27", "t28", "t32"], description: "Lisbon in five brass arrangements.", palette: 6 },
  { id: "al9", title: "Evensong", artistIds: ["ar1"], artistNames: ["Wren Hollis"], year: 2025, type: "Single", trackIds: ["t31"], palette: 12 },
  { id: "al10", title: "Linen & Light", artistIds: ["ar2"], artistNames: ["Marlowe & Sons"], year: 2024, type: "Single", trackIds: ["t9"], palette: 9 },
  { id: "al11", title: "Fragment VII", artistIds: ["ar3"], artistNames: ["Ilse Varga"], year: 2025, type: "Single", trackIds: ["t13"], palette: 10 },
  { id: "al12", title: "Sunday Hands", artistIds: ["ar5"], artistNames: ["Cassius Reed"], year: 2025, type: "Single", trackIds: ["t21"], palette: 11 },
  { id: "al13", title: "Cello Machine", artistIds: ["ar8"], artistNames: ["Tomas Lindqvist"], year: 2024, type: "EP", trackIds: ["t29", "t30"], palette: 7 },
];

TRACKS.forEach((tr) => {
  tr.albumName = ALBUMS.find((a) => a.id === tr.albumId)?.title;
});

/* ---------- Remote playlists & mixes ---------- */
export const REMOTE_PLAYLISTS: Playlist[] = [
  { id: "pl_r1", title: "Paper Mornings", author: "SimpMusic Editorial", description: "Slow light, warm coffee, soft strings.", trackIds: ["t1", "t10", "t22", "t25", "t4", "t12"], kind: "remote", createdAt: 1, palette: 13 },
  { id: "pl_r2", title: "Brass & Handclaps", author: "SimpMusic Editorial", description: "Horn sections for walking faster.", trackIds: ["t6", "t8", "t26", "t20", "t7", "t27"], kind: "remote", createdAt: 1, palette: 14 },
  { id: "pl_r3", title: "Night Train Dream Pop", author: "Community", description: "Reverb for the last carriage.", trackIds: ["t14", "t15", "t16", "t17", "t11"], kind: "remote", createdAt: 1, palette: 15 },
  { id: "pl_r4", title: "Focus: Piano & Tape", author: "SimpMusic Editorial", description: "Minimal piano with a low hum.", trackIds: ["t10", "t11", "t12", "t13", "t29", "t30"], kind: "remote", createdAt: 1, palette: 2 },
  { id: "pl_r5", title: "Sleep Garden", author: "SimpMusic Editorial", description: "Long pieces, nothing sudden.", trackIds: ["t22", "t23", "t24"], kind: "remote", createdAt: 1, palette: 5 },
  { id: "pl_r6", title: "Lisbon Afternoons", author: "Community", description: "Bossa, brass and tram bells.", trackIds: ["t25", "t26", "t27", "t28", "t32"], kind: "remote", createdAt: 1, palette: 6 },
  { id: "mix1", title: "My Mix 1", author: "Mix for you", description: "Wren Hollis, Ilse Varga and more", trackIds: ["t1", "t10", "t4", "t13", "t31", "t5"], kind: "mix", createdAt: 1, palette: 0 },
  { id: "mix2", title: "My Mix 2", author: "Mix for you", description: "Cassius Reed, Odessa Blue and more", trackIds: ["t18", "t25", "t20", "t32", "t21", "t26"], kind: "mix", createdAt: 1, palette: 4 },
  { id: "mix3", title: "Discover Mix", author: "Mix for you", description: "New music you haven't heard", trackIds: ["t29", "t14", "t9", "t23", "t7"], kind: "mix", createdAt: 1, palette: 7 },
];

/* ---------- Podcasts ---------- */
export const PODCASTS: Podcast[] = [
  { id: "pd1", title: "Liner Notes", author: "Paper Radio", description: "Conversations with the people who make records sound the way they do.", palette: 9, episodes: [
    { id: "pd1e1", title: "Mixing in a chapel with Wren Hollis", duration: 2860, date: "Mar 12, 2025", description: "Wren on reverb tails and tape hiss." },
    { id: "pd1e2", title: "The horn arrangements of Odessa Blue", duration: 2410, date: "Feb 26, 2025", description: "Three trumpets, one room." },
    { id: "pd1e3", title: "Why Ilse Varga records at 4AM", duration: 3120, date: "Feb 12, 2025", description: "On silence as an instrument." },
  ] },
  { id: "pd2", title: "The Slow Listen", author: "Juniper Sky", description: "One long piece of music, discussed slowly.", palette: 5, episodes: [
    { id: "pd2e1", title: "Greenhouse I, revisited", duration: 4200, date: "Jan 30, 2025", description: "A guided listen." },
    { id: "pd2e2", title: "Moss, microphones and patience", duration: 3660, date: "Jan 9, 2025", description: "Field recording in winter." },
  ] },
];

/* ---------- Moods ---------- */
export const MOODS: Mood[] = [
  { id: "commute", title: "Commute", category: "Moods & moments", playlistIds: ["pl_r2", "pl_r6"], tint: "#D9CBB7" },
  { id: "energize", title: "Energize", category: "Moods & moments", playlistIds: ["pl_r2"], tint: "#C49A94" },
  { id: "feel_good", title: "Feel good", category: "Moods & moments", playlistIds: ["pl_r2", "pl_r6", "pl_r1"], tint: "#E6DCCB" },
  { id: "focus", title: "Focus", category: "Moods & moments", playlistIds: ["pl_r4", "pl_r1"], tint: "#A2A58A" },
  { id: "party", title: "Party", category: "Moods & moments", playlistIds: ["pl_r2"], tint: "#B97E76" },
  { id: "relax", title: "Relax", category: "Moods & moments", playlistIds: ["pl_r1", "pl_r5"], tint: "#71836B" },
  { id: "romance", title: "Romance", category: "Moods & moments", playlistIds: ["pl_r6", "pl_r3"], tint: "#EAD9D6" },
  { id: "sad", title: "Sad", category: "Moods & moments", playlistIds: ["pl_r3", "pl_r4"], tint: "#CDBFA9" },
  { id: "sleep", title: "Sleep", category: "Moods & moments", playlistIds: ["pl_r5"], tint: "#5A6A55" },
  { id: "workout", title: "Workout", category: "Moods & moments", playlistIds: ["pl_r2"], tint: "#8C5F5A" },
  { id: "folk", title: "Folk & Acoustic", category: "Genres", playlistIds: ["pl_r1"], tint: "#D6D9C8" },
  { id: "jazz", title: "Jazz", category: "Genres", playlistIds: ["pl_r6"], tint: "#9A7A4A" },
  { id: "ambient", title: "Ambient", category: "Genres", playlistIds: ["pl_r5", "pl_r4"], tint: "#DCE1DA" },
  { id: "indie", title: "Indie", category: "Genres", playlistIds: ["pl_r3", "pl_r2"], tint: "#F2E9E3" },
];

/* ---------- Charts ---------- */
export const CHARTS: ChartCountry[] = [
  { code: "ZZ", name: "Global", trackIds: ["t18", "t1", "t6", "t25", "t14", "t10", "t20", "t9", "t31", "t29"], videoIds: ["t20", "t8", "t27", "t15"], artistIds: ["ar5", "ar1", "ar7", "ar2", "ar3", "ar4"] },
  { code: "US", name: "United States", trackIds: ["t18", "t6", "t20", "t1", "t9", "t14", "t25", "t19", "t7", "t21"], videoIds: ["t20", "t8", "t15", "t27"], artistIds: ["ar5", "ar2", "ar1", "ar4", "ar7", "ar3"] },
  { code: "GB", name: "United Kingdom", trackIds: ["t1", "t31", "t3", "t18", "t14", "t6", "t10", "t4", "t25", "t29"], videoIds: ["t15", "t20", "t8", "t27"], artistIds: ["ar1", "ar5", "ar4", "ar2", "ar3", "ar6"] },
  { code: "PT", name: "Portugal", trackIds: ["t25", "t26", "t32", "t27", "t28", "t18", "t1", "t6", "t10", "t14"], videoIds: ["t27", "t20", "t8", "t15"], artistIds: ["ar7", "ar5", "ar1", "ar2", "ar3", "ar4"] },
  { code: "JP", name: "Japan", trackIds: ["t14", "t15", "t17", "t16", "t10", "t12", "t1", "t22", "t29", "t25"], videoIds: ["t15", "t27", "t20", "t8"], artistIds: ["ar4", "ar3", "ar1", "ar6", "ar8", "ar7"] },
  { code: "VN", name: "Vietnam", trackIds: ["t20", "t18", "t14", "t6", "t1", "t25", "t9", "t13", "t21", "t31"], videoIds: ["t20", "t15", "t8", "t27"], artistIds: ["ar5", "ar4", "ar2", "ar1", "ar7", "ar3"] },
];

/* ---------- Home shelves ---------- */
export const HOME_SHELVES: HomeShelf[] = [
  { id: "quick", title: "Quick picks", subtitle: "Start radio from a song", kind: "tracks", itemIds: ["t18", "t1", "t25", "t10", "t6", "t14", "t20", "t31", "t9", "t12", "t26", "t4"], columns: 4 },
  { id: "recent", title: "Listen again", kind: "albums", itemIds: ["al1", "al6", "al8", "al4", "al5"] },
  { id: "new", title: "New releases", subtitle: "Albums and singles from this month", kind: "albums", itemIds: ["al9", "al11", "al12", "al1", "al13", "al10"] },
  { id: "foryou", title: "Playlists for you", subtitle: "Curated on paper, every morning", kind: "playlists", itemIds: ["pl_r1", "pl_r4", "pl_r3", "pl_r2", "pl_r5", "pl_r6"] },
  { id: "trending", title: "Trending songs", kind: "tracks", itemIds: ["t20", "t18", "t6", "t9", "t31", "t14", "t29", "t13"], columns: 4 },
  { id: "artists", title: "Top artists", kind: "artists", itemIds: ["ar5", "ar1", "ar7", "ar3", "ar2", "ar4", "ar6", "ar8"] },
  { id: "mixes", title: "Mixed for you", kind: "playlists", itemIds: ["mix1", "mix2", "mix3"] },
];

export const NOTIFICATIONS: NotificationItem[] = [
  { id: "n1", artistId: "ar1", albumId: "al9", date: "Today" },
  { id: "n2", artistId: "ar3", albumId: "al11", date: "Yesterday" },
  { id: "n3", artistId: "ar5", albumId: "al12", date: "3 days ago" },
  { id: "n4", artistId: "ar2", albumId: "al10", date: "Last week" },
];

/* ---------- Lyrics ---------- */
const lyricTemplates: string[][] = [
  ["Morning comes in on paper wings", "The kettle hums a hymn it almost knows", "I keep the window open for the weather", "And let the chapel breathe", "Pedal steel like winter light", "Falling slow across the floor", "I am not leaving, I am staying", "Staying is the harder door", "Lantern season, lantern season", "Every street a slow amen", "If you call I'll hear it echo", "Off the stone and back again"],
  ["Brass on a Sunday, sun on the brass", "We walked the long way just to make it last", "Handclaps carry down the avenue", "Everybody's singing something true", "Postcard from nowhere, wish you were here", "Nowhere's lovely at this time of year", "Linen and light in the kitchen door", "I don't need much, I don't need more", "Oh the horns, oh the horns", "Playing us home"],
  ["Four in the morning, the tape still turns", "A small hour nobody else has learned", "Danube loop around the quiet town", "Every note a lamp I'm turning down", "Fragment seven, fragment seven", "Half a melody is still a heaven", "Piano shadows on the wall", "The softest thing can hold it all"],
  ["Last train to Arashiyama", "Tremolo garden through the glass", "Pale signal in the carriage window", "Paper moon hotel, we're nearly there", "Nearly there, nearly there", "Reverb like a river underneath", "Hold the handrail, hold your breath", "The night is longer than the line"],
  ["Velvet hour, pour it slow", "Honey and smoke on the radio", "Slow burn avenue, we take our time", "Sunday hands, Sunday hands in mine", "Oh the band don't play it twice", "Every take a different kind of nice", "Baritone like a warm front coming in", "Let the velvet hour begin"],
  ["Tagus afternoon, the light goes gold", "Saudade in the brass, a story told", "Tram twenty-eight is ringing up the hill", "Azulejo blue, the world stands still", "Blue hour radio, play it once more", "Lisbon humming through the open door"],
];

export function lyricsFor(track: Track): LyricLine[] | null {
  if (track.id === "t24" || track.id === "t22" || track.id === "t23") return null; // instrumental → unavailable
  const lines = lyricTemplates[track.palette % lyricTemplates.length];
  const step = (track.duration - 20) / lines.length;
  return lines.map((text, i) => ({ time: 6 + i * step, text }));
}
