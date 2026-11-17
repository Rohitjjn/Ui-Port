import { Art, Button } from "@/components/common";
import { PlayingBars } from "@/components/cards";
import { usePlayerStore } from "@/store/playerStore";
import { useUiStore } from "@/store/uiStore";
import type { Track } from "@/types";
import { fmtTime } from "@/services/mockMusicService";
import { cn } from "@/utils/cn";
import { Reorder, useDragControls } from "framer-motion";
import { GripVertical, ListPlus, MoreHorizontal, Trash2 } from "lucide-react";

function QueueItem({ track, index, isCurrent }: { track: Track; index: number; isCurrent: boolean }) {
  const controls = useDragControls();
  const { playAt, removeFromQueue, isPlaying } = usePlayerStore();
  const openSheet = useUiStore((s) => s.openSheet);
  return (
    <Reorder.Item value={track} dragListener={false} dragControls={controls} className={cn("flex items-center gap-2 rounded-md bg-card px-1 py-1.5", isCurrent && "bg-ivory")}>
      <button type="button" aria-label="Reorder" onPointerDown={(e) => controls.start(e)} className="cursor-grab touch-none p-2 text-mute active:cursor-grabbing">
        <GripVertical size={18} />
      </button>
      <button type="button" onClick={() => playAt(index)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <Art palette={track.palette} seed={track.id.charCodeAt(1)} className="h-11 w-11" />
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-[14px]", isCurrent && "text-sage")}>{track.title}</span>
          <span className="block truncate text-[12px] text-mute">{track.artistNames.join(", ")} · <span className="tabular">{fmtTime(track.duration)}</span></span>
        </span>
        {isCurrent && <PlayingBars paused={!isPlaying} />}
      </button>
      <button type="button" aria-label="Options" onClick={() => openSheet({ kind: "track", track, queueIndex: index })} className="p-2 text-mute hover:text-ink">
        <MoreHorizontal size={18} />
      </button>
      {!isCurrent && (
        <button type="button" aria-label="Remove from queue" onClick={() => removeFromQueue(index)} className="p-2 text-mute hover:text-rose">
          <Trash2 size={16} />
        </button>
      )}
    </Reorder.Item>
  );
}

export function QueuePanel() {
  const { queue, index, reorderQueue, clearQueue, source } = usePlayerStore();
  const openSheet = useUiStore((s) => s.openSheet);
  const toast = useUiStore((s) => s.toast);
  const upcoming = queue.length - index - 1;
  const total = queue.slice(index).reduce((a, t) => a + t.duration, 0);
  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="kicker">{source.isRadio ? "Radio" : "Playing from"}</div>
          <div className="font-serif text-[18px]">{source.name || "Queue"}</div>
        </div>
        <div className="text-right text-[12px] text-mute">
          {upcoming} up next · {Math.round(total / 60)} min
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Reorder.Group axis="y" values={queue} onReorder={reorderQueue} className="space-y-0.5">
          {queue.map((t, i) => (
            <QueueItem key={`${t.id}-${i}`} track={t} index={i} isCurrent={i === index} />
          ))}
        </Reorder.Group>
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant="soft" size="sm" icon={<ListPlus size={16} />} onClick={() => openSheet({ kind: "createPlaylist", addTracks: queue })}>
          Save as playlist
        </Button>
        <Button variant="soft" size="sm" icon={<Trash2 size={16} />} onClick={() => { clearQueue(); toast("Queue cleared"); }} disabled={queue.length <= 1}>
          Clear
        </Button>
      </div>
    </div>
  );
}
