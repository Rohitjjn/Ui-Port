import { TrackRow } from "@/components/cards";
import { Art, Botanical, Button, Empty, Kicker, PageHeader } from "@/components/common";
import { albumById, artistById, tracksByIds } from "@/services/mockMusicService";
import { useLibraryStore } from "@/store/libraryStore";
import { useUiStore } from "@/store/uiStore";
import { cn } from "@/utils/cn";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Share2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

function useStats() {
  const { playCounts, history } = useLibraryStore();
  return useMemo(() => {
    const entries = Object.entries(playCounts).sort((a, b) => b[1] - a[1]);
    const topTracks = tracksByIds(entries.map(([id]) => id)).slice(0, 10);
    const totalPlays = entries.reduce((a, [, n]) => a + n, 0);
    const minutes = Math.round(tracksByIds(entries.map(([id]) => id)).reduce((a, t) => a + (playCounts[t.id] ?? 0) * t.duration, 0) / 60);
    const artistCounts: Record<string, number> = {};
    const albumCounts: Record<string, number> = {};
    entries.forEach(([id, n]) => {
      const t = tracksByIds([id])[0];
      if (!t) return;
      t.artistIds.forEach((a) => (artistCounts[a] = (artistCounts[a] ?? 0) + n));
      if (t.albumId) albumCounts[t.albumId] = (albumCounts[t.albumId] ?? 0) + n;
    });
    const topArtists = Object.entries(artistCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, n]) => ({ artist: artistById(id)!, n }));
    const topAlbums = Object.entries(albumCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, n]) => ({ album: albumById(id)!, n }));
    const hours = new Array(24).fill(0);
    history.forEach((h) => hours[new Date(h.at).getHours()]++);
    if (!history.length) [8, 9, 13, 18, 19, 20, 22].forEach((h, i) => (hours[h] = 3 + i));
    const days = new Array(7).fill(0);
    history.forEach((h) => days[new Date(h.at).getDay()]++);
    if (!history.length) [4, 6, 5, 7, 9, 12, 8].forEach((v, i) => (days[i] = v));
    const peakHour = hours.indexOf(Math.max(...hours));
    const decades: Record<string, number> = {};
    topTracks.forEach((t) => { const d = `${Math.floor((t.year ?? 2020) / 10) * 10}s`; decades[d] = (decades[d] ?? 0) + (playCounts[t.id] ?? 0); });
    return { topTracks, totalPlays, minutes, topArtists, topAlbums, hours, days, peakHour, decades, enough: totalPlays >= 10 };
  }, [playCounts, history]);
}

