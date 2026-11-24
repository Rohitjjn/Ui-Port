---
name: wire-engine
description: Use after screens match their references, to replace fixture data with the real engine — ViewModels/state holders, navigation, events, lifecycle and threading — following wiring-plan.md, without touching protected engine files unless the user approved it. Triggers on "wire it up", "connect the UI to the ViewModel", "replace the fake data", "the app crashes after wiring", or as Step 4 of a ui-port run.
---

# Wire the engine

One job: the ported UI becomes the app's real UI, driven by existing logic, with no change in
appearance.

## Procedure

1. **Re-diff before you start.** Every screen in scope must be `matched` or
   `accepted-with-notes` with fixtures. Wiring into an unfinished screen destroys the ability to
   tell a wiring bug from a layout bug.

2. **Work the wiring plan row by row.** For each row with action `wire`:
   - create the state holder (ViewModel) the plan named, or extend the existing one;
   - expose a single immutable UI state (`data class HomeUiState(...)`) plus events;
   - the composable keeps its stateless signature — only the entry point changes:

     ```kotlin
     @Composable
     fun HomeRoute(viewModel: HomeViewModel = koinViewModel(), nav: NavHostController) {
         val state by viewModel.uiState.collectAsStateWithLifecycle()
         HomeScreen(state = state, onTrackClick = viewModel::playTrack, ...)
     }
     ```

3. **Engine edits need approval.** If a row is `missing` and the user chose `build-in-engine`,
   the change lands in engine code, which the protect hook blocks. Ask once, name the files,
   then proceed after the flag is set — and write the approval into the worklog.

4. **Fix the lifecycle, not the symptom.** The classic wiring bugs and their real causes:

   | Symptom | Cause | Fix |
   | --- | --- | --- |
   | state lost on rotation | state created in the composable, not the ViewModel | hoist to ViewModel |
   | crash on first frame | collecting a `StateFlow` with a non-initial value | give the state a real initial value (`Loading`, never `null` cast) |
   | flicker | recomposing on every emission with an unstable state class | make the UI state a `data class` of stable types |
   | playback stops on navigation | coroutine scope tied to composition | use `viewModelScope` / app scope |
   | back does not return | nav call forked from the composed destination | route through the app's existing NavHost |
   | jank on scroll | heavy work in composition | move to the ViewModel / `derivedStateOf` |

5. **Re-diff after wiring.** Appearance must be unchanged. A wiring change that alters the
   screenshot is a regression; investigate before declaring done.

6. **Write a wiring test** for each primary flow (playback, navigation, search): assert that the
   user action reaches the engine, not that a pixel changed.

## Rules

- Never modify engine code without recorded approval.
- Never leave fixture data in production code. Delete the fixture file or scope it to tests.
- Never invent a repository call. The wiring plan names real functions; if one does not exist,
  that is a feature gap, and it goes back to the user.
- One flow per change, one diff per change.

## References

- `references/wiring-patterns.md` — state holder shapes, event naming, lifecycle, threading.
- `references/engine-edit-protocol.md` — how to ask, what to record, what the hook will do.
