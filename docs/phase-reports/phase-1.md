# Phase 1 — Skeleton and foundations

## Done

- `.claude-plugin/plugin.json` + `marketplace.json` (verified shape against Anthropic's own
  marketplace file).
- 11 skills with `references/`, 4 agents, 4 commands.
- `hooks/hooks.json` + four Node hooks with their pure decision modules in `hooks/lib/`.
- `scripts/lib/{fs-utils,state,worklog,answers,preflight}.mjs` and the `uiport.mjs` CLI.
- `config/{tools,viewports,thresholds}.json`.
- `.github/workflows/ci-static.yml`, `ci-unit.yml` (ubuntu/windows/macos).

## Key numbers

| Metric | Value |
| --- | --- |
| Unit tests | 154, all passing locally |
| Skills / agents / commands | 11 / 4 / 4 |
| Hook events | 4 (SessionStart, PreToolUse, PostToolUse, Stop) |
| Validation | `node scripts/validate-plugin.mjs` OK, `node scripts/lint-markdown.mjs` OK (49 files) |

## Decisions made

- Hooks are thin wrappers over pure functions so they can be unit-tested without a session.
- The CLI is the single entry point; skills never re-implement state or worklog logic.
- `state.json` is written atomically and migrated/quarantined rather than treated as trusted input.

## Open risks / blockers

- Static and unit CI are green locally but have not run in Actions (B1).

## Next

Phase 2 (preflight, gate, registry, headless) — done, see `phase-2.md`.
