import { TrackRow } from "@/components/cards";
import { Art, Button, Chip, Empty, IconButton, Loading, Mosaic, PageHeader } from "@/components/common";
import { fmtLength, mockMusicService, remotePlaylistById, tracksByIds } from "@/services/mockMusicService";
import { useLibraryStore } from "@/store/libraryStore";
import { usePlayerStore } from "@/store/playerStore";
import { useUiStore } from "@/store/uiStore";
import type { Playlist, Track } from "@/types";
import { cn } from "@/utils/cn";
import { Reorder, useDragControls } from "framer-motion";
import { ArrowUpDown, Download, GripVertical, Heart, MoreHorizontal, Pencil, Play, Plus, RefreshCw, Search, Shuffle, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { registerSelectable } from "@/components/selection/SelectionBar";
import { useParams } from "react-router-dom";

function ReorderRow({ track, playlistId, tracks }: { track: Track; playlistId: string; tracks: Track[] }) {
  const controls = useDragControls();
  return (
    <Reorder.Item value={track} dragListener={false} dragControls={controls} className="bg-paper">
      <div className="flex items-center">
        <button type="button" aria-label="Drag to reorder" onPointerDown={(e) => controls.start(e)} className="cursor-grab touch-none p-2 text-mute"><GripVertical size={18} /></button>
        <div className="flex-1"><TrackRow track={track} context={tracks} fromPlaylistId={playlistId} dense /></div>
      </div>
    </Reorder.Item>
  );
}

export function PlaylistScreen() {
  const { id = "" } = useParams();
  const lib = useLibraryStore();
  const local = lib.playlists.find((p) => p.id === id);
  const [remote, setRemote] = useState<Playlist | null | "loading">(local ? null : "loading");
  const setQueue = usePlayerStore((s) => s.setQueue);
  const openSheet = useUiStore((s) => s.openSheet);
  const toast = useUiStore((s) => s.toast);
  const [sort, setSort] = useState("custom");
  const [filter, setFilter] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [reorder, setReorder] = useState(false);
  const [suggest, setSuggest] = useState<Track[] | null>(null);

  useEffect(() => {
    if (local) return;
    setRemote("loading");
    mockMusicService.getRemotePlaylist(id).then((p) => setRemote(p ?? remotePlaylistById(id) ?? null));
  }, [id, local]);

  const playlist = local ?? (remote !== "loading" ? remote : null);
  const baseTracks = useMemo(() => (playlist ? tracksByIds(playlist.trackIds) : []), [playlist]);
  const tracks = useMemo(() => {
    let t = baseTracks;
    if (filter) t = t.filter((x) => (x.title + x.artistNames.join()).toLowerCase().includes(filter.toLowerCase()));
    if (sort === "title") t = [...t].sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "artist") t = [...t].sort((a, b) => a.artistNames[0].localeCompare(b.artistNames[0]));
    if (sort === "duration") t = [...t].sort((a, b) => a.duration - b.duration);
    return t;
  }, [baseTracks, filter, sort]);

  useEffect(() => { registerSelectable(tracks.map((t) => t.id)); }, [tracks]);
  if (remote === "loading" && !local) return <Loading label="Opening playlist" />;
  if (!playlist) return <Empty title="Playlist not found" />;

  const isLocal = playlist.kind === "local";
  const total = baseTracks.reduce((a, t) => a + t.duration, 0);
  const allDownloaded = baseTracks.length > 0 && baseTracks.every((t) => lib.downloads[t.id] === "downloaded");
  const downloading = baseTracks.some((t) => lib.downloads[t.id] === "downloading");
  const liked = lib.likedPlaylists.includes(playlist.id);

  return (
    <div>
      <PageHeader right={<IconButton size="sm" aria-label="More" onClick={() => openSheet({ kind: "playlistOptions", playlist })}><MoreHorizontal size={20} /></IconButton>} />
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
        <div className="relative mx-auto w-[220px] shrink-0 sm:mx-0">
          <div className="rounded-md bg-card p-2 shadow-art">
            {isLocal ? <Mosaic palettes={baseTracks.map((t) => t.palette)} className="aspect-square w-full" /> : <Art palette={playlist.palette} seed={3} className="aspect-square w-full" />}
          </div>
          {isLocal && <button type="button" aria-label="Edit thumbnail" onClick={() => { lib.setPlaylistPalette(playlist.id, (playlist.palette + 1) % 16); toast("Thumbnail updated"); }} className="absolute bottom-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-ink/80 text-paper"><Pencil size={14} /></button>}
        </div>
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <div className="kicker">{isLocal ? "Your playlist" : playlist.kind === "mix" ? "Mix for you" : "Playlist"}{playlist.synced ? " · synced" : ""}</div>
          <h1 className="mt-1 font-serif text-[32px] leading-tight lg:text-[40px]">{playlist.title}</h1>
          <p className="mt-1 text-[14px] text-charcoal">{playlist.author} · {baseTracks.length} songs · {fmtLength(total)}</p>
          {isLocal && <p className="text-[12px] text-mute">Created {new Date(playlist.createdAt).toLocaleDateString()}</p>}
          {playlist.description && <p className="mt-2 text-[14px] text-charcoal">{playlist.description}</p>}
          <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
            <Button icon={<Play size={16} fill="currentColor" />} disabled={!baseTracks.length} onClick={() => setQueue(baseTracks, 0, { name: playlist.title }, false)}>Play</Button>
            <Button variant="soft" icon={<Shuffle size={16} />} disabled={!baseTracks.length} onClick={() => setQueue(baseTracks, 0, { name: playlist.title }, true)}>Shuffle</Button>
            {!isLocal && <IconButton tone="soft" aria-label="Like playlist" onClick={() => lib.toggleLikedPlaylist(playlist.id)} className={cn(liked && "text-rose")}><Heart size={18} fill={liked ? "currentColor" : "none"} /></IconButton>}
            <IconButton tone="soft" aria-label="Download" onClick={() => { allDownloaded ? lib.removeDownload(playlist.trackIds) : lib.download(playlist.trackIds); toast(allDownloaded ? "Downloads removed" : "Downloading playlist (simulated)"); }} className={cn(allDownloaded && "text-sage")}>
              {downloading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-sand border-t-sage" /> : <Download size={18} />}
            </IconButton>
            {isLocal && <IconButton tone="soft" aria-label="Sync" onClick={() => openSheet({ kind: "playlistOptions", playlist })} className={cn(playlist.synced && "text-sage")}><RefreshCw size={18} /></IconButton>}
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2 border-b border-line pb-3">
        <Chip active={showFilter} onClick={() => { setShowFilter((v) => !v); setFilter(""); }}><span className="flex items-center gap-1"><Search size={14} /> Search</span></Chip>
        <Chip onClick={() => openSheet({ kind: "sort", current: sort, onPick: setSort, options: [{ id: "custom", label: isLocal ? "Custom order" : "Default" }, { id: "title", label: "Title" }, { id: "artist", label: "Artist" }, { id: "duration", label: "Duration" }] })}><span className="flex items-center gap-1"><ArrowUpDown size={14} /> Sort by</span></Chip>
        {isLocal && <Chip active={reorder} onClick={() => { setReorder((v) => !v); setSort("custom"); setFilter(""); }}><span className="flex items-center gap-1"><GripVertical size={14} /> Reorder</span></Chip>}
        {isLocal && <Chip active={!!suggest} onClick={() => setSuggest(suggest ? null : mockMusicService.suggestForPlaylist(playlist.trackIds))}><span className="flex items-center gap-1"><Sparkles size={14} /> Suggest</span></Chip>}
        {isLocal && <Chip onClick={() => openSheet({ kind: "prompt", title: "Edit title", label: "Playlist title", initial: playlist.title, onSubmit: (v) => lib.renamePlaylist(playlist.id, v) })}><span className="flex items-center gap-1"><Pencil size={14} /> Edit title</span></Chip>}
      </div>
      {showFilter && (
        <div className="relative mt-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
          <input autoFocus value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search in playlist" className="h-10 w-full rounded-full bg-ivory pl-9 pr-9 text-[14px] outline-none ring-sage focus:ring-2" />
          {filter && <button type="button" aria-label="Clear" onClick={() => setFilter("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-mute"><X size={14} /></button>}
        </div>
      )}

      {suggest && (
        <section className="mt-4 rounded-lg bg-ivory/70 p-3">
          <div className="mb-1 flex items-center justify-between px-1"><span className="kicker">Suggested for this playlist</span><button type="button" onClick={() => setSuggest(mockMusicService.suggestForPlaylist(playlist.trackIds))} className="text-[12px] font-medium text-sage">Reload</button></div>
          {suggest.map((t) => (
            <TrackRow key={t.id} track={t} context={suggest} dense trailing={<Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={() => { lib.addToPlaylist(playlist.id, [t.id]); setSuggest((s) => s?.filter((x) => x.id !== t.id) ?? null); toast(`Added "${t.title}"`); }}>Add</Button>} />
          ))}
        </section>
      )}

      <div className="mt-3 -mx-2">
        {tracks.length === 0 && <Empty title={filter ? "No matches" : "This playlist is empty"} body={filter ? undefined : "Add songs from any track's menu → Add to a playlist."} />}
        {reorder && isLocal ? (
          <Reorder.Group axis="y" values={tracks} onReorder={(t) => lib.reorderPlaylist(playlist.id, t.map((x) => x.id))}>
            {tracks.map((t) => <ReorderRow key={t.id} track={t} playlistId={playlist.id} tracks={tracks} />)}
          </Reorder.Group>
        ) : (
          tracks.map((t, i) => <TrackRow key={t.id} track={t} index={i} context={tracks} sourceName={playlist.title} fromPlaylistId={isLocal ? playlist.id : undefined} showAlbum />)
        )}
      </div>
    </div>
  );
}
