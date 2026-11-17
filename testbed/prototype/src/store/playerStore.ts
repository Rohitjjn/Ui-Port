import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RepeatState, Track } from "@/types";
import { useUiStore } from "./uiStore";
import { useLibraryStore } from "./libraryStore";

export interface QueueSource {
  name: string;
  isRadio?: boolean;
}

interface PlayerState {
  queue: Track[];
  index: number;
  isPlaying: boolean;
  progress: number; // seconds
  shuffle: boolean;
  repeat: RepeatState;
  volume: number;
  speed: number;
  pitch: number;
  source: QueueSource;
  sleepTimer: { endsAt: number; endOfSong?: boolean } | null;
  // actions (mirror SharedViewModel.onUIEvent)
  setQueue: (tracks: Track[], startIndex: number, source: QueueSource, shuffle?: boolean) => void;
  playTrack: (track: Track, context?: Track[], source?: QueueSource) => void;
  playAt: (index: number) => void;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  seek: (sec: number) => void;
  tick: (dt: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setVolume: (v: number) => void;
  setSpeedPitch: (speed: number, pitch: number) => void;
  addToQueue: (tracks: Track[]) => void;
  playNext: (track: Track) => void;
  removeFromQueue: (i: number) => void;
  moveInQueue: (from: number, to: number) => void;
  reorderQueue: (tracks: Track[]) => void;
  clearQueue: () => void;
  stop: () => void;
  setSleepTimer: (minutes: number | "end" | null) => void;
}

const shuffleArr = <T,>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5);

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      queue: [],
      index: -1,
      isPlaying: false,
      progress: 0,
      shuffle: false,
      repeat: "none",
      volume: 0.8,
      speed: 1,
      pitch: 1,
      source: { name: "" },
      sleepTimer: null,

      setQueue: (tracks, startIndex, source, shuffle) => {
        if (!tracks.length) return;
        let list = tracks;
        let idx = startIndex;
        const doShuffle = shuffle ?? get().shuffle;
        if (doShuffle) {
          const first = tracks[startIndex];
          list = [first, ...shuffleArr(tracks.filter((_, i) => i !== startIndex))];
          idx = 0;
        }
        set({ queue: list, index: idx, isPlaying: true, progress: 0, source, shuffle: doShuffle });
        useLibraryStore.getState().recordPlay(list[idx].id);
      },
      playTrack: (track, context, source) => {
        const ctx = context && context.length ? context : [track];
        const i = Math.max(0, ctx.findIndex((t) => t.id === track.id));
        get().setQueue(ctx, i, source ?? { name: track.albumName ?? "Now playing" });
      },
      playAt: (index) => {
        const q = get().queue;
        if (!q[index]) return;
        set({ index, progress: 0, isPlaying: true });
        useLibraryStore.getState().recordPlay(q[index].id);
      },
      togglePlay: () => {
        if (get().index < 0) return;
        set((s) => ({ isPlaying: !s.isPlaying }));
      },
      next: () => {
        const { queue, index, repeat } = get();
        if (!queue.length) return;
        let n = index + 1;
        if (n >= queue.length) {
          if (repeat === "all") n = 0;
          else {
            set({ isPlaying: false, progress: queue[index]?.duration ?? 0 });
            return;
          }
        }
        get().playAt(n);
      },
      previous: () => {
        const { index, progress } = get();
        if (progress > 3 || index === 0) {
          set({ progress: 0 });
          return;
        }
        get().playAt(index - 1);
      },
      seek: (sec) => set({ progress: Math.max(0, sec) }),
      tick: (dt) => {
        const s = get();
        if (!s.isPlaying || s.index < 0) return;
        const cur = s.queue[s.index];
        if (!cur) return;
        const p = s.progress + dt * s.speed;
        if (s.sleepTimer && !s.sleepTimer.endOfSong && Date.now() >= s.sleepTimer.endsAt) {
          set({ isPlaying: false, sleepTimer: null });
          useUiStore.getState().toast("Sleep timer ended — playback paused");
          return;
        }
        if (p >= cur.duration) {
          if (s.repeat === "one") {
            set({ progress: 0 });
            return;
          }
          if (s.sleepTimer?.endOfSong) {
            set({ isPlaying: false, sleepTimer: null, progress: 0 });
            useUiStore.getState().toast("Sleep timer ended — playback paused");
            return;
          }
          get().next();
          return;
        }
        set({ progress: p });
      },
      toggleShuffle: () => {
        const { shuffle, queue, index } = get();
        if (!shuffle && queue.length > 1) {
          const cur = queue[index];
          const rest = shuffleArr(queue.filter((_, i) => i !== index));
          set({ shuffle: true, queue: [cur, ...rest], index: 0 });
        } else set({ shuffle: !shuffle });
      },
      cycleRepeat: () => set((s) => ({ repeat: s.repeat === "none" ? "all" : s.repeat === "all" ? "one" : "none" })),
      setVolume: (v) => set({ volume: Math.min(1, Math.max(0, v)) }),
      setSpeedPitch: (speed, pitch) => set({ speed, pitch }),
      addToQueue: (tracks) => {
        const s = get();
        if (s.index < 0) {
          s.setQueue(tracks, 0, { name: "Queue" });
          return;
        }
        set({ queue: [...s.queue, ...tracks] });
      },
      playNext: (track) => {
        const s = get();
        if (s.index < 0) {
          s.setQueue([track], 0, { name: "Queue" });
          return;
        }
        const q = [...s.queue];
        q.splice(s.index + 1, 0, track);
        set({ queue: q });
      },
      removeFromQueue: (i) => {
        const s = get();
        if (i === s.index) return;
        const q = s.queue.filter((_, k) => k !== i);
        set({ queue: q, index: i < s.index ? s.index - 1 : s.index });
      },
      moveInQueue: (from, to) => {
        const s = get();
        const q = [...s.queue];
        const [item] = q.splice(from, 1);
        q.splice(to, 0, item);
        const cur = s.queue[s.index];
        set({ queue: q, index: q.findIndex((t) => t.id === cur.id && t === cur) });
      },
      reorderQueue: (tracks) => {
        const cur = get().queue[get().index];
        set({ queue: tracks, index: tracks.indexOf(cur) });
      },
      clearQueue: () => {
        const s = get();
        const cur = s.queue[s.index];
        set({ queue: cur ? [cur] : [], index: cur ? 0 : -1 });
      },
      stop: () => set({ queue: [], index: -1, isPlaying: false, progress: 0, sleepTimer: null }),
      setSleepTimer: (minutes) => {
        if (minutes === null) set({ sleepTimer: null });
        else if (minutes === "end") set({ sleepTimer: { endsAt: 0, endOfSong: true } });
        else set({ sleepTimer: { endsAt: Date.now() + minutes * 60000 } });
      },
    }),
    {
      name: "papercraft.player",
      partialize: (s) => ({
        queue: s.queue,
        index: s.index,
        progress: s.progress,
        shuffle: s.shuffle,
        repeat: s.repeat,
        volume: s.volume,
        speed: s.speed,
        pitch: s.pitch,
        source: s.source,
      }),
    },
  ),
);

export const useCurrentTrack = () => usePlayerStore((s) => (s.index >= 0 ? s.queue[s.index] : undefined));
