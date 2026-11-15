#!/usr/bin/env node
/**
 * Stop — worklog guard.
 *
 * If a step is in progress and its worklog file was not written during that step,
 * block stopping ONCE with an instruction to update it. A per-session marker file
 * guarantees the guard can only fire once, so it can never trap the agent in a
 * loop.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { guard, projectDirOf, readHookInput, stopDecision } from "./lib/io.mjs";
import { loadState } from "../scripts/lib/state.mjs";
import { isStepWorklogStale, worklogFile } from "../scripts/lib/worklog.mjs";

guard(() => {
  const input = readHookInput();
  const projectRoot = projectDirOf(input);
  // Only act inside a project that ui-port has touched.
  if (!fs.existsSync(path.join(projectRoot, ".uiport", "state.json"))) stopDecision("approve", "not a ui-port project");

  const { state } = loadState(projectRoot, { repair: false });
  // Already blocked once for this step in this session? Let the agent stop.
  const sessionKey = createHash("sha1")
    .update(`${input.session_id ?? os.hostname()}::${state.currentStep}::${state.updatedAt ?? ""}`)
    .digest("hex")
    .slice(0, 16);
  const marker = path.join(os.tmpdir(), `uiport-worklog-guard-${sessionKey}.flag`);
  if (fs.existsSync(marker)) stopDecision("approve", "worklog guard already fired once for this step");

  const check = isStepWorklogStale(projectRoot, state);
  if (!check.stale) stopDecision("approve", check.reason);

  try {
    fs.writeFileSync(marker, new Date().toISOString());
  } catch {
    /* a missing marker only means we may ask again later; acceptable */
  }

  const file = worklogFile(projectRoot, check.step);
  stopDecision(
    "block",
    [
      `Worklog is out of date for ${check.step}: ${check.reason}`,
      "",
      `Before stopping, update ${path.relative(projectRoot, file)} with:`,
      "  ## What was done and why",
      "  ## Commands run",
      "  ## Results",
      "  ## Files touched",
      "  ## Problems and fixes",
      "",
      'Quick way: node scripts/uiport.mjs worklog append ' + check.step + ' --heading "Commands run" --body "<what you ran>"',
      "Then stop again. This guard will not ask a second time in this session.",
    ].join("\n"),
  );
});
