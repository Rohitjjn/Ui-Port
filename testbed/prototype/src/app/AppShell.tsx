import { Botanical, IconButton, Toast } from "@/components/common";
import { FullPlayer } from "@/components/player/FullPlayer";
import { FullscreenPlayer } from "@/components/player/FullscreenPlayer";
import { SelectionBar } from "@/components/selection/SelectionBar";
import { MiniPlayer } from "@/components/player/MiniPlayer";
import { SheetHost } from "@/components/sheets/SheetHost";
import { useLibraryStore } from "@/store/libraryStore";
import { useCurrentTrack, usePlayerStore } from "@/store/playerStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useUiStore } from "@/store/uiStore";
import { cn } from "@/utils/cn";
import { BarChart3, Heart, Home, Library, ListMusic, Pause, Play, Plus, Repeat, Repeat1, Search, Settings, Shuffle, SkipBack, SkipForward, Sparkles, Volume2 } from "lucide-react";
import { useEffect } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Art, Slider } from "@/components/common";
import { fmtTime } from "@/services/mockMusicService";
import { AnimatePresence, motion } from "framer-motion";

function useTheme() {
  const mode = useSettingsStore((s) => s.themeMode);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = mode === "dark" || (mode === "system" && mq.matches);
      document.documentElement.classList.toggle("dark", dark);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [mode]);
}

function useClock() {
  const tick = usePlayerStore((s) => s.tick);
  useEffect(() => {
    const id = setInterval(() => tick(0.5), 500);
    return () => clearInterval(id);
  }, [tick]);
}

function useKeyboard() {
  const { togglePlay, next, previous } = usePlayerStore();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "Space") { e.preventDefault(); togglePlay(); }
      if (e.key === "ArrowRight" && e.shiftKey) next();
      if (e.key === "ArrowLeft" && e.shiftKey) previous();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, next, previous]);
}

function useNavItems() {
  const { showMixTab, showAnalyticsTab } = useSettingsStore();
  return [
    { to: "/", label: "Home", icon: Home },
    { to: "/search", label: "Search", icon: Search },
    ...(showMixTab ? [{ to: "/mix", label: "Mix", icon: Sparkles }] : []),
    ...(showAnalyticsTab ? [{ to: "/analytics", label: "Stats", icon: BarChart3 }] : []),
    { to: "/library", label: "Library", icon: Library },
  ];
}

