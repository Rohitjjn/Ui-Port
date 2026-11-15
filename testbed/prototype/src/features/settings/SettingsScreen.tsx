import { Button, Chip, Kicker, PageHeader, Slider, Toggle } from "@/components/common";
import { useLibraryStore } from "@/store/libraryStore";
import { EQ_PRESETS, useSettingsStore, type Settings } from "@/store/settingsStore";
import { useUiStore } from "@/store/uiStore";
import { cn } from "@/utils/cn";
import { ChevronRight, ExternalLink } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";

/* ---------- primitives ---------- */
function Section({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="paper rounded-lg">
      <div className="border-b border-line px-4 py-3"><Kicker className="text-sage">{title}</Kicker></div>
      <div className="divide-y divide-line px-4">{children}</div>
    </section>
  );
}
function Row({ title, sub, right, onClick, disabled }: { title: string; sub?: string; right?: ReactNode; onClick?: () => void; disabled?: boolean }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick} disabled={disabled} className={cn("flex w-full items-center gap-4 py-3.5 text-left", onClick && "hover:bg-ivory/50 -mx-4 px-4 w-[calc(100%+2rem)]", disabled && "opacity-50")}>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px]">{title}</span>
        {sub && <span className="block text-[12px] leading-snug text-mute">{sub}</span>}
      </span>
      {right ?? (onClick && <ChevronRight size={16} className="text-mute" />)}
    </Tag>
  );
}
function SwitchRow({ k, title, sub, disabled }: { k: keyof Settings; title: string; sub?: string; disabled?: boolean }) {
  const v = useSettingsStore((s) => s[k]) as boolean;
  const set = useSettingsStore((s) => s.set);
  return <Row title={title} sub={sub} disabled={disabled} right={<Toggle checked={v} onChange={(x) => set(k, x as never)} label={title} />} />;
}
function PickRow<K extends keyof Settings>({ k, title, sub, options, labels }: { k: K; title: string; sub?: string; options: Settings[K][]; labels?: Record<string, string> }) {
  const v = useSettingsStore((s) => s[k]);
  const set = useSettingsStore((s) => s.set);
  const openSheet = useUiStore((s) => s.openSheet);
  const label = (o: Settings[K]) => labels?.[String(o)] ?? String(o);
  return <Row title={title} sub={sub} right={<span className="flex items-center gap-1 text-[13px] text-charcoal">{label(v)}<ChevronRight size={16} className="text-mute" /></span>} onClick={() => openSheet({ kind: "sort", current: String(v), options: options.map((o) => ({ id: String(o), label: label(o) })), onPick: (id) => set(k, options.find((o) => String(o) === id)!) })} />;
}

