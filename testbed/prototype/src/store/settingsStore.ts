import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";
export type NowPlayingStyle = "papercraft" | "apple_music" | "m3_expressive" | "soundcloud" | "spotify";
export type LyricsProvider = "simpmusic" | "lrclib" | "spotify" | "youtube_transcript";

export interface Settings {
  // User interface
  themeMode: ThemeMode;
  themeColor: "default" | "wallpaper" | "custom";
  customColor: string;
  nowPlayingStyle: NowPlayingStyle;
  lyricsStyle: "apple_music" | "classic";
  animatedArtwork: boolean;
  canvas: boolean;
  showMixTab: boolean;
  showAnalyticsTab: boolean;
  // Content
  language: string;
  contentCountry: string;
  explicit: boolean;
  videoForVideoTracks: boolean;
  proxyEnabled: boolean;
  proxyHost: string;
  // Playback
  quality: "Auto" | "High" | "Medium" | "Low";
  downloadQuality: "High" | "Medium" | "Low";
  savePlaybackState: boolean;
  saveShuffleRepeat: boolean;
  skipSilent: boolean;
  normalizeVolume: boolean;
  radioAudioOnly: boolean;
  endlessQueue: boolean;
  killServiceOnExit: boolean;
  crossfade: boolean;
  crossfadeDuration: number;
  crossfadeDjMode: boolean;
  crossfadeSkipAlbum: boolean;
  // Audio
  equalizerEnabled: boolean;
  equalizerType: "built_in" | "system";
  eqPreset: string;
  eqBands: number[];
  eightD: boolean;
  reverb: boolean;
  audioDelay: number;
  // Lyrics
  lyricsProvider: LyricsProvider;
  spotifyLyrics: boolean;
  romanization: boolean;
  translationLanguage: string;
  aiTranslation: boolean;
  lyricsOffset: number;
  lyricsFontScale: number;
  helpBuildLyrics: boolean;
  // SponsorBlock
  sponsorBlock: boolean;
  sponsorCategories: string[];
  // Backup
  autoBackup: boolean;
  backupFrequency: "daily" | "weekly" | "monthly";
  keepBackups: number;
  backupDownloaded: boolean;
  lastBackup: number | null;
  // Database / history
  localTracking: boolean;
  smartDownloads: boolean;
  sendToGoogle: boolean;
  // Accounts (simulated)
  accounts: { youtube: string | null; spotify: boolean; lastfm: string | null; discord: boolean; scrobbling: boolean; richPresence: boolean };
  autoDownloadLiked: boolean;
  combineLiked: boolean;
  syncFollowToYouTube: boolean;
  autoCheckUpdate: boolean;
  updateChannel: "stable" | "beta";
}

export const EQ_PRESETS: Record<string, number[]> = {
  Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  Acoustic: [4, 3, 2, 0, 1, 2, 3, 3, 2, 1],
  "Bass boost": [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
  Classical: [4, 3, 2, 1, -1, -1, 0, 2, 3, 4],
  Jazz: [3, 2, 1, 2, -1, -1, 0, 1, 2, 3],
  Pop: [-1, 0, 2, 4, 4, 3, 1, 0, -1, -1],
  Vocal: [-2, -1, 0, 2, 4, 4, 3, 1, 0, -1],
  Treble: [0, 0, 0, 0, 0, 1, 2, 4, 5, 6],
};

const defaults: Settings = {
  themeMode: "system",
  themeColor: "default",
  customColor: "#71836B",
  nowPlayingStyle: "papercraft",
  lyricsStyle: "apple_music",
  animatedArtwork: true,
  canvas: false,
  showMixTab: false,
  showAnalyticsTab: false,
  language: "English",
  contentCountry: "ZZ",
  explicit: true,
  videoForVideoTracks: false,
  proxyEnabled: false,
  proxyHost: "",
  quality: "Auto",
  downloadQuality: "High",
  savePlaybackState: true,
  saveShuffleRepeat: true,
  skipSilent: false,
  normalizeVolume: true,
  radioAudioOnly: true,
  endlessQueue: false,
  killServiceOnExit: false,
  crossfade: false,
  crossfadeDuration: 6,
  crossfadeDjMode: false,
  crossfadeSkipAlbum: true,
  equalizerEnabled: false,
  equalizerType: "built_in",
  eqPreset: "Flat",
  eqBands: EQ_PRESETS.Flat,
  eightD: false,
  reverb: false,
  audioDelay: 0,
  lyricsProvider: "simpmusic",
  spotifyLyrics: false,
  romanization: false,
  translationLanguage: "en",
  aiTranslation: false,
  lyricsOffset: 0,
  lyricsFontScale: 1,
  helpBuildLyrics: true,
  sponsorBlock: true,
  sponsorCategories: ["sponsor", "selfpromo", "music_offtopic"],
  autoBackup: false,
  backupFrequency: "weekly",
  keepBackups: 5,
  backupDownloaded: false,
  lastBackup: null,
  localTracking: true,
  smartDownloads: false,
  sendToGoogle: false,
  accounts: { youtube: null, spotify: false, lastfm: null, discord: false, scrobbling: false, richPresence: false },
  autoDownloadLiked: false,
  combineLiked: false,
  syncFollowToYouTube: false,
  autoCheckUpdate: true,
  updateChannel: "stable",
};

interface SettingsState extends Settings {
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  patch: (p: Partial<Settings>) => void;
  reset: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaults,
      set: (key, value) => set({ [key]: value } as Partial<Settings>),
      patch: (p) => set(p),
      reset: () => set(defaults),
    }),
    { name: "papercraft.settings" },
  ),
);
