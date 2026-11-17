import { AlbumCard, Carousel, TrackRow } from "@/components/cards";
import { Art, Button, Empty, IconButton, PageHeader, SectionHeader, Skeleton } from "@/components/common";
import { artistById, fmtLength, mockMusicService, tracksByIds } from "@/services/mockMusicService";
import { useLibraryStore } from "@/store/libraryStore";
import { usePlayerStore } from "@/store/playerStore";
import { useUiStore } from "@/store/uiStore";
import type { Album, Track } from "@/types";
import { cn } from "@/utils/cn";
import { Download, Heart, MoreHorizontal, Play, Share2, Shuffle } from "lucide-react";
import { useEffect, useState } from "react";
import { registerSelectable } from "@/components/selection/SelectionBar";
import { useNavigate, useParams } from "react-router-dom";

export function AlbumScreen() {
  const { id = "" } = useParams();
  const [data, setData] = useState<{ album: Album; tracks: Track[] } | null | "loading">("loading");
  const lib = useLibraryStore();
  const setQueue = usePlayerStore((s) => s.setQueue);
  const openSheet = useUiStore((s) => s.openSheet);
  const toast = useUiStore((s) => s.toast);
  const nav = useNavigate();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setData("loading");
    mockMusicService.getAlbum(id).then(setData);
  }, [id]);

  useEffect(() => { if (data !== "loading" && data) registerSelectable(data.tracks.map((t) => t.id)); }, [data]);
  if (data === "loading")
    return (
      <div>
        <PageHeader />
        <div className="flex flex-col gap-5 sm:flex-row"><Skeleton className="mx-auto h-[220px] w-[220px] sm:mx-0" /><div className="flex-1 space-y-3"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-4 w-1/3" /><Skeleton className="h-20" /></div></div>
      </div>
    );
  if (!data) return <Empty title="Album not found" action={<Button onClick={() => nav(-1)}>Go back</Button>} />;
  const { album, tracks } = data;
  const liked = lib.likedAlbums.includes(album.id);
  const allDl = tracks.every((t) => lib.downloads[t.id] === "downloaded");
  const artist = artistById(album.artistIds[0]);
  const others = (artist?.albumIds ?? []).concat(artist?.singleIds ?? []).filter((a) => a !== album.id);
  const total = tracks.reduce((a, t) => a + t.duration, 0);

  return (
    <div>
      <PageHeader right={<IconButton size="sm" aria-label="More" onClick={() => openSheet({ kind: "albumOptions", album })}><MoreHorizontal size={20} /></IconButton>} />
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
        <div className="mx-auto w-[220px] shrink-0 rounded-md bg-card p-2 shadow-art sm:mx-0 lg:w-[260px]"><Art palette={album.palette} className="aspect-square w-full" alt={album.title} /></div>
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <div className="kicker">{album.type} · {album.year}</div>
          <h1 className="mt-1 font-serif text-[32px] leading-tight lg:text-[42px]">{album.title}</h1>
          <button type="button" onClick={() => nav(`/artist/${album.artistIds[0]}`)} className="mt-1 text-[15px] text-sage hover:underline">{album.artistNames.join(", ")}</button>
          <p className="mt-1 text-[13px] text-mute">{tracks.length} songs · {fmtLength(total)}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
            <Button icon={<Play size={16} fill="currentColor" />} onClick={() => setQueue(tracks, 0, { name: album.title }, false)}>Play</Button>
            <Button variant="soft" icon={<Shuffle size={16} />} onClick={() => setQueue(tracks, 0, { name: album.title }, true)}>Shuffle</Button>
            <IconButton tone="soft" aria-label="Save album" onClick={() => { lib.toggleLikedAlbum(album.id); toast(liked ? "Removed from library" : "Saved to library"); }} className={cn(liked && "text-rose")}><Heart size={18} fill={liked ? "currentColor" : "none"} /></IconButton>
            <IconButton tone="soft" aria-label="Download album" onClick={() => { allDl ? lib.removeDownload(album.trackIds) : lib.download(album.trackIds); toast(allDl ? "Downloads removed" : "Downloading album (simulated)"); }} className={cn(allDl && "text-sage")}><Download size={18} /></IconButton>
            <IconButton tone="soft" aria-label="Share" onClick={() => openSheet({ kind: "share", title: album.title, url: `https://music.youtube.com/browse/${album.id}` })}><Share2 size={18} /></IconButton>
          </div>
        </div>
      </div>
      {album.description && (
        <button type="button" onClick={() => setExpanded((e) => !e)} className={cn("mt-5 block max-w-2xl text-left text-[14px] leading-relaxed text-charcoal", !expanded && "line-clamp-2")}>{album.description}</button>
      )}
      <div className="mt-6 -mx-2">{tracks.map((t, i) => <TrackRow key={t.id} track={t} index={i} context={tracks} sourceName={album.title} showArt={false} />)}</div>
      <p className="mt-4 text-[12px] text-mute">{album.year} · {tracks.length} songs · {fmtLength(total)}</p>
      {others.length > 0 && (
        <section className="-mx-4 mt-10 lg:mx-0">
          <SectionHeader title="Other versions & more" subtitle={`From ${album.artistNames[0]}`} />
          <Carousel>{others.map((aid) => mockMusicService.allAlbums.find((a) => a.id === aid)).filter(Boolean).map((a) => <AlbumCard key={a!.id} album={a!} tracks={tracksByIds(a!.trackIds)} />)}</Carousel>
        </section>
      )}
    </div>
  );
}
