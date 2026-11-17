# screens-plan.md template

```
# Screens plan

## Package layout (must match the project's existing convention)

Target: `com.example.app.ui.screen` — copied from the existing tree, not invented.
Shared: `com.example.app.ui.component` (only what two or more screens use)
Tokens: `com.example.app.ui.theme` (AppColors / AppType / AppSpacing)

## Screens

| Screen | Package | Composables | State input | Events | Devices | Shared components |
| --- | --- | --- | --- | --- | --- | --- |
| home | ui.screen.home | HomeScreen, ShelfRow, TrackRow | HomeUiState | onPlayAll, onTrackClick, onSeeAll | phone, tablet, desktop | TrackRow, SectionHeader, Artwork |
| search | ui.screen.search | SearchScreen, SearchField | SearchUiState | onQueryChange, onResultClick | phone, tablet | Artwork |
| library | ui.screen.library | LibraryScreen, LibraryTabs | LibraryUiState | onTabSelect, onPlaylistClick | phone, tablet, desktop | Artwork, SelectionBar |

## Shared components (extracted on second use)

| Component | Used by | Notes |
| --- | --- | --- |
| Artwork | home, search, library, player | procedural art; port the algorithm once |
| TrackRow | home, album, playlist, queue | the most reused row in the app; port it first |
| SectionHeader | home, browse | kicker + title + action |

## Stub files to create (only if the delivery asks for them)

- ui/screen/home/HomeScreen.kt        — @Composable HomeScreen(state, events)
- ui/screen/home/HomeUiState.kt       — immutable state, real initial value
- ui/screen/home/HomeFixtures.kt      — fixture mirroring the prototype's mock data (tests only)

## Naming rules

- `<Feature>Screen` for the stateless screen, `<Feature>Route` for the stateful entry.
- `<Feature>UiState` for the state class. One per screen.
- Events are `on<Verb>`; no `handleX`, no `setX`.
- A composable that is `private` in the file it is used in is not a shared component.
```

## Rules

- The package path must already exist in the project. If the project has `ui/screen/<feature>/`,
  the plan says that; it never introduces a parallel tree.
- Total files per screen should be small: screen, state, fixtures. If the plan lists eight files
  for one screen, the screen is doing too much or the components are not extracted.
- The `Devices` column must match what the capture plan will produce, otherwise the port loop will
  be missing references.
