#!/usr/bin/env node
/**
 * ui-port CLI — the one entry point every skill, agent and hook calls.
 *
 *   node scripts/uiport.mjs preflight [--json] [--save]
 *   node scripts/uiport.mjs state show
 *   node scripts/uiport.mjs state init [--case case-2-engine-only]
 *   node scripts/uiport.mjs state set-step <step> <status> [--note text]
 *   node scripts/uiport.mjs state set-screen <screen> --device phone --status building [--score 98.7]
 *   node scripts/uiport.mjs state bump <screen> --device phone
 *   node scripts/uiport.mjs state summary
 *   node scripts/uiport.mjs worklog ensure <step>
 *   node scripts/uiport.mjs worklog append <step> --heading "Commands run" --body "npm run dev"
 *   node scripts/uiport.mjs changelog --step step-1-maps --file src/Foo.kt --note "created"
 *   node scripts/uiport.mjs answers check
 *   node scripts/uiport.mjs status
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  applyAnswers,
  bumpIteration,
  emptyState,
  loadState,
  nextStep,
  saveState,
  setScreenStatus,
  setStep,
  summarize,
  STEPS,
  statePath,
} from "./lib/state.mjs";
import { appendChangelog, appendWorklog, ensureWorklog, isStepWorklogStale, worklogFile } from "./lib/worklog.mjs";
import {
  classifyEnvironment,
  detectProjectCase,
  probeEnvironment,
  renderPreflightReport,
  toolPlan,
} from "./lib/preflight.mjs";
import { UIPORT_DIR, ensureDir, exists, readJson, readJsonSafe, writeJsonAtomic } from "./lib/fs-utils.mjs";
import { loadAnswers, validateAnswers, REQUIRED_GATE_KEYS } from "./lib/answers.mjs";
import { spawnSync } from "node:child_process";

const rawArgs = process.argv.slice(2);

/**
 * --project / UIPORT_PROJECT_ROOT choose the project being ported. Accepted in any
 * position, so both `uiport answers --project dir` and `uiport --project dir answers`
 * work: a positional parse that depends on flag order is a trap for the caller.
 */
function extractProject(argv) {
  const i = argv.indexOf("--project");
  if (i === -1) return { args: argv, projectRoot: null };
  const value = argv[i + 1];
  if (value === undefined || value.startsWith("--")) {
    process.stderr.write("uiport: --project needs a directory\n");
    process.exit(2);
  }
  const rest = [...argv.slice(0, i), ...argv.slice(i + 2)];
  return { args: rest, projectRoot: path.resolve(value) };
}

const extracted = extractProject(rawArgs);
const args = extracted.args;
const projectRoot = path.resolve(extracted.projectRoot || process.env.UIPORT_PROJECT_ROOT || process.cwd());

function flag(name, fallback) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = args[i + 1];
  if (v === undefined || v.startsWith("--")) return true;
  return v;
}

function has(name) {
  return args.includes(`--${name}`);
}

function out(obj) {
  process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);
}

function fail(msg, code = 1) {
  process.stderr.write(`uiport: ${msg}\n`);
  process.exit(code);
}

function requireUiportDir() {
  ensureDir(path.join(projectRoot, UIPORT_DIR));
}

const [group, action, ...rest] = args;

