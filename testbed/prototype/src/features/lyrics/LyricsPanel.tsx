import { Button, Chip, Empty, Loading } from "@/components/common";
import { mockMusicService } from "@/services/mockMusicService";
import { usePlayerStore } from "@/store/playerStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useUiStore } from "@/store/uiStore";
import type { LyricLine, Track } from "@/types";
import { cn } from "@/utils/cn";
import { AArrowDown, AArrowUp, Minus, Plus, Share2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const PROVIDER_LABEL = { simpmusic: "SimpMusic Lyrics", lrclib: "LRCLIB", spotify: "Spotify", youtube_transcript: "YouTube transcript" };

export function LyricsPanel({ track, compact }: { track: Track; compact?: boolean }) {
  const [lines, setLines] = useState<LyricLine[] | null | "loading">("loading");
  const progress = usePlayerStore((s) => s.progress);
  const seek = usePlayerStore((s) => s.seek);
  const { lyricsProvider, lyricsOffset, lyricsFontScale, set, romanization } = useSettingsStore();
  const openSheet = useUiStore((s) => s.openSheet);
  const toast = useUiStore((s) => s.toast);
  const ref = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<number[]>([]);

  useEffect(() => {
    let alive = true;
    setLines("loading");
    mockMusicService.getLyrics(track).then((l) => alive && setLines(l));
    return () => {
      alive = false;
    };
  }, [track.id, lyricsProvider]);

  const t = progress + lyricsOffset / 1000;
  const activeIdx = useMemo(() => {
    if (!Array.isArray(lines)) return -1;
    let idx = -1;
    lines.forEach((l, i) => l.time <= t && (idx = i));
    return idx;
  }, [lines, t]);

  useEffect(() => {
    if (activeIdx < 0 || !ref.current) return;
    const el = ref.current.querySelector<HTMLElement>(`[data-i="${activeIdx}"]`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeIdx]);

  if (lines === "loading") return <Loading label="Fetching lyrics" />;
  if (!lines)
    return (
      <Empty title="Lyrics unavailable" body={`No lyrics found on ${PROVIDER_LABEL[lyricsProvider]} for this track.`} action={
        <div className="flex gap-2">
          <Button variant="soft" size="sm" onClick={() => openSheet({ kind: "lyricsProvider" })}>Change provider</Button>
          <Button size="sm" onClick={() => openSheet({ kind: "addLyrics", track })}>Add lyrics</Button>
        </div>
      } />
    );

  return (
    <div className="flex h-full flex-col">
      <div ref={ref} className={cn("min-h-0 flex-1 overflow-y-auto scroll-smooth px-1 py-6", compact ? "max-h-[50dvh]" : "")}>
        {lines.map((l, i) => (
          <button
            key={i}
            data-i={i}
            type="button"
            onClick={() => (selected.length ? setSelected((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i].slice(-4))) : seek(l.time))}
            onContextMenu={(e) => { e.preventDefault(); setSelected([i]); }}
            className={cn("block w-full py-2 text-left font-serif transition-all duration-300", selected.includes(i) ? "text-sage underline decoration-sage/40" : i === activeIdx ? "text-ink" : i < activeIdx ? "text-mute/70" : "text-mute")}
            style={{ fontSize: `${22 * lyricsFontScale}px`, lineHeight: 1.3, transform: i === activeIdx ? "scale(1.02)" : undefined, transformOrigin: "left" }}
          >
            {l.text}
            {romanization && <span className="block text-[0.6em] text-mute/70">({l.text.toLowerCase()})</span>}
          </button>
        ))}
        <div className="pt-6 text-[12px] text-mute">Source: {PROVIDER_LABEL[lyricsProvider]} · simulated sync</div>
      </div>
      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto border-t border-line pt-3">
        <Chip onClick={() => openSheet({ kind: "lyricsProvider" })}>{PROVIDER_LABEL[lyricsProvider]}</Chip>
        <div className="flex items-center rounded-full bg-ivory">
          <button type="button" aria-label="Offset −100ms" className="p-2" onClick={() => set("lyricsOffset", lyricsOffset - 100)}><Minus size={14} /></button>
          <span className="w-16 text-center text-[12px] tabular">{lyricsOffset > 0 ? "+" : ""}{lyricsOffset} ms</span>
          <button type="button" aria-label="Offset +100ms" className="p-2" onClick={() => set("lyricsOffset", lyricsOffset + 100)}><Plus size={14} /></button>
        </div>
        <div className="flex items-center rounded-full bg-ivory">
          <button type="button" aria-label="Smaller text" className="p-2" onClick={() => set("lyricsFontScale", Math.max(0.7, +(lyricsFontScale - 0.1).toFixed(1)))}><AArrowDown size={16} /></button>
          <button type="button" aria-label="Larger text" className="p-2" onClick={() => set("lyricsFontScale", Math.min(1.6, +(lyricsFontScale + 0.1).toFixed(1)))}><AArrowUp size={16} /></button>
        </div>
        <Chip onClick={() => {
          if (!selected.length) { toast("Long-press / right-click a line to select, then share"); setSelected([activeIdx >= 0 ? activeIdx : 0]); return; }
          openSheet({ kind: "shareLyrics", track, lines: selected.sort((a, b) => a - b).map((i) => lines[i].text) });
          setSelected([]);
        }}>
          <span className="flex items-center gap-1"><Share2 size={14} /> Share{selected.length ? ` (${selected.length})` : ""}</span>
        </Chip>
      </div>
    </div>
  );
}
