---
name: preflight
description: Use at the very start of a ui-port run, before any mapping or porting. Detects the environment (OS, Node, JDK, Android SDK, Gradle wrapper, git, gh, GitHub connection, disk), classifies the execution mode (LOCAL_FULL, CI_ONLY, HYBRID, LIMITED), measures the port's size (SIMPLE/MEDIUM/LARGE) from the prototype and the target app, detects the project case (old UI + engine, engine only, nothing), and produces the one-time tool approval batch. Also use when the user asks "can this machine run ui-port", "what will you install", or when a step failed because a tool is missing.
---

# Preflight

One job: work out what this machine and this project can do, and get a single approval
for everything that needs installing. Nothing else.

## Procedure

1. Run the detector and save its output:

   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/uiport.mjs preflight --save
   ```

   It writes `.uiport/preflight.md` and `.uiport/tooling.md`, and records the detected
   execution mode and project case in `.uiport/state.json`.

2. **Measure the size.** Run it against both subjects, in the same project directory:

   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/uiport.mjs size assess <prototypeDir> --app <androidAppDir>
   ```

   It writes `.uiport/size-assessment.json` and prints the per-dimension comparison. The tier is
   `SIMPLE` (one batch), `MEDIUM` (slices) or `LARGE` (strangler behind a per-route flag), and it
   changes the whole shape of the run, so it belongs in the approval batch, not in a passing
   remark: quote the tier, the dimension that drove it, and what it means for how the work runs.

   Do not argue with the number by editing the numbers. If you think it is wrong — twenty
   variants of one list, a screen that is really four — say so at the gate and let the user
   record a `sizeOverride` with a reason. The computed verdict stays in the file.

3. Read `.uiport/preflight.md`. Do not re-derive anything by hand.

4. Build the approval batch. One message, one yes/no, listing exactly:

   - the execution mode and the one-line reason for it;
   - the size tier, the dimension that drove it, and the strategy it implies;
   - the project case and the signals behind it;
   - every tool from `config/tools.json` in the plan, with its pinned version, its install
     command and what it is for;
   - the approximate download size (Playwright + Chromium is the big one, ~150 MB);
   - the security note: plugin hooks and scripts run on this machine, nothing is installed
     without this approval.

5. On approval: install exactly the pinned versions, in this order, and record the result in
   `.uiport/tooling.md` — version, command, date, success. If an install fails, stop and
   report; do not silently skip a tool that later steps depend on.

6. On refusal, or when the mode is `LIMITED`, write `.uiport/tooling.md` describing what can
   still be done locally (mapping, code generation, static checks, diffing of images the user
   provides) and the exact commands the user can run elsewhere to finish.

7. Write `.uiport/worklog/step-0-preflight.md` (see `worklog` helper) and mark the step
   `done` with the state CLI.

## Rules

- Never install anything without the approval batch, and never re-ask for the same approval
  twice in one run.
- Never guess versions: read them from `config/tools.json`. If a pin is missing or marked
  `needs-user-input`, ask once and record the answer.
- If `node` itself is missing, say so plainly and stop; the plugin cannot run its scripts.
- If the target app has not been chosen yet, assess the prototype alone and say so: the tier is
  then a lower bound, because the app can only push it up.
- The mode is a proposal. The user can override it at the decision gate; record the override
  in `state.json` and in the worklog.

## References

- `references/execution-modes.md` — what each mode can and cannot do, and how work is
  re-planned for it.
- `references/tool-approval.md` — the exact approval message shape, and the failure modes to
  name up front (no network, no browser download, corporate proxy).
- `references/size-tiers.md` — what each tier changes, and how to record an override.
