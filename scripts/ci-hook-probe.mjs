#!/usr/bin/env node
/**
 * End-to-end probe for the engine-protect hook.
 *
 * Runs the real hook binary the way Claude Code does — JSON on stdin, exit code as the
 * answer — instead of testing the library in-process. Cross-platform on purpose: it uses
 * os.tmpdir() and path.join, and it feeds both POSIX and Windows separators on every OS,
 * because the payload the hook receives depends on the platform the user is on, while the
 * paths inside a project are written by whoever wrote the config.
 *
 *   node scripts/ci-hook-probe.mjs
 *
 * Exit 0 = every expectation held; 1 = a hook decision was wrong.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const HOOK = path.join(ROOT, "hooks", "engine-protect.mjs");

const results = [];
const check = (name, actual, expected) => {
  const ok = actual === expected;
  results.push({ name, actual, expected, ok });
  process.stdout.write(`${ok ? "ok  " : "FAIL"}  ${name} (exit ${actual}, expected ${expected})\n`);
  return ok;
};

function makeProject({ globs = ["core/**"], approved = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "uiport-probe-"));
  fs.mkdirSync(path.join(dir, ".uiport"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".uiport", "engine-paths.json"), JSON.stringify({ globs }));
  if (approved) {
    fs.writeFileSync(
      path.join(dir, ".uiport", "state.json"),
      JSON.stringify({ schemaVersion: 1, protectedPathsApproved: true, options: { allowEngineEdits: true } }),
    );
  }
  return dir;
}

function runHook(payload) {
  const res = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify(payload),
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: payload.cwd },
  });
  return { code: res.status, stdout: res.stdout ?? "", stderr: res.stderr ?? "" };
}

const project = makeProject();
try {
  // 1. Blocking edit, POSIX separator.
  check(
    "edit inside a protected glob is blocked",
    runHook({ cwd: project, tool_name: "Edit", tool_input: { file_path: path.posix.join("core", "Player.kt") } }).code,
    2,
  );

  // 2. Same edit with the platform separator (backslash on Windows, slash elsewhere).
  check(
    "edit inside a protected glob is blocked with the native separator",
    runHook({ cwd: project, tool_name: "Write", tool_input: { file_path: path.join("core", "Player.kt") } }).code,
    2,
  );

  // 3. An absolute path inside the project, as Claude Code reports it.
  check(
    "absolute path inside the protected glob is blocked",
    runHook({ cwd: project, tool_name: "Edit", tool_input: { file_path: path.join(project, "core", "Player.kt") } }).code,
    2,
  );

  // 4. A UI file is never blocked.
  check(
    "edit outside the protected glob is allowed",
    runHook({ cwd: project, tool_name: "Edit", tool_input: { file_path: path.join("ui", "Home.kt") } }).code,
    0,
  );

  // 5. A CRLF-carrying payload must not defeat the parser (the original probe's target).
  const crlf = spawnSync(process.execPath, [HOOK], {
    input: `${JSON.stringify({ cwd: project, tool_name: "Edit", tool_input: { file_path: "core/Player.kt" } }).replace(/\n/g, "\r\n")}\r\n`,
    encoding: "utf8",
  });
  check("CRLF-delimited JSON input is still parsed and blocked", crlf.status, 2);

  // 6. Read-only tools are allowed.
  check(
    "read-only tool is allowed",
    runHook({ cwd: project, tool_name: "Read", tool_input: { file_path: "core/Player.kt" } }).code,
    0,
  );

  // 7. Approval in state.json unblocks.
  const approved = makeProject({ approved: true });
  check(
    "approved engine edits are allowed",
    runHook({ cwd: approved, tool_name: "Edit", tool_input: { file_path: "core/Player.kt" } }).code,
    0,
  );
  fs.rmSync(approved, { recursive: true, force: true });
} finally {
  fs.rmSync(project, { recursive: true, force: true });
}

const failed = results.filter((r) => !r.ok);
process.stdout.write(`\n${results.length - failed.length}/${results.length} hook probes passed\n`);
if (failed.length) {
  for (const f of failed) process.stdout.write(`::error title=hook probe: ${f.name}::exit ${f.actual}, expected ${f.expected}\n`);
  process.exit(1);
}
