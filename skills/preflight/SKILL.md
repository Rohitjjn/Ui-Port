---
name: preflight
description: Use at the very start of a ui-port run, before any mapping or porting. Detects the environment (OS, Node, JDK, Android SDK, Gradle wrapper, git, gh, GitHub connection, disk), classifies the execution mode (LOCAL_FULL, CI_ONLY, HYBRID, LIMITED), detects the project case (old UI + engine, engine only, nothing), and produces the one-time tool approval batch. Also use when the user asks "can this machine run ui-port", "what will you install", or when a step failed because a tool is missing.
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

2. Read `.uiport/preflight.md`. Do not re-derive anything by hand.

3. Build the approval batch. One message, one yes/no, listing exactly:

   - the execution mode and the one-line reason for it;
   - the project case and the signals behind it;
   - every tool from `config/tools.json` in the plan, with its pinned version, its install
     command and what it is for;
   - the approximate download size (Playwright + Chromium is the big one, ~150 MB);
   - the security note: plugin hooks and scripts run on this machine, nothing is installed
     without this approval.

4. On approval: install exactly the pinned versions, in this order, and record the result in
   `.uiport/tooling.md` — version, command, date, success. If an install fails, stop and
   report; do not silently skip a tool that later steps depend on.

5. On refusal, or when the mode is `LIMITED`, write `.uiport/tooling.md` describing what can
   still be done locally (mapping, code generation, static checks, diffing of images the user
   provides) and the exact commands the user can run elsewhere to finish.

6. Write `.uiport/worklog/step-0-preflight.md` (see `worklog` helper) and mark the step
   `done` with the state CLI.

## Rules

- Never install anything without the approval batch, and never re-ask for the same approval
  twice in one run.
- Never guess versions: read them from `config/tools.json`. If a pin is missing or marked
  `needs-user-input`, ask once and record the answer.
- If `node` itself is missing, say so plainly and stop; the plugin cannot run its scripts.
- The mode is a proposal. The user can override it at the decision gate; record the override
  in `state.json` and in the worklog.

## References

- `references/execution-modes.md` — what each mode can and cannot do, and how work is
  re-planned for it.
- `references/tool-approval.md` — the exact approval message shape, and the failure modes to
  name up front (no network, no browser download, corporate proxy).
