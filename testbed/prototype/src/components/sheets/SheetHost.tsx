import { Art, Button, Chip, Mosaic, OptionList, SheetRow, SheetShell, Slider, Toggle } from "@/components/common";
import { tracksByIds } from "@/services/mockMusicService";
import { useLibraryStore } from "@/store/libraryStore";
import { usePlayerStore } from "@/store/playerStore";
import { useSettingsStore, type LyricsProvider } from "@/store/settingsStore";
import { useUiStore, type SheetKind } from "@/store/uiStore";
import { cn } from "@/utils/cn";
import { CheckSquare, MessageCircle, Check, Copy, Disc3, Download, Heart, Info, ListEnd, ListPlus, ListStart, Mic2, Moon, Pencil, Radio, Share2, Trash2, User, Gauge, Link, Image, RefreshCw, Headphones, Speaker, Cast, Plus, Link2 } from "lucide-react";
import { useState } from "react";
import { CommentsSheet } from "./CommentsSheet";
import { useNavigate } from "react-router-dom";

function TrackSheet({ s }: { s: Extract<SheetKind, { kind: "track" }> }) {
  const { track } = s;
  const close = useUiStore((x) => x.closeSheet);
  const openSheet = useUiStore((x) => x.openSheet);
  const toast = useUiStore((x) => x.toast);
  const nav = useNavigate();
  const lib = useLibraryStore();
  const player = usePlayerStore();
  const liked = lib.favorites.includes(track.id);
  const dl = lib.downloads[track.id];
  const go = (p: string) => { close(); useUiStore.getState().closePlayer(); nav(p); };
  return (
    <>
      <div className="flex items-center gap-3 pb-3">
        <Art palette={track.palette} seed={track.id.charCodeAt(1)} className="h-14 w-14" />
        <div className="min-w-0">
          <div className="truncate font-medium">{track.title}</div>
          <div className="truncate text-[13px] text-mute">{track.artistNames.join(", ")}{track.albumName ? ` · ${track.albumName}` : ""}</div>
        </div>
      </div>
      <div className="divide-y divide-line">
        <div>
          <SheetRow icon={<Heart size={20} fill={liked ? "currentColor" : "none"} className={liked ? "text-rose" : ""} />} label={liked ? "Liked" : "Like"} onClick={() => { lib.toggleFavorite(track.id); close(); }} />
          <SheetRow icon={<ListPlus size={20} />} label="Add to a playlist" onClick={() => openSheet({ kind: "addToPlaylist", tracks: [track] })} />
          <SheetRow icon={<CheckSquare size={20} />} label="Select" sub="Pick multiple songs to act on together" onClick={() => { useUiStore.getState().startSelection(track.id); close(); }} />
          <SheetRow icon={<ListStart size={20} />} label="Play next" onClick={() => { player.playNext(track); toast("Will play next"); close(); }} />
          <SheetRow icon={<ListEnd size={20} />} label="Add to queue" sub={player.source.isRadio ? "Disabled for radio queue" : undefined} disabled={player.source.isRadio} onClick={() => { player.addToQueue([track]); toast("Added to queue"); close(); }} />
          <SheetRow icon={<Radio size={20} />} label="Start radio" onClick={() => { import("@/services/mockMusicService").then(({ mockMusicService }) => player.setQueue(mockMusicService.radio(track), 0, { name: `${track.title} Radio`, isRadio: true }, false)); close(); }} />
          {s.queueIndex !== undefined && s.queueIndex !== player.index && (
            <SheetRow icon={<Trash2 size={20} />} label="Delete from queue" onClick={() => { player.removeFromQueue(s.queueIndex!); close(); }} />
          )}
          {s.fromPlaylistId && (
            <SheetRow icon={<Trash2 size={20} />} label="Remove from playlist" danger onClick={() => { lib.removeFromPlaylist(s.fromPlaylistId!, track.id); toast("Removed from playlist"); close(); }} />
          )}
        </div>
        <div>
          <SheetRow icon={<Download size={20} className={dl === "downloaded" ? "text-sage" : ""} />} label={dl === "downloaded" ? "Remove download" : dl === "downloading" ? "Downloading…" : "Download"} sub="Simulated — nothing is written to disk" onClick={() => { dl === "downloaded" ? lib.removeDownload([track.id]) : lib.download([track.id]); close(); }} />
          <SheetRow icon={<Disc3 size={20} />} label="Album" sub={track.albumName} disabled={!track.albumId} onClick={() => go(`/album/${track.albumId}`)} />
          <SheetRow icon={<User size={20} />} label="Artists" sub={track.artistNames.join(", ")} onClick={() => go(`/artist/${track.artistIds[0]}`)} />
          <SheetRow icon={<Info size={20} />} label="Song info" onClick={() => openSheet({ kind: "songInfo", track })} />
          <SheetRow icon={<MessageCircle size={20} />} label="Comments" sub="YouTube comments (simulated)" onClick={() => openSheet({ kind: "comments", track })} />
        </div>
        <div>
          <SheetRow icon={<Moon size={20} />} label="Sleep timer" onClick={() => openSheet({ kind: "sleepTimer" })} />
          <SheetRow icon={<Gauge size={20} />} label="Playback speed & pitch" onClick={() => openSheet({ kind: "speedPitch" })} />
          <SheetRow icon={<Mic2 size={20} />} label="Main lyrics provider" onClick={() => openSheet({ kind: "lyricsProvider" })} />
          <SheetRow icon={<Share2 size={20} />} label="Share" onClick={() => openSheet({ kind: "share", title: track.title, url: `https://music.youtube.com/watch?v=${track.id}` })} />
        </div>
      </div>
    </>
  );
}

