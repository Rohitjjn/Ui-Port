# Phase 6 — Engine wiring and feature gaps

## Done

- `skills/wire-engine/` — row-by-row wiring from `wiring-plan.md`, one immutable UI state per screen,
  route/screen split, lifecycle and threading rules, the classic wiring bugs and their real causes.
  `references/wiring-patterns.md`, `references/engine-edit-protocol.md`.
- `agents/wiring-engineer.md` — wires screens, adds approved engine features **with tests**, re-diffs
  after wiring.
- Engine-protect hook (`hooks/engine-protect.mjs` + `hooks/lib/protect.mjs`): blocks
  Write/Edit/MultiEdit/NotebookEdit and destructive Bash on protected globs unless
  `protectedPathsApproved`; read-only Bash is allowed; fails open on any internal error.
- Feature-gap flow: `build-in-engine` vs `remove-from-ui` per feature, recorded in `answers.json`,
  `state.json` and the worklog; the wiring plan keeps a "decided at the gate" section.

## Key numbers

| Metric | Value |
| --- | --- |
| Hook unit tests | 12 for engine-protect alone (approve, block, approved, relative, outside-project, destructive, read-only, trailing slash, no-config, candidate parsing, process-level block/approve, garbage stdin) |
| Block/allow contract | exit 2 + `{"decision":"block"}` blocks; exit 0 approves |
| Engine entry points available to the port | 64 (SimpMusic) |

## Decisions made

- The approval flag is **per run**, not permanent: a new session asks again.
- The block message tells the agent exactly how to ask the user, so it never tries to work around the
  hook by editing files through a shell trick.

## Open risks / blockers

- The hook is tested at the function and process level; it has not been exercised inside a live
  Claude Code session from here (no IDE/session in this environment).

## Next

Phase 7 (verify + package), see `phase-7.md`.
