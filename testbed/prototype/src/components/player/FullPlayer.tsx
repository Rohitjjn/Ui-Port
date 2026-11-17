import { Art, IconButton, Slider } from "@/components/common";
import { TrackRow } from "@/components/cards";
import { LyricsPanel } from "@/features/lyrics/LyricsPanel";
import { QueuePanel } from "@/features/queue/QueuePanel";
import { fmtPlays, fmtTime, mockMusicService } from "@/services/mockMusicService";
import { useLibraryStore } from "@/store/libraryStore";
import { useCurrentTrack, usePlayerStore } from "@/store/playerStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useUiStore } from "@/store/uiStore";
import { cn } from "@/utils/cn";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, Cast, ChevronDown, Gauge, Heart, Info, ListMusic, Maximize2, MicVocal, Moon, MoreHorizontal, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Sparkles, ThumbsDown, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const TABS = [
  { id: "lyrics", label: "Lyrics", icon: MicVocal },
  { id: "queue", label: "Queue", icon: ListMusic },
  { id: "related", label: "Related", icon: Sparkles },
  { id: "info", label: "Info", icon: Info },
] as const;

function Transport({ large }: { large?: boolean }) {
  const { isPlaying, shuffle, repeat, togglePlay, next, previous, toggleShuffle, cycleRepeat, index, queue } = usePlayerStore();
  const RepeatIcon = repeat === "one" ? Repeat1 : Repeat;
  return (
    <div className="flex items-center justify-between">
      <IconButton aria-label="Shuffle" onClick={toggleShuffle} className={cn(shuffle ? "text-sage" : "text-charcoal")}>
        <Shuffle size={20} />
        {shuffle && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-sage" />}
      </IconButton>
      <IconButton aria-label="Previous" size="lg" onClick={previous}>
        <SkipBack size={28} fill="currentColor" />
      </IconButton>
      <button type="button" aria-label={isPlaying ? "Pause" : "Play"} onClick={togglePlay} className={cn("flex items-center justify-center rounded-full bg-ink text-paper shadow-lift transition active:scale-95", large ? "h-[72px] w-[72px]" : "h-16 w-16")}>
        {isPlaying ? <Pause size={30} fill="currentColor" /> : <Play size={30} fill="currentColor" className="ml-1" />}
      </button>
      <IconButton aria-label="Next" size="lg" onClick={next} disabled={index >= queue.length - 1 && repeat !== "all"}>
        <SkipForward size={28} fill="currentColor" />
      </IconButton>
      <IconButton aria-label={`Repeat: ${repeat}`} onClick={cycleRepeat} className={cn("relative", repeat !== "none" ? "text-sage" : "text-charcoal")}>
        <RepeatIcon size={20} />
        {repeat !== "none" && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-sage" />}
      </IconButton>
    </div>
  );
}

function Timeline() {
  const { progress, seek } = usePlayerStore();
  const track = useCurrentTrack();
  const [drag, setDrag] = useState<number | null>(null);
  if (!track) return null;
  const v = drag ?? progress;
  return (
    <div>
      <Slider ariaLabel="Seek" value={v} max={track.duration} step={0.5} onChange={setDrag} onCommit={(x) => { seek(x); setDrag(null); }} />
      <div className="flex justify-between text-[12px] tabular text-mute">
        <span>{fmtTime(v)}</span>
        <span>-{fmtTime(track.duration - v)}</span>
      </div>
    </div>
  );
}

function InfoPanel() {
  const track = useCurrentTrack();
  const speed = usePlayerStore((s) => s.speed);
  const quality = useSettingsStore((s) => s.quality);
  if (!track) return null;
  const rows: [string, string][] = [
    ["Title", track.title],
    ["Artists", track.artistNames.join(", ")],
    ["Album", track.albumName ?? "—"],
    ["Plays", fmtPlays(track.plays)],
    ["BPM", String(track.bpm)],
    ["Key", track.key ?? "—"],
    ["Bitrate", quality === "Low" ? "48 kbps" : quality === "Medium" ? "128 kbps" : "256 kbps (simulated)"],
    ["Codec", "opus (simulated)"],
    ["Mime type", "audio/webm"],
    ["itag", "251"],
    ["Playback speed", `${speed}×`],
  ];
  return (
    <div className="divide-y divide-line">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 py-2.5 text-[14px]">
          <span className="text-mute">{k}</span>
          <span className="truncate text-right">{v}</span>
        </div>
      ))}
    </div>
  );
}

