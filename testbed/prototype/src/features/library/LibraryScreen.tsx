import { AlbumCard, ArtistCard, Carousel, PlaylistCard, TrackRow } from "@/components/cards";
import { Art, Button, Chip, Empty, Kicker, Mosaic, SectionHeader } from "@/components/common";
import { CHARTS } from "@/data/mockData";
import { albumById, artistById, mockMusicService, tracksByIds } from "@/services/mockMusicService";
import { useLibraryStore } from "@/store/libraryStore";
import { usePlayerStore } from "@/store/playerStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useUiStore } from "@/store/uiStore";
import type { LibraryChip } from "@/types";
import { cn } from "@/utils/cn";
import { Clock, Download, HardDrive, Heart, Mic2, Play, Plus, Sparkles, TrendingUp, UserCheck } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const CHIPS: { id: LibraryChip; label: string }[] = [
  { id: "your_library", label: "Your library" },
  { id: "local_playlists", label: "Your playlists" },
  { id: "favorite_playlists", label: "Favorite playlists" },
  { id: "downloaded_playlists", label: "Downloaded" },
  { id: "favorite_podcasts", label: "Podcasts" },
  { id: "charts", label: "SimpMusic charts" },
  { id: "wrapped", label: "Wrapped" },
  { id: "mix_for_you", label: "Mix for you" },
  { id: "youtube_playlists", label: "YouTube playlists" },
];