function AddToPlaylistSheet({ tracks }: { tracks: typeof useLibraryStore extends never ? never : import("@/types").Track[] }) {
  const { playlists, addToPlaylist } = useLibraryStore();
  const close = useUiStore((x) => x.closeSheet);
  const openSheet = useUiStore((x) => x.openSheet);
  const toast = useUiStore((x) => x.toast);
  return (
    <div className="space-y-1">
      <SheetRow icon={<Plus size={20} />} label="New playlist" onClick={() => openSheet({ kind: "createPlaylist", addTracks: tracks })} />
      {playlists.length === 0 && <p className="py-4 text-center text-[13px] text-mute">No playlist found</p>}
      {playlists.map((p) => (
        <button key={p.id} type="button" onClick={() => { addToPlaylist(p.id, tracks.map((t) => t.id)); toast(`Saved to ${p.title}`); close(); }} className="flex w-full items-center gap-3 rounded-md px-2 py-2 hover:bg-ivory">
          <Mosaic palettes={tracksByIds(p.trackIds).map((t) => t.palette)} className="h-12 w-12" />
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate">{p.title}</span>
            <span className="block text-[12px] text-mute">{p.trackIds.length} songs</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function CreatePlaylistSheet({ addTracks }: { addTracks?: import("@/types").Track[] }) {
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const create = useLibraryStore((x) => x.createPlaylist);
  const close = useUiStore((x) => x.closeSheet);
  const toast = useUiStore((x) => x.toast);
  const nav = useNavigate();
  const submit = () => {
    if (!name.trim()) return setErr("Playlist name cannot be empty");
    const p = create(name.trim(), addTracks?.map((t) => t.id));
    toast(`Created "${p.title}"`);
    close();
    if (!addTracks) nav(`/playlist/${p.id}`);
  };
  return (
    <div className="space-y-4">
      <input autoFocus value={name} onChange={(e) => { setName(e.target.value); setErr(""); }} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="Playlist title" className="h-12 w-full rounded-md bg-ivory px-4 text-[15px] outline-none ring-sage focus:ring-2" />
      {err && <p className="text-[12px] text-rose">{err}</p>}
      {addTracks && <p className="text-[13px] text-mute">{addTracks.length} song{addTracks.length > 1 ? "s" : ""} will be added.</p>}
      <div className="flex justify-end gap-2">
        <Button variant="soft" onClick={close}>Cancel</Button>
        <Button onClick={submit}>Create</Button>
      </div>
    </div>
  );
}

function SleepTimerSheet() {
  const { sleepTimer, setSleepTimer } = usePlayerStore();
  const close = useUiStore((x) => x.closeSheet);
  const toast = useUiStore((x) => x.toast);
  const [custom, setCustom] = useState(20);
  const remaining = sleepTimer && !sleepTimer.endOfSong ? Math.max(0, Math.round((sleepTimer.endsAt - Date.now()) / 60000)) : null;
  return (
    <div className="space-y-4">
      {sleepTimer && <div className="rounded-md bg-ivory p-3 text-[13px]">{sleepTimer.endOfSong ? "Timer set: end of song" : `Timer set: ~${remaining} min remaining`}</div>}
      <div className="flex flex-wrap gap-2">
        {[5, 10, 15, 30, 45, 60].map((m) => (
          <Chip key={m} onClick={() => { setSleepTimer(m); toast(`Sleep timer: ${m} minutes`); close(); }}>{m} min</Chip>
        ))}
        <Chip onClick={() => { setSleepTimer("end"); toast("Sleep timer: end of song"); close(); }}>End of song</Chip>
      </div>
      <div>
        <div className="mb-1 flex justify-between text-[13px]"><span>Custom</span><span className="tabular">{custom} min</span></div>
        <Slider value={custom} min={1} max={120} onChange={setCustom} ariaLabel="Custom minutes" />
        <Button size="sm" className="mt-2" onClick={() => { setSleepTimer(custom); toast(`Sleep timer: ${custom} minutes`); close(); }}>Set</Button>
      </div>
      {sleepTimer && <Button variant="danger" size="sm" onClick={() => { setSleepTimer(null); toast("Sleep timer off"); close(); }}>Turn off</Button>}
    </div>
  );
}

function SpeedPitchSheet() {
  const { speed, pitch, setSpeedPitch } = usePlayerStore();
  const [s, setS] = useState(speed);
  const [p, setP] = useState(pitch);
  const close = useUiStore((x) => x.closeSheet);
  return (
    <div className="space-y-5">
      <div>
        <div className="mb-1 flex justify-between text-[13px]"><span>Playback speed</span><span className="tabular">{s.toFixed(2)}×</span></div>
        <Slider value={s} min={0.25} max={2} step={0.05} onChange={setS} ariaLabel="Speed" />
      </div>
      <div>
        <div className="mb-1 flex justify-between text-[13px]"><span>Pitch</span><span className="tabular">{p.toFixed(2)}</span></div>
        <Slider value={p} min={0.5} max={1.5} step={0.05} onChange={setP} ariaLabel="Pitch" />
      </div>
      <p className="text-[12px] text-mute">Speed affects the simulated progress clock. Audio DSP is not available in the web prototype.</p>
      <div className="flex justify-end gap-2">
        <Button variant="soft" onClick={() => { setS(1); setP(1); }}>Reset</Button>
        <Button onClick={() => { setSpeedPitch(+s.toFixed(2), +p.toFixed(2)); close(); }}>Apply</Button>
      </div>
    </div>
  );
}

function LyricsProviderSheet() {
  const { lyricsProvider, set } = useSettingsStore();
  const close = useUiStore((x) => x.closeSheet);
  return (
    <OptionList<LyricsProvider>
      value={lyricsProvider}
      onChange={(v) => { set("lyricsProvider", v); close(); }}
      options={[
        { id: "simpmusic", label: "SimpMusic Lyrics", sub: "Community database with word sync" },
        { id: "lrclib", label: "LRCLIB", sub: "Open lyrics database" },
        { id: "spotify", label: "Spotify", sub: "Requires Spotify login (simulated)" },
        { id: "youtube_transcript", label: "YouTube transcript", sub: "Unsynced fallback" },
      ]}
    />
  );
}

function ShareSheet({ title, url }: { title: string; url: string }) {
  const toast = useUiStore((x) => x.toast);
  const close = useUiStore((x) => x.closeSheet);
  return (
    <div className="space-y-3">
      <div className="truncate rounded-md bg-ivory px-3 py-2 text-[13px] text-charcoal">{url}</div>
      <SheetRow icon={<Copy size={20} />} label="Copy link" onClick={() => { navigator.clipboard?.writeText(url).catch(() => {}); toast("Copied to clipboard"); close(); }} />
      <SheetRow icon={<Share2 size={20} />} label="Share…" sub={title} onClick={() => { if (navigator.share) navigator.share({ title, url }).catch(() => {}); else toast("System share unavailable — link copied"); close(); }} />
      <SheetRow icon={<Image size={20} />} label="Share as image" sub="Generates a PaperCraft card (simulated)" onClick={() => { toast("Image card generated (simulated)"); close(); }} />
    </div>
  );
}

function PlaylistOptionsSheet({ playlist }: { playlist: import("@/types").Playlist }) {
  const lib = useLibraryStore();
  const close = useUiStore((x) => x.closeSheet);
  const openSheet = useUiStore((x) => x.openSheet);
  const toast = useUiStore((x) => x.toast);
  const nav = useNavigate();
  const player = usePlayerStore();
  const tracks = tracksByIds(playlist.trackIds);
  const local = playlist.kind === "local";
  const likedRemote = lib.likedPlaylists.includes(playlist.id);
  return (
    <div className="divide-y divide-line">
      <div>
        <SheetRow icon={<ListStart size={20} />} label="Play next" onClick={() => { tracks.slice().reverse().forEach((t) => player.playNext(t)); toast("Playlist will play next"); close(); }} />
        <SheetRow icon={<ListEnd size={20} />} label="Add to queue" onClick={() => { player.addToQueue(tracks); toast("Added to queue"); close(); }} />
        <SheetRow icon={<Radio size={20} />} label="Start radio" onClick={() => { player.setQueue(tracks.slice().sort(() => Math.random() - 0.5), 0, { name: `${playlist.title} Radio`, isRadio: true }, false); close(); }} />
      </div>
      {local ? (
        <div>
          <SheetRow icon={<Pencil size={20} />} label="Edit title" onClick={() => openSheet({ kind: "prompt", title: "Edit title", label: "Playlist title", initial: playlist.title, onSubmit: (v) => { lib.renamePlaylist(playlist.id, v); toast("Title updated"); } })} />
          <SheetRow icon={<Image size={20} />} label="Edit thumbnail" sub="Cycles generated paper covers" onClick={() => { lib.setPlaylistPalette(playlist.id, (playlist.palette + 1) % 16); toast("Thumbnail updated"); close(); }} />
          <SheetRow icon={<RefreshCw size={20} />} label={playlist.synced ? "Unsync from YouTube" : "Sync to YouTube"} sub="Simulated — no account connected" onClick={() => openSheet({ kind: "confirm", title: playlist.synced ? "Unsync playlist?" : "Sync playlist?", body: playlist.synced ? "This playlist will stop mirroring to your YouTube account." : "A YouTube playlist would be created and kept in sync. In this prototype only the flag changes.", onConfirm: () => { lib.toggleSyncPlaylist(playlist.id); toast(playlist.synced ? "Unsynced" : "Synced"); } })} />
          <SheetRow icon={<Download size={20} />} label="Download all" onClick={() => { lib.download(playlist.trackIds); toast("Downloading playlist (simulated)"); close(); }} />
          <SheetRow icon={<Trash2 size={20} />} label="Delete playlist" danger onClick={() => openSheet({ kind: "confirm", title: "Delete playlist?", body: `"${playlist.title}" will be removed from your library.`, danger: true, confirmLabel: "Delete", onConfirm: () => { lib.deletePlaylist(playlist.id); toast("Playlist deleted"); nav("/library"); } })} />
        </div>
      ) : (
        <div>
          <SheetRow icon={<Heart size={20} fill={likedRemote ? "currentColor" : "none"} className={likedRemote ? "text-rose" : ""} />} label={likedRemote ? "Remove from library" : "Save to library"} onClick={() => { lib.toggleLikedPlaylist(playlist.id); close(); }} />
          <SheetRow icon={<ListPlus size={20} />} label="Save to local playlist" onClick={() => { const p = lib.createPlaylist(playlist.title, playlist.trackIds); toast(`Saved to local playlist "${p.title}"`); close(); }} />
          <SheetRow icon={<Download size={20} />} label="Download all" onClick={() => { lib.download(playlist.trackIds); toast("Downloading playlist (simulated)"); close(); }} />
        </div>
      )}
      <div>
        <SheetRow icon={<Share2 size={20} />} label="Share" onClick={() => openSheet({ kind: "share", title: playlist.title, url: `https://music.youtube.com/playlist?list=${playlist.id}` })} />
      </div>
    </div>
  );
}

function AccountSheet() {
  const { accounts, set } = useSettingsStore();
  const toast = useUiStore((x) => x.toast);
  const close = useUiStore((x) => x.closeSheet);
  const nav = useNavigate();
  return (
    <div className="space-y-3">
      <div className="rounded-md bg-ivory p-4">
        <div className="kicker">YouTube Music</div>
        <div className="mt-1 font-serif text-[20px]">{accounts.youtube ?? "Guest"}</div>
        <p className="mt-1 text-[13px] text-mute">{accounts.youtube ? "Signed in (simulated session)" : "Log in to see your YouTube playlists, liked songs and personalised home."}</p>
        <div className="mt-3 flex gap-2">
          {accounts.youtube ? (
            <Button variant="outline" size="sm" onClick={() => { set("accounts", { ...accounts, youtube: null }); toast("Logged out"); }}>Log out</Button>
          ) : (
            <Button size="sm" onClick={() => { set("accounts", { ...accounts, youtube: "paper.listener@example.com" }); toast("Signed in (simulated)"); }}>Log in (simulated)</Button>
          )}
          <Button variant="soft" size="sm" onClick={() => { close(); nav("/account"); }}>Manage accounts</Button>
        </div>
      </div>
      <p className="text-[12px] text-mute">No real authentication happens in this web prototype.</p>
    </div>
  );
}

function OutputSheet() {
  const [sel, setSel] = useState("this");
  const close = useUiStore((x) => x.closeSheet);
  const toast = useUiStore((x) => x.toast);
  const opts = [
    { id: "this", label: "This device", icon: Speaker },
    { id: "hp", label: "Paper Buds (simulated)", icon: Headphones },
    { id: "cast", label: "Living room speaker (Cast · simulated)", icon: Cast },
  ];
  return (
    <div className="space-y-1">
      {opts.map((o) => (
        <button key={o.id} type="button" onClick={() => { setSel(o.id); toast(o.id === "this" ? "Playing on this device" : `Connected to ${o.label.split(" (")[0]} (simulated)`); close(); }} className="flex w-full items-center gap-3 rounded-md px-2 py-3 hover:bg-ivory">
          <o.icon size={20} className="text-charcoal" />
          <span className="flex-1 text-left">{o.label}</span>
          {sel === o.id && <Check size={18} className="text-sage" />}
        </button>
      ))}
    </div>
  );
}

function SongInfoSheet({ track }: { track: import("@/types").Track }) {
  const rows: [string, string][] = [["Title", track.title], ["Artists", track.artistNames.join(", ")], ["Album", track.albumName ?? "—"], ["Year", String(track.year ?? "—")], ["Duration", `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, "0")}`], ["Plays", String(track.plays)], ["BPM", String(track.bpm)], ["Key", track.key ?? "—"], ["Video ID", track.id]];
  return (
    <div className="divide-y divide-line">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between py-2.5 text-[14px]"><span className="text-mute">{k}</span><span>{v}</span></div>
      ))}
    </div>
  );
}

function AddLyricsSheet({ track }: { track: import("@/types").Track }) {
  const [text, setText] = useState("");
  const toast = useUiStore((x) => x.toast);
  const close = useUiStore((x) => x.closeSheet);
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-mute">Contribute lyrics for <b>{track.title}</b> to the SimpMusic Lyrics database. Paste plain or LRC‑timed lyrics.</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} placeholder="[00:06.00] First line…" className="w-full rounded-md bg-ivory p-3 text-[14px] outline-none ring-sage focus:ring-2" />
      <div className="flex justify-end gap-2">
        <Button variant="soft" onClick={close}>Cancel</Button>
        <Button disabled={!text.trim()} onClick={() => { toast("Lyrics submitted (simulated)"); close(); }}>Submit</Button>
      </div>
    </div>
  );
}

function ShareLyricsSheet({ track, lines }: { track: import("@/types").Track; lines: string[] }) {
  const [style, setStyle] = useState(0);
  const toast = useUiStore((x) => x.toast);
  const close = useUiStore((x) => x.closeSheet);
  const bgs = ["bg-ivory text-ink", "bg-ink text-paper", "bg-sage text-paper", "bg-rose/70 text-ink"];
  return (
    <div className="space-y-4">
      <div className={cn("rounded-lg p-6 shadow-paper", bgs[style])}>
        <div className="flex items-center gap-3">
          <Art palette={track.palette} seed={track.id.charCodeAt(1)} className="h-12 w-12" />
          <div><div className="text-[14px] font-medium">{track.title}</div><div className="text-[12px] opacity-70">{track.artistNames.join(", ")}</div></div>
        </div>
        <div className="mt-5 space-y-2 font-serif text-[22px] leading-tight">{lines.map((l, i) => <p key={i}>{l}</p>)}</div>
        <div className="mt-5 text-[10px] uppercase tracking-widest opacity-60">SimpMusic · PaperCraft</div>
      </div>
      <div className="flex gap-2">{bgs.map((b, i) => <button key={i} type="button" aria-label={`Style ${i + 1}`} onClick={() => setStyle(i)} className={cn("h-8 w-8 rounded-full border-2", b.split(" ")[0], style === i ? "border-sage" : "border-transparent")} />)}</div>
      <Button className="w-full" icon={<Share2 size={16} />} onClick={() => { toast("Lyrics card shared (simulated)"); close(); }}>Share card</Button>
    </div>
  );
}

function PromptSheet({ s }: { s: Extract<SheetKind, { kind: "prompt" }> }) {
  const [v, setV] = useState(s.initial ?? "");
  const close = useUiStore((x) => x.closeSheet);
  return (
    <div className="space-y-4">
      <label className="block text-[13px] text-mute">{s.label}</label>
      <input autoFocus value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === "Enter" && v.trim() && (s.onSubmit(v.trim()), close())} className="h-12 w-full rounded-md bg-ivory px-4 outline-none ring-sage focus:ring-2" />
      <div className="flex justify-end gap-2">
        <Button variant="soft" onClick={close}>Cancel</Button>
        <Button disabled={!v.trim()} onClick={() => { s.onSubmit(v.trim()); close(); }}>Save</Button>
      </div>
    </div>
  );
}