function cmdPreflight() {
  const snap = probeEnvironment({ projectRoot });
  const classification = classifyEnvironment(snap);
  const detected = detectProjectCase(projectRoot);
  const plan = toolPlan(classification.mode, snap);
  const report = renderPreflightReport(snap, classification, detected);
  if (has("save")) {
    requireUiportDir();
    const dir = path.join(projectRoot, UIPORT_DIR);
    fs.writeFileSync(path.join(dir, "preflight.md"), `${report}\n`);
    const toolsFile = path.join(dir, "tooling.md");
    if (!exists(toolsFile)) {
      fs.writeFileSync(
        toolsFile,
        [
          "# Tooling",
          "",
          `Pinned on ${new Date().toISOString().slice(0, 10)} for execution mode \`${classification.mode}\`.`,
          "",
          "| Tool id | Why it is needed | Install command |",
          "| --- | --- | --- |",
          ...plan.map((p) => `| \`${p.id}\` | ${p.why} | see config/tools.json |`),
          "",
          "Versions come from `config/tools.json`. Nothing is installed without the user's approval batch.",
          "",
        ].join("\n"),
      );
    }
    const { state } = loadState(projectRoot);
    state.executionMode = classification.mode;
    state.projectCase = detected.projectCase;
    state.options = { ...state.options, toolsApproved: Boolean(state.options?.toolsApproved) };
    setStep(state, "step-0-preflight", state.steps["step-0-preflight"]?.status === "done" ? "done" : "in-progress");
    saveState(projectRoot, state);
  }
  if (has("json")) {
    out({ snapshot: snap, classification, detected, toolPlan: plan });
    return;
  }
  process.stdout.write(`${report}\n## Tool install plan (needs one approval)\n\n`);
  for (const p of plan) process.stdout.write(`- \`${p.id}\` — ${p.why}\n`);
}

function cmdState() {
  const sub = action;
  if (sub === "show") {
    const { state, recovered, warning } = loadState(projectRoot);
    if (warning) process.stderr.write(`warning: ${warning}\n`);
    out({ path: statePath(projectRoot), recovered, state });
    return;
  }
  if (sub === "init") {
    requireUiportDir();
    const file = statePath(projectRoot);
    if (exists(file) && !has("force")) fail("state.json already exists; pass --force to reinitialize", 2);
    const state = emptyState();
    const c = flag("case", null);
    if (c) state.projectCase = c;
    const devices = flag("devices", null);
    if (devices && devices !== true) state.deviceTargets = String(devices).split(",").map((s) => s.trim()).filter(Boolean);
    const mode = flag("mode", null);
    if (mode) state.executionMode = mode;
    writeJsonAtomic(file, state);
    out({ created: file, state });
    return;
  }
  if (sub === "set-step") {
    const [step, status] = [rest[0], rest[1]];
    if (!STEPS.includes(step)) fail(`unknown step "${step}"; expected one of ${STEPS.join(", ")}`, 2);
    const { state } = loadState(projectRoot);
    setStep(state, step, status, flag("note", undefined));
    saveState(projectRoot, state);
    out({ step, status, updatedAt: state.steps[step].updatedAt });
    return;
  }
  if (sub === "set-screen") {
    const screen = rest[0];
    if (!screen) fail("usage: state set-screen <screen> --device phone --status building", 2);
    const { state } = loadState(projectRoot);
    const scoreRaw = flag("score", null);
    setScreenStatus(state, {
      screen,
      device: String(flag("device", "phone")),
      status: String(flag("status", "pending")),
      score: scoreRaw == null || scoreRaw === true ? undefined : Number(scoreRaw),
      iterations: flag("iterations", undefined) === undefined ? undefined : Number(flag("iterations")),
      notes: flag("notes", undefined),
    });
    saveState(projectRoot, state);
    out({ screen, device: flag("device", "phone"), entry: state.screens[screen] });
    return;
  }
  if (sub === "bump") {
    const screen = rest[0];
    if (!screen) fail("usage: state bump <screen> --device phone", 2);
    const { state } = loadState(projectRoot);
    const device = String(flag("device", "phone"));
    const count = bumpIteration(state, screen, device);
    const limit = Number(flag("limit", 5));
    saveState(projectRoot, state);
    out({ screen, device, iterations: count, limit, capReached: count >= limit });
    return;
  }
  if (sub === "summary") {
    const { state } = loadState(projectRoot);
    out(summarize(state));
    return;
  }
  fail(`unknown state command "${sub}"`, 2);
}

