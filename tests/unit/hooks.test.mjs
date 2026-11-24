import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test, { describe } from "node:test";
import { tmpProject } from "../helpers/fixtures.mjs";
import { evaluate, candidatePaths, isDestructive } from "../../hooks/lib/protect.mjs";
import { checkSource } from "../../hooks/lib/syntax.mjs";
import { emptyState, saveState, setStep } from "../../scripts/lib/state.mjs";
import { appendWorklog, isStepWorklogStale, worklogFile } from "../../scripts/lib/worklog.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const ENGINE_GLOBS = ["core/**/*.kt", "**/viewModel/**", "app/src/main/java/com/app/data/**"];

function projectWithEngine() {
  const p = tmpProject();
  p.json(".uiport/engine-paths.json", { globs: ENGINE_GLOBS });
  return p;
}

function evaluateFor(p, toolName, toolInput, approved = false) {
  return evaluate({
    toolName,
    toolInput,
    projectRoot: p.dir,
    enginePaths: { globs: ENGINE_GLOBS },
    approved,
  });
}

describe("engine protect", () => {
  test("allows edits to UI files", () => {
    const p = projectWithEngine();
    try {
      const r = evaluateFor(p, "Write", { file_path: path.join(p.dir, "app/src/main/java/com/app/ui/Home.kt") });
      assert.equal(r.decision, "approve");
      assert.deepEqual(r.matched, []);
    } finally {
      p.cleanup();
    }
  });

  test("blocks an edit to an engine file without approval", () => {
    const p = projectWithEngine();
    try {
      const r = evaluateFor(p, "Edit", { file_path: path.join(p.dir, "app/src/main/java/com/app/data/Repo.kt") });
      assert.equal(r.decision, "block");
      assert.deepEqual(r.matched, ["app/src/main/java/com/app/data/Repo.kt"]);
      assert.match(r.reason, /protects engine files/);
      assert.match(r.reason, /ask the user/);
    } finally {
      p.cleanup();
    }
  });

  test("allows the same edit once approved", () => {
    const p = projectWithEngine();
    try {
      const r = evaluateFor(p, "Edit", { file_path: path.join(p.dir, "core/media/Player.kt") }, true);
      assert.equal(r.decision, "approve");
      assert.match(r.reason, /approved/);
    } finally {
      p.cleanup();
    }
  });

  test("relative paths are resolved against the project", () => {
    const p = projectWithEngine();
    try {
      const r = evaluateFor(p, "Write", { file_path: "core/data/Database.kt" });
      assert.equal(r.decision, "block");
    } finally {
      p.cleanup();
    }
  });

  test("paths outside the project are never treated as protected", () => {
    const p = projectWithEngine();
    try {
      const r = evaluateFor(p, "Write", { file_path: "/etc/passwd" });
      assert.equal(r.decision, "approve");
    } finally {
      p.cleanup();
    }
  });

  test("destructive bash on a protected path is blocked", () => {
    const p = projectWithEngine();
    try {
      const r = evaluateFor(p, "Bash", { command: "rm -rf app/src/main/java/com/app/data" });
      assert.equal(r.decision, "block");
      assert.equal(isDestructive("rm -rf x"), true);
    } finally {
      p.cleanup();
    }
  });

  test("read-only bash on a protected path is allowed", () => {
    const p = projectWithEngine();
    try {
      const r = evaluateFor(p, "Bash", { command: "grep -rn 'fun play' core/media/Player.kt" });
      assert.equal(r.decision, "approve");
      assert.match(r.reason, /read-only/);
    } finally {
      p.cleanup();
    }
  });

  test("destroying a protected dir with a trailing slash still matches", () => {
    const p = projectWithEngine();
    try {
      assert.equal(evaluateFor(p, "Bash", { command: "rm -rf app/src/main/java/com/app/data/" }).decision, "block");
    } finally {
      p.cleanup();
    }
  });

  test("no engine-paths.json means no protection (never a false block)", () => {
    const p = tmpProject();
    try {
      const r = evaluate({
        toolName: "Write",
        toolInput: { file_path: path.join(p.dir, "core/x.kt") },
        projectRoot: p.dir,
        enginePaths: { globs: [] },
        approved: false,
      });
      assert.equal(r.decision, "approve");
      assert.match(r.reason, /no protected paths/);
    } finally {
      p.cleanup();
    }
  });

  test("candidatePaths ignores flags and punctuation", () => {
    const paths = candidatePaths("Bash", { command: "git add core/a.kt && rm -f -- 'core/b.kt'" }, "/repo");
    assert.deepEqual(paths.sort(), ["core/a.kt", "core/b.kt"]);
  });

  test("hook process blocks via exit code 2 and JSON on stdout", () => {
    const p = projectWithEngine();
    try {
      const payload = JSON.stringify({
        cwd: p.dir,
        tool_name: "Edit",
        tool_input: { file_path: path.join(p.dir, "core/media/Player.kt") },
      });
      let stdout = "";
      let code = 0;
      try {
        stdout = execFileSync(process.execPath, [path.join(ROOT, "hooks/engine-protect.mjs")], {
          input: payload,
          encoding: "utf8",
        });
      } catch (err) {
        code = err.status;
        stdout = String(err.stdout ?? "");
      }
      assert.equal(code, 2);
      assert.equal(JSON.parse(stdout).decision, "block");
    } finally {
      p.cleanup();
    }
  });

  test("hook process approves clean input with exit code 0", () => {
    const p = projectWithEngine();
    try {
      const payload = JSON.stringify({
        cwd: p.dir,
        tool_name: "Write",
        tool_input: { file_path: path.join(p.dir, "app/src/main/java/com/app/ui/Home.kt") },
      });
      const stdout = execFileSync(process.execPath, [path.join(ROOT, "hooks/engine-protect.mjs")], {
        input: payload,
        encoding: "utf8",
      });
      assert.equal(JSON.parse(stdout).decision, "approve");
    } finally {
      p.cleanup();
    }
  });

  test("hook fails open on garbage stdin", () => {
    const stdout = execFileSync(process.execPath, [path.join(ROOT, "hooks/engine-protect.mjs")], {
      input: "not json at all",
      encoding: "utf8",
    });
    assert.equal(JSON.parse(stdout).decision, "approve");
  });
});

describe("worklog guard", () => {
  test("stale when the step is in progress and the file is missing", () => {
    const p = tmpProject();
    try {
      const s = emptyState();
      setStep(s, "step-3-port", "in-progress");
      const r = isStepWorklogStale(p.dir, s);
      assert.equal(r.stale, true);
      assert.match(r.reason, /does not exist/);
    } finally {
      p.cleanup();
    }
  });

  test("not stale when the worklog was just written", () => {
    const p = tmpProject();
    try {
      const s = emptyState();
      setStep(s, "step-3-port", "in-progress");
      appendWorklog(p.dir, "step-3-port", "What was done and why", "ported home screen");
      const r = isStepWorklogStale(p.dir, s);
      assert.equal(r.stale, false);
    } finally {
      p.cleanup();
    }
  });

  test("not stale when the step is done", () => {
    const p = tmpProject();
    try {
      const s = emptyState();
      setStep(s, "step-3-port", "done");
      assert.equal(isStepWorklogStale(p.dir, s).stale, false);
    } finally {
      p.cleanup();
    }
  });

  test("stale when the worklog predates the step start", () => {
    const p = tmpProject();
    try {
      const s = emptyState();
      appendWorklog(p.dir, "step-3-port", "Objective", "old notes");
      const old = new Date(Date.now() - 60 * 60 * 1000);
      fs.utimesSync(worklogFile(p.dir, "step-3-port"), old, old);
      setStep(s, "step-3-port", "in-progress");
      assert.equal(isStepWorklogStale(p.dir, s).stale, true);
    } finally {
      p.cleanup();
    }
  });

  test("hook exits 0 in a non-ui-port project (no state.json)", () => {
    const p = tmpProject();
    try {
      const stdout = execFileSync(process.execPath, [path.join(ROOT, "hooks/worklog-guard.mjs")], {
        input: JSON.stringify({ cwd: p.dir, session_id: "s1" }),
        encoding: "utf8",
      });
      assert.equal(JSON.parse(stdout).decision, "approve");
    } finally {
      p.cleanup();
    }
  });

  test("hook blocks once and then lets the agent stop", () => {
    const p = tmpProject();
    try {
      const s = emptyState();
      setStep(s, "step-4-wiring", "in-progress");
      saveState(p.dir, s);
      const payload = JSON.stringify({ cwd: p.dir, session_id: `session-${Date.now()}` });
      const out1 = JSON.parse(
        execFileSync(process.execPath, [path.join(ROOT, "hooks/worklog-guard.mjs")], { input: payload, encoding: "utf8" }),
      );
      assert.equal(out1.decision, "block");
      assert.match(out1.reason, /Worklog is out of date for step-4-wiring/);
      const out2 = JSON.parse(
        execFileSync(process.execPath, [path.join(ROOT, "hooks/worklog-guard.mjs")], { input: payload, encoding: "utf8" }),
      );
      assert.equal(out2.decision, "approve");
      assert.match(out2.reason, /already fired once/);
    } finally {
      p.cleanup();
    }
  });
});

describe("syntax check", () => {
  test("accepts well-formed Kotlin", () => {
    assert.deepEqual(checkSource("@Composable\nfun A() {\n  Box { Text(\"hi\") }\n}\n", ".kt"), []);
  });

  test("accepts a string containing braces", () => {
    assert.deepEqual(checkSource('fun a() { val s = "{ [ (" }\n', ".kt"), []);
  });

  test("flags an unclosed brace", () => {
    assert.match(checkSource("fun a() {\n  println(1)\n", ".kt").join(" "), /unclosed "\{"/);
  });

  test("flags a mismatched closer", () => {
    assert.match(checkSource("fun a() { println(1]) }\n", ".kt").join(" "), /unbalanced "\]"/);
  });

  test("flags CRLF and a missing trailing newline", () => {
    const problems = checkSource("fun a() {}\r\n", ".kt").join(" ");
    assert.match(problems, /CRLF/);
  });

  test("flags an unterminated string", () => {
    assert.match(checkSource('val s = "abc\n', ".kt").join(" "), /unterminated string/);
  });

  test("TSX with a template literal is not a false positive", () => {
    assert.deepEqual(checkSource("const A = () => <div>{`hello ${name}`}</div>;\n", ".tsx"), []);
  });

  test("PostToolUse hook emits additional context for a broken file", () => {
    const p = tmpProject();
    try {
      const file = p.write("Broken.kt", "fun a() {\n");
      const stdout = execFileSync(process.execPath, [path.join(ROOT, "hooks/syntax-check.mjs")], {
        input: JSON.stringify({ cwd: p.dir, tool_name: "Write", tool_input: { file_path: file } }),
        encoding: "utf8",
      });
      const parsed = JSON.parse(stdout);
      assert.equal(parsed.hookSpecificOutput.hookEventName, "PostToolUse");
      assert.match(parsed.hookSpecificOutput.additionalContext, /unclosed/);
    } finally {
      p.cleanup();
    }
  });

  test("PostToolUse hook stays silent for a clean file and for non-source files", () => {
    const p = tmpProject();
    try {
      const good = p.write("Good.kt", "fun a() {}\n");
      const md = p.write("notes.md", "# not code {\n");
      for (const file of [good, md]) {
        const stdout = execFileSync(process.execPath, [path.join(ROOT, "hooks/syntax-check.mjs")], {
          input: JSON.stringify({ cwd: p.dir, tool_name: "Write", tool_input: { file_path: file } }),
          encoding: "utf8",
        });
        assert.equal(stdout.trim(), "");
      }
    } finally {
      p.cleanup();
    }
  });
});

describe("session start", () => {
  test("says nothing when there is no ui-port state", () => {
    const p = tmpProject();
    try {
      const stdout = execFileSync(process.execPath, [path.join(ROOT, "hooks/session-start.mjs")], {
        input: JSON.stringify({ cwd: p.dir }),
        encoding: "utf8",
      });
      assert.equal(stdout.trim(), "");
    } finally {
      p.cleanup();
    }
  });

  test("announces resume availability with the next step", () => {
    const p = tmpProject();
    try {
      const s = emptyState();
      s.deviceTargets = ["phone", "tablet"];
      setStep(s, "step-0-preflight", "done");
      setStep(s, "step-1-maps", "done");
      saveState(p.dir, s);
      const parsed = JSON.parse(
        execFileSync(process.execPath, [path.join(ROOT, "hooks/session-start.mjs")], {
          input: JSON.stringify({ cwd: p.dir }),
          encoding: "utf8",
        }),
      );
      const text = parsed.hookSpecificOutput.additionalContext;
      assert.match(text, /resume/i);
      assert.match(text, /Next incomplete step: step-2-analysis/);
      assert.match(text, /phone, tablet/);
    } finally {
      p.cleanup();
    }
  });

  test("warns about a corrupt state without breaking the session", () => {
    const p = tmpProject();
    try {
      p.write(".uiport/state.json", "{{{{");
      const parsed = JSON.parse(
        execFileSync(process.execPath, [path.join(ROOT, "hooks/session-start.mjs")], {
          input: JSON.stringify({ cwd: p.dir }),
          encoding: "utf8",
        }),
      );
      assert.match(parsed.hookSpecificOutput.additionalContext, /needs attention/);
    } finally {
      p.cleanup();
    }
  });
});
