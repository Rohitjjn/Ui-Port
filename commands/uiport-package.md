---
description: Package a finished ui-port delivery — final report with measured scores, worklog index, baseline, ZIP excluding build outputs, and optional branch/PR.
argument-hint: [optional: output zip path] [optional: --pr]
allowed-tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"]
---

# /uiport-package

## 1. Preconditions

- `.uiport/state.json` exists and Step 5 (`step-5-verify`) is at least in progress.
- Every screen in `state.deviceTargets` has a status: no `pending`, no `building`, and every
  `blocked` screen has a written reason. If not, stop and list what is missing — packaging an
  unfinished port is how wrong numbers get published.

## 2. Final report

Follow `finalize-delivery` and write `.uiport/FINAL-REPORT.md` from the real reports:

- score table (screen × device × status × pixel match × SSIM × geometry coverage);
- noise floor and effective thresholds;
- residual differences per screen, categorised;
- feature gaps and their resolutions;
- engine files touched and the approval record;
- how to run the app and the screenshot tests;
- remaining risks.

## 3. Baseline and worklog index

```
node -e "..."  # or write .uiport/baseline.json directly from state.lastScores
```

Confirm `.uiport/worklog/step-0-preflight.md` … `step-5-verify.md` and `CHANGELOG.md` exist and
each contains its six sections.

## 4. ZIP

```
node ${CLAUDE_PLUGIN_ROOT}/scripts/package-zip.mjs \
  --project . --out "${1:-<project>-uiport.zip}" [--include-output]
```

Then verify: list the archive entries, confirm `.uiport/worklog/` is inside, confirm no
`local.properties`, no `*.jks`, no `build/`. Report the entry count and size.

## 5. Branch and PR (only if asked)

If the argument contains `--pr`:

1. `git checkout -b ui-port/<short-description>` (never on `main`, never force-push).
2. Commit in logical units with clear messages.
3. Push, then open the PR with the score table as the body.

Report the branch and PR links.

## Rules

- Never include secrets, keystores or `local.properties` in the ZIP.
- Never publish a score that has no `report.json` behind it.
- If the ZIP exceeds `--max-mb`, find what is bloating it instead of raising the limit.
