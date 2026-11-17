#!/usr/bin/env node
/**
 * Run the verification suite for a ported project and record the evidence.
 *
 *   node scripts/verify.mjs --project . [--devices phone] [--step assembleDebug]
 *     [--skip build] [--regression] [--json .uiport/worklog/logs/verify.json]
 *
 * Each check is recorded with its command, exit code, duration and the tail of its
 * output, so the worklog and the final report can quote real evidence.
 *
 * Nothing here is Android-specific: the gradle task is a parameter.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { writeJsonAtomic } from "./lib/fs-utils.mjs";

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = args[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
};
const multi = (name) => {
  const out = [];
  for (let i = 0; i < args.length; i++) if (args[i] === `--${name}` && args[i + 1] && !args[i + 1].startsWith("--")) out.push(args[i + 1]);
  return out;
};

const project = path.resolve(String(flag("project", ".")));
const devices = multi("devices").length ? multi("devices") : [String(flag("device", "phone"))];
const step = String(flag("step", "assembleDebug"));
const skip = new Set(multi("skip").flatMap((s) => s.split(",")));
const wantRegression = Boolean(flag("regression", false));
const jsonOut = flag("json") ? path.resolve(String(flag("json"))) : path.join(project, ".uiport", "worklog", "logs", "verify.json");

const isWindows = process.platform === "win32";
const gradlew = path.join(project, isWindows ? "gradlew.bat" : "gradlew");
const hasWrapper = fs.existsSync(gradlew);

const checks = [];

function run(name, command, cmdArgs, { cwd = project, timeoutMs = 45 * 60 * 1000 } = {}) {
  const started = Date.now();
  const res = spawnSync(command, cmdArgs, {
    cwd,
    encoding: "utf8",
    timeout: timeoutMs,
    shell: isWindows && command.endsWith(".bat"),
    env: { ...process.env, CI: "true" },
  });
  const output = `${res.stdout ?? ""}\n${res.stderr ?? ""}`.trim();
  const entry = {
    name,
    command: [command, ...cmdArgs].join(" "),
    exitCode: res.status ?? (res.error ? 1 : 0),
    ok: (res.status ?? 1) === 0,
    durationMs: Date.now() - started,
    tail: output.split("\n").slice(-40).join("\n"),
    error: res.error ? String(res.error.message ?? res.error) : null,
  };
  checks.push(entry);
  process.stdout.write(`${entry.ok ? "PASS" : "FAIL"}  ${name}  (${(entry.durationMs / 1000).toFixed(1)}s)  ${entry.command}\n`);
  return entry;
}

if (!hasWrapper) {
  process.stdout.write("verify: no Gradle wrapper in the project; only non-Gradle checks will run\n");
}

// 1. Lint (cheap)
if (hasWrapper && !skip.has("lint")) {
  run("ktlint", gradlew, ["ktlintCheck", "--console=plain"]);
}
// 2. Build
if (hasWrapper && !skip.has("build")) {
  run("build", gradlew, [`:${flag("module", "androidApp")}:${step}`, "--console=plain", "--stacktrace"]);
}
// 3. Unit tests
if (hasWrapper && !skip.has("test")) {
  run("unit tests", gradlew, ["testDebugUnitTest", "--console=plain"]);
}
// 4. Screenshot regression (diff-all) when references exist
if (!skip.has("screens") && fs.existsSync(path.join(project, ".uiport", "reference"))) {
  for (const device of devices) {
    run(`screenshots:${device}`, process.execPath, [
      path.join(import.meta.dirname, "diff-all.mjs"),
      "--device",
      device,
      "--reference",
      path.join(project, ".uiport", "reference"),
      "--candidate",
      path.join(project, ".uiport", "output"),
      "--out",
      path.join(project, ".uiport", "output"),
      "--baseline",
      path.join(project, ".uiport", "baseline.json"),
    ]);
  }
}

const failed = checks.filter((c) => !c.ok);
const summary = {
  generatedAt: new Date().toISOString(),
  project,
  devices,
  step,
  passed: checks.length - failed.length,
  failed: failed.length,
  checks,
};
fs.mkdirSync(path.dirname(jsonOut), { recursive: true });
writeJsonAtomic(jsonOut, summary);
fs.mkdirSync(path.join(project, ".uiport", "worklog", "logs"), { recursive: true });
fs.writeFileSync(
  path.join(project, ".uiport", "worklog", "logs", "verify.log"),
  checks.map((c) => `### ${c.name} (${c.ok ? "PASS" : "FAIL"}, ${c.durationMs}ms)\n$ ${c.command}\n${c.tail}\n`).join("\n"),
);

process.stdout.write(`\nverify: ${summary.passed} passed, ${summary.failed} failed — evidence in ${path.relative(process.cwd(), jsonOut)}\n`);
if (failed.length) {
  process.stdout.write(`failed: ${failed.map((f) => f.name).join(", ")}\n`);
  process.exitCode = 1;
}