/* ---------- Settings screen ---------- */
export function SettingsScreen() {
  const s = useSettingsStore();
  const lib = useLibraryStore();
  const nav = useNavigate();
  const openSheet = useUiStore((x) => x.openSheet);
  const toast = useUiStore((x) => x.toast);
  const [checking, setChecking] = useState(false);
  const unavailable = (title: string, body: string) => () => openSheet({ kind: "info", title, body });
  const caches = { player: 184, downloaded: 612, thumbnail: 23, canvas: 0 };

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" subtitle="SimpMusic · PaperCraft web prototype" />

      <Section title="User interface">
        <PickRow k="themeMode" title="Theme" options={["light", "dark", "system"]} labels={{ light: "Light", dark: "Dark", system: "Follow system" }} />
        <PickRow k="themeColor" title="Theme color" sub="Wallpaper color requires Android 12+" options={["default", "wallpaper", "custom"]} labels={{ default: "Default (sage)", wallpaper: "Wallpaper", custom: "Custom" }} />
        {s.themeColor === "custom" && <Row title="Custom color" right={<input type="color" value={s.customColor} onChange={(e) => { s.set("customColor", e.target.value); document.documentElement.style.setProperty("--color-sage", e.target.value); }} className="h-8 w-12 cursor-pointer rounded border-0 bg-transparent" aria-label="Custom color" />} />}
        <PickRow k="nowPlayingStyle" title="Now playing style" sub="Original offers Apple Music, M3 Expressive, SoundCloud and Spotify styles; the web prototype renders the PaperCraft layout for all." options={["papercraft", "apple_music", "m3_expressive", "soundcloud", "spotify"]} labels={{ papercraft: "PaperCraft", apple_music: "Apple Music", m3_expressive: "M3 Expressive", soundcloud: "SoundCloud", spotify: "Spotify" }} />
        <PickRow k="lyricsStyle" title="Lyrics style" options={["apple_music", "classic"]} labels={{ apple_music: "Apple Music", classic: "Classic" }} />
        <SwitchRow k="animatedArtwork" title="Enable animated artwork" sub="Shows animated covers when available" />
        <SwitchRow k="canvas" title="Enable Spotify Canvas" sub="Requires Spotify login" />
        <Row title="Liquid glass effect" sub="Android 12+ only — not available in the web prototype" right={<Toggle checked={false} onChange={unavailable("Liquid glass", "This effect uses Android RenderEffect and has no web equivalent.")} label="Liquid glass" />} />
        <SwitchRow k="showMixTab" title="Show Mix for you tab" sub="Adds a tab to the bottom navigation" />
        <SwitchRow k="showAnalyticsTab" title="Show Analytics tab" sub="Adds a tab to the bottom navigation" />
      </Section>

      <Section title="Content">
        <PickRow k="language" title="Language" options={["English", "Tiếng Việt", "Deutsch", "Español", "Français", "日本語"]} />
        <Row title="Content country" sub="Affects charts and recommendations" right={<span className="text-[13px] text-charcoal">{s.contentCountry}</span>} onClick={() => openSheet({ kind: "sort", current: s.contentCountry, options: [{ id: "ZZ", label: "Global" }, { id: "US", label: "United States" }, { id: "GB", label: "United Kingdom" }, { id: "PT", label: "Portugal" }, { id: "JP", label: "Japan" }, { id: "VN", label: "Vietnam" }], onPick: (v) => s.set("contentCountry", v) })} />
        <SwitchRow k="explicit" title="Play explicit content" sub="Include songs marked explicit in results" />
        <SwitchRow k="videoForVideoTracks" title="Play video for video tracks" sub="Such as music videos, lyric videos, podcasts and more" />
        <Row title="YouTube account" sub={s.accounts.youtube ? `Logged in as ${s.accounts.youtube}` : "Guest · manage your YouTube accounts"} onClick={() => nav("/account")} />
        <SwitchRow k="sendToGoogle" title="Send back listening data to Google" sub="Improves YouTube Music recommendations (needs login)" disabled={!s.accounts.youtube} />
        <SwitchRow k="syncFollowToYouTube" title="Sync follows to YouTube" sub="Following an artist also subscribes on YouTube" disabled={!s.accounts.youtube} />
        <SwitchRow k="proxyEnabled" title="Proxy" sub="Route requests through HTTP/SOCKS proxy" />
        {s.proxyEnabled && <Row title="Proxy host" sub={s.proxyHost || "Not set"} onClick={() => openSheet({ kind: "prompt", title: "Proxy host", label: "host:port", initial: s.proxyHost, onSubmit: (v) => s.set("proxyHost", v) })} />}
      </Section>

      <Section title="Playback">
        <PickRow k="quality" title="Quality" options={["Auto", "High", "Medium", "Low"]} />
        <PickRow k="downloadQuality" title="Download quality" options={["High", "Medium", "Low"]} />
        <SwitchRow k="savePlaybackState" title="Save playback state" sub="Resume queue & position on launch" />
        <SwitchRow k="saveShuffleRepeat" title="Save shuffle and repeat mode" />
        <SwitchRow k="radioAudioOnly" title="Radio audio only" sub="Radio queues load audio tracks instead of videos" />
        <SwitchRow k="endlessQueue" title="Endless queue" sub="Keep adding related songs when the queue ends" />
        <SwitchRow k="skipSilent" title="Skip silent parts" />
        <SwitchRow k="normalizeVolume" title="Normalize volume" sub="Balance media loudness" />
        <SwitchRow k="crossfade" title="Crossfade" sub="Blend the end of a song into the next" />
        {s.crossfade && (
          <>
            <Row title="Crossfade duration" right={<span className="w-40"><Slider value={s.crossfadeDuration} min={1} max={12} onChange={(v) => s.set("crossfadeDuration", v)} ariaLabel="Crossfade duration" /></span>} sub={`${s.crossfadeDuration} seconds`} />
            <SwitchRow k="crossfadeDjMode" title="DJ mode" sub="Beat-aware transitions planned from track structure" />
            <SwitchRow k="crossfadeSkipAlbum" title="Skip crossfade within albums" sub="Keeps gapless album transitions intact" />
          </>
        )}
        <SwitchRow k="killServiceOnExit" title="Kill service on exit" sub="Stops the playback service when the app is swiped away" />
      </Section>

      <Section title="Audio">
        <Row title="Equalizer & effects" sub={s.equalizerEnabled ? `On · ${s.eqPreset}` : "Off"} onClick={() => nav("/settings/equalizer")} />
        <SwitchRow k="eightD" title="8D audio" sub="Rotating spatial effect (simulated toggle)" />
        <SwitchRow k="reverb" title="Reverb" sub="Convolution room reverb (simulated toggle)" />
        <Row title="Audio delay" sub={`${s.audioDelay} ms · for Bluetooth sync`} right={<span className="w-40"><Slider value={s.audioDelay} min={-500} max={500} step={10} onChange={(v) => s.set("audioDelay", v)} ariaLabel="Audio delay" /></span>} />
      </Section>

      <Section title="Lyrics">
        <PickRow k="lyricsProvider" title="Main lyrics provider" options={["simpmusic", "lrclib", "spotify", "youtube_transcript"]} labels={{ simpmusic: "SimpMusic Lyrics", lrclib: "LRCLIB", spotify: "Spotify", youtube_transcript: "YouTube transcript" }} />
        <SwitchRow k="spotifyLyrics" title="Enable Spotify lyrics" sub="Requires Spotify login" />
        <SwitchRow k="romanization" title="Lyrics romanization" sub="Japanese, Korean, Chinese, Russian, Hindi and more" />
        <Row title="Translation language" sub={s.translationLanguage} onClick={() => openSheet({ kind: "prompt", title: "Translation language", label: "Language code (e.g. en, vi, ja)", initial: s.translationLanguage, onSubmit: (v) => (/^[a-z]{2}$/.test(v) ? s.set("translationLanguage", v) : toast("Invalid language code")) })} />
        <SwitchRow k="aiTranslation" title="Use AI translation" sub="Translate lyrics with your configured AI provider" />
        <Row title="Lyrics offset" sub={`${s.lyricsOffset} ms`} right={<span className="w-40"><Slider value={s.lyricsOffset} min={-2000} max={2000} step={100} onChange={(v) => s.set("lyricsOffset", v)} ariaLabel="Lyrics offset" /></span>} />
        <SwitchRow k="helpBuildLyrics" title="Help build the lyrics database" sub="Share lyrics you add with SimpMusic Lyrics" />
      </Section>

      <Section title="SponsorBlock">
        <SwitchRow k="sponsorBlock" title="Enable SponsorBlock" sub="Skip sponsor parts of videos using community data" />
        {s.sponsorBlock && (
          <Row title="Categories" sub="Tap to toggle" right={null} />
        )}
        {s.sponsorBlock && (
          <div className="flex flex-wrap gap-2 py-3">
            {["sponsor", "selfpromo", "interaction", "intro", "outro", "preview", "music_offtopic", "filler"].map((c) => (
              <Chip key={c} active={s.sponsorCategories.includes(c)} onClick={() => s.set("sponsorCategories", s.sponsorCategories.includes(c) ? s.sponsorCategories.filter((x) => x !== c) : [...s.sponsorCategories, c])}>{c.replace("_", " ")}</Chip>
            ))}
          </div>
        )}
      </Section>

      <Section title="Storage">
        {([["Player cache", caches.player], ["Downloaded cache", caches.downloaded], ["Thumbnail cache", caches.thumbnail], ["Spotify canvas cache", caches.canvas]] as const).map(([t, mb]) => (
          <Row key={t} title={t} sub={`${mb} MB (simulated)`} right={<Button size="sm" variant="soft" onClick={() => openSheet({ kind: "confirm", title: `Clear ${t.toLowerCase()}?`, body: "Cached files would be deleted from the device.", onConfirm: () => toast(`${t} cleared (simulated)`) })}>Clear</Button>} />
        ))}
        <Row title="Limit player cache" right={<span className="text-[13px] text-charcoal">512 MB</span>} onClick={() => toast("Cache limit dialog — simulated")} />
        <Row title="Free space" sub="48.2 GB available (simulated)" />
      </Section>

      <Section title="Backup">
        <Row title="Backup" sub="Save all your playlist data" right={<Button size="sm" onClick={() => { const blob = new Blob([lib.exportSnapshot()], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `simpmusic-papercraft-backup-${Date.now()}.json`; a.click(); s.set("lastBackup", Date.now()); toast("Backup downloaded"); }}>Back up</Button>} />
        <Row title="Restore your data" sub="Restore your saved data from a backup file" right={<label className="cursor-pointer rounded-full bg-ivory px-4 py-2 text-[13px] font-medium">Restore<input type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; f.text().then((t) => toast(lib.importSnapshot(t) ? "Backup restored" : "Import failed — invalid file")); }} /></label>} />
        <Row title="Last backup" sub={s.lastBackup ? new Date(s.lastBackup).toLocaleString() : "Never"} />
        <SwitchRow k="autoBackup" title="Auto backup" sub="Periodically create backups" />
        {s.autoBackup && <PickRow k="backupFrequency" title="Backup frequency" options={["daily", "weekly", "monthly"]} labels={{ daily: "Daily", weekly: "Weekly", monthly: "Monthly" }} />}
        {s.autoBackup && <Row title="Keep backups" sub={`${s.keepBackups} most recent`} right={<span className="w-32"><Slider value={s.keepBackups} min={1} max={20} onChange={(v) => s.set("keepBackups", v)} ariaLabel="Keep backups" /></span>} />}
        <SwitchRow k="backupDownloaded" title="Backup downloaded songs" sub="Include downloaded media files in backups" />
        <Row title="Import playlists from other apps" sub="CSV / JSON from Spotify, Apple Music and more" onClick={() => openSheet({ kind: "info", title: "Import data", body: "In the original app a file picker reads the export, matches songs on YouTube Music and reports imported / skipped counts. The web prototype demonstrates the entry point only." })} />
      </Section>

      <Section title="Database & listening history">
        <SwitchRow k="localTracking" title="Local listening tracking" sub="Powers Most played, Analytics and Wrapped. Stored on-device only." />
        <SwitchRow k="smartDownloads" title="Smart downloads" sub="Automatically download your most played songs" disabled={!s.localTracking} />
        <SwitchRow k="autoDownloadLiked" title="Auto download liked songs" />
        <SwitchRow k="combineLiked" title="Combine local and YouTube liked songs" disabled={!s.accounts.youtube} />
        <SwitchRow k="autoBackup" title="Keep your YouTube playlists offline" sub="Downloads synced playlists for offline use" />
        <Row title="Clear listening history" sub="Removes play counts and history. Unpairs Wrapped data." right={<Button size="sm" variant="danger" onClick={() => openSheet({ kind: "confirm", title: "Clear listening history?", body: "This removes all local play counts and history. This cannot be undone.", danger: true, confirmLabel: "Clear", onConfirm: () => { lib.clearHistory(); toast("Listening history cleared"); } })}>Clear</Button>} />
      </Section>

      <Section title="Integrations">
        <Row title="Spotify" sub={s.accounts.spotify ? "Logged in · lyrics & canvas enabled" : "Log in to Spotify for lyrics & canvas"} onClick={() => nav("/account")} />
        <Row title="Last.fm" sub={s.accounts.lastfm ? `Scrobbling as ${s.accounts.lastfm}` : "Log in to scrobble your listening"} onClick={() => nav("/account")} />
        <Row title="Discord" sub={s.accounts.discord ? "Rich presence enabled" : "Show what you're listening to on Discord"} onClick={() => nav("/account")} />
        <Row title="AI provider" sub="OpenAI, Gemini or OpenAI-compatible endpoint for translation" onClick={() => openSheet({ kind: "prompt", title: "AI API key", label: "API key (stored locally, simulated)", onSubmit: () => toast("API key saved (simulated)") })} />
      </Section>

      <Section title="Sync & sharing">
        <Row title="Library sync" sub="Pair phone and desktop to sync your library over the local network" onClick={unavailable("Library sync", "Pairing requires the SimpMusic desktop/Android apps on the same network. Not available in the web prototype.")} />
        <Row title="Login sync" sub="Send your logins to a paired device via QR code" onClick={unavailable("Login sync", "Credential transfer uses a local P2P channel between native apps. Not available in the web prototype.")} />
        <Row title="Listen together" sub="Host or join a shared listening session" onClick={unavailable("Listen together", "Shared sessions need the native networking service. Not available in the web prototype.")} />
      </Section>

      <Section title="Updates & developer">
        <SwitchRow k="autoCheckUpdate" title="Auto check for update" sub="Check GitHub releases on launch" />
        <PickRow k="updateChannel" title="Update channel" options={["stable", "beta"]} labels={{ stable: "Stable", beta: "Beta" }} />
        <Row title="Check for update" sub={checking ? "Checking…" : "Last checked just now"} right={<Button size="sm" variant="soft" disabled={checking} onClick={() => { setChecking(true); setTimeout(() => { setChecking(false); toast("You're on the latest version (2.6.2)"); }, 1200); }}>Check</Button>} />
        <Row title="App log" sub="View and share diagnostic logs" onClick={() => nav("/settings/log")} />
      </Section>

      <Section title="About">
        <Row title="Version" sub="PaperCraft web prototype · mirrors SimpMusic 2.6.2 (dev @ f78a4fd)" />
        <Row title="Author" sub="maxrave-dev · Original app is GPL-3.0" right={<ExternalLink size={16} className="text-mute" />} onClick={() => window.open("https://github.com/maxrave-dev/SimpMusic", "_blank")} />
        <Row title="Developer blog" sub="News, changelogs and behind-the-scenes" right={<ExternalLink size={16} className="text-mute" />} onClick={() => window.open("https://www.simpmusic.org/", "_blank")} />
        <Row title="Buy me a coffee" sub="Support the original project" right={<ExternalLink size={16} className="text-mute" />} onClick={() => window.open("https://www.simpmusic.org/", "_blank")} />
        <Row title="Third-party libraries" sub="Description and licenses" onClick={() => nav("/settings/credits")} />
        <Row title="Reset prototype settings" right={<Button size="sm" variant="danger" onClick={() => openSheet({ kind: "confirm", title: "Reset settings?", body: "All PaperCraft settings return to defaults.", danger: true, confirmLabel: "Reset", onConfirm: () => { s.reset(); toast("Settings reset"); } })}>Reset</Button>} />
      </Section>
    </div>
  );
}