export function SheetHost() {
  const sheet = useUiStore((x) => x.sheet);
  const close = useUiStore((x) => x.closeSheet);
  const titles: Record<SheetKind["kind"], string | undefined> = {
    track: undefined, addToPlaylist: "Add to a playlist", createPlaylist: "New playlist", playlistOptions: undefined, albumOptions: undefined, artistOptions: undefined, sleepTimer: "Sleep timer", speedPitch: "Speed & pitch", lyricsProvider: "Lyrics provider", songInfo: "Song info", share: "Share", sort: "Sort by", account: "Account", output: "Output", info: undefined, confirm: undefined, prompt: undefined, addLyrics: "Add lyrics", shareLyrics: "Share lyrics", comments: "Comments",
  };
  const title = sheet ? (sheet.kind === "info" || sheet.kind === "confirm" || sheet.kind === "prompt" ? sheet.title : sheet.kind === "playlistOptions" ? sheet.playlist.title : sheet.kind === "albumOptions" ? sheet.album.title : sheet.kind === "artistOptions" ? sheet.artist.name : titles[sheet.kind]) : undefined;
  return (
    <SheetShell open={!!sheet} onClose={close} title={title} wide={sheet?.kind === "shareLyrics" || sheet?.kind === "comments"}>
      {sheet?.kind === "track" && <TrackSheet s={sheet} />}
      {sheet?.kind === "addToPlaylist" && <AddToPlaylistSheet tracks={sheet.tracks} />}
      {sheet?.kind === "createPlaylist" && <CreatePlaylistSheet addTracks={sheet.addTracks} />}
      {sheet?.kind === "playlistOptions" && <PlaylistOptionsSheet playlist={sheet.playlist} />}
      {sheet?.kind === "albumOptions" && <AlbumOptionsSheet album={sheet.album} />}
      {sheet?.kind === "artistOptions" && <ArtistOptionsSheet artist={sheet.artist} />}
      {sheet?.kind === "sleepTimer" && <SleepTimerSheet />}
      {sheet?.kind === "speedPitch" && <SpeedPitchSheet />}
      {sheet?.kind === "lyricsProvider" && <LyricsProviderSheet />}
      {sheet?.kind === "songInfo" && <SongInfoSheet track={sheet.track} />}
      {sheet?.kind === "share" && <ShareSheet title={sheet.title} url={sheet.url} />}
      {sheet?.kind === "account" && <AccountSheet />}
      {sheet?.kind === "output" && <OutputSheet />}
      {sheet?.kind === "addLyrics" && <AddLyricsSheet track={sheet.track} />}
      {sheet?.kind === "shareLyrics" && <ShareLyricsSheet track={sheet.track} lines={sheet.lines} />}
      {sheet?.kind === "comments" && <CommentsSheet track={sheet.track} />}
      {sheet?.kind === "prompt" && <PromptSheet s={sheet} />}
      {sheet?.kind === "sort" && <OptionList value={sheet.current} onChange={(v) => { sheet.onPick(v); close(); }} options={sheet.options} />}
      {sheet?.kind === "info" && <div className="space-y-4"><p className="text-[14px] text-charcoal">{sheet.body}</p><Button className="w-full" onClick={close}>OK</Button></div>}
      {sheet?.kind === "confirm" && (
        <div className="space-y-4">
          <p className="text-[14px] text-charcoal">{sheet.body}</p>
          <div className="flex justify-end gap-2">
            <Button variant="soft" onClick={close}>Cancel</Button>
            <Button variant={sheet.danger ? "danger" : "primary"} onClick={() => { sheet.onConfirm(); close(); }}>{sheet.confirmLabel ?? "Yes"}</Button>
          </div>
        </div>
      )}
    </SheetShell>
  );
}

