# 04 — PaperCraft Design System ("White Flower / Warm Editorial")

## Principles
1. Paper first — warm white surfaces layered like stationery; depth from soft shadows and hairline rules, never glass.
2. Editorial typography — serif display for titles and featured content; humanist sans for controls and metadata.
3. Artwork is the colour — accents are muted botanical tones; album art carries saturation.
4. Botanical restraint — a single line‑drawn flower motif used at ≤ 3 places per screen (hero corner, empty states, player backdrop).
5. Mobile first — 44px minimum touch targets, thumb‑reachable transport, persistent mini‑player.

## Tokens (`src/styles/tokens.css` → Tailwind v4 `@theme`)

| Token | Value | Usage |
|---|---|---|
| `--color-paper` | `#FAF8F3` | app background |
| `--color-ivory` | `#F4F0E8` | secondary surfaces, chips, inputs |
| `--color-white` | `#FFFFFF` | elevated cards, sheets |
| `--color-ink` | `#25231F` | primary text, primary button |
| `--color-charcoal` | `#555149` | secondary text |
| `--color-mute` | `#969087` | tertiary text, icons idle |
| `--color-sage` | `#71836B` | primary accent (active nav, play states, links) |
| `--color-olive` | `#A2A58A` | secondary accent, progress track fill |
| `--color-rose` | `#C49A94` | favourite / heart, destructive‑soft |
| `--color-sand` | `#D9CBB7` | dividers, borders, placeholders |
| `--color-line` | `rgba(37,35,31,0.08)` | hairlines |
| Dark mode | paper `#1C1B18`, ivory `#242320`, white `#2C2A26`, ink `#F1EDE4`, charcoal `#C8C2B6`, mute `#8B867C` | `.dark` class |

Radii: `xs 6px · sm 10px · md 16px · lg 22px · xl 28px · pill 999px`.
Shadows: `paper: 0 1px 2px rgba(37,35,31,.06), 0 8px 24px -12px rgba(37,35,31,.18)`; `lift: 0 18px 40px -18px rgba(37,35,31,.35)`.
Texture: SVG feTurbulence grain at 4–5 % opacity on `body::before`, fixed, pointer‑events none.

## Typography
- Display / headings: **Instrument Serif** (fallback Georgia). Sizes: h1 34/40, h2 26/32, h3 20/26; tracking ‑0.01em.
- UI / body: **Inter** (fallback system‑ui). Body 15/22, meta 13/18, caption 11/14 uppercase tracking 0.08em.
- Numeric time labels use `font-variant-numeric: tabular-nums`.

Fonts are loaded via Google Fonts `<link>` with system fallbacks; the UI never depends on them being available.

## Components
- `Paper` surface (`bg-white rounded-lg shadow-paper border border-line`).
- `Chip` (ivory, active → ink bg / paper text).
- `IconButton` (40–48 px, ivory hover ring).
- `PrimaryButton` ink pill, `SoftButton` ivory pill.
- `Artwork` (ratio‑locked, `rounded-md`, inner 1px sand ring, optional paper mat).
- `TrackRow` (art 48, title/artist, trailing like/more; playing indicator = 3 sage bars).
- `Shelf` (editorial header: serif title + sans subtitle + "See all").
- `Sheet` (bottom sheet mobile / centered dialog desktop, drag handle, spring via Framer Motion).
- `Toast` (ink pill, bottom above mini‑player).
- `Botanical` SVG motif (line‑drawn anemone), `opacity 0.12–0.35`.

## Motion
Framer Motion springs `{ type: 'spring', stiffness: 380, damping: 34 }`; page fade/slide 12 px; sheet slide from bottom; artwork scale 0.96→1 on play.

## Layout
- Mobile (<768): bottom nav 5 max (Home, Search, Library, +Mix, +Stats via settings), mini‑player docked above nav, full player as full‑screen sheet.
- Tablet (768–1023): bottom nav kept, 3–4 column grids, player sheet max‑w 640 centered.
- Desktop (≥1024): left sidebar 264 px (nav + library shortcuts), content max‑w 1280, persistent bottom player bar 88 px with full transport; full player opens as right‑hand panel/overlay.

## Accessibility
Contrast ≥ 4.5:1 for ink/charcoal on paper; focus rings `outline sage 2px`; all icon buttons have `aria-label`; sliders are native `<input type=range>` styled.

---

## Screen Design Specification (PaperCraft)

Each spec: layout → key components → states → responsive notes. All controls map to rows in `02-complete-ui-interaction-map.md`.

## Home `/`
- Header: serif greeting ("Good morning, Guest") with date line in caps; right: bell, settings, avatar chip.
- Hero "Featured" editorial card: large artwork (4:5 on mobile, 16:9 split on desktop) with kicker, serif title, description, Play + Save buttons; botanical motif bottom‑right at 20 %.
- Quick picks: 4‑rows‑per‑column horizontal pager of TrackRows (mirrors `numItemsPerColumn`), "Play all" soft button.
- Recently played strip (square art 120).
- Shelves: New releases (albums), Playlists for you, Trending songs (numbered list), Top artists (circular art), Mood & moments (tinted paper tiles), Charts (country dropdown + top 5 with "See all").
- Wrapped / Taste entry card (if enough history).

