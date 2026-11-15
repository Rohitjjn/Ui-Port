import { create } from "zustand";
import type { Track, Playlist, Album, Artist } from "@/types";

export type SheetKind =
  | { kind: "track"; track: Track; fromPlaylistId?: string; queueIndex?: number }
  | { kind: "addToPlaylist"; tracks: Track[] }
  | { kind: "createPlaylist"; addTracks?: Track[] }
  | { kind: "playlistOptions"; playlist: Playlist }
  | { kind: "albumOptions"; album: Album }
  | { kind: "artistOptions"; artist: Artist }
  | { kind: "sleepTimer" }
  | { kind: "speedPitch" }
  | { kind: "lyricsProvider" }
  | { kind: "songInfo"; track: Track }
  | { kind: "share"; title: string; url: string }
  | { kind: "sort"; options: { id: string; label: string }[]; current: string; onPick: (id: string) => void }
  | { kind: "account" }
  | { kind: "output" }
  | { kind: "info"; title: string; body: string }
  | { kind: "confirm"; title: string; body: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void }
  | { kind: "prompt"; title: string; label: string; initial?: string; onSubmit: (v: string) => void }
  | { kind: "addLyrics"; track: Track }
  | { kind: "shareLyrics"; track: Track; lines: string[] }
  | { kind: "comments"; track: Track };

interface UiState {
  playerOpen: boolean;
  playerTab: "lyrics" | "queue" | "related" | "info";
  fullscreen: boolean;
  sheet: SheetKind | null;
  toastMsg: { id: number; text: string } | null;
  /** multi-selection mode (mirrors SongSelectionState) */
  selection: string[] | null;
  openPlayer: (tab?: UiState["playerTab"]) => void;
  closePlayer: () => void;
  setPlayerTab: (t: UiState["playerTab"]) => void;
  setFullscreen: (v: boolean) => void;
  openSheet: (s: SheetKind) => void;
  closeSheet: () => void;
  toast: (text: string) => void;
  startSelection: (id?: string) => void;
  toggleSelected: (id: string) => void;
  selectAll: (ids: string[]) => void;
  exitSelection: () => void;
}

export const MAX_SELECTION = 50;

export const useUiStore = create<UiState>((set) => ({
  playerOpen: false,
  playerTab: "queue",
  fullscreen: false,
  sheet: null,
  toastMsg: null,
  selection: null,
  openPlayer: (tab) => set((s) => ({ playerOpen: true, playerTab: tab ?? s.playerTab })),
  closePlayer: () => set({ playerOpen: false, fullscreen: false }),
  setFullscreen: (v) => set({ fullscreen: v }),
  startSelection: (id) => set({ selection: id ? [id] : [] }),
  toggleSelected: (id) =>
    set((s) => {
      if (!s.selection) return {};
      if (s.selection.includes(id)) return { selection: s.selection.filter((x) => x !== id) };
      if (s.selection.length >= MAX_SELECTION) return { toastMsg: { id: Date.now(), text: `Maximum selection reached (${MAX_SELECTION})` } };
      return { selection: [...s.selection, id] };
    }),
  selectAll: (ids) => set({ selection: ids.slice(0, MAX_SELECTION) }),
  exitSelection: () => set({ selection: null }),
  setPlayerTab: (t) => set({ playerTab: t }),
  openSheet: (sheet) => set({ sheet }),
  closeSheet: () => set({ sheet: null }),
  toast: (text) => set({ toastMsg: { id: Date.now(), text } }),
}));
