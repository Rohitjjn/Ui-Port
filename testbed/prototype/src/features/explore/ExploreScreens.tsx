import { AlbumCard, ArtistCard, PlaylistCard, TrackRow } from "@/components/cards";
import { Art, Botanical, Button, Chip, Empty, Loading, PageHeader, SectionHeader } from "@/components/common";
import { HOME_SHELVES, MOODS } from "@/data/mockData";
import { albumById, artistById, fmtTime, mockMusicService, remotePlaylistById, tracksByIds } from "@/services/mockMusicService";
import { useLibraryStore } from "@/store/libraryStore";
import { usePlayerStore } from "@/store/playerStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useUiStore } from "@/store/uiStore";
import type { ChartCountry, NotificationItem, Podcast } from "@/types";
import { cn } from "@/utils/cn";
import { ChevronDown, Heart, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

/* ---------- Moods ---------- */
export function MoodsScreen() {
  const nav = useNavigate();
  const groups = ["Moods & moments", "Genres"] as const;
  return (
    <div>
      <PageHeader title="Moods & genres" subtitle="Pick a feeling, we'll fold a playlist" />
      {groups.map((g) => (
        <section key={g} className="mb-8">
          <SectionHeader title={g} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {MOODS.filter((m) => m.category === g).map((m) => (
              <button key={m.id} type="button" onClick={() => nav(`/mood/${m.id}`)} className="relative h-[88px] overflow-hidden rounded-md p-3 text-left shadow-paper transition hover:-translate-y-0.5" style={{ background: `linear-gradient(135deg, ${m.tint}, var(--color-ivory))` }}>
                <span className="font-serif text-[20px] text-ink">{m.title}</span>
                <Botanical className="absolute -bottom-3 -right-3 h-14 w-14 text-ink/15" />
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function MoodScreen() {
  const { id = "" } = useParams();
  const mood = MOODS.find((m) => m.id === id);
  const [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(true); const t = setTimeout(() => setLoading(false), 400); return () => clearTimeout(t); }, [id]);
  if (!mood) return <Empty title="Mood not found" />;
  const playlists = mood.playlistIds.map(remotePlaylistById).filter(Boolean);
  return (
    <div>
      <div className="-mx-4 -mt-2 mb-6 px-4 pb-8 pt-2 lg:mx-0 lg:rounded-xl lg:px-6" style={{ background: `linear-gradient(160deg, ${mood.tint}55, transparent)` }}>
        <PageHeader />
        <div className="kicker">{mood.category}</div>
        <h1 className="mt-1 font-serif text-[40px] leading-none">{mood.title}</h1>
      </div>
      {loading ? <Loading /> : (
        <>
          <SectionHeader title="Playlists" subtitle={`${playlists.length} curated for ${mood.title.toLowerCase()}`} />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">{playlists.map((p) => <PlaylistCard key={p!.id} playlist={p!} tracks={tracksByIds(p!.trackIds)} className="w-full" />)}</div>
        </>
      )}
    </div>
  );
}

/* ---------- Charts ---------- */
export function ChartsScreen() {
  const { contentCountry, set } = useSettingsStore();
  const [chart, setChart] = useState<ChartCountry | null>(null);
  const [tab, setTab] = useState<"songs" | "videos" | "artists">("songs");
  const setQueue = usePlayerStore((s) => s.setQueue);
  useEffect(() => { setChart(null); mockMusicService.getCharts(contentCountry).then(setChart); }, [contentCountry]);
  return (
    <div>
      <PageHeader title="Charts" subtitle="What the world is playing" right={
        <label className="relative"><select value={contentCountry} onChange={(e) => set("contentCountry", e.target.value)} className="h-9 appearance-none rounded-full bg-ivory pl-4 pr-8 text-[13px] font-medium outline-none">{mockMusicService.chartCountries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select><ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-mute" /></label>
      } />
      <div className="mb-4 flex gap-2">{(["songs", "videos", "artists"] as const).map((t) => <Chip key={t} active={tab === t} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</Chip>)}</div>
      {!chart ? <Loading /> : (
        <>
          {tab !== "artists" && <Button className="mb-3" icon={<Play size={16} fill="currentColor" />} onClick={() => setQueue(tracksByIds(tab === "songs" ? chart.trackIds : chart.videoIds), 0, { name: `${chart.name} chart` })}>Play top {tab}</Button>}
          {tab === "songs" && <div className="-mx-2">{tracksByIds(chart.trackIds).map((t, i) => <TrackRow key={t.id} track={t} index={i} context={tracksByIds(chart.trackIds)} sourceName={`${chart.name} chart`} showAlbum />)}</div>}
          {tab === "videos" && <div className="-mx-2">{tracksByIds(chart.videoIds).map((t, i) => <TrackRow key={t.id} track={t} index={i} context={tracksByIds(chart.videoIds)} sourceName={`${chart.name} videos`} />)}</div>}
          {tab === "artists" && <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">{chart.artistIds.map((id, i) => <div key={id} className="relative"><span className="absolute left-1 top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-ink font-serif text-[14px] text-paper">{i + 1}</span><ArtistCard artist={artistById(id)!} className="w-full" /></div>)}</div>}
        </>
      )}
    </div>
  );
}

/* ---------- Browse (shelf "See all") ---------- */
export function BrowseScreen() {
  const { id = "" } = useParams();
  const shelf = HOME_SHELVES.find((s) => s.id === id);
  if (!shelf) return <Empty title="Nothing to browse" />;
  return (
    <div>
      <PageHeader title={shelf.title} subtitle={shelf.subtitle} />
      {shelf.kind === "tracks" && <div className="-mx-2">{tracksByIds(shelf.itemIds).map((t, i) => <TrackRow key={t.id} track={t} index={i} context={tracksByIds(shelf.itemIds)} sourceName={shelf.title} showAlbum />)}</div>}
      {shelf.kind === "albums" && <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">{shelf.itemIds.map((i) => albumById(i)!).map((a) => <AlbumCard key={a.id} album={a} tracks={tracksByIds(a.trackIds)} className="w-full" />)}</div>}
      {shelf.kind === "playlists" && <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">{shelf.itemIds.map((i) => remotePlaylistById(i)!).map((p) => <PlaylistCard key={p.id} playlist={p} tracks={tracksByIds(p.trackIds)} className="w-full" />)}</div>}
      {shelf.kind === "artists" && <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">{shelf.itemIds.map((i) => <ArtistCard key={i} artist={artistById(i)!} className="w-full" />)}</div>}
    </div>
  );
}

/* ---------- Mix for you ---------- */
export function MixForYouScreen() {
  const mixes = mockMusicService.remotePlaylists.filter((p) => p.kind === "mix");
  return (
    <div>
      <PageHeader back={false} title="Mix for you" subtitle="Mixes refreshed from your listening" />
      {mixes.length ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{mixes.map((p) => <PlaylistCard key={p.id} playlist={p} tracks={tracksByIds(p.trackIds)} className="w-full" />)}</div> : <Empty title="No mixes found" />}
    </div>
  );
}

/* ---------- Podcast ---------- */
export function PodcastScreen() {
  const { id = "" } = useParams();
  const [pod, setPod] = useState<Podcast | null | "loading">("loading");
  const { likedPodcasts, toggleLikedPodcast } = useLibraryStore();
  const toast = useUiStore((s) => s.toast);
  const playTrack = usePlayerStore((s) => s.playTrack);
  useEffect(() => { setPod("loading"); mockMusicService.getPodcast(id).then(setPod); }, [id]);
  if (pod === "loading") return <Loading label="Opening podcast" />;
  if (!pod) return <Empty title="Podcast not found" />;
  const liked = likedPodcasts.includes(pod.id);
  return (
    <div>
      <PageHeader />
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
        <div className="mx-auto w-[200px] shrink-0 rounded-md bg-card p-2 shadow-art sm:mx-0"><Art palette={pod.palette} seed={9} className="aspect-square w-full" /></div>
        <div className="text-center sm:text-left">
          <div className="kicker">Podcast</div>
          <h1 className="mt-1 font-serif text-[32px] leading-tight">{pod.title}</h1>
          <p className="text-[14px] text-charcoal">{pod.author} · {pod.episodes.length} episodes</p>
          <p className="mt-2 max-w-xl text-[14px] text-charcoal">{pod.description}</p>
          <Button className="mt-4" variant={liked ? "soft" : "primary"} icon={<Heart size={16} fill={liked ? "currentColor" : "none"} />} onClick={() => { toggleLikedPodcast(pod.id); toast(liked ? "Removed from favorite podcasts" : "Added to favorite podcasts"); }}>{liked ? "Favorited" : "Favorite"}</Button>
        </div>
      </div>
      <SectionHeader title="Episodes" />
      <div className="divide-y divide-line">
        {pod.episodes.map((e) => (
          <div key={e.id} className="flex items-start gap-4 py-4">
            <div className="min-w-0 flex-1">
              <div className="text-[12px] text-mute">{e.date}</div>
              <div className="mt-0.5 text-[15px] font-medium">{e.title}</div>
              <p className="mt-1 text-[13px] text-charcoal">{e.description}</p>
              <div className="mt-2 flex items-center gap-2">
                <Button size="sm" variant="soft" icon={<Play size={14} fill="currentColor" />} onClick={() => playTrack({ id: e.id, title: e.title, artistIds: [], artistNames: [pod.author], duration: e.duration, palette: pod.palette, albumName: pod.title }, undefined, { name: pod.title })}>Play</Button>
                <span className="text-[12px] tabular text-mute">{fmtTime(e.duration)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Notifications ---------- */
export function NotificationScreen() {
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const nav = useNavigate();
  const followed = useLibraryStore((s) => s.followedArtists);
  useEffect(() => { mockMusicService.getNotifications().then(setItems); }, []);
  return (
    <div>
      <PageHeader title="Notifications" subtitle="New releases from artists you follow" />
      {!items ? <Loading /> : items.length === 0 ? <Empty title="No notifications" /> : (
        <div className="divide-y divide-line">
          {items.map((n) => {
            const ar = artistById(n.artistId)!; const al = albumById(n.albumId)!;
            return (
              <button key={n.id} type="button" onClick={() => nav(`/album/${al.id}`)} className="flex w-full items-center gap-3 py-3 text-left hover:bg-ivory/60">
                <Art palette={ar.palette} seed={5} shape="circle" className="h-11 w-11" />
                <div className="min-w-0 flex-1">
                  <div className="text-[14px]"><b>{ar.name}</b> released <b>{al.title}</b> {!followed.includes(ar.id) && <span className={cn("ml-1 rounded-full bg-ivory px-2 py-0.5 text-[10px] text-mute")}>suggested</span>}</div>
                  <div className="text-[12px] text-mute">{al.type} · {n.date}</div>
                </div>
                <Art palette={al.palette} className="h-12 w-12" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
