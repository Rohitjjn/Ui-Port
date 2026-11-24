import { Art, Mosaic } from "@/components/common";
import { usePlayerStore, useCurrentTrack } from "@/store/playerStore";
import { useLibraryStore } from "@/store/libraryStore";
import { useUiStore } from "@/store/uiStore";
import type { Album, Artist, Playlist, Track } from "@/types";
import { cn } from "@/utils/cn";
import { fmtTime } from "@/services/mockMusicService";
import { Check, Download, GripVertical, Heart, MoreHorizontal, Play, Video } from "lucide-react";
import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { ReactNode } from "react";

export function PlayingBars({ paused }: { paused?: boolean }) {
  return (
    <span className="flex h-4 items-end gap-[3px]" aria-label="Now playing">
      {[0, 1, 2].map((i) => (
        <span key={i} className={cn("w-[3px] rounded-sm bg-sage", !paused && "eq-bar")} style={{ height: paused ? 6 : 16 }} />
      ))}
    </span>
  );
}

/* ---------- Track row ---------- */
export function TrackRow({
  track,
  context,
  sourceName,
  index,
  showArt = true,
  showAlbum,
  dense,
  trailing,
  dragHandle,
  fromPlaylistId,
  onClick,
  className,
}: {
  track: Track;
  context?: Track[];
  sourceName?: string;
  index?: number;
  showArt?: boolean;
  showAlbum?: boolean;
  dense?: boolean;
  trailing?: ReactNode;
  dragHandle?: boolean;
  fromPlaylistId?: string;
  onClick?: () => void;
  className?: string;
}) {
  const playTrack = usePlayerStore((s) => s.playTrack);
  const current = useCurrentTrack();
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const liked = useLibraryStore((s) => s.favorites.includes(track.id));
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);
  const dl = useLibraryStore((s) => s.downloads[track.id]);
  const openSheet = useUiStore((s) => s.openSheet);
  const active = current?.id === track.id;
  const nav = useNavigate();
  const selection = useUiStore((s) => s.selection);
  const toggleSelected = useUiStore((s) => s.toggleSelected);
  const startSelection = useUiStore((s) => s.startSelection);
  const selecting = selection !== null;
  const selected = !!selection?.includes(track.id);
  const pressTimer = useRef<number | null>(null);
  const startPress = () => { pressTimer.current = window.setTimeout(() => { startSelection(track.id); pressTimer.current = null; }, 550); };
  const cancelPress = () => { if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; } };

  if (selecting) {
    return (
      <button type="button" onClick={() => toggleSelected(track.id)} className={cn("flex w-full items-center gap-3 rounded-md px-2 text-left transition", dense ? "py-1.5" : "py-2", selected ? "bg-sage/15" : "hover:bg-ivory/80", className)}>
        <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2", selected ? "border-sage bg-sage text-paper" : "border-sand")}>{selected && <Check size={14} />}</span>
        {showArt && <Art palette={track.palette} seed={track.id.charCodeAt(1)} className={dense ? "h-10 w-10" : "h-12 w-12"} />}
        <span className="min-w-0 flex-1"><span className="block truncate text-[15px]">{track.title}</span><span className="block truncate text-[13px] text-mute">{track.artistNames.join(", ")}</span></span>
      </button>
    );
  }

  return (
    <div
      className={cn("group flex w-full items-center gap-3 rounded-md px-2 text-left transition hover:bg-ivory/80", dense ? "py-1.5" : "py-2", active && "bg-ivory/70", className)}
      onContextMenu={(e) => {
        e.preventDefault();
        openSheet({ kind: "track", track, fromPlaylistId });
      }}
      onTouchStart={startPress}
      onTouchEnd={cancelPress}
      onTouchMove={cancelPress}
    >
      {dragHandle && <GripVertical size={18} className="cursor-grab text-mute" />}
      {index !== undefined && (
        <span className="w-5 shrink-0 text-center text-[13px] tabular text-mute">{active ? <PlayingBars paused={!isPlaying} /> : index + 1}</span>
      )}
      <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={onClick ?? (() => playTrack(track, context, sourceName ? { name: sourceName } : undefined))}>
        {showArt && (
          <div className="relative">
            <Art palette={track.palette} seed={track.id.charCodeAt(1)} className={dense ? "h-10 w-10" : "h-12 w-12"} />
            {active && index === undefined && (
              <span className="absolute inset-0 flex items-center justify-center rounded-sm bg-ink/40">
                <PlayingBars paused={!isPlaying} />
              </span>
            )}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className={cn("flex items-center gap-1.5 truncate text-[15px] leading-tight", active ? "text-sage" : "text-ink")}>
            <span className="truncate">{track.title}</span>
            {track.isExplicit && <span className="shrink-0 rounded-[3px] bg-sand px-1 text-[9px] font-bold leading-4 text-charcoal">E</span>}
            {track.isVideo && <Video size={12} className="shrink-0 text-mute" />}
          </div>
          <div className="truncate text-[13px] text-mute">
            <span onClick={(e) => { e.stopPropagation(); nav(`/artist/${track.artistIds[0]}`); }} className="hover:underline">{track.artistNames.join(", ")}</span>
            {showAlbum && track.albumName && <> · {track.albumName}</>}
            {" · "}
            <span className="tabular">{fmtTime(track.duration)}</span>
          </div>
        </div>
      </button>
      {dl === "downloaded" && <Download size={14} className="text-sage" />}
      {dl === "downloading" && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-sand border-t-sage" />}
      {trailing ?? (
        <>
          <button type="button" aria-label="Like" onClick={() => toggleFavorite(track.id)} className={cn("rounded-full p-2 transition hover:bg-sand/50", liked ? "text-rose" : "text-mute opacity-0 group-hover:opacity-100 max-lg:opacity-100")}>
            <Heart size={17} fill={liked ? "currentColor" : "none"} />
          </button>
          <button type="button" aria-label="More options" onClick={() => openSheet({ kind: "track", track, fromPlaylistId })} className="rounded-full p-2 text-mute transition hover:bg-sand/50 hover:text-ink">
            <MoreHorizontal size={18} />
          </button>
        </>
      )}
    </div>
  );
}

/* ---------- Cards ---------- */
function CardBase({ onClick, children, className }: { onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={cn("group w-[150px] shrink-0 snap-start text-left sm:w-[170px]", className)}>
      {children}
    </button>
  );
}

function HoverPlay({ onPlay }: { onPlay: (e: React.MouseEvent) => void }) {
  return (
    <span onClick={onPlay} role="button" aria-label="Play" className="absolute bottom-2 right-2 flex h-10 w-10 translate-y-2 items-center justify-center rounded-full bg-ink text-paper opacity-0 shadow-lift transition group-hover:translate-y-0 group-hover:opacity-100">
      <Play size={16} fill="currentColor" className="ml-0.5" />
    </span>
  );
}

export function AlbumCard({ album, tracks, className }: { album: Album; tracks?: Track[]; className?: string }) {
  const nav = useNavigate();
  const setQueue = usePlayerStore((s) => s.setQueue);
  return (
    <CardBase onClick={() => nav(`/album/${album.id}`)} className={className}>
      <div className="relative">
        <Art palette={album.palette} className="aspect-square w-full shadow-art transition group-hover:-translate-y-0.5" />
        {tracks && <HoverPlay onPlay={(e) => { e.stopPropagation(); setQueue(tracks, 0, { name: album.title }); }} />}
      </div>
      <div className="mt-2.5 truncate text-[14px] font-medium text-ink">{album.title}</div>
      <div className="truncate text-[12px] text-mute">{album.type} · {album.year} · {album.artistNames.join(", ")}</div>
    </CardBase>
  );
}

export function PlaylistCard({ playlist, tracks, className }: { playlist: Playlist; tracks?: Track[]; className?: string }) {
  const nav = useNavigate();
  const setQueue = usePlayerStore((s) => s.setQueue);
  const palettes = (tracks ?? []).map((t) => t.palette);
  return (
    <CardBase onClick={() => nav(`/playlist/${playlist.id}`)} className={className}>
      <div className="relative">
        {playlist.kind === "local" ? <Mosaic palettes={palettes} className="aspect-square w-full shadow-art" /> : <Art palette={playlist.palette} seed={3} className="aspect-square w-full shadow-art transition group-hover:-translate-y-0.5" />}
        {tracks && tracks.length > 0 && <HoverPlay onPlay={(e) => { e.stopPropagation(); setQueue(tracks, 0, { name: playlist.title }); }} />}
      </div>
      <div className="mt-2.5 truncate text-[14px] font-medium text-ink">{playlist.title}</div>
      <div className="truncate text-[12px] text-mute">{playlist.kind === "mix" ? playlist.description : playlist.author}</div>
    </CardBase>
  );
}

export function ArtistCard({ artist, className }: { artist: Artist; className?: string }) {
  const nav = useNavigate();
  return (
    <CardBase onClick={() => nav(`/artist/${artist.id}`)} className={cn("w-[128px] sm:w-[140px]", className)}>
      <Art palette={artist.palette} seed={5} shape="circle" className="aspect-square w-full shadow-art transition group-hover:-translate-y-0.5" />
      <div className="mt-2.5 truncate text-center text-[14px] font-medium text-ink">{artist.name}</div>
      <div className="truncate text-center text-[12px] text-mute">{artist.subscribers} subscribers</div>
    </CardBase>
  );
}

export function Carousel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("no-scrollbar flex snap-x gap-4 overflow-x-auto px-4 pb-2 lg:px-0", className)}>{children}</div>;
}
