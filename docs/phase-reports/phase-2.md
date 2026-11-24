# Phase 2 — Preflight, decision gate, tools registry

## Done

- `scripts/lib/preflight.mjs`: environment snapshot (OS, Node, JDK major, Android SDK in four
  locations including `local.properties`, Gradle wrapper/CLI, git, gh auth, GitHub remote, free disk),
  classification into LOCAL_FULL / CI_ONLY / HYBRID / LIMITED with reasons, project-case detection
  (case 1/2/3) with signals, tool plan per mode, markdown report.
- `skills/preflight/` with `references/execution-modes.md` and `references/tool-approval.md`.
- Decision gate: six questions, specified once in `commands/uiport-start.md`, all answerable from
  `answers.json`.
- Headless mode: `scripts/lib/answers.mjs` (strict validation with one error list, normalization),
  `uiport.mjs answers` (exit 3 on invalid), `UIPORT_HEADLESS=0/1` overrides.
- `config/tools.json` registry with resolution date, age policy and per-tool `needs-user-input` status;
  `scripts/resolve-versions.mjs --check` verifies pins against the npm registry.

## Key numbers

| Metric | Value |
| --- | --- |
| Unit tests for this phase | 36 (preflight classification 7, tool plan 3, case detection 4, SDK discovery 2, answers 15, CLI answers 1, plus resume/state) |
| Execution modes demonstrated by tests | 4 of 4, each with the environment that produces it |
| Registry entries | 13 (8 fixed, 5 on demand), 2 deliberately `source: null`/`needs-user-input` |

## Decisions made

- A JDK below 17, or a non-GitHub remote, disqualifies a mode: the classifier is strict and says why.
- Answers validation reports **all** problems at once, so a CI run fails in one pass, not five.
- Playwright re-pinned from 1.65.1 (1 day old) to 1.64.1 (31 days old) to honour the 14-day policy.

## Open risks / blockers

- Maven pins (Roborazzi, Paparazzi, ktlint, detekt) cannot be verified from this machine: no Maven
  Central. They are verified by the consuming Gradle build; `resolve-versions.mjs` says so instead of
  pretending.

## Next

Phase 3 (mapping), see `phase-3.md`.
