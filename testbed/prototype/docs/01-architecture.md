# 01 — Architecture: Core Engine vs. UI Layer (SimpMusic dev@f78a4fd)

**Source of truth**

| Field | Value |
|---|---|
| Repository | `https://github.com/maxrave-dev/SimpMusic` |
| Branch | `dev` (default branch at time of clone) |
| Commit | `f78a4fd6da9680e5771f4763194d2895d26914fd` |
| Engine submodule | `core` → `https://github.com/maxrave-dev/core` @ `8413a257cbe45d102a9f101f2760e35b549e4d9e` |
| App version | `2.6.2` (`composeApp/build.gradle.kts`) |
| License | GPL‑3.0 |
| Technology | Kotlin Multiplatform + Compose Multiplatform (Android, Desktop/JVM, iOS stubs), Koin DI, Ktor, Room/SQLDelight‑style DB, Media3/ExoPlayer (Android), custom JVM media (Desktop) |

> The React web app in this workspace does **not** import, link, or call any of the modules below. It is a separate presentation layer with a mock service.

---

## 1. Gradle module map (classification)

| Module (settings.gradle.kts) | Path | Layer |
|---|---|---|
| `:androidApp`, `:vivoAndroidApp` | `androidApp/`, `vivoAndroidApp/` | Platform shell (Android) |
| `:desktopApp` | `desktopApp/` | Platform shell (JVM Desktop) |
| `:composeApp` | `composeApp/` | **PRESENTATION / UI** (screens, components, ViewModels, navigation, theme) |
| `:common` | `core/common` | Shared infra (logger) |
| `:domain` | `core/domain` | **SHARED DOMAIN** — entities, models, repository interfaces, `MediaPlayerHandler` contract, `DataStoreManager` contract |
| `:data` | `core/data` | **CORE ENGINE** — repository implementations, DB, DataStore, parsers, media‑service handler, lyrics, lastfm, login/library sync |
| `:media3`, `:media3-ui` | `core/media/media3*` | **CORE ENGINE** — Android playback (ExoPlayer, audio processors, downloads, cast, Android Auto) |
| `:media-jvm`, `:media-jvm-ui` | `core/media/media-jvm*` | **CORE ENGINE** — Desktop playback |
| `:kotlinYtmusicScraper` | `core/service/kotlinYtmusicScraper` | **CORE ENGINE** — YouTube Music / YouTube API client, cipher, SponsorBlock & ReturnYouTubeDislike models |
| `:spotify` | `core/service/spotify` | **CORE ENGINE** — Spotify lyrics/canvas auth + client |
| `:lyricsService` | `core/service/lyricsService` | **CORE ENGINE** — SimpMusic Lyrics / LRCLIB |
| `:aiService` | `core/service/aiService` | **CORE ENGINE** — AI translation (OpenAI/Gemini compatible) |
| `:autoEqService` | `core/service/autoEqService` | **CORE ENGINE** — AutoEq profile fetch |
| `:listenTogether`, `:loginSync` | `core/service/*` | **CORE ENGINE** — P2P listen‑together & login sync |
| `:kizzy`, `:discord`, `:lastfm` | `core/service/*`, `lastfm/` | **CORE ENGINE** — Discord Rich Presence, Last.fm scrobbling |
| `:cast`, `:crashlytics` (+ `-empty`) | root | Platform infra, swappable (empty variants for FOSS builds) |

---

## 2. PART A — Core engine / functionality

