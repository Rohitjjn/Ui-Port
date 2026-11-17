import { IconButton, Slider } from "@/components/common";
import { lyricsFor } from "@/data/mockData";
import { fmtTime } from "@/services/mockMusicService";
import { useCurrentTrack, usePlayerStore } from "@/store/playerStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useUiStore } from "@/store/uiStore";
import { artwork } from "@/utils/artwork";
import { cn } from "@/utils/cn";
import { AnimatePresence, motion } from "framer-motion";
import { Captions, CaptionsOff, Info, Minimize2, MoreVertical, Pause, PictureInPicture2, Play, RotateCcw, RotateCw, Share2, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

/**
 * Mirrors FullscreenPlayer.kt + FullscreenLyricsContent.kt:
 * landscape video/artwork surface, overlay transport, ±5s, lyrics toggle, mute, PiP, share lyrics.
 */
export function FullscreenPlayer() {
  const open = useUiStore((s) => s.fullscreen);
  const setOpen = useUiStore((s) => s.setFullscreen);
  const openSheet = useUiStore((s) => s.openSheet);
  const toast = useUiStore((s) => s.toast);
  const track = useCurrentTrack();
  const { isPlaying, progress, togglePlay, next, previous, seek, volume, setVolume } = usePlayerStore();
  const { lyricsOffset, crossfade } = useSettingsStore();
  const [showLyrics, setShowLyrics] = useState(true);
  const [muted, setMuted] = useState(false);
  const [controls, setControls] = useState(true);

  useEffect(() => {
    if (!open || !controls) return;
    const t = setTimeout(() => setControls(false), 3500);
    return () => clearTimeout(t);
  }, [open, controls, progress]);

  const lines = useMemo(() => (track ? lyricsFor(track) : null), [track]);
  const activeIdx = useMemo(() => {
    if (!lines) return -1;
    const t = progress + lyricsOffset / 1000;
    let i = -1;
    lines.forEach((l, k) => l.time <= t && (i = k));
    return i;
  }, [lines, progress, lyricsOffset]);

  if (!track) return null;
  const isCrossfading = crossfade && track.duration - progress < 6;

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[66] bg-ink text-paper" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setControls((c) => !c)}>
          <img src={artwork(track.palette, track.id.charCodeAt(1), "wide")} alt="" className={cn("absolute inset-0 h-full w-full object-cover transition-opacity duration-700", showLyrics ? "opacity-25 blur-sm" : "opacity-90")} />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/20 to-ink/60" />

          {showLyrics && (
            <div className={cn("absolute inset-x-0 flex flex-col items-center justify-center px-6 text-center transition-all", controls ? "bottom-[46%] top-20 sm:bottom-28" : "bottom-28 top-20")}>
              {!lines ? (
                <p className="font-serif text-[24px] text-paper/60">Lyrics unavailable</p>
              ) : (
                [-1, 0, 1, 2].map((d) => {
                  const l = lines[activeIdx + d];
                  if (!l) return <div key={d} className="h-10" />;
                  return (
                    <motion.p key={activeIdx + d} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: d === 0 ? 1 : d < 0 ? 0.35 : 0.55, y: 0, scale: d === 0 ? 1 : 0.9 }} className={cn("max-w-3xl py-2 font-serif leading-tight", d === 0 ? "text-[34px] lg:text-[48px]" : "text-[24px] lg:text-[30px]")}>
                      {l.text}
                    </motion.p>
                  );
                })
              )}
              {isCrossfading && <span className="mt-4 rounded-full bg-paper/15 px-3 py-1 text-[11px] uppercase tracking-widest">Crossfading</span>}
            </div>
          )}

          <AnimatePresence>
            {controls && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-2 p-4">
                  <IconButton aria-label="Exit fullscreen" onClick={() => setOpen(false)} className="text-paper hover:bg-paper/10"><Minimize2 size={22} /></IconButton>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-serif text-[20px]">{track.title}</div>
                    <div className="truncate text-[13px] text-paper/70">{track.artistNames.join(", ")}</div>
                  </div>
                  <IconButton aria-label={showLyrics ? "Hide lyrics" : "Show lyrics"} onClick={() => setShowLyrics((v) => !v)} className="text-paper hover:bg-paper/10">{showLyrics ? <Captions size={22} /> : <CaptionsOff size={22} />}</IconButton>
                  <IconButton aria-label="Picture in picture" onClick={() => toast("Picture-in-picture needs the native video surface")} className="hidden text-paper hover:bg-paper/10 sm:inline-flex"><PictureInPicture2 size={20} /></IconButton>
                  <IconButton aria-label="Share lyrics"  onClick={() => lines && openSheet({ kind: "shareLyrics", track, lines: [lines[Math.max(0, activeIdx)].text] })} className="hidden text-paper hover:bg-paper/10 sm:inline-flex" disabled={!lines}><Share2 size={20} /></IconButton>
                  <IconButton aria-label="Song info"  onClick={() => openSheet({ kind: "songInfo", track })} className="hidden text-paper hover:bg-paper/10 sm:inline-flex"><Info size={20} /></IconButton>
                  <IconButton aria-label="More" onClick={() => openSheet({ kind: "track", track })} className="text-paper hover:bg-paper/10"><MoreVertical size={20} /></IconButton>
                </div>
                <div className="flex flex-1 items-end justify-center gap-3 pb-6 sm:items-center sm:gap-6 sm:pb-0">
                  <IconButton size="lg" aria-label="Previous" onClick={previous} className="text-paper hover:bg-paper/10"><SkipBack size={30} fill="currentColor" /></IconButton>
                  <IconButton size="lg" aria-label="Rewind 5 seconds" onClick={() => seek(Math.max(0, progress - 5))} className="text-paper hover:bg-paper/10"><RotateCcw size={26} /></IconButton>
                  <button type="button" aria-label={isPlaying ? "Pause" : "Play"} onClick={togglePlay} className="flex h-16 w-16 items-center sm:h-20 sm:w-20 justify-center rounded-full bg-paper text-ink shadow-lift">{isPlaying ? <Pause size={34} fill="currentColor" /> : <Play size={34} fill="currentColor" className="ml-1" />}</button>
                  <IconButton size="lg" aria-label="Forward 5 seconds" onClick={() => seek(Math.min(track.duration, progress + 5))} className="text-paper hover:bg-paper/10"><RotateCw size={26} /></IconButton>
                  <IconButton size="lg" aria-label="Next" onClick={next} className="text-paper hover:bg-paper/10"><SkipForward size={30} fill="currentColor" /></IconButton>
                </div>
                <div className="flex items-center gap-3 px-6 pb-6 text-[12px] tabular text-paper/80">
                  <span>{fmtTime(progress)}</span>
                  <div className="flex-1 [&_.slider::-webkit-slider-runnable-track]:bg-paper/30"><Slider ariaLabel="Seek" value={progress} max={track.duration} step={0.5} onChange={seek} /></div>
                  <span>{fmtTime(track.duration)}</span>
                  <IconButton size="sm" aria-label={muted ? "Unmute" : "Mute"} onClick={() => { setMuted((m) => !m); setVolume(muted ? 0.8 : 0); }} className="text-paper hover:bg-paper/10">{muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}</IconButton>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
