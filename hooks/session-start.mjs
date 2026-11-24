#!/usr/bin/env node
/**
 * SessionStart — state sanity.
 *
 * If .uiport/state.json exists, print a short "resume available" hint with the
 * next step, and warn (without blocking) when the file is corrupt or belongs to a
 * newer schema.
 */
import fs from "node:fs";
import path from "node:path";
import { addContext, guard, projectDirOf, readHookInput } from "./lib/io.mjs";
import { loadState, nextStep, summarize } from "../scripts/lib/state.mjs";

guard(() => {
  const input = readHookInput();
  const projectRoot = projectDirOf(input);
  const file = path.join(projectRoot, ".uiport", "state.json");
  if (!fs.existsSync(file)) return;
  const { state, recovered, warning } = loadState(projectRoot, { repair: false });
  const s = summarize(state);
  const lines = [];
  if (recovered || warning) lines.push(`ui-port: state.json needs attention — ${warning ?? "it could not be parsed"}`);
  lines.push(
    `ui-port project detected: a port is in progress (plugin ${s.pluginVersion}, case ${s.case ?? "unknown"}, mode ${s.executionMode ?? "unknown"}, devices ${s.deviceTargets.join(", ") || "not chosen"}).`,
  );
  lines.push(`Current step: ${s.currentStep}. Next incomplete step: ${s.nextStep ?? "none (all done)"}.`);
  if (s.screens.length) {
    const matched = s.screens.flatMap((sc) => sc.devices).filter((d) => d.status === "matched").length;
    lines.push(`Screens tracked: ${s.screens.length}, device entries matched: ${matched}.`);
  }
  lines.push('Run /uiport-resume to continue from state.json, or /uiport-status for the full table. Do not restart finished work.');
  addContext("SessionStart", lines.join("\n"));
});
