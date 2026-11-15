/**
 * .uiport/worklog/ — one markdown file per step plus CHANGELOG.md.
 *
 * The Worklog guard hook (Stop) checks `isStepWorklogStale`: if a step is
 * "in-progress" and its worklog file was not written during this step, the agent
 * is asked once to update it before it may stop.
 */
import fs from "node:fs";
import path from "node:path";
import { UIPORT_DIR, ensureDir, exists, readText, toPosix } from "./fs-utils.mjs";
import { STEPS } from "./state.mjs";

export function worklogDir(projectRoot) {
  return path.join(projectRoot, UIPORT_DIR, "worklog");
}

export function worklogFile(projectRoot, step) {
  return path.join(worklogDir(projectRoot), `${step}.md`);
}

export const STEP_TITLES = {
  "step-0-preflight": "Step 0 — Preflight, tooling and decision gate",
  "step-1-maps": "Step 1 — Maps (app, prototype, wiring plan)",
  "step-2-analysis": "Step 2 — Analysis and preparation",
  "step-3-port": "Step 3 — Port loop (screens, motion, assets)",
  "step-4-wiring": "Step 4 — Wiring to the engine",
  "step-5-verify": "Step 5 — Verify, fix and finalize",
};

const SECTION_ORDER = [
  "Objective",
  "What was done and why",
  "Context and decisions",
  "Commands run",
  "Results",
  "Files touched",
  "Problems and fixes",
];

export function renderWorklog(step, { sections = {} } = {}) {
  const title = STEP_TITLES[step] ?? step;
  const lines = [`# ${title}`, "", `<!-- updated: ${new Date().toISOString()} -->`, ""];
  for (const key of SECTION_ORDER) {
    const body = sections[key] ?? (key === "Objective" ? "_TODO: one or two sentences._" : "_TODO_");
    lines.push(`## ${key}`, "", body.trim(), "");
  }
  const extra = Object.entries(sections).filter(([k]) => !SECTION_ORDER.includes(k));
  for (const [k, v] of extra) lines.push(`## ${k}`, "", String(v).trim(), "");
  return lines.join("\n");
}

export function ensureWorklog(projectRoot, step, sections) {
  const file = worklogFile(projectRoot, step);
  if (exists(file)) return { file, created: false };
  ensureDir(worklogDir(projectRoot));
  fs.writeFileSync(file, renderWorklog(step, { sections }));
  return { file, created: true };
}

/** Append to a section, or add it at the end if missing. Idempotent by comment marker. */
export function appendWorklog(projectRoot, step, heading, body) {
  const file = worklogFile(projectRoot, step);
  ensureDir(worklogDir(projectRoot));
  const current = exists(file) ? readText(file) : renderWorklog(step, {});
  const marker = `## ${heading}`;
  const idx = current.indexOf(marker);
  const stamp = new Date().toISOString();
  const chunk = `\n- ${stamp} ${body.trim()}\n`;
  let next;
  if (idx === -1) {
    next = `${current.trimEnd()}\n\n${marker}\n${chunk}`;
  } else {
    const after = current.indexOf("\n## ", idx + marker.length);
    if (after === -1) {
      next = `${current.trimEnd()}\n${chunk}`;
    } else {
      next = `${current.slice(0, after)}${chunk}${current.slice(after)}`;
    }
  }
  // Touch the "updated" marker so staleness checks are time-accurate.
  next = next.replace(/<!-- updated: .*? -->/, `<!-- updated: ${stamp} -->`);
  fs.writeFileSync(file, next.endsWith("\n") ? next : `${next}\n`);
  return file;
}

export function appendChangelog(projectRoot, { step, files = [], note }) {
  const file = path.join(worklogDir(projectRoot), "CHANGELOG.md");
  ensureDir(worklogDir(projectRoot));
  if (!exists(file)) {
    fs.writeFileSync(
      file,
      "# ui-port changelog (this project)\n\nEvery file the plugin created, changed or deleted, by step.\n\n",
    );
  }
  const stamp = new Date().toISOString();
  const lines = [`## ${stamp} — ${step}`, ""];
  if (note) lines.push(note, "");
  for (const f of files) {
    const entry = typeof f === "string" ? { path: f, action: "changed" } : f;
    lines.push(`- \`${toPosix(entry.path)}\` — ${entry.action ?? "changed"}`);
  }
  if (!files.length) lines.push("- (no file changes)");
  lines.push("");
  fs.appendFileSync(file, `${lines.join("\n")}\n`);
  return file;
}

/**
 * Staleness check used by the Stop hook.
 * @returns {{stale: boolean, step: string|null, reason: string}}
 */
export function isStepWorklogStale(projectRoot, state, now = Date.now()) {
  const step = state?.currentStep;
  if (!step || !STEPS.includes(step)) return { stale: false, step, reason: "no active step" };
  const status = state?.steps?.[step]?.status;
  if (status !== "in-progress" && status !== "active") {
    return { stale: false, step, reason: `step status is "${status ?? "unknown"}"` };
  }
  const file = worklogFile(projectRoot, step);
  if (!exists(file)) return { stale: true, step, reason: `worklog for ${step} does not exist` };
  const stat = fs.statSync(file);
  const stepStarted = Date.parse(state?.steps?.[step]?.updatedAt ?? state?.timestamps?.startedAt ?? 0);
  // Stale when the file predates the moment the step was opened, or is older than 10 minutes.
  const olderThanStep = Number.isFinite(stepStarted) && stat.mtimeMs < stepStarted - 1000;
  const olderThanWindow = now - stat.mtimeMs > 10 * 60 * 1000;
  if (olderThanStep || olderThanWindow) {
    return {
      stale: true,
      step,
      reason: `${toPosix(path.relative(projectRoot, file))} was not updated during ${step} (last write ${new Date(stat.mtimeMs).toISOString()})`,
    };
  }
  return { stale: false, step, reason: "worklog is fresh" };
}
