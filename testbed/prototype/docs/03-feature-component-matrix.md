# 03 — Feature → Component Matrix (implementation blueprint)

| Original feature | Original implementation | Original UI | Interaction | React component | Mock state | Simulated behavior |
|---|---|---|---|---|---|---|
| Home shelves (Quick picks, trending, new releases, playlists for you) | `HomeRepository`, `HomeItem` | `HomeScreen.kt` carousels | tap/long‑press | `features/home/HomeScreen.tsx`, `components/cards/*` | `mockMusicService.getHome()` | Shelves from local data; play sets queue |
| Greeting + account | `HomeViewModel.accountInfo` | greeting header | tap avatar | `HomeScreen` header | `settings.accountName` | Opens Account sheet |
| Chart (country) | `HomeViewModel.exploreChart` | Chart section w/ dropdown | select | `features/explore/ChartsScreen.tsx` + Home chart section | `mockCharts` | Switch country, re‑sorted list |
| Mood & moments | `MoodViewModel` | `MoodScreen` | tap | `features/explore/MoodScreen.tsx` | `mockMoods` | Mood → playlist grid |
| Top artists | HomeItem | row | tap | Home artist strip | `mockArtists` | → Artist |
| Notifications | `NotificationViewModel` | `NotificationScreen` | tap | `features/home/NotificationScreen.tsx` | `mockNotifications` | list, open album |
| Search / suggestions / history / filters | `SearchViewModel`, `SearchHistory` | `SearchScreen` | type/submit/chips | `features/search/SearchScreen.tsx` | `searchStore` (persisted history) | Local fuzzy search, delayed loading |
| Recognize song | Android recognition | mic button | tap | Search mic | — | Simulated 2.5s listening → random result; labelled simulated |
| Library chips + tiles | `LibraryViewModel`, `LibraryChipType` | `LibraryScreen` | tap | `features/library/LibraryScreen.tsx` | `libraryStore` | Filter sections |
| Dynamic playlists (Favorite/Followed/MostPlayed/Downloaded/Cached) | `LibraryDynamicPlaylistViewModel` | `LibraryDynamicPlaylistScreen` | tap/sort | `features/library/DynamicPlaylistScreen.tsx` | favorites, followed, playCounts, downloads | Lists derived from store |
| Local playlist CRUD, reorder, sort, suggest | `LocalPlaylistViewModel`, `PairSongLocalPlaylist` | `LocalPlaylistScreen`, `CreateSheet` | tap/drag | `features/playlists/PlaylistScreen.tsx`, `sheets/CreatePlaylistSheet` | `libraryStore.playlists` (persisted) | Create/rename/delete/add/remove/reorder/sort |
| Album detail | `AlbumViewModel` | `AlbumScreen` | play/shuffle/like/download | `features/albums/AlbumScreen.tsx` | `mockAlbums` | all actions update stores |
| Artist detail | `ArtistViewModel` | `ArtistScreen` | follow/radio/shuffle | `features/artists/ArtistScreen.tsx` | `followed` | radio = shuffled artist tracks flagged radio |
| YT Playlist detail | `PlaylistViewModel` | `PlaylistScreen` | play/like/download | same `PlaylistScreen` with `kind:'remote'` | `mockPlaylists` | — |
| Podcasts | `PodcastViewModel` | `PodcastsScreen` | play episode | `features/podcasts/PodcastScreen.tsx` | `mockPodcasts` | episodes playable |
| Mini player | `MiniPlayer.kt` | bar | tap/play/next/like/swipe | `components/player/MiniPlayer.tsx` | `playerStore` | — |
| Now playing (transport, like, slider, shuffle, repeat) | `SharedViewModel.onUIEvent`, `PlayerControlLayout` | `NowPlayingScreen` | all | `components/player/FullPlayer.tsx` | `playerStore` | Timer‑driven progress, repeat None→All→One |
| Player tabs: lyrics / queue / related | `NowPlayingContent*` | tabs | tap | `FullPlayer` tabs → `LyricsPanel`, `QueuePanel`, `RelatedPanel` | `lyricsStore`, queue | — |
| Lyrics (synced, provider, offset, share, font) | `LyricsView`, `LyricsOffsetControl` | lyrics view | tap line | `features/lyrics/LyricsPanel.tsx` | `mockLyrics`, `settings.lyricsFontScale`, `lyricsOffset`, `lyricsProvider` | Highlight by time, seek on tap |
| Queue (reorder, remove, play next) | `MediaPlayerHandler` | `AppleMusicQueueView` | drag/remove | `features/queue/QueuePanel.tsx` | `playerStore.queue` | Reorder via framer‑motion Reorder |
| NowPlaying bottom sheet | `NowPlayingBottomSheetViewModel` | `ModalBottomSheet.kt` | tap items | `components/sheets/TrackSheet.tsx` | stores | like/add to playlist/queue/play next/radio/download/share/sleep timer/speed‑pitch/lyrics provider/go to album/artist |
| Sleep timer | `sleepTimerState` | dialog | pick minutes | `sheets/SleepTimerSheet` | `playerStore.sleepTimer` | Countdown pauses playback |
| Speed/pitch | `ChangePlaybackSpeedPitch` | dialog | slider | `sheets/SpeedPitchSheet` | `playerStore.speed/pitch` | Progress timer respects speed |
| Download | `DownloadHandler` | download icon states | tap | `DownloadButton` | `libraryStore.downloads` | Simulated progress → downloaded |
| Song info | `songInfoData` | sheet | tap | `sheets/SongInfoSheet` | mock metadata | — |
| Settings (all sections) | `SettingsViewModel` | `SettingScreen` | toggles/dialogs | `features/settings/SettingsScreen.tsx` | `settingsStore` (persisted) | Live theme/style changes |
| Equalizer / audio effects | `EqualizerAudioProcessor` etc. | `EqualizerSection`, `AudioEffectsSection` | sliders | `features/settings/EqualizerScreen.tsx` | `settings.eqBands`, presets | Visual only (labelled simulated) |
| Backup / restore / import | `AutoBackupWorker`, `ImportViewModel` | Settings backup | tap | Settings → Backup rows | localStorage snapshot | Export/import JSON of mock store |
| Analytics | `AnalyticsViewModel` | `AnalyticsScreen` | — | `features/analytics/AnalyticsScreen.tsx` | `playCounts`, history | bars from mock play history |
| Wrapped | `WrappedViewModel` | `WrappedScreen` cards | swipe | `features/analytics/WrappedScreen.tsx` | derived | Paged cards |
| Login (YT/Spotify/Last.fm/Discord) | `LogInViewModel` | WebViews | — | `features/account/AccountScreen.tsx` | `settings.account` | Simulated sign‑in toggles (clearly labelled) |
| Listen together / login sync / library sync | services | screens | — | Settings rows → info sheet | — | "Unavailable in web prototype" toast |
| Credits / App log | screens | — | tap | `features/settings/AboutScreen.tsx` | — | Static |
| Themes (light/dark/system, color) | DataStore | Settings | select | `settingsStore.theme` | — | Live class toggle |
| YouTube comments | `CommentsViewModel`, `CommentsBottomSheet.kt` | sheet | open/reply/like | `components/sheets/CommentsSheet.tsx` | local comment list per track; `accounts.youtube` gate | seeded comments, like toggles, reply/post when "signed in", turned‑off state on one track |
| Fullscreen player / lyrics | `FullscreenPlayer.kt`, `FullscreenLyricsContent.kt` | overlay | toggle lyrics, ±5 s, mute, PiP | `components/player/FullscreenPlayer.tsx` | `ui.fullscreen` | auto‑hide controls, 4‑line synced lyric strip, crossfading badge, PiP → explanatory toast |
| Multi‑selection | `selection/SongSelectionState.kt`, `SongSelectionTopAppBar.kt`, `SelectedSongsBottomSheet.kt` | top bar + sheet | long‑press, select all | `components/selection/SelectionBar.tsx` + `TrackRow` select mode | `ui.selection` (max 50) | favorite / add to playlist / download / play next on the whole selection |
