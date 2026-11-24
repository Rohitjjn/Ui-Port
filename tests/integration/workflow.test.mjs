/**
 * Integration checks that tie the pieces together the way a real run does:
 * maps -> capture plan -> diff -> state -> worklog -> package.
 *
 * Runs entirely on synthetic data, so it is safe in every environment and does not
 * need a browser or a JVM.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test, { describe } from "node:test";
import { tmpProject } from "../helpers/fixtures.mjs";
import { fakeNodes, fakeScreen, save } from "../helpers/images.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const NODE = process.execPath;
const CLI = path.join(ROOT, "scripts/uiport.mjs");

function cli(cwd, ...args) {
  try {
    return { code: 0, stdout: execFileSync(NODE, [CLI, ...args], { cwd, encoding: "utf8" }) };
  } catch (err) {
    return { code: err.status, stdout: String(err.stdout ?? ""), stderr: String(err.stderr ?? "") };
  }
}

describe("end-to-end procedure (synthetic project)", () => {
  test("state, screens, diffs, worklog and ZIP form one coherent run", () => {
    const p = tmpProject("uiport-e2e-");
    try {
      // A tiny "ported project": one screen file, one worklog entry per step.
      p.write("app/src/main/java/Home.kt", "package app\n\nfun Home() {}\n");
      p.json(".uiport/engine-paths.json", { globs: ["core/**"], approved: false });

      // Step 0: answers (headless mode) drive the run instead of questions.
      p.json(".uiport/answers.json", {
        deviceTargets: ["phone"],
        executionMode: "HYBRID",
        extraFeatures: { "canvas-video": "remove-from-ui" },
        allowEngineEdits: false,
        delivery: ["zip"],
      });
      const answers = cli(p.dir, "answers");
      assert.equal(answers.code, 0, answers.stderr);
      assert.equal(JSON.parse(answers.stdout).ok, true);

      // State initialised from those answers.
      assert.equal(cli(p.dir, "state", "init", "--case", "case-1-old-ui-plus-engine", "--devices", "phone", "--mode", "HYBRID").code, 0);
      for (const step of ["step-0-preflight", "step-1-maps", "step-2-analysis"]) {
        cli(p.dir, "state", "set-step", step, "done");
        cli(p.dir, "worklog", "append", step, "--heading", "Results", "--body", `${step} finished`);
      }

      // Step 3: two screens, one matches, one needs one more iteration.
      cli(p.dir, "state", "set-step", "step-3-port", "in-progress");
      save(path.join(p.dir, ".uiport/reference/phone/home"), "default.png", fakeScreen());
      save(path.join(p.dir, ".uiport/output/phone/home"), "default.png", fakeScreen());
      save(path.join(p.dir, ".uiport/reference/phone/search"), "default.png", fakeScreen());
      save(path.join(p.dir, ".uiport/output/phone/search"), "default.png", fakeScreen({ shift: 6 }));

      // Both sides emit a node dump, because geometry is a gate: a screen with no candidate
      // dump is "not measured" and cannot be accepted however good the pixels look.
      const dump = (rel, nodes, name) => {
        fs.mkdirSync(path.join(p.dir, rel), { recursive: true });
        fs.writeFileSync(path.join(p.dir, rel, name), JSON.stringify(nodes));
      };
      dump(".uiport/reference/phone/home", fakeNodes(), "default.geometry.json");
      dump(".uiport/output/phone/home", fakeNodes(), "default.semantics.json");
      // search is shifted by 6dp, which is beyond the 1dp tolerance: geometry must catch it.
      dump(".uiport/reference/phone/search", fakeNodes(), "default.geometry.json");
      dump(".uiport/output/phone/search", fakeNodes({ shift: 6 }), "default.semantics.json");

      const diff = (() => {
        try {
          return {
            code: 0,
            stdout: execFileSync(
              NODE,
              [path.join(ROOT, "scripts/diff-all.mjs"), "--device", "phone", "--reference", ".uiport/reference", "--candidate", ".uiport/output", "--out", ".uiport/output"],
              { cwd: p.dir, encoding: "utf8" },
            ),
          };
        } catch (err) {
          return { code: err.status, stdout: String(err.stdout ?? "") };
        }
      })();
      assert.equal(diff.code, 5, "one screen still needs work => exit 5");
      const summary = JSON.parse(p.read(".uiport/output/summary.json"));
      assert.equal(summary.counts.matched, 1);
      assert.equal(summary.counts.building, 1);
      const searchRow = summary.results.find((r) => r.screen === "search");
      // 99.25% is above the 95% floor, so the only thing keeping it out is geometry.
      assert.ok(searchRow.pixelMatchPct > 95, `search pixel ${searchRow.pixelMatchPct} should clear the floor`);
      assert.match(searchRow.reason, /geometry coverage/, "geometry, not pixels, must be what blocks it");

      cli(p.dir, "state", "set-screen", "home", "--device", "phone", "--status", "matched", "--score", "100");
      cli(p.dir, "state", "set-screen", "search", "--device", "phone", "--status", "building", "--score", "96.1");
      const bump = JSON.parse(cli(p.dir, "state", "bump", "search", "--device", "phone").stdout);
      assert.equal(bump.used, 1);
      assert.equal(bump.remaining, 4);
      assert.equal(bump.capReached, false);

      // Step 5: verify records evidence, packaging includes the worklog.
      const verify = (() => {
        try {
          return {
            code: 0,
            stdout: execFileSync(NODE, [path.join(ROOT, "scripts/verify.mjs"), "--project", p.dir, "--skip", "build,lint,test"], {
              encoding: "utf8",
            }),
          };
        } catch (err) {
          return { code: err.status, stdout: String(err.stdout ?? "") };
        }
      })();
      assert.ok([0, 1].includes(verify.code), `verify exit ${verify.code}`);
      assert.ok(p.exists(".uiport/worklog/logs/verify.json"), "verify must leave evidence");

      const status = cli(p.dir, "status");
      assert.match(status.stdout, /home \| phone \| matched \| 100/);
      assert.match(status.stdout, /search \| phone \| building/);

      cli(p.dir, "changelog", "--step", "step-3-port", "--file", "app/src/main/java/Home.kt", "--action", "created");
      cli(p.dir, "worklog", "ensure", "step-3-port");

      const zip = path.join(p.dir, "delivery.zip");
      execFileSync(NODE, [path.join(ROOT, "scripts/package-zip.mjs"), "--project", p.dir, "--out", zip], { encoding: "utf8" });
      const listing = execFileSync("unzip", ["-Z1", zip], { encoding: "utf8" }).split("\n").filter(Boolean);
      assert.ok(listing.includes(".uiport/worklog/step-3-port.md"));
      assert.ok(listing.includes(".uiport/worklog/CHANGELOG.md"));
      assert.ok(listing.includes(".uiport/state.json"));
      assert.ok(listing.includes("app/src/main/java/Home.kt"));
      assert.ok(!listing.some((f) => f.startsWith(".uiport/output/")), "diff images stay out unless asked");
    } finally {
      p.cleanup();
    }
  });

  test("resume picks up the first incomplete step", () => {
    const p = tmpProject();
    try {
      cli(p.dir, "state", "init");
      cli(p.dir, "state", "set-step", "step-0-preflight", "done");
      cli(p.dir, "state", "set-step", "step-1-maps", "done");
      const summary = JSON.parse(cli(p.dir, "state", "summary").stdout);
      assert.equal(summary.nextStep, "step-2-analysis");
      assert.equal(summary.currentStep, "step-1-maps");
    } finally {
      p.cleanup();
    }
  });

  test("an engine edit is blocked, then allowed after the approval flag", () => {
    const p = tmpProject();
    try {
      p.json(".uiport/engine-paths.json", { globs: ["core/**"] });
      const payload = JSON.stringify({ cwd: p.dir, tool_name: "Edit", tool_input: { file_path: path.join(p.dir, "core/Player.kt") } });
      const blocked = (() => {
        try {
          execFileSync(NODE, [path.join(ROOT, "hooks/engine-protect.mjs")], { input: payload, encoding: "utf8" });
          return { code: 0, stdout: "" };
        } catch (err) {
          return { code: err.status, stdout: String(err.stdout ?? "") };
        }
      })();
      assert.equal(blocked.code, 2);
      assert.equal(JSON.parse(blocked.stdout).decision, "block");

      cli(p.dir, "state", "init");
      const state = JSON.parse(p.read(".uiport/state.json"));
      state.protectedPathsApproved = true;
      p.json(".uiport/state.json", state);

      const allowed = execFileSync(NODE, [path.join(ROOT, "hooks/engine-protect.mjs")], { input: payload, encoding: "utf8" });
      assert.equal(JSON.parse(allowed).decision, "approve");
      assert.ok(fs.existsSync(path.join(p.dir, ".uiport/engine-paths.json")));
    } finally {
      p.cleanup();
    }
  });
});
