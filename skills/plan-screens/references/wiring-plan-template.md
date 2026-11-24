# wiring-plan.md template

```
# Wiring plan

Every prototype control, what backs it in the engine today, and what has to happen.

## Legend

- Status: `exists` (engine can do it now) · `missing` (engine has no equivalent) · `extra` (engine can, UI does not show it)
- Action: `wire` · `build-in-engine` · `remove-from-ui` · `ask-user` · `none`

## Home screen

| Control | Prototype behaviour | Engine equivalent | Status | Action |
| --- | --- | --- | --- | --- |
| Play all (shelf) | sets queue, starts playback | `PlayerViewModel.setQueue(tracks, index)` | exists | wire |
| Shelf "See all" | navigates to /browse/:id | none | missing | ask-user |
| Track row click | starts playback with context | `PlayerViewModel.playTrack(track, context)` | exists | wire |
| Heart | toggles favourite | `LibraryViewModel.toggleFavorite(id)` | exists | wire |
| Bell | notifications sheet | `NotificationViewModel` | exists | wire |
| Chart country selector | reloads chart | `HomeViewModel.setContentCountry(code)` | exists | wire |
| Canvas video | shows Spotify-style canvas | none | missing | ask-user |

## Global (shell)

| Control | Prototype behaviour | Engine equivalent | Status | Action |
| --- | --- | --- | --- | --- |
| Mini player | open player | `uiState.nowPlayingOpen` | exists | wire |
| Bottom nav | route change | the app's NavHost | exists | wire |
| Selection bar | local multi-select state | none (UI-only) | extra | none |

## Decided at the gate

- Shelf "See all": **remove-from-ui** (user, 2026-11-15) — the engine has no browse endpoint for arbitrary shelves.
- Canvas video: **build-in-engine** (user, 2026-11-15) — needs `CanvasRepository`; tracked as engine task E1.
```

## Filling it in honestly

- An "exists" row must name a real function or state you have seen in `app-map.json` or in the
  file. A plausible-looking name is the most expensive kind of mistake in this plan.
- "UI-only" is a legitimate status: selection state, sheet open/closed, scroll position.
- If you cannot tell whether the engine supports something in 5 minutes of reading, write
  `ask-user` and move on; the gate is exactly the place for it.
- The "Decided at the gate" section is mandatory: it is the record of *why* the UI differs
  from the prototype. Without it, the diff report cannot explain a missing control.