## Search `/search`
- Sticky search field (ivory pill, search icon, clear ×, mic). Below: Recent searches (chips with ×, "Clear"), Suggestions while typing.
- Results: filter chips (All, Songs, Videos, Albums, Artists, Playlists, Podcasts) → grouped sections in All mode, flat list otherwise.
- Empty intro: botanical + "Everything you need…"; No results; Recognizing state with pulsing ring.

## Library `/library`
- Title "Your Library" + Create (+) button.
- Chip rail: Your library · Local playlists · Favorite playlists · Downloaded · Podcasts · Charts · Wrapped · Mix for you · YouTube playlists.
- Tiles 2×3: Favorites, Followed, Most played, Downloaded, Cached, Recently added.
- Playlist grid (2 col mobile / 4–6 desktop) with mosaic covers.
- Create sheet: name input, "Create" primary.

## Dynamic playlist `/library/:type`
Header with serif title + count, Play/Shuffle, Sort dropdown (Title / Recently added / Most played), list.

## Local playlist `/playlist/:id`, Album `/album/:id`, Remote playlist, Podcast `/podcast/:id`
- Collapsing header: 220 px artwork matted on paper, serif title, meta (author · year · n songs · length), description expandable.
- Action row: Play (ink pill), Shuffle, Like, Download (state icon), More.
- Tools row (local only): Search, Sort, Suggest, Reorder toggle.
- Track list with drag handles in reorder mode; swipe‑free remove via row menu.

## Artist `/artist/:id`
- Banner 3:2 with gradient to paper, serif name 34 px, follower meta; Follow pill, Radio, Shuffle.
- Sections: Popular (top 5 + show more), Albums (carousel + See all → `/artist/:id/albums`), Singles, Videos, Featured in, Related artists, About.

## Mood `/mood/:id`, Charts `/charts`, Browse `/browse/:id`
Editorial header + grids/lists; charts has country dropdown and three tabs (Songs, Videos, Artists).

## Notifications `/notifications`
Grouped by date; rows: artist avatar, "released <Album>", open.

## Settings `/settings`
Sections as cards: User interface (theme mode, theme colour, now‑playing style, lyrics style, liquid glass → "n/a in web", animated artwork), Content (language, country, explicit, video for video tracks, proxy), Playback (quality, save state, save shuffle/repeat, skip silent, normalize, crossfade duration/DJ mode/skip album, kill service), Audio (equalizer → `/settings/equalizer`, 8D, reverb, audio delay), Lyrics (main provider, Spotify lyrics, romanization, translation language, AI translation, offset), SponsorBlock (enable, categories), Storage (caches with sizes + clear), Backup (backup now, restore, auto backup, frequency, keep backups, import), Database/Listening history (local tracking, clear history), Integrations (YouTube account, Spotify, Last.fm, Discord), Login sync / Listen together (info), Developer (app log), About (version, blog, donate, licenses).

## Equalizer `/settings/equalizer`
Enable toggle, type (built‑in/system), preset chips, 10 vertical sliders, AutoEq picker (mock), 8D & reverb toggles.

## Analytics `/analytics`, Wrapped `/wrapped`
Analytics: KPI tiles (minutes, tracks, artists), weekly bars, top lists, "listening receipt" card. Wrapped: full‑screen paged cards with paper textures and botanical frames.

## Account `/account`
Provider rows (YouTube Music, Spotify, Last.fm, Discord) with simulated sign‑in toggles and clear "Simulated — no real auth" note.

## Now Playing (sheet)
- Mobile: full‑screen paper sheet; top: chevron, "Playing from <source>" caps + name, more. Artwork 1:1 with mat & shadow (swipe = prev/next). Title serif 24, artist 15 sage, like heart (rose), dislike (YT). Timeline slider with tabular times. Transport row: shuffle · prev · play (64 px ink circle) · next · repeat. Bottom tabs: Lyrics · Queue · Related · Info. Secondary: volume (desktop), sleep timer, speed badge, output/cast.
- Desktop: two‑column (artwork + controls | tab panel).

## Mini player
Paper bar with 1px top hairline, 56 px art, title/artist, like, play/pause, next; 2px progress line at top; tap to expand; × to stop.

## Queue panel
"Now playing" card, "Up next · n", Reorder list (framer‑motion Reorder), row menu: play next, remove; footer: Save queue as playlist, Clear.

## Lyrics panel
Centered serif lines 22/30, current line ink, others mute; auto‑scroll; controls: provider dropdown, offset −/+ 100 ms, font A‑/A+, share lines, "Add lyrics" when unavailable.
