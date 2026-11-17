import { AlbumCard, ArtistCard, Carousel, PlaylistCard, TrackRow } from "@/components/cards";
import { Art, Botanical, Button, IconButton, Kicker, SectionHeader, Skeleton } from "@/components/common";
import { MOODS } from "@/data/mockData";
import { albumById, artistById, mockMusicService, remotePlaylistById, tracksByIds } from "@/services/mockMusicService";
import { useLibraryStore } from "@/store/libraryStore";
import { usePlayerStore } from "@/store/playerStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useUiStore } from "@/store/uiStore";
import type { ChartCountry, HomeShelf } from "@/types";
import { Bell, ChevronDown, Play, Settings, Sparkles, User } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function TrackGrid({ shelf }: { shelf: HomeShelf }) {
  const tracks = tracksByIds(shelf.itemIds);
  const cols = shelf.columns ?? 4;
  const pages: typeof tracks[] = [];
  for (let i = 0; i < tracks.length; i += cols) pages.push(tracks.slice(i, i + cols));
  return (
    <Carousel>
      {pages.map((page, i) => (
        <div key={i} className="w-[88vw] shrink-0 snap-start sm:w-[400px]">
          {page.map((t) => (
            <TrackRow key={t.id} track={t} context={tracks} sourceName={shelf.title} />
          ))}
        </div>
      ))}
    </Carousel>
  );
}

function Shelf({ shelf }: { shelf: HomeShelf }) {
  const setQueue = usePlayerStore((s) => s.setQueue);
  const nav = useNavigate();
  const action = shelf.kind === "tracks" ? "Play all" : shelf.id === "artists" ? undefined : "See all";
  const onAction = () => {
    if (shelf.kind === "tracks") setQueue(tracksByIds(shelf.itemIds), 0, { name: shelf.title });
    else nav(`/browse/${shelf.id}`);
  };
  return (
    <section className="-mx-4 lg:mx-0">
      <SectionHeader title={shelf.title} subtitle={shelf.subtitle} action={action} onAction={onAction} />
      {shelf.kind === "tracks" && <TrackGrid shelf={shelf} />}
      {shelf.kind === "albums" && (
        <Carousel>{shelf.itemIds.map((id) => { const a = albumById(id)!; return <AlbumCard key={id} album={a} tracks={tracksByIds(a.trackIds)} />; })}</Carousel>
      )}
      {shelf.kind === "playlists" && (
        <Carousel>{shelf.itemIds.map((id) => { const p = remotePlaylistById(id)!; return <PlaylistCard key={id} playlist={p} tracks={tracksByIds(p.trackIds)} />; })}</Carousel>
      )}
      {shelf.kind === "artists" && <Carousel>{shelf.itemIds.map((id) => <ArtistCard key={id} artist={artistById(id)!} />)}</Carousel>}
    </section>
  );
}

