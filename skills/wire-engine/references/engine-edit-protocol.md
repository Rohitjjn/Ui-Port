# Engine edit protocol

Engine code is protected by default because a UI port has no business quietly changing playback,
persistence or networking.

## The sequence

1. The agent tries to edit an engine file. The `PreToolUse` hook blocks it and returns the list of
   matched paths plus the instruction to ask the user.
2. The agent asks **once**, in one message:

   ```
   The new UI needs three engine changes. May I make them?

   1. core/data/repository/LibraryRepositoryImpl.kt — add `suspend fun delete(ids: Set<String>)`
      (the prototype's multi-select delete has no engine support today).
   2. composeApp/src/commonMain/.../di/Modules.kt — register the new LibraryViewModel.
   3. core/domain/model/Playlist.kt — add `trackCount: Int` (the card shows it).

   None of these change existing behaviour; (1) and (3) are additions, (2) is a registration.
   ```

3. On approval: set `protectedPathsApproved: true` in `.uiport/state.json`, add every path and
   the user's exact words to the worklog, then edit. Add tests for the additions.
4. On refusal: the affected rows in the wiring plan become `remove-from-ui`, and that decision is
   recorded in the same place.

## What the hook actually checks

- `Write`/`Edit`/`MultiEdit`/`NotebookEdit` on a path matching a glob in
  `.uiport/engine-paths.json`.
- `Bash` commands that are destructive (`rm`, `mv`, `sed -i`, `git checkout --`, `truncate`,
  redirects) and touch a protected path. Read-only commands are allowed without approval, because
  blocking them would make understanding the code impossible.

## What it does not check

- Logic errors inside an approved edit. That is the tests' job.
- Files outside the project. Never protected, never relevant.

## After approval

Approval is per run. A new session starts with `protectedPathsApproved: false` again, on purpose:
a human should look at engine diffs once per attempt, not once per project.
