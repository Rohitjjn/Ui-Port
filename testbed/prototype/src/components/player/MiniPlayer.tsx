import { Art } from "@/components/common";
import { useCurrentTrack, usePlayerStore } from "@/store/playerStore";
import { useLibraryStore } from "@/store/libraryStore";
import { useUiStore } from "@/store/uiStore";
import { cn } from "@/utils/cn";
import { motion } from "framer-motion";
import { Heart, Pause, Play, SkipForward, X } from "lucide-react";

export function MiniPlayer({ className }: { className?: string }) {
  const track = useCurrentTrack();
  const { isPlaying, progress, togglePlay, next, stop } = usePlayerStore();
  const liked = useLibraryStore((s) => (track ? s.favorites.includes(track.id) : false));
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);
  const openPlayer = useUiStore((s) => s.openPlayer);
  if (!track) return null;
  const pct = Math.min(100, (progress / track.duration) * 100);
  return (
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0.2, bottom: 0.4 }}
      onDragEnd={(_, info) => {
        if (info.offset.y > 60) stop();
        else if (info.offset.y < -40) openPlayer();
      }}
      className={cn("relative mx-2 overflow-hidden rounded-lg paper", className)}
    >
      <div className="absolute inset-x-0 top-0 h-[2px] bg-sand">
        <div className="h-full bg-sage transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center gap-3 px-2 py-2">
        <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => openPlayer()} aria-label="Open player">
          <Art palette={track.palette} seed={track.id.charCodeAt(1)} className="h-12 w-12" />
          <div className="min-w-0">
            <div className="truncate text-[14px] font-medium leading-tight">{track.title}</div>
            <div className="truncate text-[12px] text-mute">{track.artistNames.join(", ")}</div>
          </div>
        </button>
        <button type="button" aria-label="Like" onClick={() => toggleFavorite(track.id)} className={cn("hidden rounded-full p-2 sm:block", liked ? "text-rose" : "text-mute")}>
          <Heart size={18} fill={liked ? "currentColor" : "none"} />
        </button>
        <button type="button" aria-label={isPlaying ? "Pause" : "Play"} onClick={togglePlay} className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-paper">
          {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
        </button>
        <button type="button" aria-label="Next" onClick={next} className="rounded-full p-2 text-ink">
          <SkipForward size={20} fill="currentColor" />
        </button>
        <button type="button" aria-label="Stop" onClick={stop} className="hidden rounded-full p-2 text-mute hover:text-ink sm:block">
          <X size={18} />
        </button>
      </div>
    </motion.div>
  );
}