export function AnalyticsScreen() {
  const s = useStats();
  const toast = useUiStore((x) => x.toast);
  const nav = useNavigate();
  const { playCounts } = useLibraryStore();
  const maxH = Math.max(...s.hours, 1);
  const maxD = Math.max(...s.days, 1);
  return (
    <div className="space-y-6">
      <PageHeader back={false} title="Analytics" subtitle="Local listening insights · nothing is uploaded" right={<Button size="sm" variant="soft" icon={<Share2 size={14} />} onClick={() => toast("Listening receipt image generated (simulated)")}>Receipt</Button>} />
      {!s.enough && <Empty title="Not enough data yet" body="Play at least 10 songs and your insights will appear here." action={<Button onClick={() => nav("/")}>Go listen</Button>} />}
      <div className="grid grid-cols-3 gap-3">
        {[["Minutes", s.minutes], ["Plays", s.totalPlays], ["Artists", s.topArtists.length]].map(([k, v]) => (
          <div key={k} className="paper rounded-lg p-4"><Kicker>{k}</Kicker><div className="mt-1 font-serif text-[30px] tabular">{v}</div></div>
        ))}
      </div>
      <section className="paper rounded-lg p-4">
        <Kicker>Listening clock</Kicker>
        <div className="mt-3 flex h-28 items-end gap-[3px]">{s.hours.map((v, i) => <div key={i} title={`${i}:00 — ${v} plays`} className={cn("flex-1 rounded-t-sm", i === s.peakHour ? "bg-sage" : "bg-sand")} style={{ height: `${Math.max(4, (v / maxH) * 100)}%` }} />)}</div>
        <div className="mt-1 flex justify-between text-[10px] text-mute"><span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>24h</span></div>
        <p className="mt-2 text-[13px] text-charcoal">Peak listening around <b>{s.peakHour}:00</b>.</p>
      </section>
      <section className="paper rounded-lg p-4">
        <Kicker>By weekday</Kicker>
        <div className="mt-3 flex h-24 items-end gap-2">{s.days.map((v, i) => <div key={i} className="flex flex-1 flex-col items-center gap-1"><div className="w-full rounded-t-sm bg-olive" style={{ height: `${Math.max(4, (v / maxD) * 80)}px` }} /><span className="text-[10px] text-mute">{"SMTWTFS"[i]}</span></div>)}</div>
      </section>
      <section className="paper rounded-lg p-4">
        <Kicker>Top artists</Kicker>
        <div className="mt-2 divide-y divide-line">{s.topArtists.map(({ artist, n }, i) => <button key={artist.id} type="button" onClick={() => nav(`/artist/${artist.id}`)} className="flex w-full items-center gap-3 py-2 text-left"><span className="w-5 font-serif text-[18px] text-mute">{i + 1}</span><Art palette={artist.palette} seed={5} shape="circle" className="h-10 w-10" /><span className="flex-1">{artist.name}</span><span className="text-[12px] tabular text-mute">{n} plays</span></button>)}</div>
      </section>
      <section className="paper rounded-lg p-3">
        <Kicker className="px-2 pt-1">Top tracks</Kicker>
        {s.topTracks.map((t, i) => <TrackRow key={t.id} track={t} index={i} context={s.topTracks} sourceName="Top tracks" dense trailing={<span className="pr-2 text-[12px] tabular text-mute">{playCounts[t.id]}×</span>} />)}
      </section>
      <section className="paper relative overflow-hidden rounded-lg p-5 font-mono text-[12px] leading-relaxed">
        <Botanical className="absolute -right-4 -top-4 h-24 w-24 text-olive/20" />
        <div className="text-center font-serif text-[18px] tracking-wide">LISTENING RECEIPT</div>
        <div className="text-center text-mute">{new Date().toLocaleDateString()}</div>
        <div className="my-3 border-t border-dashed border-sand" />
        {s.topTracks.slice(0, 5).map((t) => <div key={t.id} className="flex justify-between"><span className="truncate pr-4">{t.title}</span><span>{playCounts[t.id]}</span></div>)}
        <div className="my-3 border-t border-dashed border-sand" />
        <div className="flex justify-between font-semibold"><span>TOTAL MINUTES</span><span>{s.minutes}</span></div>
        <div className="mt-3 text-center text-mute">THANK YOU FOR LISTENING</div>
      </section>
    </div>
  );
}