function ChartSection() {
  const { contentCountry, set } = useSettingsStore();
  const [chart, setChart] = useState<ChartCountry | null>(null);
  const setQueue = usePlayerStore((s) => s.setQueue);
  const nav = useNavigate();
  useEffect(() => {
    setChart(null);
    mockMusicService.getCharts(contentCountry).then(setChart);
  }, [contentCountry]);
  const tracks = chart ? tracksByIds(chart.trackIds).slice(0, 5) : [];
  return (
    <section className="-mx-4 lg:mx-0">
      <div className="mb-3 flex items-end justify-between px-4 lg:px-0">
        <div>
          <h2 className="font-serif text-[24px] leading-tight">Chart</h2>
          <p className="text-[13px] text-mute">Top songs right now</p>
        </div>
        <label className="relative">
          <select value={contentCountry} onChange={(e) => set("contentCountry", e.target.value)} className="h-9 appearance-none rounded-full bg-ivory pl-4 pr-8 text-[13px] font-medium outline-none">
            {mockMusicService.chartCountries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-mute" />
        </label>
      </div>
      <div className="px-4 lg:px-0">
        {!chart ? (
          <div className="space-y-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : (
          <div className="paper rounded-lg p-2">
            {tracks.map((t, i) => <TrackRow key={t.id} track={t} index={i} context={tracksByIds(chart.trackIds)} sourceName={`${chart.name} chart`} />)}
            <div className="flex gap-2 p-2">
              <Button size="sm" icon={<Play size={14} fill="currentColor" />} onClick={() => setQueue(tracksByIds(chart.trackIds), 0, { name: `${chart.name} chart` })}>Play chart</Button>
              <Button size="sm" variant="soft" onClick={() => nav("/charts")}>See all charts</Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function FeaturedHero() {
  const album = albumById("al1")!;
  const tracks = tracksByIds(album.trackIds);
  const setQueue = usePlayerStore((s) => s.setQueue);
  const nav = useNavigate();
  const { likedAlbums, toggleLikedAlbum } = useLibraryStore();
  return (
    <section className="paper relative overflow-hidden rounded-xl">
      <Botanical className="pointer-events-none absolute -right-6 -top-6 h-48 w-48 text-olive/25" />
      <div className="grid gap-5 p-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] sm:items-center lg:p-8">
        <Art palette={album.palette} className="aspect-square w-full shadow-art" alt={album.title} />
        <div>
          <Kicker className="text-sage">Featured this week</Kicker>
          <h2 className="mt-2 font-serif text-[34px] leading-[1.05] lg:text-[44px]">{album.title}</h2>
          <button type="button" onClick={() => nav(`/artist/${album.artistIds[0]}`)} className="mt-1 text-[15px] text-charcoal hover:underline">{album.artistNames.join(", ")} · {album.year}</button>
          <p className="mt-4 max-w-md text-[14px] leading-relaxed text-charcoal">{album.description}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button icon={<Play size={16} fill="currentColor" />} onClick={() => setQueue(tracks, 0, { name: album.title })}>Play</Button>
            <Button variant="soft" onClick={() => toggleLikedAlbum(album.id)}>{likedAlbums.includes(album.id) ? "Saved" : "Save"}</Button>
            <Button variant="outline" onClick={() => nav(`/album/${album.id}`)}>Open album</Button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function HomeScreen() {
  const [shelves, setShelves] = useState<HomeShelf[] | null>(null);
  const nav = useNavigate();
  const openSheet = useUiStore((s) => s.openSheet);
  const account = useSettingsStore((s) => s.accounts.youtube);
  const history = useLibraryStore((s) => s.history);
  const playCounts = useLibraryStore((s) => s.playCounts);
  const recent = useMemo(() => {
    const ids = [...new Set(history.map((h) => h.trackId))].slice(0, 10);
    return tracksByIds(ids);
  }, [history]);
  const totalPlays = Object.values(playCounts).reduce((a, b) => a + b, 0);

  useEffect(() => {
    mockMusicService.getHome().then(setShelves);
  }, []);

  const date = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="space-y-10">
      <header className="flex items-start justify-between gap-3 pt-2">
        <div>
          <Kicker>{date}</Kicker>
          <h1 className="mt-1 font-serif text-[32px] leading-tight lg:text-[40px]">{greeting()}, {account ? account.split("@")[0] : "Guest"}</h1>
          <p className="mt-1 text-[14px] text-mute">What is the best choice today?</p>
        </div>
        <div className="flex items-center gap-1">
          <IconButton aria-label="Notifications" onClick={() => nav("/notifications")} className="relative"><Bell size={20} /><span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-rose" /></IconButton>
          <IconButton aria-label="Settings" onClick={() => nav("/settings")}><Settings size={20} /></IconButton>
          <button type="button" aria-label="Account" onClick={() => openSheet({ kind: "account" })} className="ml-1 flex h-10 w-10 items-center justify-center rounded-full bg-sage text-paper"><User size={18} /></button>
        </div>
      </header>

      {!account && (
        <div className="flex items-center justify-between gap-4 rounded-lg bg-ivory px-4 py-3">
          <p className="text-[13px] text-charcoal">Log in to YouTube Music for a personalised home, your playlists and liked songs.</p>
          <Button size="sm" variant="primary" onClick={() => openSheet({ kind: "account" })}>Log in</Button>
        </div>
      )}

      <FeaturedHero />

      {recent.length > 0 && (
        <section className="-mx-4 lg:mx-0">
          <SectionHeader title="Recently played" subtitle="From your listening history" />
          <Carousel>
            {recent.map((t) => (
              <button key={t.id} type="button" onClick={() => usePlayerStore.getState().playTrack(t, recent, { name: "Recently played" })} className="w-[120px] shrink-0 snap-start text-left">
                <Art palette={t.palette} seed={t.id.charCodeAt(1)} className="aspect-square w-full shadow-art" />
                <div className="mt-2 truncate text-[13px] font-medium">{t.title}</div>
                <div className="truncate text-[12px] text-mute">{t.artistNames[0]}</div>
              </button>
            ))}
          </Carousel>
        </section>
      )}

      {!shelves ? (
        <div className="space-y-8">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <Skeleton className="mb-3 h-7 w-48" />
              <div className="flex gap-4">{[0, 1, 2, 3].map((j) => <Skeleton key={j} className="h-[170px] w-[150px] shrink-0" />)}</div>
            </div>
          ))}
        </div>
      ) : (
        shelves.map((s, i) => (
          <div key={s.id} className="space-y-10">
            <Shelf shelf={s} />
            {i === 1 && <ChartSection />}
            {i === 3 && (
              <section className="-mx-4 lg:mx-0">
                <SectionHeader title="Moods & moments" action="All moods" onAction={() => nav("/moods")} />
                <Carousel>
                  {MOODS.filter((m) => m.category === "Moods & moments").map((m) => (
                    <button key={m.id} type="button" onClick={() => nav(`/mood/${m.id}`)} className="relative h-[92px] w-[150px] shrink-0 snap-start overflow-hidden rounded-md p-3 text-left shadow-paper transition hover:-translate-y-0.5" style={{ background: `linear-gradient(135deg, ${m.tint}, var(--color-ivory))` }}>
                      <span className="font-serif text-[20px] text-ink">{m.title}</span>
                      <Botanical className="absolute -bottom-3 -right-3 h-14 w-14 text-ink/15" />
                    </button>
                  ))}
                </Carousel>
              </section>
            )}
          </div>
        ))
      )}

      {totalPlays > 30 && (
        <button type="button" onClick={() => nav("/wrapped")} className="paper flex w-full items-center gap-4 rounded-xl p-5 text-left transition hover:-translate-y-0.5">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sage/15 text-sage"><Sparkles size={24} /></div>
          <div className="flex-1">
            <Kicker className="text-sage">Your listening, folded</Kicker>
            <div className="font-serif text-[22px]">SimpMusic Wrapped</div>
            <div className="text-[13px] text-mute">{totalPlays} plays tracked locally · tap to open</div>
          </div>
        </button>
      )}
    </div>
  );
}
