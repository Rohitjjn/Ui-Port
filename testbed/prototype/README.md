# SimpMusic · PaperCraft — React web reconstruction

An independent React + TypeScript prototype that reproduces the full user interface and workflows of
[SimpMusic](https://github.com/maxrave-dev/SimpMusic) (`dev` @ `f78a4fd`, v2.6.2) with a new
"PaperCraft / White Flower" editorial design. **Playback, streaming, downloads and logins are simulated** —
nothing connects to YouTube Music, Spotify, or SimpMusic's Kotlin engine.

## Run
```
npm install
npm run dev       # dev server
npm run build     # self-contained dist/index.html
```

## Structure
- `src/app` — router + shell (sidebar / bottom nav / mini player / desktop player bar)
- `src/components` — common primitives, cards, player, sheets
- `src/features` — home, search, library, playlists, albums, artists, explore, lyrics, queue, settings, analytics
- `src/store` — Zustand stores (player, library, settings, ui) persisted to localStorage
- `src/services/mockMusicService.ts` + `src/data/mockData.ts` — the only "backend"
- `docs/` — reverse-engineering, UI maps, design system, implementation report

## Docs
1. `docs/01-architecture.md`
2. `docs/02-ui-interaction-map.md` (screens, controls, journeys, state, Mermaid diagrams), `docs/03-feature-component-matrix.md`
3. `docs/04-design-system.md`
4. `docs/05-implementation-report.md`

Original SimpMusic is GPL-3.0 by maxrave-dev. This prototype contains no original source code.
