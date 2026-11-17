---
name: finalize-delivery
description: Use at the end of a port to package what was delivered — final report with measured scores per screen and device, worklog index, ZIP builder that excludes build outputs and includes .uiport/worklog, and branch/PR creation when asked. Triggers on "package the port", "make the zip", "give me the final report", "open a PR with the new UI", or as the last step of a ui-port run.
---

# Finalize delivery

One job: hand over something the user can open, read and run, with numbers attached.

## Procedure

1. **Final report.** Write `.uiport/FINAL-REPORT.md` (and echo a short version in the chat):

   - what was ported: screen list per device target with status and score;
   - noise floor and effective thresholds;
   - residual differences per screen, categorised;
   - what was wired and what was left as a fixture (should be nothing);
   - feature gaps and how each was resolved (build in engine / removed from UI);
   - engine files touched, with the approval reference;
   - how to run the screenshot tests and the app;
   - known limits and remaining risks.

2. **Worklog index.** `.uiport/worklog/` must contain `step-0` … `step-5` and `CHANGELOG.md`.
   Verify each file has the six sections and at least one concrete command per step.

3. **Baseline.** Write `.uiport/baseline.json` from the final scores so later changes are
   measured against this run.

4. **Package.**

   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/package-zip.mjs --project <projectRoot> \
     --out <project>-uiport-<date>.zip
   ```

   The script excludes `build/`, `.gradle/`, `node_modules/`, `dist/`, `.idea/`, caches, `*.iml`,
   and includes `.uiport/` — worklog, maps, reports and reference screenshots — but not
   `.uiport/output/` (the working diff images) unless `--include-output` is passed. It refuses to
   create a ZIP larger than `--max-mb` (default 200) and prints the entry count and size.

5. **Git delivery, only if asked.** Branch from the current state, one commit per logical unit,
   push, and open a PR with the final report as the description. Never force-push, never touch
   `main` directly unless the user asked for exactly that.

6. Mark Step 5 done and `timestamps.finishedAt` in state.

## Rules

- The ZIP must open and contain the worklog. Verify by listing its entries before handing it over;
  report the entry count.
- Never include secrets: no `local.properties`, no keystores, no `.env`, no tokens. The script
  blocks the common ones; check the listing anyway.
- The report's numbers come from `.uiport/output/**/report.json`, not from memory.
- If the delivery is a PR, the PR description must include the score table and the residual
  differences, so a reviewer does not have to open the ZIP.

## References

- `references/final-report-template.md` — the exact report shape.
- `../verify-and-fix/references/verification-matrix.md` — what the numbers mean.
