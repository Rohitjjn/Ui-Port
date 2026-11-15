# 05 — Implementation Report: SimpMusic PaperCraft (React web prototype)

## Source reference (verified)
| Field | Value |
|---|---|
| Repository | `https://github.com/maxrave-dev/SimpMusic` |
| Branch / commit | `dev` @ `f78a4fd6da9680e5771f4763194d2895d26914fd` |
| Engine submodule | `maxrave-dev/core` @ `8413a257cbe45d102a9f101f2760e35b549e4d9e` |
| Version / license | 2.6.2 · GPL‑3.0 |
| Clone location | `/tmp/SimpMusic` (inspection only — **no file modified**) |

## Architecture of the web app
```
React screens (src/features/*) ─▶ Zustand stores (src/store/*) ─▶ mockMusicService ─▶ src/data/mockData.ts
        │                             │ persist → localStorage (papercraft.player / .library / .settings)
        └── src/components/{common, cards, player, sheets, selection}
```
- Reused the workspace's existing Vite 7 + React 19 + Tailwind v4 infrastructure; added `zustand`, `framer-motion`, `lucide-react`, `react-router-dom`.
- **Zero** imports of Kotlin/Compose/Media3/ExoPlayer/YouTube/Android code. All artwork is generated inline SVG (`src/utils/artwork.ts`) — no external image services.
- `HashRouter` so the single‑file production build (`dist/index.html`) works from any host or `file://`.

## Screen coverage — original → React
| Original (`composeApp/.../ui/screen`) | Route | Status |
|---|---|---|
| HomeScreen (greeting, account chip, notifications, settings, quick picks, shelves, chart + country, moods & moments, top artists, wrapped entry, login promo) | `/` | ✅ |
| MoodScreen | `/moods`, `/mood/:id` | ✅ |
| NotificationScreen | `/notifications` | ✅ |
| SettingScreen (UI, Content, Playback, Audio, Lyrics, SponsorBlock, Storage, Backup, Database/History, Integrations, Sync, Updates/Developer, About) | `/settings` | ✅ |
| EqualizerSection / AudioEffectsSection / AutoEqPicker | `/settings/equalizer` | ✅ (visual DSP, labelled simulated) |
| AnalyticsScreen + ListeningReceipt | `/analytics` | ✅ |
| WrappedScreen (8 cards) / WrappedNotEnoughData | `/wrapped` | ✅ |
| SearchScreen (history, suggestions, 7 filter chips, recognize song, error/empty) | `/search` | ✅ |
| LibraryScreen (9 `LibraryChipType` chips, 6 dynamic tiles, create sheet) | `/library` | ✅ |
| LibraryDynamicPlaylistScreen | `/library/:type` | ✅ |
| LocalPlaylistScreen (edit title/thumbnail, sort, search, suggest, reorder, sync, download, delete) | `/playlist/:id` | ✅ |
| PlaylistScreen (remote) / MixForYouScreen | `/playlist/:id`, `/mix` | ✅ |
| AlbumScreen | `/album/:id` | ✅ |
| ArtistScreen / MoreAlbumsScreen | `/artist/:id`, `/artist/:id/albums` | ✅ |
| PodcastsScreen | `/podcast/:id` | ✅ |
| BrowseScreen / charts | `/browse/:id`, `/charts` | ✅ |
| CreditScreen / AppLogScreen | `/settings/credits`, `/settings/log` | ✅ |
| LogIn / Spotify / Last.fm / Discord login | `/account` + Account sheet | ✅ simulated sign‑in |
| NowPlayingScreen (artwork pager, like/dislike, timeline, transport, lyrics/queue/related/info tabs, volume, speed, sleep timer, output, comments, fullscreen) | overlay | ✅ |
| MiniPlayer | persistent | ✅ |
| Queue view (reorder, remove, play next, save as playlist, clear) | player tab | ✅ |
| LyricsView (sync highlight, tap‑seek, provider, offset, font size, share lines, add lyrics) | player tab | ✅ |
| **FullscreenPlayer + FullscreenLyricsContent** | overlay | ✅ (added in pass 2) |
| **CommentsBottomSheet** | sheet | ✅ (added in pass 2) |
| **Song selection mode** (`SongSelectionTopAppBar`, `SelectedSongsBottomSheet`) | top bar | ✅ (added in pass 2) |
| ListenTogether / ListenTogetherSettings | Settings rows | ⚠️ info dialog (needs native P2P service) |
| UnofficialBuildScreen | — | n/a (build‑flavor gate) |

Sheets/dialogs implemented: track options, album options, artist options, playlist options, add‑to‑playlist, create playlist, sleep timer, speed & pitch, lyrics provider, song info, share, share lyrics card, add lyrics, comments, output/cast, account, sort, confirm, prompt, info — **20 kinds**.

## Mock functionality
Play/pause · next/previous (restart‑if‑>3 s) · seek · shuffle (current‑first reshuffle) · repeat None→All→One · like with heart burst · dislike · radio queues (add‑to‑queue disabled, as in original) · play next / add to queue · drag reorder (queue & local playlists) · remove / clear queue · sleep timer (minutes or end‑of‑song; pauses) · speed/pitch (speed drives the clock) · favorites, follows, liked albums/playlists/podcasts · local playlist CRUD, reorder, sort, filter, suggestions, cover cycling, sync flag · simulated downloads with progress → downloaded badges · search with latency, suggestions, history, `"error"` keyword for the error state · song recognition simulation · multi‑select batch actions · comments (post/reply/like when "signed in") · settings with live theme/colour switching · backup export / restore (JSON) · listening history → Recently played, Most played, Analytics, Wrapped · toast feedback for every non‑navigational action · keyboard: Space, Shift+←/→, Esc.

## Verified vs. experimental
- **Verified original functionality**: every row in `02-ui-interaction-map.md` cites the Compose file / ViewModel event it derives from.
- **Experimental design additions** (not in original): editorial "Featured this week" hero on Home, "Recently played" strip derived from local history, PaperCraft share‑card styles, listening‑receipt styling. All are presentation‑level and reuse verified data/state.

## Build & test results (actually executed)
| Step | Result |
|---|---|
| `npm install` (+ zustand, framer‑motion, lucide‑react, react‑router‑dom) | ✅ |
| `npx tsc --noEmit` (strict, noUnusedLocals/Parameters) | ✅ 0 errors |
| `npm run build` | ✅ `dist/index.html` ≈ 732 kB (gzip ≈ 224 kB) |
| Automated unit tests | none in template; none added |
| Playwright headless Chromium — 33 captures across 390×844, 820×1180, 1440×900 (home, player, lyrics, queue, fullscreen, comments, selection, search, library, playlist reorder, album, artist, settings, equalizer, charts, moods, account, analytics, wrapped, dark mode) | ✅ 0 page errors · 0 console errors · 0 horizontal overflow |
| Visual inspection | fixed two issues found: fullscreen controls overlapping lyrics on mobile; truncated "n selected" label on mobile |

## Known limitations
- No audio/video is played; the "player" is a 500 ms timer. Stated in sidebar, settings and sheets.
- `nowPlayingStyle` (Apple Music / M3 Expressive / SoundCloud / Spotify) is stored but every style renders the PaperCraft layout.
- PiP, cast hand‑off, system equalizer, listen‑together, login/library sync are represented by explanatory dialogs/toasts.
- Fonts come from Google Fonts with Georgia/system‑ui fallbacks.
- Single‑file bundle is not code‑split (prototype choice).

## Run
```
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/index.html — self‑contained
```