| Component | Actual location | Responsibility | Input | Output | Dependencies | Persistence | UI connection |
|---|---|---|---|---|---|---|---|
| `MediaPlayerHandler` (interface + `QueueData`, `RepeatState{None,All,One}`, `ControlState`) | `core/domain/.../mediaservice/handler/MediaPlayerHandler.kt` | Queue, transport, shuffle/repeat, radio queue trimming, sleep timer | `UIEvent` from `SharedViewModel` | `StateFlow<ControlState>`, `StateFlow<QueueData>`, timeline | `MediaPlayerInterface` | Queue saved via `QueueEntity` | MiniPlayer, NowPlayingScreen, Queue view |
| `MediaServiceHandlerImpl` | `core/data/src/androidMain/.../mediaservice/MediaServiceHandlerImpl.kt` | Android impl bridging Media3 session | Media3 player events | Flows above | Media3 | — | — |
| `SimpleMediaService`, `SimpleMediaSessionCallback` | `core/media/media3/.../service/` | Foreground service, MediaSession, notification/media buttons | Session commands | Playback | ExoPlayer | — | System notification, Android Auto (`*CarScreen.kt`) |
| `ExoPlayerAdapter`, `CrossfadeExoPlayerAdapter`, `DelegatingForwardingPlayer` | `core/media/media3/.../exoplayer/` | Player wrapper, dual‑player crossfade, DJ‑mode transitions (`TransitionPlanner`, `TrackStructureAnalyzer` in domain) | Stream URLs | Audio | Media3 | — | Crossfade settings, "crossfading" indicator in lyrics |
| Audio processors: `EqualizerAudioProcessor`, `BiquadFilter`, `EightDAudioProcessor`, `ConvolutionReverbAudioProcessor`, `EchoAudioProcessor`, `SleepFadeAudioProcessor`, `WaveformAudioSink` | `core/media/media3/.../audio/` | Built‑in EQ, 8D, reverb, echo, sleep fade, waveform capture | PCM | PCM | ExoPlayer audio sink | EQ presets in DataStore | Settings → Equalizer / Audio Effects sections; SoundCloud player waveform |
| `MusicDownloadService`, `DownloadUtils`, `DownloadHandler` | `core/media/media3/`, `core/domain/.../handler/DownloadHandler.kt` | Download tracks for offline, cache | videoId | `DownloadState` | Media3 download manager | DB `DownloadState` | Download button in sheets, Downloaded playlists |
| `CastHandoffManager`, `CastStreamResolver`, `AudioOutputRouter` | `core/media/media3/` | Google Cast handoff & output routing | — | cast state | `:cast` | — | Cast button / Output sheet (Apple Music style) |
| `kotlinYtmusicScraper` (`YouTube` object, `pages/`, `parser/`, `cipher/`, `extractor/`) | `core/service/kotlinYtmusicScraper` | All YouTube Music browse/search/stream extraction, SponsorBlock segments, ReturnYouTubeDislike | endpoints, cookies | Response models | Ktor | Cookies via DataStore | Every content screen |
| Repositories (interfaces in domain, impls in data): `HomeRepository`, `SearchRepository`, `SongRepository`, `AlbumRepository`, `ArtistRepository`, `PlaylistRepository`, `LocalPlaylistRepository`, `PodcastRepository`, `StreamRepository`, `AccountRepository`, `AnalyticsRepository`, `TasteRepository`, `CacheRepository`, `ImportRepository`, `UpdateRepository`, `AutoEqRepository`, `LyricsCanvasRepository`, `LyricsRomanizerRepository`, `BrowserLoginRepository`, `LibrarySyncRepository`, `LoginSync*Repository`, `ListenTogetherRepository`, `DiscordRepository`, `CommonRepository` | `core/domain/.../repository/`, `core/data/.../repository/` | Data orchestration between network, DB, DataStore | ids/queries | Flows of domain models / `Resource` | scraper, DB, DataStore | DB | ViewModels |
| `MusicDatabase` + entities (`SongEntity`, `AlbumEntity`, `ArtistEntity`, `PlaylistEntity`, `LocalPlaylistEntity`, `PairSongLocalPlaylist`, `QueueEntity`, `SearchHistory`, `LyricsEntity`, `TranslatedLyricsEntity`, `PodcastsEntity`, `NotificationEntity`, `GoogleAccountEntity`, `AutoEqEntity`, `analytics/*`, `sync/*`) | `core/data/.../db/`, `core/domain/.../data/entities/` | Local persistence (library, favorites, history, downloads, playlists, lyrics cache, accounts) | entities | Flows | Room | Yes | Library, LocalPlaylist, Search history, Analytics, Settings |
| `DataStoreManager` | `core/domain/.../manager/DataStoreManager.kt`, impl in data | All user settings (theme, now‑playing style, quality, crossfade, lyrics provider, proxy, sponsorblock categories…) | key/value | Flows | DataStore | Yes | Settings screen, player styles |
| Lyrics pipeline (`data/lyrics`, `lyricsService`, `spotify`, `RichSyncParser`) | `core/data/.../lyrics`, `core/service/lyricsService`, `core/service/spotify` | Fetch synced lyrics (SimpMusic Lyrics, LRCLIB, Spotify, YouTube transcript), romanization, AI translation, canvas | videoId/title | `LyricsData` | Ktor | `LyricsEntity` | LyricsView, AppleMusicLyricsView, Fullscreen lyrics, Add/Vote lyrics sheets |
| Song recognition | `composeApp/src/androidMain/.../recognition/`, `RecognitionTileService.kt` | Identify song from mic (Android only) | audio | track | platform | — | Search → "Recognize song" |
| Analytics / Wrapped / Taste | `AnalyticsRepository`, `TasteRepository`, `domain/.../model/analytics`, `taste` | Local listening tracking, monthly recap, wrapped cards, taste share | playback events | aggregates | DB | Yes | Analytics screen, Wrapped screen, Library Wrapped tab |
| Backup / Restore / Import | `AutoBackupWorker`, `AutoBackupScheduler`, `ImportRepository`, `ImportViewModel` | Backup DB + settings, restore, import playlists from other apps | files | result | DB | files | Settings → Backup |
| Listen Together / Login Sync / Library Sync | `core/service/listenTogether`, `loginSync`, `data/librarysync` | LAN/P2P shared playback, credential sync, library sync | network | state | Ktor | — | ListenTogether screens, Settings |
| Integrations | `lastfm`, `discord`, `kizzy` | Scrobbling, Discord RPC | playback | — | Ktor/WebSocket | tokens | Settings → integrations, login screens |

