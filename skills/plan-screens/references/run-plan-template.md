# run-plan.md template

The shape of this file is decided by the tier `uiport size assess` reports as governing — not by
preference. Fill in only the section for that tier; delete the others. Every slice below is
verified on its own before the next one starts.

```md
# Run plan

Assessment: `LARGE` (computed `LARGE`, not overridden) — `uiport size assess` at map time.
Strategy: strangler, per-route runtime flag, default old UI.
Driving subject: SimpMusic — exceeds the MEDIUM budget in 4 dimensions (screens 37/20,
files 1567/400, nav 64/25, engine 666/200).

## Flag

| Route | Renders today | New composable slot | Flag-off must still do |
| --- | --- | --- | --- |
| home | HomeScreen (old) | ui/uiport/HomeScreen → `if (UiPortFlags.home) NewHomeScreen(...) else OldHomeScreen(...)` | full existing home, including its bottom-sheet player |
| library | LibraryScreen (old) | same pattern | tabs, sort menu, selection mode |

Flag defaults off. One route flips per accepted slice. The old composable stays compiled and
reachable until its slice passes, and flipping the flag back is the rollback.

## Slices (dependency order — a route switches only after everything it navigates into can)

| # | Screens | Lands first | Checks | Rollback |
| --- | --- | --- | --- | --- |
| 1 | nowplaying | shared `TrackRow`, tokens | build, unit, render, diff-all, geometry, flag-off smoke | flag off |
| 2 | library | `Artwork`, `SelectionBar` | same | flag off |
| 3 | home | `ShelfRow`, `SectionHeader` | same | flag off |

## Screens and shared work

| Screen | Slice | Package | Composables | State input | Events |
| --- | --- | --- | --- | --- | --- |
| nowplaying | 1 | ui.uiport.player | NowPlayingScreen | NowPlayingUiState | onSeek, onToggle, onNext |
| library | 2 | ui.uiport.library | LibraryScreen, LibraryTabs | LibraryUiState | onTabSelect, onPlaylistClick |
| home | 3 | ui.uiport.home | HomeScreen, ShelfRow | HomeUiState | onPlayAll, onTrackClick |

## Wiring that is still undecided

| Prototype control | Screen | Status | Question for the gate |
| --- | --- | --- | --- |
| "Create playlist" | library | missing | build in engine, or remove from the UI? |
```

For a `MEDIUM` run, drop the flag table and drop the rollback column to "revert the slice"; for
`SIMPLE`, the whole file collapses to one ordered screen list and a single verification pass.