export function WrappedScreen() {
  const s = useStats();
  const nav = useNavigate();
  const toast = useUiStore((x) => x.toast);
  const [i, setI] = useState(0);
  const year = new Date().getFullYear();
  if (!s.enough) return <Empty title="Wrapped isn't ready" body="We need a little more listening history before we can fold your year." action={<Button onClick={() => nav(-1)}>Back</Button>} />;
  const cards = [
    { bg: "bg-ink text-paper", body: <><Kicker className="text-sand">SimpMusic Wrapped</Kicker><h2 className="mt-4 font-serif text-[44px] leading-none">Your {year},<br />folded on paper.</h2><p className="mt-6 text-sand">Swipe to open</p></> },
    { bg: "bg-sage text-paper", body: <><Kicker className="text-paper/70">Minutes listened</Kicker><div className="mt-4 font-serif text-[88px] leading-none tabular">{s.minutes}</div><p className="mt-4 text-paper/80">That's {Math.round(s.minutes / 60 * 10) / 10} hours of music tracked locally.</p></> },
    { bg: "bg-ivory text-ink", body: <><Kicker>Top tracks</Kicker><ol className="mt-4 space-y-3">{s.topTracks.slice(0, 5).map((t, k) => <li key={t.id} className="flex items-center gap-3"><span className="font-serif text-[28px] text-mute">{k + 1}</span><Art palette={t.palette} seed={t.id.charCodeAt(1)} className="h-12 w-12" /><span><span className="block font-medium">{t.title}</span><span className="block text-[13px] text-mute">{t.artistNames[0]}</span></span></li>)}</ol></> },
    { bg: "bg-rose/60 text-ink", body: <><Kicker>Top artists</Kicker><div className="mt-4 space-y-3">{s.topArtists.map(({ artist }, k) => <div key={artist.id} className="flex items-center gap-3"><span className="font-serif text-[28px] text-ink/50">{k + 1}</span><Art palette={artist.palette} seed={5} shape="circle" className="h-12 w-12" /><span className="font-serif text-[22px]">{artist.name}</span></div>)}</div></> },
    { bg: "bg-sand text-ink", body: <><Kicker>Top albums</Kicker><div className="mt-4 grid grid-cols-2 gap-3">{s.topAlbums.slice(0, 4).map(({ album }) => <div key={album.id}><Art palette={album.palette} className="aspect-square w-full" /><div className="mt-1 truncate text-[13px] font-medium">{album.title}</div></div>)}</div></> },
    { bg: "bg-card text-ink", body: <><Kicker>Your listening clock</Kicker><div className="mt-4 font-serif text-[56px] leading-none">{s.peakHour}:00</div><p className="mt-2 text-charcoal">is when you press play most. {s.peakHour >= 21 || s.peakHour < 5 ? "A night owl." : s.peakHour < 11 ? "An early riser." : "An afternoon listener."}</p><div className="mt-6 flex h-20 items-end gap-[2px]">{s.hours.map((v, k) => <div key={k} className={cn("flex-1 rounded-t-sm", k === s.peakHour ? "bg-sage" : "bg-sand")} style={{ height: `${Math.max(4, (v / Math.max(...s.hours, 1)) * 100)}%` }} />)}</div></> },
    { bg: "bg-olive text-ink", body: <><Kicker className="text-ink/60">Decades</Kicker><div className="mt-4 space-y-2">{Object.entries(s.decades).sort((a, b) => b[1] - a[1]).map(([d, n]) => <div key={d} className="flex items-center gap-3"><span className="w-16 font-serif text-[24px]">{d}</span><div className="h-3 flex-1 rounded-full bg-ink/10"><div className="h-full rounded-full bg-ink" style={{ width: `${(n / Math.max(...Object.values(s.decades))) * 100}%` }} /></div></div>)}</div></> },
    { bg: "bg-ink text-paper", body: <><Kicker className="text-sand">Listener type</Kicker><h2 className="mt-4 font-serif text-[40px] leading-tight">{s.topArtists.length >= 5 ? "The Curator" : "The Devotee"}</h2><p className="mt-3 text-sand">{s.topArtists.length >= 5 ? "You spread your plays across many voices." : "You go deep with a few favourite artists."}</p><Button className="mt-8 bg-paper text-ink" icon={<Share2 size={16} />} onClick={() => toast("Wrapped card shared (simulated)")}>Share</Button></> },
  ];
  return (
    <div className="fixed inset-0 z-[55] flex flex-col bg-paper">
      <div className="flex items-center justify-between px-4 pt-4">
        <div className="flex flex-1 gap-1 pr-4">{cards.map((_, k) => <div key={k} className={cn("h-1 flex-1 rounded-full", k <= i ? "bg-ink" : "bg-sand")} />)}</div>
        <button type="button" aria-label="Close" onClick={() => nav(-1)} className="rounded-full p-2 hover:bg-ivory"><X size={20} /></button>
      </div>
      <div className="relative flex flex-1 items-center justify-center p-4">
        <AnimatePresence mode="wait">
          <motion.div key={i} initial={{ opacity: 0, x: 40, rotate: 1 }} animate={{ opacity: 1, x: 0, rotate: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ type: "spring", stiffness: 300, damping: 30 }} drag="x" dragConstraints={{ left: 0, right: 0 }} onDragEnd={(_, info) => (info.offset.x < -60 ? setI((v) => Math.min(cards.length - 1, v + 1)) : info.offset.x > 60 ? setI((v) => Math.max(0, v - 1)) : null)} className={cn("relative aspect-[9/14] w-full max-w-[380px] overflow-hidden rounded-xl p-7 shadow-lift", cards[i].bg)}>
            <Botanical className="pointer-events-none absolute -bottom-8 -right-8 h-40 w-40 opacity-15" />
            {cards[i].body}
          </motion.div>
        </AnimatePresence>
        <button type="button" aria-label="Previous" onClick={() => setI((v) => Math.max(0, v - 1))} disabled={i === 0} className="absolute left-2 rounded-full bg-card/80 p-2 shadow-paper disabled:opacity-0 lg:left-10"><ChevronLeft /></button>
        <button type="button" aria-label="Next" onClick={() => setI((v) => Math.min(cards.length - 1, v + 1))} disabled={i === cards.length - 1} className="absolute right-2 rounded-full bg-card/80 p-2 shadow-paper disabled:opacity-0 lg:right-10"><ChevronRight /></button>
      </div>
    </div>
  );
}