### Components that must remain untouched
Everything in `core/`, `androidApp/`, `desktopApp/`, `composeApp/` is left exactly as cloned. No file in the cloned tree was modified.

---

## 3. PART B — Presentation / UI layer (`composeApp/src/commonMain/kotlin/com/maxrave/simpmusic/`)

| Area | Files |
|---|---|
| App root | `App.kt` (scaffold, bottom nav, mini‑player host, now‑playing sheet) |
| Navigation | `ui/navigation/graph/{AppNavigationGraph,HomeScreenGraph,LibraryScreenGraph,ListScreenGraph,LoginScreenGraph}.kt`; destinations in `ui/navigation/destination/**` |
| Bottom nav | `ui/component/AppBottomNavigationBar.kt`, `LiquidGlassAppBottomNavigationBar.kt` (`sealed class BottomNavScreen { Home, Search, Library, MixForYou, Analytics }`), `DesktopSidebar.kt` |
| Home | `ui/screen/home/HomeScreen.kt` (greeting, account chip, Quick picks, Chart, Mood & moments, Top artists, home shelves), `MoodScreen.kt`, `NotificationScreen.kt`, `SettingScreen.kt` (+ `EqualizerSection`, `AudioEffectsSection`, `AutoEqPicker`, `EqualizerPresets`), `ListenTogether*Screen.kt`, `analytics/*`, `wrapped/*` |
| Search | `ui/screen/other/SearchScreen.kt` (+ `SearchBarTransition.kt`) |
| Library | `ui/screen/library/{LibraryScreen,LibraryDynamicPlaylistScreen,LocalPlaylistScreen,MixForYouScreen,LibraryWrappedTab}.kt` |
| Lists | `ui/screen/other/{AlbumScreen,ArtistScreen,PlaylistScreen,PodcastsScreen,BrowseScreen,MoreAlbumsScreen,CreditScreen,AppLogScreen,UnofficialBuildScreen}.kt` |
| Player | `ui/screen/MiniPlayer.kt`, `ui/screen/player/{NowPlayingScreen,FullscreenPlayer,ArtworkPagerLogic}.kt`, `content/{NowPlayingContentAppleMusic,NowPlayingContentM3Expressive,NowPlayingContentSoundCloud,NowPlayingContentSpotify,NowPlayingContentState}.kt`, `applemusic/{AppleMusicLyricsView,AppleMusicQueueView,AppleMusicOutputSheet,...}`, `ui/component/PlayerControlLayout.kt` |
| Lyrics | `ui/component/{LyricsView,FullscreenLyricsContent,LyricText,LyricsOffsetControl,AddLyricsSheet,VoteLyricsDialog,ShareSavedLyricsDialog}.kt`, `component/lyrics/*` |
| Sheets & dialogs | `ui/component/ModalBottomSheet.kt` (NowPlaying sheet, playlist sheet, artist sheet, sort, sleep timer, speed/pitch, lyrics provider, add‑to‑playlist, share), `CommentsBottomSheet.kt`, `CreateSheet.kt`, `ShareImageSheet.kt`, `LoadingDialog.kt`, `ReviewDialog.kt`, `BlogPromoDialog.kt`, `ImageCropperDialog.kt`, `selection/SelectedSongsBottomSheet.kt` |
| Shared components | `AdapterItems.kt`, `FullWidthItems.kt`, `LibraryItem.kt`, `GridLibraryPlaylist.kt`, `PlaylistThumbnail.kt`, `ChipGroup.kt`, `CollapsingToolbar.kt`, `NormalAppBar.kt`, `Shimmer.kt`, `CenterLoadingBox.kt`, `OfflineErrorState.kt`, `EndOfPage.kt`, `MoodCategoryCard.kt`, `SimpMusicChart.kt`, `PodcastEpisodeItem.kt`, `DescriptionView.kt`, `ExpandableText.kt`, `PromoBanner.kt`, `WrappedEntryCard.kt`, `HeartBurstEffect.kt`, `RememberDragDropState.kt` |
| Login | `ui/screen/login/{LogInScreen,SpotifyLoginScreen,LastfmLoginScreen,DiscordLoginScreen,DiscordOAuthLoginScreen}.kt` |
| Theme | `ui/theme/*` (Material 3 dynamic colors, `AmbientThemeGlow`, `LiquidGlassContainer`, `SurfaceDarkColors`) |
| ViewModels (state holders) | `viewModel/{SharedViewModel, HomeViewModel, SearchViewModel, LibraryViewModel, LibraryDynamicPlaylistViewModel, LocalPlaylistViewModel, PlaylistViewModel, AlbumViewModel, ArtistViewModel, PodcastViewModel, BrowseViewModel, MoreAlbumsViewModel, MoodViewModel, NotificationViewModel, SettingsViewModel, NowPlayingBottomSheetViewModel, CommentsViewModel, AnalyticsViewModel, WrappedViewModel, TasteViewModel, AutoEqViewModel, SongSelectionViewModel, ImportViewModel, LogInViewModel, BrowserLoginViewModel, ListenTogether*ViewModel, LoginSync*ViewModel, LibrarySyncViewModels, LibrarySidebarViewModel, SoundCloudPlayerViewModel}.kt` |

