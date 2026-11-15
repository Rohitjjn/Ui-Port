import assert from "node:assert/strict";
import fs from "node:fs";
import test, { describe } from "node:test";
import { validAnswers } from "../helpers/fixtures.mjs";
import { loadAnswers, validateAnswers } from "../../scripts/lib/answers.mjs";

const clone = (v) => JSON.parse(JSON.stringify(v));

describe("answers validation", () => {
  test("accepts a complete answer file", () => {
    const v = validateAnswers(clone(validAnswers));
    assert.equal(v.ok, true, v.errors?.join("; "));
    assert.deepEqual(v.answers.deviceTargets, ["phone"]);
    assert.equal(v.answers.extraFeatures["sleep-timer"], "build-in-engine");
  });

  test("rejects an empty deviceTargets list", () => {
    const a = clone(validAnswers);
    a.deviceTargets = [];
    const v = validateAnswers(a);
    assert.equal(v.ok, false);
    assert.match(v.errors.join(" "), /non-empty array/);
  });

  test("rejects an unknown device and duplicates", () => {
    const a = clone(validAnswers);
    a.deviceTargets = ["phone", "watch", "phone"];
    const v = validateAnswers(a);
    assert.match(v.errors.join(" "), /unknown device "watch"/);
    assert.match(v.errors.join(" "), /duplicates/);
  });

  test("all three devices produces a warning, not an error", () => {
    const a = clone(validAnswers);
    a.deviceTargets = ["phone", "tablet", "desktop"];
    const v = validateAnswers(a);
    assert.equal(v.ok, true);
    assert.match(v.warnings.join(" "), /3x longer/);
  });

  test("rejects an unknown execution mode", () => {
    const a = clone(validAnswers);
    a.executionMode = "FAST";
    assert.match(validateAnswers(a).errors.join(" "), /executionMode must be one of/);
  });

  test("requires an explicit boolean for allowEngineEdits", () => {
    const a = clone(validAnswers);
    delete a.allowEngineEdits;
    assert.match(validateAnswers(a).errors.join(" "), /allowEngineEdits must be true or false/);
  });

  test("rejects an unknown per-feature action", () => {
    const a = clone(validAnswers);
    a.extraFeatures = { canvas: "ignore" };
    assert.match(validateAnswers(a).errors.join(" "), /must be one of build-in-engine, remove-from-ui/);
  });

  test("requires extraFeatures to exist even when empty", () => {
    const a = clone(validAnswers);
    delete a.extraFeatures;
    assert.match(validateAnswers(a).errors.join(" "), /extraFeatures must be present/);
  });

  test("rejects a non-object document", () => {
    assert.equal(validateAnswers([]).ok, false);
    assert.equal(validateAnswers("nope").ok, false);
    assert.equal(validateAnswers(null).ok, false);
  });

  test("reports every missing required key at once", () => {
    const v = validateAnswers({});
    assert.ok(v.errors.length >= 5);
  });
});

describe("answers file loading (headless mode)", () => {
  function project(answers) {
    const dir = fs.mkdtempSync("/tmp/uiport-answers-");
    fs.mkdirSync(`${dir}/.uiport`, { recursive: true });
    if (answers !== undefined) fs.writeFileSync(`${dir}/.uiport/answers.json`, typeof answers === "string" ? answers : JSON.stringify(answers));
    return dir;
  }

  test("headless off when no file and no env flag", () => {
    const dir = project(undefined);
    const r = loadAnswers(dir, {});
    assert.equal(r.headless, false);
    assert.equal(r.present, false);
  });

  test("headless on when the file exists", () => {
    const dir = project(clone(validAnswers));
    const r = loadAnswers(dir, {});
    assert.equal(r.headless, true);
    assert.equal(r.error, null);
    assert.equal(r.answers.executionMode, "HYBRID");
  });

  test("env flag forces headless and fails loudly without the file", () => {
    const dir = project(undefined);
    const r = loadAnswers(dir, { UIPORT_HEADLESS: "1" });
    assert.equal(r.headless, true);
    assert.match(r.error, /does not exist/);
  });

  test("env flag 0 disables headless even when the file exists", () => {
    const dir = project(clone(validAnswers));
    assert.equal(loadAnswers(dir, { UIPORT_HEADLESS: "0" }).headless, false);
  });

  test("invalid JSON in the file is reported, not thrown", () => {
    const dir = project("{ nope");
    const r = loadAnswers(dir, {});
    assert.equal(r.headless, true);
    assert.match(r.error, /not valid JSON/);
    assert.equal(r.answers, null);
  });
});