function AlbumOptionsSheet({ album }: { album: import("@/types").Album }) {
  const lib = useLibraryStore();
  const player = usePlayerStore();
  const close = useUiStore((x) => x.closeSheet);
  const openSheet = useUiStore((x) => x.openSheet);
  const toast = useUiStore((x) => x.toast);
  const nav = useNavigate();
  const tracks = tracksByIds(album.trackIds);
  const liked = lib.likedAlbums.includes(album.id);
  return (
    <div className="divide-y divide-line">
      <div>
        <SheetRow icon={<Heart size={20} fill={liked ? "currentColor" : "none"} className={liked ? "text-rose" : ""} />} label={liked ? "Remove from library" : "Save to library"} onClick={() => { lib.toggleLikedAlbum(album.id); close(); }} />
        <SheetRow icon={<ListStart size={20} />} label="Play next" onClick={() => { tracks.slice().reverse().forEach((t) => player.playNext(t)); toast("Album will play next"); close(); }} />
        <SheetRow icon={<ListEnd size={20} />} label="Add to queue" onClick={() => { player.addToQueue(tracks); toast("Added to queue"); close(); }} />
        <SheetRow icon={<ListPlus size={20} />} label="Add to a playlist" onClick={() => openSheet({ kind: "addToPlaylist", tracks })} />
        <SheetRow icon={<Download size={20} />} label="Download" onClick={() => { lib.download(album.trackIds); toast("Downloading album (simulated)"); close(); }} />
      </div>
      <div>
        <SheetRow icon={<User size={20} />} label="Artist" sub={album.artistNames.join(", ")} onClick={() => { close(); nav(`/artist/${album.artistIds[0]}`); }} />
        <SheetRow icon={<Share2 size={20} />} label="Share" onClick={() => openSheet({ kind: "share", title: album.title, url: `https://music.youtube.com/browse/${album.id}` })} />
      </div>
    </div>
  );
}

function ArtistOptionsSheet({ artist }: { artist: import("@/types").Artist }) {
  const openSheet = useUiStore((x) => x.openSheet);
  const toast = useUiStore((x) => x.toast);
  const close = useUiStore((x) => x.closeSheet);
  const { followedArtists, toggleFollow } = useLibraryStore();
  const following = followedArtists.includes(artist.id);
  return (
    <div>
      <SheetRow icon={<User size={20} />} label={following ? "Unfollow" : "Follow"} onClick={() => { toggleFollow(artist.id); close(); }} />
      <SheetRow icon={<Link2 size={20} />} label="Copy YouTube URL" onClick={() => { toast("Copied to clipboard"); close(); }} />
      <SheetRow icon={<Share2 size={20} />} label="Share" onClick={() => openSheet({ kind: "share", title: artist.name, url: `https://music.youtube.com/channel/${artist.id}` })} />
    </div>
  );
}

// keep unused icon import tidy
void Link; void Toggle;
