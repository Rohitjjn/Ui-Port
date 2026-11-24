/**
 * Mock Music Service — the only "backend" of the web prototype.
 * Simulates latency and returns local sample data. Nothing here touches
 * YouTube, SimpMusic's Kotlin engine or any real streaming service.
 */
import {
  ALBUMS,
  ARTISTS,
  CHARTS,
  HOME_SHELVES,
  MOODS,
  NOTIFICATIONS,
  PODCASTS,
  REMOTE_PLAYLISTS,
  TRACKS,
  lyricsFor,
} from "@/data/mockData";
import type { Album, Artist, Playlist, Podcast, SearchResults, Track } from "@/types";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const trackById = (id: string) => TRACKS.find((t) => t.id === id);
export const tracksByIds = (ids: string[]) => ids.map(trackById).filter(Boolean) as Track[];
export const albumById = (id: string) => ALBUMS.find((a) => a.id === id);
export const artistById = (id: string) => ARTISTS.find((a) => a.id === id);
export const remotePlaylistById = (id: string) => REMOTE_PLAYLISTS.find((p) => p.id === id);
export const podcastById = (id: string) => PODCASTS.find((p) => p.id === id);

export const mockMusicService = {
  async getHome() {
    await wait(650);
    return HOME_SHELVES;
  },
  async getAlbum(id: string): Promise<{ album: Album; tracks: Track[] } | null> {
    await wait(420);
    const album = albumById(id);
    return album ? { album, tracks: tracksByIds(album.trackIds) } : null;
  },
  async getArtist(id: string): Promise<Artist | null> {
    await wait(480);
    return artistById(id) ?? null;
  },
  async getRemotePlaylist(id: string): Promise<Playlist | null> {
    await wait(420);
    return remotePlaylistById(id) ?? null;
  },
  async getPodcast(id: string): Promise<Podcast | null> {
    await wait(380);
    return podcastById(id) ?? null;
  },
  async getMoods() {
    await wait(300);
    return MOODS;
  },
  async getCharts(code: string) {
    await wait(380);
    return CHARTS.find((c) => c.code === code) ?? CHARTS[0];
  },
  chartCountries: CHARTS.map((c) => ({ code: c.code, name: c.name })),
  async getNotifications() {
    await wait(300);
    return NOTIFICATIONS;
  },
  async getLyrics(track: Track) {
    await wait(500);
    return lyricsFor(track);
  },
  suggest(query: string): string[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const pool = new Set<string>();
    TRACKS.forEach((t) => t.title.toLowerCase().includes(q) && pool.add(t.title));
    ARTISTS.forEach((a) => a.name.toLowerCase().includes(q) && pool.add(a.name));
    ALBUMS.forEach((a) => a.title.toLowerCase().includes(q) && pool.add(a.title));
    REMOTE_PLAYLISTS.forEach((p) => p.title.toLowerCase().includes(q) && pool.add(p.title));
    return [...pool].slice(0, 6);
  },
  async search(query: string): Promise<SearchResults> {
    await wait(550);
    const q = query.trim().toLowerCase();
    const terms = q.split(/\s+/).filter(Boolean);
    const match = (...fields: (string | undefined)[]) => {
      const hay = fields.filter(Boolean).join(" ").toLowerCase();
      return terms.every((term) => hay.includes(term));
    };
    const songs = TRACKS.filter((t) => match(t.title, t.artistNames.join(" "), t.albumName));
    return {
      songs: songs.filter((s) => !s.isVideo),
      videos: songs.filter((s) => s.isVideo),
      albums: ALBUMS.filter((a) => match(a.title, a.artistNames.join(" "))),
      artists: ARTISTS.filter((a) => match(a.name)),
      playlists: REMOTE_PLAYLISTS.filter((p) => match(p.title, p.author, p.description)),
      podcasts: PODCASTS.filter((p) => match(p.title, p.author)),
    };
  },
  async recognize(): Promise<Track> {
    await wait(2600);
    return TRACKS[Math.floor(Math.random() * TRACKS.length)];
  },
  related(track: Track): Track[] {
    return TRACKS.filter((t) => t.id !== track.id && (t.artistIds.some((a) => track.artistIds.includes(a)) || t.palette % 4 === track.palette % 4)).slice(0, 8);
  },
  radio(seed: Track): Track[] {
    const rest = TRACKS.filter((t) => t.id !== seed.id).sort(() => Math.random() - 0.5).slice(0, 11);
    return [seed, ...rest];
  },
  suggestForPlaylist(trackIds: string[]): Track[] {
    return TRACKS.filter((t) => !trackIds.includes(t.id)).sort(() => Math.random() - 0.5).slice(0, 5);
  },
  allTracks: TRACKS,
  allAlbums: ALBUMS,
  allArtists: ARTISTS,
  remotePlaylists: REMOTE_PLAYLISTS,
  podcasts: PODCASTS,
};

export function fmtTime(sec: number) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
export function fmtLength(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h ? `${h} hr ${m} min` : `${m} min`;
}
export function fmtPlays(n = 0) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M plays`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}K plays`;
  return `${n} plays`;
}
