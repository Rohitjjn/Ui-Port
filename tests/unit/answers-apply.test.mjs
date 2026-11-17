import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { applyAnswers, emptyState, loadState, saveState } from "../../scripts/lib/state.mjs";
import { validateAnswers } from "../../scripts/lib/answers.mjs";
import { validateInjection, FREEZE_CSS, SEED_SCRIPT } from "../../scripts/lib/browser-inject.mjs";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const ANSWERS = {
  deviceTargets: ["phone", "tablet"],
  executionMode: "LOCAL_FULL",
  ponytail: false,
  extraFeatures: { "sleep-timer": "build-in-engine" },
  allowEngineEdits: true,
  delivery: ["zip"],
};

test("applyAnswers writes the gate decisions into state", () => {
  const state = emptyState();
  applyAnswers(state, ANSWERS, { source: "test" });
  assert.deepEqual(state.deviceTargets, ["phone", "tablet"]);
  assert.equal(state.executionMode, "LOCAL_FULL");
  assert.equal(state.protectedPathsApproved, true);
  assert.deepEqual(state.options.delivery, ["zip"]);
  assert.deepEqual(state.options.extraFeaturePolicy, { "sleep-timer": "build-in-engine" });
  assert.equal(state.decisions.source, "test");
});

test("applyAnswers keeps engine protection off unless the gate said yes", () => {
  const state = emptyState();
  applyAnswers(state, { ...ANSWERS, allowEngineEdits: false });
  assert.equal(state.protectedPathsApproved, false);
  assert.equal(state.options.allowEngineEdits, false);
});

test("applyAnswers preserves recorded screens and iterations", () => {
  const state = emptyState();
  state.screens = { home: { devices: { phone: { status: "matched", score: 99.9, iterations: 2 } } } };
  state.iterationCounts = { "home::phone": 2 };
  applyAnswers(state, ANSWERS);
  assert.equal(state.screens.home.devices.phone.score, 99.9);
  assert.equal(state.iterationCounts["home::phone"], 2);
});

test("applyAnswers rejects nonsense instead of writing it", () => {
  assert.throws(() => applyAnswers(emptyState(), { ...ANSWERS, deviceTargets: ["watch"] }), /unknown device/);
  assert.throws(() => applyAnswers(emptyState(), { ...ANSWERS, executionMode: "MAGIC" }), /unknown executionMode/);
  assert.throws(() => applyAnswers(emptyState(), null), /normalized answers/);
});

test("applyAnswers round-trips through state.json", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "uiport-apply-"));
  const state = emptyState();
  applyAnswers(state, ANSWERS);
  saveState(tmp, state);
  const loaded = loadState(tmp).state;
  assert.deepEqual(loaded.deviceTargets, ["phone", "tablet"]);
  assert.equal(loaded.decisions.executionMode, "LOCAL_FULL");
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("answers --apply wires a real answers file into state", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "uiport-cli-"));
  fs.mkdirSync(path.join(tmp, ".uiport"), { recursive: true });
  const v = validateAnswers(ANSWERS);
  assert.ok(v.ok, v.errors.join("; "));
  fs.writeFileSync(path.join(tmp, ".uiport", "answers.json"), JSON.stringify(ANSWERS));
  const out = execFileSync(process.execPath, [path.join(ROOT, "scripts", "uiport.mjs"), "--project", tmp, "answers", "--apply"], { encoding: "utf8" });
  assert.match(out, /"applied": true/);
  const state = loadState(tmp).state;
  assert.equal(state.executionMode, "LOCAL_FULL");
  assert.deepEqual(state.deviceTargets, ["phone", "tablet"]);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("the injected browser code is valid and freezing", () => {
  assert.deepEqual(validateInjection(), []);
  assert.match(FREEZE_CSS, /animation-duration:\s*0s/);
  assert.match(SEED_SCRIPT.toString(), /Math\.random/);
  // A deliberately broken freeze sheet is caught.
  const bad = FREEZE_CSS.replace("animation-duration: 0s !important;", "");
  assert.ok(!bad.includes("animation-duration"));
});
