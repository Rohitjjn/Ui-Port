import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DownloadState, Playlist } from "@/types";
import { useUiStore } from "./uiStore";

interface LibraryState {
  favorites: string[]; // track ids
  likedAlbums: string[];
  likedPlaylists: string[]; // remote playlist ids
  likedPodcasts: string[];
  followedArtists: string[];
  playlists: Playlist[]; // local playlists
  downloads: Record<string, DownloadState>;
  cached: string[];
  playCounts: Record<string, number>;
  history: { trackId: string; at: number }[];
  recentlyAdded: string[];
  searchHistory: string[];

  toggleFavorite: (id: string) => void;
  toggleLikedAlbum: (id: string) => void;
  toggleLikedPlaylist: (id: string) => void;
  toggleLikedPodcast: (id: string) => void;
  toggleFollow: (id: string) => void;
  createPlaylist: (title: string, trackIds?: string[]) => Playlist;
  renamePlaylist: (id: string, title: string) => void;
  deletePlaylist: (id: string) => void;
  addToPlaylist: (playlistId: string, trackIds: string[]) => void;
  removeFromPlaylist: (playlistId: string, trackId: string) => void;
  reorderPlaylist: (playlistId: string, trackIds: string[]) => void;
  setPlaylistPalette: (playlistId: string, palette: number) => void;
  toggleSyncPlaylist: (playlistId: string) => void;
  download: (trackIds: string[]) => void;
  removeDownload: (trackIds: string[]) => void;
  recordPlay: (trackId: string) => void;
  clearHistory: () => void;
  addSearch: (q: string) => void;
  removeSearch: (q: string) => void;
  clearSearchHistory: () => void;
  importSnapshot: (json: string) => boolean;
  exportSnapshot: () => string;
}

const uniqPush = (arr: string[], id: string) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      favorites: ["t1", "t18", "t25", "t10"],
      likedAlbums: ["al1"],
      likedPlaylists: ["pl_r1"],
      likedPodcasts: ["pd1"],
      followedArtists: ["ar1", "ar5"],
      playlists: [
        { id: "lp1", title: "Kitchen Table Songs", author: "You", description: "For slow breakfasts.", trackIds: ["t1", "t25", "t6", "t12", "t31"], kind: "local", createdAt: Date.now() - 86400000 * 12, palette: 13 },
        { id: "lp2", title: "Late Shift", author: "You", trackIds: ["t10", "t29", "t14", "t22"], kind: "local", createdAt: Date.now() - 86400000 * 40, palette: 10 },
      ],
      downloads: { t1: "downloaded", t2: "downloaded", t3: "downloaded", t18: "downloaded" },
      cached: ["t25", "t6", "t10", "t14", "t20"],
      playCounts: { t18: 42, t1: 37, t25: 29, t10: 22, t6: 19, t14: 15, t20: 11, t31: 9, t9: 7, t12: 5 },
      history: [],
      recentlyAdded: ["t31", "t13", "t21"],
      searchHistory: ["wren hollis", "velvet hour", "lisbon"],

      toggleFavorite: (id) => {
        const was = get().favorites.includes(id);
        set((s) => ({ favorites: uniqPush(s.favorites, id) }));
        useUiStore.getState().toast(was ? "Removed from Liked songs" : "Added to Liked songs");
      },
      toggleLikedAlbum: (id) => set((s) => ({ likedAlbums: uniqPush(s.likedAlbums, id) })),
      toggleLikedPlaylist: (id) => set((s) => ({ likedPlaylists: uniqPush(s.likedPlaylists, id) })),
      toggleLikedPodcast: (id) => set((s) => ({ likedPodcasts: uniqPush(s.likedPodcasts, id) })),
      toggleFollow: (id) => set((s) => ({ followedArtists: uniqPush(s.followedArtists, id) })),
      createPlaylist: (title, trackIds = []) => {
        const p: Playlist = { id: `lp${Date.now()}`, title, author: "You", trackIds, kind: "local", createdAt: Date.now(), palette: Math.floor(Math.random() * 16) };
        set((s) => ({ playlists: [p, ...s.playlists] }));
        return p;
      },
      renamePlaylist: (id, title) => set((s) => ({ playlists: s.playlists.map((p) => (p.id === id ? { ...p, title } : p)) })),
      deletePlaylist: (id) => set((s) => ({ playlists: s.playlists.filter((p) => p.id !== id) })),
      addToPlaylist: (playlistId, trackIds) =>
        set((s) => ({
          playlists: s.playlists.map((p) => (p.id === playlistId ? { ...p, trackIds: [...p.trackIds, ...trackIds.filter((t) => !p.trackIds.includes(t))] } : p)),
          recentlyAdded: [...trackIds, ...s.recentlyAdded.filter((t) => !trackIds.includes(t))].slice(0, 20),
        })),
      removeFromPlaylist: (playlistId, trackId) => set((s) => ({ playlists: s.playlists.map((p) => (p.id === playlistId ? { ...p, trackIds: p.trackIds.filter((t) => t !== trackId) } : p)) })),
      reorderPlaylist: (playlistId, trackIds) => set((s) => ({ playlists: s.playlists.map((p) => (p.id === playlistId ? { ...p, trackIds } : p)) })),
      setPlaylistPalette: (playlistId, palette) => set((s) => ({ playlists: s.playlists.map((p) => (p.id === playlistId ? { ...p, palette } : p)) })),
      toggleSyncPlaylist: (playlistId) => set((s) => ({ playlists: s.playlists.map((p) => (p.id === playlistId ? { ...p, synced: !p.synced } : p)) })),
      download: (trackIds) => {
        const pending = trackIds.filter((id) => get().downloads[id] !== "downloaded");
        if (!pending.length) return;
        set((s) => ({ downloads: { ...s.downloads, ...Object.fromEntries(pending.map((id) => [id, "downloading" as DownloadState])) } }));
        pending.forEach((id, i) =>
          setTimeout(() => set((s) => ({ downloads: { ...s.downloads, [id]: "downloaded" } })), 1800 + i * 700),
        );
      },
      removeDownload: (trackIds) =>
        set((s) => {
          const d = { ...s.downloads };
          trackIds.forEach((id) => delete d[id]);
          return { downloads: d };
        }),
      recordPlay: (trackId) =>
        set((s) => ({
          playCounts: { ...s.playCounts, [trackId]: (s.playCounts[trackId] ?? 0) + 1 },
          history: [{ trackId, at: Date.now() }, ...s.history].slice(0, 200),
          cached: s.cached.includes(trackId) ? s.cached : [trackId, ...s.cached].slice(0, 30),
        })),
      clearHistory: () => set({ history: [], playCounts: {} }),
      addSearch: (q) => set((s) => ({ searchHistory: [q, ...s.searchHistory.filter((x) => x !== q)].slice(0, 12) })),
      removeSearch: (q) => set((s) => ({ searchHistory: s.searchHistory.filter((x) => x !== q) })),
      clearSearchHistory: () => set({ searchHistory: [] }),
      exportSnapshot: () => JSON.stringify({ v: 1, library: get(), at: Date.now() }),
      importSnapshot: (json) => {
        try {
          const parsed = JSON.parse(json);
          if (!parsed.library) return false;
          const { favorites, likedAlbums, likedPlaylists, followedArtists, playlists, downloads, playCounts, history, searchHistory } = parsed.library;
          set({ favorites, likedAlbums, likedPlaylists, followedArtists, playlists, downloads, playCounts, history, searchHistory });
          return true;
        } catch {
          return false;
        }
      },
    }),
    { name: "papercraft.library" },
  ),
);
