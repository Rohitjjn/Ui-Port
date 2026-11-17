import { AlbumCard, ArtistCard, Carousel, PlaylistCard, TrackRow } from "@/components/cards";
import { Art, Botanical, Button, Chip, Empty, IconButton, Loading, SectionHeader } from "@/components/common";
import { mockMusicService, tracksByIds } from "@/services/mockMusicService";
import { useLibraryStore } from "@/store/libraryStore";
import { usePlayerStore } from "@/store/playerStore";
import { useUiStore } from "@/store/uiStore";
import type { SearchFilter, SearchResults } from "@/types";
import { cn } from "@/utils/cn";
import { Clock, Mic, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const FILTERS: { id: SearchFilter; label: string }[] = [
  { id: "all", label: "All" }, { id: "songs", label: "Songs" }, { id: "videos", label: "Videos" }, { id: "albums", label: "Albums" }, { id: "artists", label: "Artists" }, { id: "playlists", label: "Playlists" }, { id: "podcasts", label: "Podcasts" },
];

export function SearchScreen() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const [input, setInput] = useState(q);
  const [filter, setFilter] = useState<SearchFilter>("all");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const { searchHistory, addSearch, removeSearch, clearSearchHistory } = useLibraryStore();
  const playTrack = usePlayerStore((s) => s.playTrack);
  const toast = useUiStore((s) => s.toast);
  const nav = useNavigate();
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { setInput(q); }, [q]);
  useEffect(() => { setSuggestions(mockMusicService.suggest(input)); }, [input]);

  useEffect(() => {
    if (!q) { setResults(null); return; }
    let alive = true;
    setLoading(true);
    setError(false);
    mockMusicService.search(q).then((r) => {
      if (!alive) return;
      if (q.toLowerCase() === "error") setError(true);
      else setResults(r);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [q]);

  const submit = (value: string) => {
    const v = value.trim();
    if (!v) return;
    addSearch(v);
    setParams({ q: v });
    ref.current?.blur();
  };

  const recognize = async () => {
    setRecognizing(true);
    const t = await mockMusicService.recognize();
    setRecognizing(false);
    toast(`Recognized: ${t.title} — ${t.artistNames[0]} (simulated)`);
    playTrack(t, undefined, { name: "Recognized song" });
  };

  const showIdle = !q && !recognizing;
  const total = results ? results.songs.length + results.videos.length + results.albums.length + results.artists.length + results.playlists.length + results.podcasts.length : 0;

  return (
    <div className="space-y-5">
      <div className="sticky top-0 z-20 -mx-4 bg-paper/90 px-4 pb-2 pt-3 backdrop-blur-md lg:mx-0 lg:px-0">
        <form onSubmit={(e) => { e.preventDefault(); submit(input); }} className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-mute" />
          <input ref={ref} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Search songs, artists, albums, playlists…" className="h-12 w-full rounded-full bg-ivory pl-11 pr-24 text-[15px] outline-none ring-sage placeholder:text-mute focus:ring-2" />
          <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center">
            {input && <IconButton size="sm" aria-label="Clear" onClick={() => { setInput(""); setParams({}); ref.current?.focus(); }}><X size={16} /></IconButton>}
            <IconButton size="sm" aria-label="Recognize song" onClick={recognize} className={cn(recognizing && "text-rose")}><Mic size={18} /></IconButton>
          </div>
        </form>
        {input && input !== q && suggestions.length > 0 && (
          <div className="paper mt-2 overflow-hidden rounded-md">
            {suggestions.map((s) => (
              <button key={s} type="button" onClick={() => { setInput(s); submit(s); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] hover:bg-ivory"><Search size={14} className="text-mute" /> {s}</button>
            ))}
          </div>
        )}
      </div>

      {recognizing && (
        <div className="flex flex-col items-center py-16">
          <div className="relative flex h-24 w-24 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-rose/30" />
            <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-rose text-paper"><Mic size={26} /></span>
          </div>
          <p className="mt-5 font-serif text-[22px]">Listening…</p>
          <p className="text-[13px] text-mute">Song recognition is simulated in the web prototype.</p>
        </div>
      )}

      {showIdle && (
        <>
          {searchHistory.length > 0 && (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <span className="kicker">Recent searches</span>
                <button type="button" onClick={clearSearchHistory} className="text-[12px] font-medium text-sage">Clear search history</button>
              </div>
              <div className="space-y-0.5">
                {searchHistory.map((h) => (
                  <div key={h} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-ivory">
                    <Clock size={16} className="text-mute" />
                    <button type="button" onClick={() => { setInput(h); submit(h); }} className="flex-1 text-left text-[14px]">{h}</button>
                    <button type="button" aria-label="Remove" onClick={() => removeSearch(h)} className="p-1 text-mute hover:text-ink"><X size={14} /></button>
                  </div>
                ))}
              </div>
            </section>
          )}
          <Empty title="Everything you need" body="Search for songs, artists, albums, playlists and more — or try the microphone to recognize what's playing.">
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {["Wren Hollis", "Velvet Hour", "piano", "Lisbon", "brass"].map((s) => <Chip key={s} onClick={() => { setInput(s); submit(s); }}>{s}</Chip>)}
            </div>
          </Empty>
        </>
      )}

      {q && !recognizing && (
        <>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
            {FILTERS.map((f) => <Chip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</Chip>)}
          </div>
          {loading && <Loading label={`Searching for "${q}"`} />}
          {error && (
            <Empty title="An error occurred" body="Could not reach the search service." action={<Button onClick={() => setParams({ q: q + " " })}>Retry</Button>} />
          )}
          {!loading && !error && results && total === 0 && <Empty title="No results found" body={`Nothing matched "${q}". Try another spelling.`} />}
          {!loading && !error && results && total > 0 && <Results r={results} filter={filter} q={q} onFilter={setFilter} nav={nav} />}
        </>
      )}
      {!q && !recognizing && !searchHistory.length && <Botanical className="mx-auto h-0 w-0" />}
    </div>
  );
}

function Results({ r, filter, q, onFilter, nav }: { r: SearchResults; filter: SearchFilter; q: string; onFilter: (f: SearchFilter) => void; nav: ReturnType<typeof useNavigate> }) {
  const songs = [...r.songs, ...r.videos];
  if (filter === "songs") return <List>{r.songs.length ? r.songs.map((t) => <TrackRow key={t.id} track={t} context={r.songs} sourceName={`Search: ${q}`} showAlbum />) : <NoMatch />}</List>;
  if (filter === "videos") return <List>{r.videos.length ? r.videos.map((t) => <TrackRow key={t.id} track={t} context={r.videos} sourceName={`Search: ${q}`} />) : <NoMatch />}</List>;
  if (filter === "albums") return <Grid>{r.albums.length ? r.albums.map((a) => <AlbumCard key={a.id} album={a} tracks={tracksByIds(a.trackIds)} className="w-full" />) : <NoMatch />}</Grid>;
  if (filter === "artists") return <Grid>{r.artists.length ? r.artists.map((a) => <ArtistCard key={a.id} artist={a} className="w-full" />) : <NoMatch />}</Grid>;
  if (filter === "playlists") return <Grid>{r.playlists.length ? r.playlists.map((p) => <PlaylistCard key={p.id} playlist={p} tracks={tracksByIds(p.trackIds)} className="w-full" />) : <NoMatch />}</Grid>;
  if (filter === "podcasts") return <List>{r.podcasts.length ? r.podcasts.map((p) => <PodcastRow key={p.id} p={p} onClick={() => nav(`/podcast/${p.id}`)} />) : <NoMatch />}</List>;

  const hasTop = r.artists.length + r.albums.length + songs.length > 0;
  return (
    <div className="space-y-8">
      {hasTop && (
        <section>
          <span className="kicker">Top result</span>
          {r.artists[0] ? (
            <button type="button" onClick={() => nav(`/artist/${r.artists[0].id}`)} className="paper mt-2 flex w-full items-center gap-4 rounded-lg p-4 text-left">
              <Art palette={r.artists[0].palette} seed={5} shape="circle" className="h-20 w-20" />
              <div><div className="font-serif text-[24px]">{r.artists[0].name}</div><div className="text-[13px] text-mute">Artist · {r.artists[0].subscribers} subscribers</div></div>
            </button>
          ) : r.albums[0] ? (
            <button type="button" onClick={() => nav(`/album/${r.albums[0].id}`)} className="paper mt-2 flex w-full items-center gap-4 rounded-lg p-4 text-left">
              <Art palette={r.albums[0].palette} className="h-20 w-20" />
              <div><div className="font-serif text-[24px]">{r.albums[0].title}</div><div className="text-[13px] text-mute">{r.albums[0].type} · {r.albums[0].artistNames.join(", ")}</div></div>
            </button>
          ) : (
            <div className="paper mt-2 rounded-lg p-2"><TrackRow track={songs[0]} context={songs} sourceName={`Search: ${q}`} /></div>
          )}
        </section>
      )}
      {songs.length > 0 && (
        <section className="-mx-4 lg:mx-0">
          <SectionHeader title="Songs" action="More" onAction={() => onFilter("songs")} />
          <div className="px-4 lg:px-0">{songs.slice(0, 5).map((t) => <TrackRow key={t.id} track={t} context={songs} sourceName={`Search: ${q}`} showAlbum />)}</div>
        </section>
      )}
      {r.albums.length > 0 && <section className="-mx-4 lg:mx-0"><SectionHeader title="Albums" action="More" onAction={() => onFilter("albums")} /><Carousel>{r.albums.map((a) => <AlbumCard key={a.id} album={a} tracks={tracksByIds(a.trackIds)} />)}</Carousel></section>}
      {r.artists.length > 0 && <section className="-mx-4 lg:mx-0"><SectionHeader title="Artists" action="More" onAction={() => onFilter("artists")} /><Carousel>{r.artists.map((a) => <ArtistCard key={a.id} artist={a} />)}</Carousel></section>}
      {r.playlists.length > 0 && <section className="-mx-4 lg:mx-0"><SectionHeader title="Playlists" action="More" onAction={() => onFilter("playlists")} /><Carousel>{r.playlists.map((p) => <PlaylistCard key={p.id} playlist={p} tracks={tracksByIds(p.trackIds)} />)}</Carousel></section>}
      {r.podcasts.length > 0 && <section><SectionHeader title="Podcasts" /><div className="-mx-4 px-4 lg:mx-0 lg:px-0">{r.podcasts.map((p) => <PodcastRow key={p.id} p={p} onClick={() => nav(`/podcast/${p.id}`)} />)}</div></section>}
    </div>
  );
}

function PodcastRow({ p, onClick }: { p: import("@/types").Podcast; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-ivory">
      <Art palette={p.palette} seed={9} className="h-12 w-12" />
      <div className="min-w-0"><div className="truncate text-[15px]">{p.title}</div><div className="truncate text-[13px] text-mute">Podcast · {p.author} · {p.episodes.length} episodes</div></div>
    </button>
  );
}
const List = ({ children }: { children: React.ReactNode }) => <div className="space-y-0.5">{children}</div>;
const Grid = ({ children }: { children: React.ReactNode }) => <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">{children}</div>;
const NoMatch = () => <p className="col-span-full py-10 text-center text-[14px] text-mute">No results in this category.</p>;
