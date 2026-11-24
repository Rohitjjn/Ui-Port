import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { describe } from "node:test";
import { assessRun, classifySubject, measureSubject } from "../../scripts/size-assessment.mjs";
import { readJson } from "../../scripts/lib/fs-utils.mjs";
import { resolveTier, validateAnswers } from "../../scripts/lib/answers.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const CONFIG = readJson(path.join(ROOT, "config", "tiers.json"));
const SCRIPT = path.join(ROOT, "scripts/size-assessment.mjs");

const sub = (metrics) => ({ root: "/x/subject", kind: "prototype", metrics });

describe("size assessment", () => {
  test("a subject inside every SIMPLE budget is SIMPLE, and says which dimension is tightest", () => {
    const c = classifySubject(sub({ screens: 3, files: 10, sourceLines: 500, components: 4 }));
    assert.equal(c.tier, "SIMPLE");
    assert.match(c.reason, /fits the SIMPLE budget/);
    assert.match(c.reason, /screens at 50% of budget/);
  });

  test("one dimension over MEDIUM does not escalate — a single metric is usually a heuristic artefact", () => {
    const c = classifySubject(sub({ screens: 21, files: 100, sourceLines: 1000, components: 5 }));
    assert.equal(c.tier, "MEDIUM");
    assert.equal(c.exceeded.length, 1);
    assert.match(c.reason, /below the escalation threshold/);
  });

  test("two dimensions over MEDIUM escalates to LARGE and names each one", () => {
    const c = classifySubject(sub({ screens: 40, files: 900, sourceLines: 1000, components: 5 }));
    assert.equal(c.tier, "LARGE");
    assert.deepEqual(c.exceeded.map((e) => e.metric).sort(), ["files", "screens"]);
  });

  test("dimensions a subject does not report are skipped, not treated as zero", () => {
    // An app reports files and navDestinations but not sourceLines or components. Those must not
    // count as zero-fit (which would silently pass) nor as over-budget.
    const c = classifySubject({ root: "/x/app", kind: "app", metrics: { files: 1567 } });
    assert.equal(c.tier, "MEDIUM", "one dimension over MEDIUM stays MEDIUM; only 2+ escalates");
    assert.deepEqual(c.exceeded.map((e) => e.metric), ["files"]);
  });

  test("an empty subject does not become LARGE by accident", () => {
    assert.equal(classifySubject({ root: "/x/empty", kind: "app", metrics: {} }).tier, "SIMPLE");
  });

  test("the run's tier follows the larger subject, because the app sets the constraints", () => {
    const prototype = sub({ screens: 23, files: 35, sourceLines: 4952, components: 58 });
    const app = { root: "/x/app", kind: "app", metrics: { screens: 37, files: 1567, navDestinations: 64 } };
    const a = assessRun([prototype, app]);
    assert.equal(a.tier, "LARGE");
    assert.equal(a.strategy, "strangler");
    assert.equal(a.drivingSubject, "/x/app");
  });

  test("slice count comes from the screen count, so the plan states a number", () => {
    const a = assessRun([sub({ screens: 23, files: 35, sourceLines: 4952, components: 58 })]);
    assert.equal(a.slices.screens, 23);
    assert.equal(a.slices.count, 3, "23 screens at 8 per slice is 3 slices");
  });

  test("the real test bed measures what the earlier calibration said, and lands on LARGE", () => {
    const prototype = measureSubject(path.join(ROOT, "testbed/prototype"));
    assert.equal(prototype.kind, "prototype");
    assert.equal(prototype.metrics.screens, 23);
    assert.equal(prototype.metrics.components, 58);

    const app = measureSubject(path.join(ROOT, "testbed/SimpMusic"));
    assert.equal(app.kind, "app");
    assert.equal(app.metrics.engineFiles, 666);
    assert.equal(app.metrics.navDestinations, 64);

    const a = assessRun([prototype, app]);
    assert.equal(a.tier, "LARGE");
    assert.equal(a.perSubject[0].tier, "MEDIUM");
    assert.equal(a.perSubject[1].tier, "LARGE");
  });

  test("a path that is neither a prototype nor an app fails loudly instead of assessing zero", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "uiport-nothing-"));
    try {
      assert.throws(() => measureSubject(dir), /neither a prototype/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("the CLI prints the verdict with its reasoning and can write the machine-readable copy", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "uiport-size-"));
    try {
      const out = path.join(dir, "nested", "size.json");
      const text = execFileSync(process.execPath, [SCRIPT, path.join(ROOT, "testbed/SimpMusic"), "--out", out], {
        encoding: "utf8",
        cwd: ROOT,
      });
      assert.match(text, /Verdict: `LARGE`/);
      assert.match(text, /Driven by `SimpMusic`/);
      const written = JSON.parse(fs.readFileSync(out, "utf8"));
      assert.equal(written.assessment.tier, "LARGE");
      assert.equal(written.subjects[0].metrics.navDestinations, 64);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("no subject is a usage error, not an empty verdict", () => {
    let code = 0;
    try {
      execFileSync(process.execPath, [SCRIPT], { encoding: "utf8", stdio: "pipe" });
    } catch (err) {
      code = err.status;
    }
    assert.equal(code, 2);
  });
});

describe("sizeOverride at the decision gate", () => {
  const base = { deviceTargets: ["phone"], executionMode: "HYBRID", extraFeatures: {}, allowEngineEdits: false, delivery: ["zip"] };
  const assessment = { tier: "LARGE", strategy: "strangler", why: "exceeds the MEDIUM budget in 4 dimensions" };

  test("absent override leaves the computed tier alone", () => {
    const a = resolveTier(assessment, validateAnswers(base).answers);
    assert.equal(a.tier, "LARGE");
    assert.equal(a.overridden, false);
    assert.equal(a.strategy, "strangler");
  });

  test("an override wins but keeps the computed tier and both reasons", () => {
    const answers = validateAnswers({ ...base, sizeOverride: { tier: "MEDIUM", reason: "every route already has a flag" } }).answers;
    const a = resolveTier(assessment, answers);
    assert.equal(a.tier, "MEDIUM");
    assert.equal(a.computed, "LARGE");
    assert.equal(a.overridden, true);
    assert.equal(a.strategy, "slices");
    assert.equal(a.reason, "every route already has a flag");
    assert.equal(a.computedReason, "exceeds the MEDIUM budget in 4 dimensions");
  });

  test("an override that agrees with the assessment is not an override", () => {
    const answers = validateAnswers({ ...base, sizeOverride: { tier: "LARGE", reason: "agreed with the numbers" } }).answers;
    assert.equal(resolveTier(assessment, answers).overridden, false);
  });

  test("an override without a reason, or with an invented tier, is rejected", () => {
    assert.equal(validateAnswers({ ...base, sizeOverride: { tier: "MEDIUM" } }).ok, false);
    assert.equal(validateAnswers({ ...base, sizeOverride: { tier: "XL", reason: "it is quite big" } }).ok, false);
    assert.equal(validateAnswers({ ...base, sizeOverride: { tier: "MEDIUM", reason: "no" } }).ok, false, "a two-letter 'reason' is a shrug");
  });
});

describe("tiers.json is the only place budgets live", () => {
  test("every tier has a meaning, a strategy that exists, and a threshold beats an arbitrary list", () => {
    for (const tier of ["SIMPLE", "MEDIUM", "LARGE"]) {
      assert.ok(CONFIG.tiers[tier], `missing tier ${tier}`);
      assert.ok(CONFIG.tiers[tier].meaning.length > 20, `${tier} needs a meaning a human can act on`);
      assert.ok(CONFIG.strategies[CONFIG.tiers[tier].strategy], `${tier} points at a missing strategy`);
    }
    assert.equal(CONFIG.rules.escalation.threshold, 2);
    assert.ok(CONFIG.calibration, "budgets without their calibration data are guesses");
    assert.match(CONFIG.rules.classifyBy, /at least two dimensions (are )?over MEDIUM/i, "the prose rule must match the code");
  });

  test("each strategy states its flag semantics, order and rollback", () => {
    for (const [name, s] of Object.entries(CONFIG.strategies)) {
      assert.ok(Array.isArray(s.order) && s.order.length >= 3, `${name} needs an order`);
      assert.ok(s.checksPerBatch.length >= 3, `${name} needs its per-batch checks`);
      assert.ok(typeof s.rollback === "string" && s.rollback.length > 10, `${name} needs a rollback`);
    }
    assert.equal(CONFIG.strategies.batch.flag, null, "a SIMPLE port should not pay for a flag");
    assert.ok(CONFIG.strategies.strangler.flag, "a LARGE port must be flag-gated");
    assert.equal(CONFIG.strategies.slices.flag, null, "slices ship by deleting the old screen, not by toggling");
    assert.ok(CONFIG.strategies.slices.flagNote, "not having a flag is a decision worth stating");
  });
});