function RelatedPanel() {
  const track = useCurrentTrack();
  if (!track) return null;
  const rel = mockMusicService.related(track);
  return (
    <div>
      <div className="kicker mb-2">You might also like</div>
      {rel.map((t) => (
        <TrackRow key={t.id} track={t} context={rel} sourceName="Related" dense />
      ))}
    </div>
  );
}

export function FullPlayer() {
  const open = useUiStore((s) => s.playerOpen);
  const close = useUiStore((s) => s.closePlayer);
  const tab = useUiStore((s) => s.playerTab);
  const setTab = useUiStore((s) => s.setPlayerTab);
  const openSheet = useUiStore((s) => s.openSheet);
  const toast = useUiStore((s) => s.toast);
  const setFullscreen = useUiStore((s) => s.setFullscreen);
  const track = useCurrentTrack();
  const { source, volume, setVolume, sleepTimer, speed, next, previous } = usePlayerStore();
  const liked = useLibraryStore((s) => (track ? s.favorites.includes(track.id) : false));
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);
  const [disliked, setDisliked] = useState(false);
  const nav = useNavigate();
  const [showPanel, setShowPanel] = useState(false);
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    if (!track && open) close();
  }, [track, open, close]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const goArtist = () => { close(); nav(`/artist/${track!.artistIds[0]}`); };

  return (
    <AnimatePresence>
      {open && track && (
        <motion.div
          key="player"
          className="fixed inset-0 z-[60] flex flex-col bg-paper lg:bg-ink/40 lg:backdrop-blur-sm"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 300, damping: 34 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.3 }}
          onDragEnd={(_, i) => i.offset.y > 120 && close()}
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden lg:hidden">
            <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full opacity-25 blur-3xl" style={{ background: `radial-gradient(circle, var(--color-olive), transparent 70%)` }} />
          </div>
          <div className="relative mx-auto flex h-full w-full max-w-6xl flex-col lg:my-6 lg:h-[calc(100%-48px)] lg:flex-row lg:overflow-hidden lg:rounded-xl lg:bg-paper lg:shadow-lift">
            {/* Left / main column */}
            <div className="flex min-h-0 flex-1 flex-col px-5 pt-3 lg:w-1/2 lg:px-10 lg:pt-6 safe-bottom">
              <div className="flex items-center justify-between">
                <IconButton aria-label="Collapse" onClick={close}><ChevronDown size={24} /></IconButton>
                <div className="text-center">
                  <div className="kicker">{source.isRadio ? "Radio" : "Playing from"}</div>
                  <div className="max-w-[220px] truncate text-[13px] font-medium">{source.name || "Now playing"}</div>
                </div>
                <IconButton aria-label="More" onClick={() => openSheet({ kind: "track", track })}><MoreHorizontal size={22} /></IconButton>
              </div>

              <div className="flex min-h-0 flex-1 flex-col justify-center">
                <motion.div
                  key={track.id}
                  initial={{ scale: 0.96, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="relative mx-auto my-4 w-full max-w-[min(78vw,380px)] lg:max-w-[420px]"
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.3}
                  onDragEnd={(_, i) => (i.offset.x < -80 ? next() : i.offset.x > 80 ? previous() : null)}
                >
                  <div className="rounded-md bg-card p-2 shadow-art">
                    <Art palette={track.palette} seed={track.id.charCodeAt(1)} className="aspect-square w-full" alt={track.title} />
                  </div>
                  <button type="button" aria-label="Fullscreen" onClick={() => setFullscreen(true)} className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-ink/70 px-2 py-1 text-[11px] text-paper">
                    <Maximize2 size={12} /> {track.isVideo ? "Video" : "Fullscreen"}
                  </button>
                </motion.div>

                <div className="mt-2 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-serif text-[26px] leading-tight">{track.title}</h2>
                    <button type="button" onClick={goArtist} className="truncate text-[15px] text-sage hover:underline">{track.artistNames.join(", ")}</button>
                  </div>
                  <button type="button" aria-label="Dislike on YouTube" onClick={() => { setDisliked((d) => !d); toast(disliked ? "Dislike removed" : "Disliked (simulated)"); }} className={cn("rounded-full p-2", disliked ? "text-ink" : "text-mute")}>
                    <ThumbsDown size={20} fill={disliked ? "currentColor" : "none"} />
                  </button>
                  <button type="button" aria-label="Like" onClick={() => { toggleFavorite(track.id); setBurst((b) => b + 1); }} className={cn("relative rounded-full p-2", liked ? "text-rose" : "text-mute")}>
                    <Heart size={24} fill={liked ? "currentColor" : "none"} />
                    {burst > 0 && liked && (
                      <motion.span key={burst} className="absolute inset-0 rounded-full border-2 border-rose" initial={{ scale: 0.6, opacity: 1 }} animate={{ scale: 1.8, opacity: 0 }} transition={{ duration: 0.5 }} />
                    )}
                  </button>
                </div>

                <div className="mt-4"><Timeline /></div>
                <div className="mt-2"><Transport large /></div>

                <div className="mt-5 flex items-center justify-between text-mute">
                  <IconButton size="sm" aria-label="Output" onClick={() => openSheet({ kind: "output" })}><Cast size={18} /></IconButton>
                  <div className="hidden items-center gap-2 sm:flex">
                    <Volume2 size={16} />
                    <Slider ariaLabel="Volume" value={volume} max={1} step={0.01} onChange={setVolume} className="w-28" />
                  </div>
                  <button type="button" onClick={() => openSheet({ kind: "speedPitch" })} className={cn("flex items-center gap-1 rounded-full px-2 py-1 text-[12px]", speed !== 1 && "bg-ivory text-ink")}>
                    <Gauge size={16} /> {speed}×
                  </button>
                  <IconButton size="sm" aria-label="Sleep timer" onClick={() => openSheet({ kind: "sleepTimer" })} className={cn(sleepTimer && "text-sage")}><Moon size={18} /></IconButton>
                  <IconButton size="sm" aria-label="Comments" onClick={() => openSheet({ kind: "comments", track })}><MessageCircle size={18} /></IconButton>
                </div>
              </div>

              {/* mobile tab bar */}
              <div className="mt-3 flex items-center justify-around border-t border-line py-2 lg:hidden">
                {TABS.map((t) => (
                  <button key={t.id} type="button" onClick={() => { setTab(t.id); setShowPanel(true); }} className="flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] text-charcoal">
                    <t.icon size={20} /> {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Right column (desktop) */}
            <div className="hidden min-h-0 w-1/2 flex-col border-l border-line bg-card/60 p-6 lg:flex">
              <div className="mb-4 flex gap-1 rounded-full bg-ivory p-1">
                {TABS.map((t) => (
                  <button key={t.id} type="button" onClick={() => setTab(t.id)} className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[13px] font-medium transition", tab === t.id ? "bg-card text-ink shadow-paper" : "text-charcoal")}>
                    <t.icon size={15} /> {t.label}
                  </button>
                ))}
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                {tab === "lyrics" && <LyricsPanel track={track} />}
                {tab === "queue" && <QueuePanel />}
                {tab === "related" && <div className="h-full overflow-y-auto"><RelatedPanel /></div>}
                {tab === "info" && <div className="h-full overflow-y-auto"><InfoPanel /></div>}
              </div>
            </div>
          </div>

          {/* mobile panel sheet */}
          <AnimatePresence>
            {showPanel && (
              <motion.div className="fixed inset-x-0 bottom-0 top-[12dvh] z-[65] flex flex-col rounded-t-xl bg-card shadow-lift lg:hidden" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 340, damping: 34 }}>
                <div className="flex items-center justify-between px-4 pt-3">
                  <div className="flex gap-1 rounded-full bg-ivory p-1">
                    {TABS.map((t) => (
                      <button key={t.id} type="button" onClick={() => setTab(t.id)} className={cn("rounded-full px-3 py-1.5 text-[12px] font-medium", tab === t.id ? "bg-card shadow-paper" : "text-charcoal")}>{t.label}</button>
                    ))}
                  </div>
                  <IconButton size="sm" aria-label="Close panel" onClick={() => setShowPanel(false)}><ChevronDown size={20} /></IconButton>
                </div>
                <div className="min-h-0 flex-1 overflow-hidden px-4 pb-4 pt-2 safe-bottom">
                  {tab === "lyrics" && <LyricsPanel track={track} />}
                  {tab === "queue" && <QueuePanel />}
                  {tab === "related" && <div className="h-full overflow-y-auto"><RelatedPanel /></div>}
                  {tab === "info" && <div className="h-full overflow-y-auto"><InfoPanel /></div>}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
