export type RepeatState = "none" | "all" | "one";

export interface Track {
  id: string;
  title: string;
  artistIds: string[];
  artistNames: string[];
  albumId?: string;
  albumName?: string;
  duration: number; // seconds
  isVideo?: boolean;
  isExplicit?: boolean;
  year?: number;
  plays?: number;
  palette: number; // index for generated artwork
  bpm?: number;
  key?: string;
}

export interface Album {
  id: string;
  title: string;
  artistIds: string[];
  artistNames: string[];
  year: number;
  type: "Album" | "EP" | "Single";
  trackIds: string[];
  description?: string;
  palette: number;
}

export interface Artist {
  id: string;
  name: string;
  subscribers: string;
  description: string;
  albumIds: string[];
  singleIds: string[];
  topTrackIds: string[];
  relatedIds: string[];
  palette: number;
}

export interface Playlist {
  id: string;
  title: string;
  author: string;
  description?: string;
  trackIds: string[];
  kind: "local" | "remote" | "mix";
  createdAt: number;
  palette: number;
  synced?: boolean;
}

export interface PodcastEpisode {
  id: string;
  title: string;
  duration: number;
  date: string;
  description: string;
}

export interface Podcast {
  id: string;
  title: string;
  author: string;
  description: string;
  episodes: PodcastEpisode[];
  palette: number;
}

export interface LyricLine {
  time: number;
  text: string;
}

export interface Mood {
  id: string;
  title: string;
  category: "Moods & moments" | "Genres";
  playlistIds: string[];
  tint: string;
}

export interface ChartCountry {
  code: string;
  name: string;
  trackIds: string[];
  videoIds: string[];
  artistIds: string[];
}

export interface HomeShelf {
  id: string;
  title: string;
  subtitle?: string;
  kind: "tracks" | "albums" | "playlists" | "artists";
  itemIds: string[];
  columns?: number;
}

export interface NotificationItem {
  id: string;
  artistId: string;
  albumId: string;
  date: string;
}

export type SearchFilter =
  | "all"
  | "songs"
  | "videos"
  | "albums"
  | "artists"
  | "playlists"
  | "podcasts";

export interface SearchResults {
  songs: Track[];
  videos: Track[];
  albums: Album[];
  artists: Artist[];
  playlists: Playlist[];
  podcasts: Podcast[];
}

export type DownloadState = "none" | "downloading" | "downloaded";

export type LibraryChip =
  | "your_library"
  | "local_playlists"
  | "favorite_playlists"
  | "downloaded_playlists"
  | "favorite_podcasts"
  | "charts"
  | "wrapped"
  | "mix_for_you"
  | "youtube_playlists";

export type DynamicPlaylistType =
  | "favorite"
  | "followed"
  | "most_played"
  | "downloaded"
  | "cached"
  | "recently_added";