function BottomNav() {
  const items = useNavItems();
  return (
    <nav className="border-t border-line bg-paper/90 backdrop-blur-md safe-bottom">
      <div className="flex items-stretch justify-around">
        {items.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.to === "/"} className={({ isActive }) => cn("flex min-w-[64px] flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition", isActive ? "text-ink" : "text-mute")}>
            {({ isActive }) => (
              <>
                <span className={cn("flex h-8 w-14 items-center justify-center rounded-full transition", isActive && "bg-ivory")}><it.icon size={20} strokeWidth={isActive ? 2.4 : 2} /></span>
                {it.label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function Sidebar() {
  const items = useNavItems();
  const playlists = useLibraryStore((s) => s.playlists);
  const openSheet = useUiStore((s) => s.openSheet);
  const nav = useNavigate();
  const loc = useLocation();
  return (
    <aside className="hidden w-[264px] shrink-0 flex-col border-r border-line bg-ivory/40 lg:flex">
      <div className="flex items-center gap-2 px-6 pb-4 pt-6">
        <Botanical className="h-8 w-8 text-sage" />
        <div>
          <div className="font-serif text-[20px] leading-none">SimpMusic</div>
          <div className="kicker mt-1">PaperCraft</div>
        </div>
      </div>
      <nav className="space-y-0.5 px-3">
        {items.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.to === "/"} className={({ isActive }) => cn("flex items-center gap-3 rounded-md px-3 py-2.5 text-[14px] font-medium transition", isActive ? "bg-card text-ink shadow-paper" : "text-charcoal hover:bg-ivory")}>
            <it.icon size={18} /> {it.label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-6 px-3">
        <div className="mb-1 flex items-center justify-between px-3">
          <span className="kicker">Your library</span>
          <button type="button" aria-label="Create playlist" onClick={() => openSheet({ kind: "createPlaylist" })} className="rounded-full p-1 text-mute hover:bg-ivory hover:text-ink"><Plus size={16} /></button>
        </div>
        <button type="button" onClick={() => nav("/library/favorite")} className={cn("flex w-full items-center gap-3 rounded-md px-3 py-2 text-[14px] text-charcoal hover:bg-ivory", loc.pathname === "/library/favorite" && "bg-card shadow-paper")}><Heart size={16} className="text-rose" /> Liked songs</button>
        <div className="max-h-[32vh] overflow-y-auto">
          {playlists.map((p) => (
            <button key={p.id} type="button" onClick={() => nav(`/playlist/${p.id}`)} className={cn("flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-[14px] text-charcoal hover:bg-ivory", loc.pathname === `/playlist/${p.id}` && "bg-card shadow-paper")}>
              <ListMusic size={16} className="shrink-0" /> <span className="truncate">{p.title}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="mt-auto px-3 pb-4">
        <NavLink to="/settings" className={({ isActive }) => cn("flex items-center gap-3 rounded-md px-3 py-2.5 text-[14px] text-charcoal hover:bg-ivory", isActive && "bg-card shadow-paper text-ink")}><Settings size={18} /> Settings</NavLink>
        <p className="mt-3 px-3 text-[11px] leading-relaxed text-mute">Web prototype · playback is simulated. No audio is streamed.</p>
      </div>
    </aside>
  );
}

function DesktopPlayerBar() {
  const track = useCurrentTrack();
  const { isPlaying, progress, togglePlay, next, previous, shuffle, repeat, toggleShuffle, cycleRepeat, seek, volume, setVolume } = usePlayerStore();
  const liked = useLibraryStore((s) => (track ? s.favorites.includes(track.id) : false));
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);
  const openPlayer = useUiStore((s) => s.openPlayer);
  if (!track) return null;
  const RepeatIcon = repeat === "one" ? Repeat1 : Repeat;
  return (
    <div className="hidden h-[88px] items-center gap-6 border-t border-line bg-card/90 px-6 backdrop-blur-md lg:flex">
      <button type="button" onClick={() => openPlayer()} className="flex w-[280px] min-w-0 items-center gap-3 text-left">
        <Art palette={track.palette} seed={track.id.charCodeAt(1)} className="h-14 w-14 shadow-art" />
        <div className="min-w-0">
          <div className="truncate text-[14px] font-medium">{track.title}</div>
          <div className="truncate text-[12px] text-mute">{track.artistNames.join(", ")}</div>
        </div>
        <button type="button" aria-label="Like" onClick={(e) => { e.stopPropagation(); toggleFavorite(track.id); }} className={cn("ml-1 p-2", liked ? "text-rose" : "text-mute")}><Heart size={18} fill={liked ? "currentColor" : "none"} /></button>
      </button>
      <div className="flex flex-1 flex-col items-center gap-1">
        <div className="flex items-center gap-2">
          <IconButton size="sm" aria-label="Shuffle" onClick={toggleShuffle} className={cn(shuffle && "text-sage")}><Shuffle size={16} /></IconButton>
          <IconButton size="sm" aria-label="Previous" onClick={previous}><SkipBack size={20} fill="currentColor" /></IconButton>
          <button type="button" aria-label={isPlaying ? "Pause" : "Play"} onClick={togglePlay} className="flex h-11 w-11 items-center justify-center rounded-full bg-ink text-paper">{isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}</button>
          <IconButton size="sm" aria-label="Next" onClick={next}><SkipForward size={20} fill="currentColor" /></IconButton>
          <IconButton size="sm" aria-label="Repeat" onClick={cycleRepeat} className={cn(repeat !== "none" && "text-sage")}><RepeatIcon size={16} /></IconButton>
        </div>
        <div className="flex w-full max-w-xl items-center gap-3 text-[11px] tabular text-mute">
          <span>{fmtTime(progress)}</span>
          <Slider ariaLabel="Seek" value={progress} max={track.duration} step={0.5} onChange={seek} />
          <span>{fmtTime(track.duration)}</span>
        </div>
      </div>
      <div className="flex w-[280px] items-center justify-end gap-2">
        <IconButton size="sm" aria-label="Lyrics" onClick={() => openPlayer("lyrics")}><Sparkles size={18} /></IconButton>
        <IconButton size="sm" aria-label="Queue" onClick={() => openPlayer("queue")}><ListMusic size={18} /></IconButton>
        <Volume2 size={16} className="text-mute" />
        <Slider ariaLabel="Volume" value={volume} max={1} step={0.01} onChange={setVolume} className="w-24" />
      </div>
    </div>
  );
}

export function AppShell() {
  useTheme();
  useClock();
  useKeyboard();
  const track = useCurrentTrack();
  const loc = useLocation();
  useEffect(() => {
    document.querySelector("main")?.scrollTo({ top: 0 });
    useUiStore.getState().exitSelection();
  }, [loc.pathname]);
  return (
    <div className="relative z-10 flex h-dvh overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={loc.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className={cn("mx-auto w-full max-w-[1280px] px-4 pt-2 lg:px-10 lg:pt-6", track ? "pb-[150px] lg:pb-10" : "pb-[84px] lg:pb-10")}>
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
        <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
          {track && <MiniPlayer className="mb-1.5" />}
          <BottomNav />
        </div>
        <DesktopPlayerBar />
      </div>
      <FullPlayer />
      <FullscreenPlayer />
      <SelectionBar />
      <SheetHost />
      <Toast />
    </div>
  );
}
