---
description: Resume a ui-port run from .uiport/state.json without redoing finished work — shows what is done, what is next, and continues from the right step.
argument-hint: [optional: force a step, e.g. step-3-port]
allowed-tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "TodoWrite", "AskUserQuestion", "Task"]
---

# /uiport-resume

## 1. Load state

```
node ${CLAUDE_PLUGIN_ROOT}/scripts/uiport.mjs status
node ${CLAUDE_PLUGIN_ROOT}/scripts/uiport.mjs state summary
```

If `.uiport/state.json` does not exist, say so and offer `/uiport-start`.

If it is corrupt, the CLI has already quarantined it as `state.json.corrupt.json` and created a
fresh one — tell the user that, show the warning, and ask whether to continue from the recovered
state or restart.

## 2. Report, in five lines or fewer

- case, execution mode, device targets;
- current step and next incomplete step;
- screens by status (matched / accepted-with-notes / building / pending / blocked) per device;
- anything that was blocked when the session ended, and why;
- the first concrete action you are about to take.

## 3. Continue

Resume at `nextStep(state)` unless `$1` forces a step. Re-read only what that step needs:

| Step | Re-read |
| --- | --- |
| step-0-preflight | `.uiport/preflight.md`, `.uiport/tooling.md` |
| step-1-maps | existing maps; do not regenerate if present and non-empty |
| step-2-analysis | `screens-plan.md`, `capture-spec.json`; re-capture only missing screenshots |
| step-3-port | state screens with status `building` or `pending`; the diff reports of the last iteration |
| step-4-wiring | `wiring-plan.md`, rows not yet wired |
| step-5-verify | the last failure log in `.uiport/worklog/logs/` |

## Rules

- Do not redo finished work. A screen already `matched` is not re-ported; a step already `done`
  is not rerun because it "seems quick".
- Re-run the noise-floor check if captures look inconsistent; do not assume the old number holds
  on a different machine.
- Iteration counters persist. A screen at 4/5 iterations has one attempt left, not five.
- Append to the worklog: `resumed at <step>`, what was re-read, what is being continued.