---

## 4. Shared models and state contracts (neither purely UI nor engine)

- `core/domain/.../data/model/**` — `Track`, `Thumbnail`, `HomeItem{title, subtitle, contents, moreEndpoint, numItemsPerColumn}`, `Content`, `SearchResult*`, `BrowseResult`, `AlbumBrowse`, `ArtistBrowse`, `PlaylistBrowse`, `Lyrics`, `Line`, `Canvas`, `Mood`, `Podcast`, `Analytics*`, `Taste*`, `Promo`.
- `core/domain/.../mediaservice/handler/MediaPlayerHandler.kt` — `ControlState{isPlaying,isShuffle,repeatState,isLiked,isNextAvailable,isPreviousAvailable,isCrossfading,volume,mediaItem}`, `QueueData{queueState, data{listTracks, firstPlayedTrack, playlistId, playlistName, playlistType, continuation}}`, `RepeatState`, `SleepTimerState`.
- `SharedViewModel` exposed state: `nowPlayingState: NowPlayingTrackState?`, `controllerState: ControlState`, `timeline: TimeLine{current,total,bufferedPercent,loading}`, `nowPlayingScreenData{playlistName,isRadioQueue,nowPlayingTitle,artistName,isVideo,isExplicit,thumbnailURL,canvasData,lyricsData,lyricsNotFound,songInfoData}`, `likeStatus: YouTubeLikeStatus`, `sleepTimerState`, `castState`, `getVideo`.
- `LibraryChipType {YOUR_LIBRARY, WRAPPED, CHART, YOUTUBE_MUSIC_PLAYLIST, YOUTUBE_MIX_FOR_YOU, LOCAL_PLAYLIST, FAVORITE_PLAYLIST, DOWNLOADED_PLAYLIST, FAVORITE_PODCAST}`.
- `LibraryDynamicPlaylistType {Favorite, Followed, MostPlayed, Downloaded, Cached, ArtistLiked, TopTracks, TopAlbums, TopArtists, MonthlyRecap}`.
- `UIEvent {PlayPause, Next, Previous, SkipToPrevious, Backward, Forward, Shuffle, Repeat, ToggleLike, UpdateProgress, UpdateVolume, Stop}`.
- `NowPlayingBottomSheetUIEvent {ToggleLike, AddToPlaylist, AddToYouTubePlaylist, AddToQueue, PlayNext, DeleteFromPlaylist, Download, StartRadio, Share, SetSleepTimer, ChangePlaybackSpeedPitch, ChangeLyricsProvider}`.

### Event flow
```
Compose screen ──(UIEvent / sheet event)──▶ ViewModel ──▶ Repository / MediaPlayerHandler
       ▲                                                            │
       └────────── StateFlow<UiState> ◀── mapping ◀─────────────────┘
```

---

## 5. Existing architecture limitations (observed)

1. `SharedViewModel` is a god‑object (~1,500+ lines) holding player, lyrics, canvas, update, sleep timer, like status, and navigation requests.
2. `ModalBottomSheet.kt` hosts many unrelated sheets in one file.
3. Four now‑playing visual styles share state but duplicate layout code.
4. Home shelves are untyped `HomeItem` lists; section identity relies on title strings from YouTube.
5. Android‑only features (recognition, system EQ, cast, widgets) are gated by `expect/actual` and show "unavailable" copies on desktop.

---

## 6. Dependency direction between layers

`composeApp` → `domain` (interfaces/models) → implemented by `data` + `media3`/`media-jvm` via Koin. UI never imports `kotlinYtmusicscraper` directly except for a few model types re‑exported via domain. The React rebuild mirrors only the **UI → domain‑model → state** contract and replaces everything below `domain` with `mockMusicService`.
