import { ArtistCard, TrackRow } from "@/components/cards";
import { Button, Empty, IconButton, PageHeader } from "@/components/common";
import { artistById, fmtLength, tracksByIds } from "@/services/mockMusicService";
import { useLibraryStore } from "@/store/libraryStore";
import { usePlayerStore } from "@/store/playerStore";
import { useUiStore } from "@/store/uiStore";
import type { DynamicPlaylistType } from "@/types";
import { ArrowUpDown, Download, Play, Shuffle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { registerSelectable } from "@/components/selection/SelectionBar";
import { useParams } from "react-router-dom";

const META: Record<DynamicPlaylistType, { title: string; empty: string }> = {
  favorite: { title: "Liked songs", empty: "Tap the heart on any song to save it here." },
  followed: { title: "Followed artists", empty: "Follow artists to get new-release notifications." },
  most_played: { title: "Most played", empty: "Play some music and your top tracks will show up." },
  downloaded: { title: "Downloaded", empty: "Downloaded songs are available offline." },
  cached: { title: "Cached", empty: "Songs you've played are cached for faster replay." },
  recently_added: { title: "Recently added", empty: "Songs added to playlists appear here." },
};

export function DynamicPlaylistScreen() {
  const { type = "favorite" } = useParams<{ type: DynamicPlaylistType }>();
  const lib = useLibraryStore();
  const setQueue = usePlayerStore((s) => s.setQueue);
  const openSheet = useUiStore((s) => s.openSheet);
  const [sort, setSort] = useState("default");
  const meta = META[type as DynamicPlaylistType] ?? META.favorite;

  const ids = useMemo(() => {
    switch (type) {
      case "favorite": return [...lib.favorites].reverse();
      case "most_played": return Object.entries(lib.playCounts).sort((a, b) => b[1] - a[1]).map(([id]) => id);
      case "downloaded": return Object.entries(lib.downloads).filter(([, s]) => s === "downloaded").map(([id]) => id);
      case "cached": return lib.cached;
      case "recently_added": return lib.recentlyAdded;
      default: return [];
    }
  }, [type, lib.favorites, lib.playCounts, lib.downloads, lib.cached, lib.recentlyAdded]);

  const tracks = useMemo(() => {
    const t = tracksByIds(ids);
    if (sort === "title") return [...t].sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "artist") return [...t].sort((a, b) => a.artistNames[0].localeCompare(b.artistNames[0]));
    if (sort === "plays") return [...t].sort((a, b) => (lib.playCounts[b.id] ?? 0) - (lib.playCounts[a.id] ?? 0));
    return t;
  }, [ids, sort, lib.playCounts]);

  useEffect(() => { registerSelectable(tracks.map((t) => t.id)); }, [tracks]);
  if (type === "followed") {
    const artists = lib.followedArtists.map(artistById).filter(Boolean);
    return (
      <div>
        <PageHeader title={meta.title} subtitle={`${artists.length} artists`} />
        {artists.length ? <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">{artists.map((a) => <ArtistCard key={a!.id} artist={a!} className="w-full" />)}</div> : <Empty title="No followed artists" body={meta.empty} />}
      </div>
    );
  }

  const total = tracks.reduce((a, t) => a + t.duration, 0);
  return (
    <div>
      <PageHeader title={meta.title} subtitle={`${tracks.length} songs · ${fmtLength(total)}`} right={
        <IconButton size="sm" aria-label="Sort" onClick={() => openSheet({ kind: "sort", current: sort, onPick: setSort, options: [{ id: "default", label: "Default" }, { id: "title", label: "Title" }, { id: "artist", label: "Artist" }, { id: "plays", label: "Most played" }] })}><ArrowUpDown size={18} /></IconButton>
      } />
      {tracks.length ? (
        <>
          <div className="mb-4 flex gap-2">
            <Button icon={<Play size={16} fill="currentColor" />} onClick={() => setQueue(tracks, 0, { name: meta.title }, false)}>Play</Button>
            <Button variant="soft" icon={<Shuffle size={16} />} onClick={() => setQueue(tracks, 0, { name: meta.title }, true)}>Shuffle</Button>
            {type === "favorite" && <Button variant="soft" icon={<Download size={16} />} onClick={() => { lib.download(tracks.map((t) => t.id)); useUiStore.getState().toast("Downloading liked songs (simulated)"); }}>Download</Button>}
          </div>
          <div className="-mx-2">
            {tracks.map((t, i) => (
              <TrackRow key={t.id} track={t} index={type === "most_played" ? i : undefined} context={tracks} sourceName={meta.title} showAlbum trailing={type === "most_played" ? <span className="pr-3 text-[12px] tabular text-mute">{lib.playCounts[t.id] ?? 0} plays</span> : undefined} />
            ))}
          </div>
        </>
      ) : (
        <Empty title={`No ${meta.title.toLowerCase()}`} body={meta.empty} />
      )}
    </div>
  );
}