function cmdWorklog() {
  const sub = action;
  const step = rest[0];
  if (!step) fail("usage: worklog <ensure|append> <step>", 2);
  if (sub === "ensure") {
    const res = ensureWorklog(projectRoot, step);
    out({ file: res.file, created: res.created });
    return;
  }
  if (sub === "append") {
    const heading = flag("heading", "What was done and why");
    const body = flag("body", "");
    if (!body) fail("append needs --body", 2);
    const file = appendWorklog(projectRoot, step, String(heading), String(body));
    out({ file });
    return;
  }
  if (sub === "check") {
    const { state } = loadState(projectRoot);
    out({ file: worklogFile(projectRoot, step), ...isStepWorklogStale(projectRoot, { ...state, currentStep: step }) });
    return;
  }
  fail(`unknown worklog command "${sub}"`, 2);
}

function cmdChangelog() {
  const step = flag("step", "unknown");
  const files = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--file") files.push({ path: args[i + 1], action: "changed" });
    if (args[i] === "--action" && files.length) files[files.length - 1].action = args[i + 1];
  }
  const file = appendChangelog(projectRoot, { step, files, note: flag("note", undefined) });
  out({ file, files: files.length });
}

function cmdAnswers() {
  const file = flag("file", path.join(projectRoot, UIPORT_DIR, "answers.json"));
  const res = readJsonSafe(file);
  if (!res.ok) {
    out({ present: false, file, error: res.error, headless: false });
    return;
  }
  const validation = validateAnswers(res.value);
  out({ present: true, file, headless: true, ...validation });
  if (!validation.ok) {
    process.exitCode = 3;
    return;
  }
  if (flag("apply", false)) {
    const { state } = loadState(projectRoot);
    applyAnswers(state, { ...validation.answers, headless: true }, { source: path.relative(projectRoot, file) });
    saveState(projectRoot, state);
    out({ applied: true, deviceTargets: state.deviceTargets, executionMode: state.executionMode, protectedPathsApproved: state.protectedPathsApproved });
  }
}

function cmdStatus() {
  const { state, warning } = loadState(projectRoot);
  const s = summarize(state);
  const lines = [
    `ui-port status — plugin ${s.pluginVersion}`,
    `case: ${s.case ?? "unknown"} | mode: ${s.executionMode ?? "unknown"} | devices: ${s.deviceTargets.join(", ") || "not chosen"}`,
    `step: ${s.currentStep} (next: ${s.nextStep ?? "done"}) | engine edits approved: ${s.protectedPathsApproved ? "yes" : "no"}`,
    "",
    "| Step | Status |",
    "| --- | --- |",
    ...Object.entries(s.steps).map(([k, v]) => `| ${k} | ${v.status} |`),
  ];
  if (s.screens.length) {
    lines.push("", "| Screen | Device | Status | Score | Iterations |", "| --- | --- | --- | --- | --- |");
    for (const sc of s.screens) {
      for (const d of sc.devices) {
        lines.push(`| ${sc.name} | ${d.device} | ${d.status} | ${d.score ?? "-"} | ${d.iterations} |`);
      }
    }
  } else {
    lines.push("", "_No screens recorded yet._");
  }
  if (warning) lines.push("", `> warning: ${warning}`);
  process.stdout.write(`${lines.join("\n")}\n`);
}

function cmdVerify() {
  // Delegate to verify.mjs so there is exactly one implementation of the checks.
  const passthrough = args.slice(1);
  const res = spawnSync(process.execPath, [path.join(import.meta.dirname, "verify.mjs"), ...passthrough], {
    stdio: "inherit",
  });
  process.exit(res.status ?? 1);
}

switch (group) {
  case "verify":
    cmdVerify();
    break;
  case "preflight":
    cmdPreflight();
    break;
  case "state":
    cmdState();
    break;
  case "worklog":
    cmdWorklog();
    break;
  case "changelog":
    cmdChangelog();
    break;
  case "answers":
    cmdAnswers();
    break;
  case "status":
    cmdStatus();
    break;
  case "--help":
  case "-h":
  case undefined:
    process.stdout.write(
      "ui-port CLI\n\n  preflight [--json] [--save]\n  state show|init|set-step|set-screen|bump|summary\n  worklog ensure|append|check <step>\n  changelog --step step-N --file path\n  answers [--file .uiport/answers.json] [--apply]\n  verify [--project dir] [--devices phone]\n  status\n",
    );
    break;
  default:
    fail(`unknown command "${group}"`, 2);
}
