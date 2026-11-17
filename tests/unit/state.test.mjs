import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test, { describe } from "node:test";
import { tmpProject } from "../helpers/fixtures.mjs";
import {
  bumpIteration,
  emptyState,
  loadState,
  migrate,
  nextStep,
  saveState,
  setScreenStatus,
  setStep,
  summarize,
  statePath,
  STEPS,
  STATE_SCHEMA_VERSION,
} from "../../scripts/lib/state.mjs";

describe("state", () => {
  test("empty state has the documented shape", () => {
    const s = emptyState();
    assert.equal(s.schemaVersion, STATE_SCHEMA_VERSION);
    assert.deepEqual(Object.keys(s.steps), STEPS);
    assert.deepEqual(s.deviceTargets, []);
    assert.equal(s.protectedPathsApproved, false);
    for (const step of STEPS) assert.equal(s.steps[step].status, "pending");
  });

  test("round-trips through disk and preserves unknown keys", () => {
    const p = tmpProject();
    try {
      const s = emptyState();
      s.futureField = { hello: "world" };
      saveState(p.dir, s);
      const { state } = loadState(p.dir);
      assert.deepEqual(state.futureField, { hello: "world" });
      assert.ok(fs.existsSync(statePath(p.dir)));
    } finally {
      p.cleanup();
    }
  });

  test("a corrupt state.json is quarantined and never crashes", () => {
    const p = tmpProject();
    try {
      fs.mkdirSync(path.join(p.dir, ".uiport"), { recursive: true });
      p.write(".uiport/state.json", "{ this is not json ");
      const { state, recovered, warning } = loadState(p.dir);
      assert.equal(recovered, true);
      assert.match(warning, /not valid JSON/);
      assert.equal(state.schemaVersion, STATE_SCHEMA_VERSION);
      assert.ok(p.exists(".uiport/state.json.corrupt.json"), "damaged file kept for diagnosis");
      assert.doesNotThrow(() => JSON.parse(p.read(".uiport/state.json")));
    } finally {
      p.cleanup();
    }
  });

  test("migrates a v0 state and keeps its data", () => {
    const { state, warning } = migrate({ pluginVersion: "0.0.1", currentStep: "step-3-port", deviceTargets: ["phone"] });
    assert.equal(warning, null);
    assert.equal(state.schemaVersion, STATE_SCHEMA_VERSION);
    assert.equal(state.currentStep, "step-3-port");
    assert.deepEqual(state.deviceTargets, ["phone"]);
  });

  test("warns but preserves data from a newer schema", () => {
    const { state, warning } = migrate({ schemaVersion: 99, screens: { home: { devices: {} } } });
    assert.match(warning, /understands 1/);
    assert.ok(state.screens.home);
  });

  test("rejects unknown steps and devices", () => {
    const s = emptyState();
    assert.throws(() => setStep(s, "step-9-nope", "done"), /Unknown step/);
    assert.throws(() => setScreenStatus(s, { screen: "home", device: "watch", status: "pending" }), /Unknown device/);
    assert.throws(() => setScreenStatus(s, { screen: "home", device: "phone", status: "great" }), /Unknown status/);
  });

  test("tracks per-screen per-device status and scores", () => {
    const s = emptyState();
    setScreenStatus(s, { screen: "home", device: "phone", status: "building" });
    setScreenStatus(s, { screen: "home", device: "phone", status: "matched", score: 99.42, iterations: 3 });
    setScreenStatus(s, { screen: "home", device: "tablet", status: "blocked" });
    assert.equal(s.screens.home.devices.phone.status, "matched");
    assert.equal(s.screens.home.devices.phone.score, 99.42);
    assert.equal(s.screens.home.devices.tablet.status, "blocked");
    assert.equal(s.lastScores.home.phone, 99.42);
    const sum = summarize(s);
    assert.equal(sum.screens.length, 1);
    assert.equal(sum.screens[0].devices.length, 2);
  });

  test("iteration counter is per screen+device and reports the cap", () => {
    const s = emptyState();
    for (let i = 1; i <= 5; i++) {
      const r = bumpIteration(s, "home", "phone");
      assert.equal(r.counted, true);
      assert.equal(r.used, i);
    }
    assert.equal(s.iterationCounts["home::phone"], 5);
    assert.equal(s.iterationCounts["home::tablet"], undefined);
  });

  test("nextStep skips finished steps", () => {
    const s = emptyState();
    setStep(s, "step-0-preflight", "done");
    setStep(s, "step-1-maps", "done");
    assert.equal(nextStep(s), "step-2-analysis");
    for (const st of STEPS) setStep(s, st, "done");
    assert.equal(nextStep(s), null);
  });

  test("atomic write leaves no tmp file behind", () => {
    const p = tmpProject();
    try {
      saveState(p.dir, emptyState());
      const leftovers = fs.readdirSync(path.join(p.dir, ".uiport")).filter((f) => f.endsWith(".tmp"));
      assert.deepEqual(leftovers, []);
    } finally {
      p.cleanup();
    }
  });
});
