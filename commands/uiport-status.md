---
description: Show ui-port progress — per-screen per-device status table, scores, iteration counts, current step, blocked items and remaining risks.
argument-hint: [optional: screen name to filter]
allowed-tools: ["Read", "Bash", "Glob"]
---

# /uiport-status

## 1. Render the table

```
node ${CLAUDE_PLUGIN_ROOT}/scripts/uiport.mjs status
```

Print it as-is (it is already a markdown table), then add, only if there is something to add:

## 2. The short version

- **Screens**: matched X / total, accepted-with-notes Y, blocked Z, pending W.
- **Devices**: which targets are complete, which have no captures yet.
- **Scores**: best and worst screen per device, from `.uiport/state.json` `lastScores`.
- **Iterations**: any screen at or near the cap (5), so the next run knows where the risk is.
- **Blocked items**: each one with its reason (from the state notes) and what the user can decide
  to unblock it.
- **Worklog health**: whether the current step's worklog is fresh
  (`node ${CLAUDE_PLUGIN_ROOT}/scripts/uiport.mjs worklog check <step>`).

## 3. Filtering

If `$1` is provided, show only that screen's rows and its last diff report path, so the user can
open `report.md` and see the residual differences.

## Rules

- Read numbers from state and from `.uiport/output/**/report.json`. Never estimate a score.
- If a score in state disagrees with the report on disk, say so — the report is authoritative and
  state should be corrected with `state set-screen ... --score`.
- Do not start work in this command. It reports; it does not port.