export function LibraryScreen() {
  const [chip, setChip] = useState<LibraryChip>("your_library");
  const lib = useLibraryStore();
  const nav = useNavigate();
  const openSheet = useUiStore((s) => s.openSheet);
  const account = useSettingsStore((s) => s.accounts.youtube);
  const setQueue = usePlayerStore((s) => s.setQueue);

  const tiles = [
    { id: "favorite", label: "Liked songs", icon: Heart, count: lib.favorites.length, tint: "text-rose" },
    { id: "followed", label: "Followed artists", icon: UserCheck, count: lib.followedArtists.length, tint: "text-sage" },
    { id: "most_played", label: "Most played", icon: TrendingUp, count: Object.keys(lib.playCounts).length, tint: "text-charcoal" },
    { id: "downloaded", label: "Downloaded", icon: Download, count: Object.values(lib.downloads).filter((d) => d === "downloaded").length, tint: "text-sage" },
    { id: "cached", label: "Cached", icon: HardDrive, count: lib.cached.length, tint: "text-charcoal" },
    { id: "recently_added", label: "Recently added", icon: Clock, count: lib.recentlyAdded.length, tint: "text-charcoal" },
  ];
  const downloadedPlaylists = lib.playlists.filter((p) => p.trackIds.length && p.trackIds.every((t) => lib.downloads[t] === "downloaded"));
  const favPlaylists = mockMusicService.remotePlaylists.filter((p) => lib.likedPlaylists.includes(p.id));
  const favPodcasts = mockMusicService.podcasts.filter((p) => lib.likedPodcasts.includes(p.id));
  const mixes = mockMusicService.remotePlaylists.filter((p) => p.kind === "mix");

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between pt-2">
        <div>
          <Kicker>Collection</Kicker>
          <h1 className="mt-1 font-serif text-[32px] leading-tight lg:text-[40px]">Your Library</h1>
        </div>
        <Button size="sm" icon={<Plus size={16} />} onClick={() => openSheet({ kind: "createPlaylist" })}>New playlist</Button>
      </header>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        {CHIPS.map((c) => <Chip key={c.id} active={chip === c.id} onClick={() => setChip(c.id)}>{c.label}</Chip>)}
      </div>

      {chip === "your_library" && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {tiles.map((t) => (
              <button key={t.id} type="button" onClick={() => nav(`/library/${t.id}`)} className="paper flex items-center gap-3 rounded-lg p-3 text-left transition hover:-translate-y-0.5">
                <span className={cn("flex h-11 w-11 items-center justify-center rounded-md bg-ivory", t.tint)}><t.icon size={20} /></span>
                <span className="min-w-0"><span className="block truncate text-[14px] font-medium">{t.label}</span><span className="block text-[12px] text-mute">{t.count} items</span></span>
              </button>
            ))}
          </div>
          <section className="-mx-4 lg:mx-0">
            <SectionHeader title="Your playlists" action="See all" onAction={() => setChip("local_playlists")} />
            <Carousel>
              {lib.playlists.map((p) => <PlaylistCard key={p.id} playlist={p} tracks={tracksByIds(p.trackIds)} />)}
              <button type="button" onClick={() => openSheet({ kind: "createPlaylist" })} className="flex aspect-square w-[150px] shrink-0 flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-sand text-mute hover:text-ink sm:w-[170px]"><Plus size={22} /><span className="text-[13px]">Create</span></button>
            </Carousel>
          </section>
          {lib.recentlyAdded.length > 0 && (
            <section>
              <SectionHeader title="Recently added" />
              <div className="-mx-4 px-4 lg:mx-0 lg:px-0">{tracksByIds(lib.recentlyAdded).slice(0, 5).map((t) => <TrackRow key={t.id} track={t} context={tracksByIds(lib.recentlyAdded)} sourceName="Recently added" />)}</div>
            </section>
          )}
          <section className="-mx-4 lg:mx-0">
            <SectionHeader title="Saved albums" />
            {lib.likedAlbums.length ? <Carousel>{lib.likedAlbums.map((id) => albumById(id)).filter(Boolean).map((a) => <AlbumCard key={a!.id} album={a!} tracks={tracksByIds(a!.trackIds)} />)}</Carousel> : <p className="px-4 text-[13px] text-mute lg:px-0">No albums saved yet.</p>}
          </section>
          <section className="-mx-4 lg:mx-0">
            <SectionHeader title="Followed artists" action="See all" onAction={() => nav("/library/followed")} />
            <Carousel>{lib.followedArtists.map((id) => artistById(id)).filter(Boolean).map((a) => <ArtistCard key={a!.id} artist={a!} />)}</Carousel>
          </section>
        </>
      )}

      {chip === "local_playlists" && (
        lib.playlists.length ? <Grid>{lib.playlists.map((p) => <PlaylistCard key={p.id} playlist={p} tracks={tracksByIds(p.trackIds)} className="w-full" />)}</Grid> : <Empty title="No playlists added" body="Create a playlist to start collecting songs." action={<Button onClick={() => openSheet({ kind: "createPlaylist" })}>Create playlist</Button>} />
      )}
      {chip === "favorite_playlists" && (
        favPlaylists.length ? <Grid>{favPlaylists.map((p) => <PlaylistCard key={p.id} playlist={p} tracks={tracksByIds(p.trackIds)} className="w-full" />)}</Grid> : <Empty title="No favorite playlists" body="Save playlists from Home or Search and they'll appear here." />
      )}
      {chip === "downloaded_playlists" && (
        downloadedPlaylists.length ? <Grid>{downloadedPlaylists.map((p) => <PlaylistCard key={p.id} playlist={p} tracks={tracksByIds(p.trackIds)} className="w-full" />)}</Grid> : <Empty title="No playlists downloaded" body="Download a whole playlist from its options menu to listen offline." action={<Button variant="soft" onClick={() => nav("/library/downloaded")}>View downloaded songs</Button>} />
      )}
      {chip === "favorite_podcasts" && (
        favPodcasts.length ? (
          <div className="space-y-1">{favPodcasts.map((p) => (
            <button key={p.id} type="button" onClick={() => nav(`/podcast/${p.id}`)} className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-ivory">
              <Art palette={p.palette} seed={9} className="h-14 w-14" />
              <div><div className="text-[15px]">{p.title}</div><div className="text-[13px] text-mute">{p.author} · {p.episodes.length} episodes</div></div>
              <Mic2 size={16} className="ml-auto text-mute" />
            </button>
          ))}</div>
        ) : <Empty title="No favorite podcasts" />
      )}
      {chip === "charts" && (
        <div className="space-y-6">
          {CHARTS.slice(0, 3).map((c) => (
            <section key={c.code} className="paper rounded-lg p-3">
              <div className="mb-1 flex items-center justify-between px-2"><span className="font-serif text-[20px]">{c.name}</span><Button size="sm" variant="soft" icon={<Play size={14} fill="currentColor" />} onClick={() => setQueue(tracksByIds(c.trackIds), 0, { name: `${c.name} chart` })}>Play</Button></div>
              {tracksByIds(c.trackIds).slice(0, 3).map((t, i) => <TrackRow key={t.id} track={t} index={i} context={tracksByIds(c.trackIds)} sourceName={`${c.name} chart`} dense />)}
            </section>
          ))}
          <Button variant="outline" onClick={() => nav("/charts")}>Open full charts</Button>
        </div>
      )}
      {chip === "wrapped" && (
        <button type="button" onClick={() => nav("/wrapped")} className="paper relative w-full overflow-hidden rounded-xl p-8 text-left">
          <Sparkles className="mb-3 text-sage" />
          <div className="font-serif text-[30px]">Your {new Date().getFullYear()} Wrapped</div>
          <p className="mt-1 max-w-sm text-[14px] text-charcoal">Built locally from your play history. Nothing leaves your device.</p>
          <Button className="mt-4">Open Wrapped</Button>
        </button>
      )}
      {chip === "mix_for_you" && <Grid>{mixes.map((p) => <PlaylistCard key={p.id} playlist={p} tracks={tracksByIds(p.trackIds)} className="w-full" />)}</Grid>}
      {chip === "youtube_playlists" && (
        account ? <Grid>{mockMusicService.remotePlaylists.filter((p) => p.kind === "remote").slice(0, 4).map((p) => <PlaylistCard key={p.id} playlist={p} tracks={tracksByIds(p.trackIds)} className="w-full" />)}</Grid> : <Empty title="Log in to see your YouTube playlists" body="Your YouTube Music playlists sync here after logging in (simulated in this prototype)." action={<Button onClick={() => openSheet({ kind: "account" })}>Log in</Button>} />
      )}
      <Mosaic palettes={[]} className="hidden" />
    </div>
  );
}

const Grid = ({ children }: { children: React.ReactNode }) => <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">{children}</div>;
