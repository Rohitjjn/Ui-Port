# Wiring patterns

## The shape that avoids most bugs

```kotlin
// 1. One immutable state per screen, with a real initial value.
data class LibraryUiState(
    val isLoading: Boolean = true,
    val playlists: List<PlaylistItem> = emptyList(),
    val selectedIds: Set<String> = emptySet(),
    val error: String? = null,
)

// 2. One state holder per screen (reuse the app's base ViewModel if it has one).
class LibraryViewModel(
    private val libraryRepository: LibraryRepository,   // existing engine entry point
) : ViewModel() {
    private val _uiState = MutableStateFlow(LibraryUiState())
    val uiState: StateFlow<LibraryUiState> = _uiState.asStateFlow()

    fun onTrackSelected(id: String) = _uiState.update { s ->
        s.copy(selectedIds = if (id in s.selectedIds) s.selectedIds - id else s.selectedIds + id)
    }

    fun onDeleteSelected() {
        viewModelScope.launch {                       // lifecycle-safe scope
            runCatching { libraryRepository.delete(_uiState.value.selectedIds) }
                .onSuccess { _uiState.update { it.copy(selectedIds = emptySet()) } }
                .onFailure { e -> _uiState.update { it.copy(error = e.message) } }
        }
    }
}

// 3. Route = stateful entry, screen = stateless and previewable.
@Composable
fun LibraryRoute(viewModel: LibraryViewModel = koinViewModel(), nav: NavHostController) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    LibraryScreen(
        state = state,
        onSelect = viewModel::onTrackSelected,
        onDelete = viewModel::onDeleteSelected,
        onPlaylistClick = { id -> nav.navigate(PlaylistDestination(id)) },
    )
}

@Composable
fun LibraryScreen(state: LibraryUiState, onSelect: (String) -> Unit, ...) { ... }
```

## Rules of thumb

- **Events are verbs** (`onPlayAll`, `onSeekTo`), **state is nouns** (`uiState`, `queue`).
- **One state object per screen.** Multiple independent `StateFlow`s in the UI layer cause
  flicker and make screenshot tests non-deterministic.
- **`collectAsStateWithLifecycle`**, never plain `collectAsState`, in anything that can go to the
  background.
- **No business logic in the composable.** A composable decides *what to draw*, not *what is
  true*.
- **Stable types.** `List<T>` of data classes is fine; lambdas captured in state are not — they
  defeat skipping.
- **Leave a preview.** `@Preview` with a fixture state keeps the screen renderable without the
  engine, which is exactly what the screenshot tests need.

## When the engine is asynchronous and the prototype is not

The prototype returns mock data after `await wait(650)`. The real engine may take 10 seconds or
fail. The ported screen must show the *same* loading/error visuals the prototype defines, not a
blank frame. If the prototype has no such state, ask the user whether to add one (it is a
feature gap, and it belongs in the gate answers).

## Threading

- Repositories suspend: call them from `viewModelScope`, never from composition.
- Main-thread-only state (`MutableStateFlow`) is safe to update from any dispatcher after
  `switchContext` in the repository layer — do not add `withContext(Dispatchers.Main)` in the
  ViewModel.
- Player/media state usually lives in a service: collect it, do not own it.