/* ---------- Equalizer ---------- */
const BANDS = ["31", "62", "125", "250", "500", "1k", "2k", "4k", "8k", "16k"];
export function EqualizerScreen() {
  const s = useSettingsStore();
  const toast = useUiStore((x) => x.toast);
  const setBand = (i: number, v: number) => { const b = [...s.eqBands]; b[i] = v; s.patch({ eqBands: b, eqPreset: "Custom" }); };
  return (
    <div className="space-y-5">
      <PageHeader title="Equalizer & effects" subtitle="Built-in 10-band EQ · simulated DSP" />
      <Section title="Equalizer">
        <Row title="Enable equalizer" right={<Toggle checked={s.equalizerEnabled} onChange={(v) => s.set("equalizerEnabled", v)} label="Enable equalizer" />} />
        <PickRow k="equalizerType" title="Equalizer type" options={["built_in", "system"]} labels={{ built_in: "Built-in (SimpMusic)", system: "System equalizer" }} />
        {s.equalizerType === "system" && <Row title="Open system equalizer" sub="Launches the Android audio effect panel" onClick={() => toast("System equalizer is not available on web")} />}
      </Section>
      <div className={cn("paper rounded-lg p-4 transition", (!s.equalizerEnabled || s.equalizerType === "system") && "pointer-events-none opacity-40")}>
        <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
          {Object.keys(EQ_PRESETS).map((p) => <Chip key={p} active={s.eqPreset === p} onClick={() => s.patch({ eqPreset: p, eqBands: EQ_PRESETS[p] })}>{p}</Chip>)}
          {s.eqPreset === "Custom" && <Chip active>Custom</Chip>}
        </div>
        <div className="flex justify-between gap-1">
          {s.eqBands.map((v, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-2">
              <span className="text-[11px] tabular text-mute">{v > 0 ? "+" : ""}{v}</span>
              <input type="range" aria-label={`${BANDS[i]} Hz`} className="slider vertical" min={-12} max={12} step={1} value={v} onChange={(e) => setBand(i, parseInt(e.target.value))} style={{ ["--pct" as string]: `${((v + 12) / 24) * 100}%` }} />
              <span className="text-[11px] text-mute">{BANDS[i]}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-[13px] text-mute">AutoEq profile</span>
          <Button size="sm" variant="soft" onClick={() => toast("AutoEq picker — headphone profiles fetched from the AutoEq database (simulated)")}>Pick headphones</Button>
        </div>
      </div>
      <Section title="Effects">
        <SwitchRow k="eightD" title="8D audio" sub="Rotating binaural panning" />
        <SwitchRow k="reverb" title="Reverb" sub="Convolution reverb (room)" />
        <SwitchRow k="normalizeVolume" title="Normalize volume" sub="Balance media loudness" />
      </Section>
      <p className="text-[12px] text-mute">Audio processing is handled by native audio processors in the original app. The web prototype stores your settings but does not alter audio.</p>
    </div>
  );
}

/* ---------- Account ---------- */
export function AccountScreen() {
  const s = useSettingsStore();
  const toast = useUiStore((x) => x.toast);
  const openSheet = useUiStore((x) => x.openSheet);
  const acc = s.accounts;
  const upd = (p: Partial<typeof acc>) => s.set("accounts", { ...acc, ...p });
  const providers = [
    { id: "youtube", name: "YouTube Music", desc: "Personalised home, your playlists, liked songs, history sync.", on: !!acc.youtube, label: acc.youtube ?? undefined, login: () => upd({ youtube: "paper.listener@example.com" }), logout: () => upd({ youtube: null }) },
    { id: "spotify", name: "Spotify", desc: "Synced lyrics & Canvas via your sp_dc cookie.", on: acc.spotify, login: () => upd({ spotify: true }), logout: () => upd({ spotify: false }) },
    { id: "lastfm", name: "Last.fm", desc: "Scrobble what you listen to.", on: !!acc.lastfm, label: acc.lastfm ?? undefined, login: () => upd({ lastfm: "paper_listener", scrobbling: true }), logout: () => upd({ lastfm: null, scrobbling: false }) },
    { id: "discord", name: "Discord", desc: "Rich presence with artwork and progress.", on: acc.discord, login: () => upd({ discord: true, richPresence: true }), logout: () => upd({ discord: false, richPresence: false }) },
  ];
  return (
    <div className="space-y-5">
      <PageHeader title="Accounts" subtitle="Sign-ins are simulated — no credentials leave this page" />
      {providers.map((p) => (
        <section key={p.id} className="paper rounded-lg p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-serif text-[20px]">{p.name}</div>
              <p className="text-[13px] text-mute">{p.desc}</p>
              <p className={cn("mt-1 text-[12px]", p.on ? "text-sage" : "text-mute")}>{p.on ? `Signed in${p.label ? ` as ${p.label}` : ""}` : "Not signed in"}</p>
            </div>
            {p.on ? (
              <Button size="sm" variant="outline" onClick={() => openSheet({ kind: "confirm", title: `Log out of ${p.name}?`, body: "You will need to sign in again to use this integration.", onConfirm: () => { p.logout(); toast(`Logged out of ${p.name}`); } })}>Log out</Button>
            ) : (
              <Button size="sm" onClick={() => { p.login(); toast(`Signed in to ${p.name} (simulated)`); }}>Log in</Button>
            )}
          </div>
          {p.id === "lastfm" && p.on && <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-[14px]"><span>Enable scrobbling</span><Toggle checked={acc.scrobbling} onChange={(v) => upd({ scrobbling: v })} label="Scrobbling" /></div>}
          {p.id === "discord" && p.on && <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-[14px]"><span>Enable rich presence</span><Toggle checked={acc.richPresence} onChange={(v) => upd({ richPresence: v })} label="Rich presence" /></div>}
          {p.id === "youtube" && p.on && <div className="mt-3 border-t border-line pt-3"><Button size="sm" variant="soft" onClick={() => toast("Add another account — opens YouTube login WebView in the original app")}>Add an account</Button></div>}
        </section>
      ))}
    </div>
  );
}

/* ---------- Credits / log ---------- */
export function CreditsScreen() {
  const libs = [["Kotlin Multiplatform", "Apache-2.0"], ["Compose Multiplatform", "Apache-2.0"], ["Media3 / ExoPlayer", "Apache-2.0"], ["Ktor", "Apache-2.0"], ["Koin", "Apache-2.0"], ["Room", "Apache-2.0"], ["Coil", "Apache-2.0"], ["SponsorBlock API", "CC BY-NC-SA 4.0"], ["Return YouTube Dislike", "GPL-3.0"], ["LRCLIB", "MIT"], ["— Web prototype —", ""], ["React", "MIT"], ["Vite", "MIT"], ["Tailwind CSS", "MIT"], ["Framer Motion", "MIT"], ["Zustand", "MIT"], ["Lucide", "ISC"]];
  return (
    <div>
      <PageHeader title="Third-party libraries" subtitle="Description and licenses" />
      <div className="paper divide-y divide-line rounded-lg px-4">{libs.map(([n, l]) => <div key={n} className="flex justify-between py-3 text-[14px]"><span className={cn(!l && "kicker self-center")}>{n}</span><span className="text-mute">{l}</span></div>)}</div>
    </div>
  );
}
export function AppLogScreen() {
  const toast = useUiStore((x) => x.toast);
  const lines = ["[info] PaperCraft prototype booted", "[info] stores hydrated from localStorage", "[info] mockMusicService ready (32 tracks, 13 albums, 8 artists)", "[debug] playback clock tick 500ms", "[warn] audio streaming disabled: web prototype", "[info] theme mode: " + useSettingsStore.getState().themeMode];
  return (
    <div>
      <PageHeader title="App log" right={<Button size="sm" variant="soft" onClick={() => { navigator.clipboard?.writeText(lines.join("\n")).catch(() => {}); toast("Log copied"); }}>Copy</Button>} />
      <pre className="paper overflow-x-auto rounded-lg p-4 text-[12px] leading-relaxed text-charcoal">{lines.join("\n")}</pre>
    </div>
  );
}
