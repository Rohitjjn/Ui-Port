import { AlbumCard, ArtistCard, Carousel, TrackRow } from "@/components/cards";
import { Art, Button, Empty, IconButton, PageHeader, SectionHeader, Skeleton } from "@/components/common";
import { albumById, mockMusicService, tracksByIds } from "@/services/mockMusicService";
import { useLibraryStore } from "@/store/libraryStore";
import { usePlayerStore } from "@/store/playerStore";
import { useUiStore } from "@/store/uiStore";
import type { Artist } from "@/types";
import { artwork } from "@/utils/artwork";
import { cn } from "@/utils/cn";
import { MoreHorizontal, Play, Radio, Shuffle, UserCheck, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

export function ArtistScreen() {
  const { id = "" } = useParams();
  const [artist, setArtist] = useState<Artist | null | "loading">("loading");
  const { followedArtists, toggleFollow, favorites } = useLibraryStore();
  const setQueue = usePlayerStore((s) => s.setQueue);
  const openSheet = useUiStore((s) => s.openSheet);
  const toast = useUiStore((s) => s.toast);
  const nav = useNavigate();
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setArtist("loading");
    mockMusicService.getArtist(id).then(setArtist);
  }, [id]);

  if (artist === "loading") return <div><PageHeader /><Skeleton className="h-[240px] w-full" /><Skeleton className="mt-4 h-10 w-1/2" /></div>;
  if (!artist) return <Empty title="Artist not found" action={<Button onClick={() => nav(-1)}>Go back</Button>} />;

  const following = followedArtists.includes(artist.id);
  const top = tracksByIds(artist.topTrackIds);
  const albums = artist.albumIds.map(albumById).filter(Boolean);
  const singles = artist.singleIds.map(albumById).filter(Boolean);
  const videos = mockMusicService.allTracks.filter((t) => t.isVideo && t.artistIds.includes(artist.id));
  const featured = mockMusicService.remotePlaylists.filter((p) => p.kind === "remote" && tracksByIds(p.trackIds).some((t) => t.artistIds.includes(artist.id)));
  const likedBy = mockMusicService.allTracks.filter((t) => t.artistIds.includes(artist.id) && favorites.includes(t.id));
  const related = artist.relatedIds.map((r) => mockMusicService.allArtists.find((a) => a.id === r)!).filter(Boolean);
  const allTracks = mockMusicService.allTracks.filter((t) => t.artistIds.includes(artist.id));

  return (
    <div className="-mt-2">
      <div className="relative -mx-4 h-[260px] overflow-hidden lg:mx-0 lg:h-[320px] lg:rounded-xl">
        <img src={artwork(artist.palette, 11, "wide")} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-paper via-paper/40 to-transparent" />
        <div className="absolute left-0 right-0 top-0"><div className="px-4 lg:px-4"><PageHeader right={<IconButton size="sm" aria-label="More" onClick={() => openSheet({ kind: "artistOptions", artist })}><MoreHorizontal size={20} /></IconButton>} /></div></div>
        <div className="absolute bottom-4 left-4 right-4 flex items-end gap-4 lg:left-8">
          <Art palette={artist.palette} seed={5} shape="circle" className="h-20 w-20 shadow-art lg:h-24 lg:w-24" />
          <div className="min-w-0">
            <div className="kicker">Artist</div>
            <h1 className="truncate font-serif text-[34px] leading-none lg:text-[48px]">{artist.name}</h1>
            <p className="mt-1 text-[13px] text-charcoal">{artist.subscribers} subscribers</p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant={following ? "soft" : "primary"} icon={following ? <UserCheck size={16} /> : <UserPlus size={16} />} onClick={() => { toggleFollow(artist.id); toast(following ? `Unfollowed ${artist.name}` : `Following ${artist.name}`); }}>{following ? "Following" : "Follow"}</Button>
        <Button variant="soft" icon={<Radio size={16} />} onClick={() => setQueue([...allTracks].sort(() => Math.random() - 0.5), 0, { name: `${artist.name} Radio`, isRadio: true }, false)}>Radio</Button>
        <Button variant="soft" icon={<Shuffle size={16} />} onClick={() => setQueue(allTracks, 0, { name: artist.name }, true)}>Shuffle</Button>
        <Button variant="outline" icon={<Play size={16} fill="currentColor" />} onClick={() => setQueue(top, 0, { name: `${artist.name} · Popular` }, false)}>Play popular</Button>
      </div>

      <section className="mt-8">
        <SectionHeader title="Popular" />
        <div className="-mx-2">{(showAll ? top : top.slice(0, 4)).map((t, i) => <TrackRow key={t.id} track={t} index={i} context={top} sourceName={`${artist.name} · Popular`} trailing={<span className="pr-2 text-[12px] tabular text-mute">{(t.plays! / 1e6).toFixed(1)}M</span>} />)}</div>
        {top.length > 4 && <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 text-[13px] font-medium text-sage">{showAll ? "Show less" : "Show more"}</button>}
      </section>

      {albums.length > 0 && <section className="-mx-4 mt-8 lg:mx-0"><SectionHeader title="Albums" action="More" onAction={() => nav(`/artist/${artist.id}/albums`)} /><Carousel>{albums.map((a) => <AlbumCard key={a!.id} album={a!} tracks={tracksByIds(a!.trackIds)} />)}</Carousel></section>}
      {singles.length > 0 && <section className="-mx-4 mt-8 lg:mx-0"><SectionHeader title="Singles & EPs" action="More" onAction={() => nav(`/artist/${artist.id}/albums?singles=1`)} /><Carousel>{singles.map((a) => <AlbumCard key={a!.id} album={a!} tracks={tracksByIds(a!.trackIds)} />)}</Carousel></section>}
      {videos.length > 0 && (
        <section className="-mx-4 mt-8 lg:mx-0"><SectionHeader title="Videos" /><Carousel>{videos.map((v) => (
          <button key={v.id} type="button" onClick={() => usePlayerStore.getState().playTrack(v, videos, { name: `${artist.name} · Videos` })} className="w-[240px] shrink-0 snap-start text-left"><div className="aspect-video w-full overflow-hidden rounded-sm shadow-art"><img src={artwork(v.palette, 2, "wide")} alt="" className="h-full w-full object-cover" /></div><div className="mt-2 truncate text-[14px] font-medium">{v.title}</div><div className="text-[12px] text-mute">{(v.plays! / 1e6).toFixed(1)}M views</div></button>
        ))}</Carousel></section>
      )}
      {featured.length > 0 && <section className="-mx-4 mt-8 lg:mx-0"><SectionHeader title="Featured in" /><Carousel>{featured.map((p) => <button key={p.id} type="button" onClick={() => nav(`/playlist/${p.id}`)} className="w-[150px] shrink-0 snap-start text-left sm:w-[170px]"><Art palette={p.palette} seed={3} className="aspect-square w-full shadow-art" /><div className="mt-2 truncate text-[14px] font-medium">{p.title}</div><div className="truncate text-[12px] text-mute">{p.author}</div></button>)}</Carousel></section>}
      {likedBy.length > 0 && <section className="mt-8"><SectionHeader title={`Liked songs by ${artist.name}`} action="See all" onAction={() => nav("/library/favorite")} /><div className="-mx-2">{likedBy.slice(0, 3).map((t) => <TrackRow key={t.id} track={t} context={likedBy} dense />)}</div></section>}
      {related.length > 0 && <section className="-mx-4 mt-8 lg:mx-0"><SectionHeader title="Fans might also like" /><Carousel>{related.map((a) => <ArtistCard key={a.id} artist={a} />)}</Carousel></section>}
      <section className="mt-8 max-w-2xl">
        <SectionHeader title="About" />
        <button type="button" onClick={() => setExpanded((e) => !e)} className={cn("text-left text-[14px] leading-relaxed text-charcoal", !expanded && "line-clamp-3")}>{artist.description}</button>
      </section>
    </div>
  );
}

export function MoreAlbumsScreen() {
  const { id = "" } = useParams();
  const singles = new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("singles");
  const artist = mockMusicService.allArtists.find((a) => a.id === id);
  if (!artist) return <Empty title="Artist not found" />;
  const list = (singles ? artist.singleIds : artist.albumIds).map(albumById).filter(Boolean);
  return (
    <div>
      <PageHeader title={singles ? "Singles & EPs" : "Albums"} subtitle={artist.name} />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">{list.map((a) => <AlbumCard key={a!.id} album={a!} tracks={tracksByIds(a!.trackIds)} className="w-full" />)}</div>
    </div>
  );
}
