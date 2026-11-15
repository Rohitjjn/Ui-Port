---
description: Port a web UI prototype into Jetpack Compose inside this Android project — preflight, maps, one decision gate, port loop with measured fidelity, engine wiring, verify, package.
argument-hint: [path to the prototype (zip or folder)] [optional: path to the Android project]
allowed-tools: ["Read", "Write", "Edit", "MultiEdit", "Glob", "Grep", "Bash", "TodoWrite", "AskUserQuestion", "Task", "WebFetch"]
---

# /uiport-start

You are running the ui-port workflow. Follow the steps in order. Do not skip a step and do not
ask questions outside the decision gate.

Arguments: `$1` = prototype path (zip or folder), `$2` = Android project path (default: the
current directory).

## Step 0 — Preflight (silent, then one approval)

1. If `$1` is a `.zip`, unpack it to a scratch folder (never modify the archive) and use that as
   the prototype root. If it is a folder, use it.
2. Follow the `preflight` skill: run the detector, read its report, present the tool approval
   batch **once** (execution mode, project case, tools with pinned versions, security note).
3. If `.uiport/answers.json` exists or `UIPORT_HEADLESS=1`, take every decision from it instead of
   asking. Validate it first: `node ${CLAUDE_PLUGIN_ROOT}/scripts/uiport.mjs answers`. An invalid
   answers file is a hard stop with the validation errors printed.

## Step 1 — Maps

Follow `map-app` and `map-prototype`. Produce:

- `.uiport/maps/app-map.md` + `app-map.json`, and `.uiport/engine-paths.json` (reviewed);
- `.uiport/maps/prototype-map.md` + `prototype-map.json`;
- `.uiport/maps/imports-map.md` (libraries → Compose equivalents, versions resolved at run time).

## Decision gate — one batch, only now

Ask all of these in a single message (or read them from `answers.json`):

1. **Device targets**: phone, tablet, desktop, a combination, or all three? (Recommend what the
   prototype actually supports and say why.)
2. **Where heavy tasks run**: confirm the detected execution mode.
3. **Ponytail**: use it to save tokens? (Recommend no for UI conversion — it can simplify away
   pixel detail; fine for engine work and reviews.)
4. **Feature gaps**: for every prototype feature with no engine support (list them from the
   wiring plan), build it in the engine or remove it from the UI — per feature.
5. **Engine edits**: may the port modify engine files? Default no.
6. **Delivery**: ZIP, branch/PR, or both.

Record the answers in `.uiport/answers.json`, `.uiport/state.json` and the worklog.

## Step 2 — Analysis and preparation

Follow `plan-screens`: `.uiport/maps/wiring-plan.md`, `.uiport/maps/screens-plan.md`,
`.uiport/maps/motion-and-assets.md`, plus the token translation. Then `capture-reference` for
every chosen device target, and the noise-floor calibration.

## Step 3 — Port loop

Follow `port-screen` one screen at a time, one device at a time: stateless composable + fixtures,
screenshot, `visual-diff`, fix, repeat (cap 5). Then `port-motion-and-assets`, then re-diff.
Update `.uiport/state.json` after every iteration.

## Step 4 — Wiring

Follow `wire-engine`. Replace fixtures with the engine, row by row from the wiring plan. Engine
edits only with recorded approval. Re-diff after wiring: appearance must not change.

## Step 5 — Verify and finalize

Follow `verify-and-fix`, then `finalize-delivery`. Produce `.uiport/FINAL-REPORT.md`, the worklog
index, the baseline, and the ZIP/PR the user asked for.

## Standing rules

- Write the worklog for every step as you go, not at the end. The Stop hook will block you once
  if a step's worklog is stale.
- Never claim a screen "matches" without a diff report in `.uiport/output/`.
- Never lower `config/thresholds.json` to make a screen pass.
- Never edit engine files without the approval flag and a worklog record.
- If a step is genuinely blocked, say what is blocked, what you tried and what the user can do —
  and keep the worklog honest.
