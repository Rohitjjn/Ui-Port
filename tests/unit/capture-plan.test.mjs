import assert from "node:assert/strict";
import path from "node:path";
import test, { describe } from "node:test";
import {
  buildCapturePlan,
  capturePath,
  deviceTargetsFromConfig,
  hashUrl,
  mergeMasks,
  normalizeRoute,
  validateSpec,
} from "../../scripts/lib/capture-spec.mjs";
import { scanPrototype } from "../../scripts/lib/scan-prototype.mjs";
import { readJson } from "../../scripts/lib/fs-utils.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const viewports = readJson(path.join(ROOT, "config/viewports.json"));
const scan = scanPrototype(path.join(ROOT, "testbed/prototype"));

describe("device targets", () => {
  test("'all' means every configured target", () => {
    assert.deepEqual(deviceTargetsFromConfig(viewports, "all").sort(), ["desktop", "phone", "tablet"]);
  });

  test("a subset is honoured in order", () => {
    assert.deepEqual(deviceTargetsFromConfig(viewports, ["tablet", "phone"]), ["tablet", "phone"]);
    assert.deepEqual(deviceTargetsFromConfig(viewports, "phone,desktop"), ["phone", "desktop"]);
  });

  test("an unknown target is a hard error with the valid list", () => {
    assert.throws(() => deviceTargetsFromConfig(viewports, "watch"), /unknown device target\(s\): watch/);
  });
});

describe("capture plan", () => {
  test("one unit per screen per device, unique ids", () => {
    const plan = buildCapturePlan(scan, { devices: ["phone", "tablet"], states: ["default"] });
    const keys = plan.map((p) => `${p.id}::${p.device}`);
    assert.equal(new Set(keys).size, keys.length);
    assert.equal(plan.length, scan.screens.filter((s) => s.route !== "*").length * 2);
  });

  test("only states the prototype can show are planned", () => {
    const plan = buildCapturePlan(scan, { devices: ["phone"], states: ["default", "error", "overlay"] });
    const home = plan.find((p) => p.id === "home");
    // HomeScreen has no error branch in the prototype, so it must not be planned.
    assert.deepEqual(home.states, ["default", "overlay"]);
    const search = plan.find((p) => p.id === "search");
    assert.ok(search.states.includes("error"));
  });

  test("the catch-all route is never captured", () => {
    const plan = buildCapturePlan(scan, { devices: ["phone"] });
    assert.ok(!plan.some((p) => p.route === "*"));
  });

  test("a screen filter limits the plan", () => {
    const plan = buildCapturePlan(scan, { devices: ["phone"], screens: ["home", "settings"] });
    assert.deepEqual([...new Set(plan.map((p) => p.id))].sort(), ["home", "settings"]);
  });

  test("desktop captures declare a scrollbar mask", () => {
    const plan = buildCapturePlan(scan, { devices: ["desktop"] });
    assert.ok(plan.every((p) => p.masks.some((m) => m.preset === "scrollbar")));
  });

  test("parameterised routes carry a note about fixture values", () => {
    const plan = buildCapturePlan(scan, { devices: ["phone"], screens: ["album--id"] });
    assert.match(plan[0].notes ?? "", /fixture values/);
  });
});

describe("urls and paths", () => {
  test("hash routing is built from the base url", () => {
    assert.equal(hashUrl("http://localhost:4173", "/"), "http://localhost:4173/#/");
    assert.equal(hashUrl("http://localhost:4173/", "search"), "http://localhost:4173/#/search");
    assert.equal(hashUrl("http://localhost:4173", "album/:id"), "http://localhost:4173/#/album/:id");
  });

  test("normalizeRoute keeps leading slashes consistent", () => {
    assert.equal(normalizeRoute("search"), "/search");
    assert.equal(normalizeRoute("/search"), "/search");
    assert.equal(normalizeRoute("*"), null);
  });

  test("artifact paths follow the documented layout", () => {
    assert.equal(capturePath(".uiport", "phone", "home", "default"), ".uiport/reference/phone/home/default.png");
  });

  test("system-bar masks are dropped from the per-screen list", () => {
    const merged = mergeMasks([{ preset: "system-bars" }, { x: 0, y: 0, w: 10, h: 10 }], [{ preset: "scrollbar" }]);
    assert.equal(merged.length, 2);
    assert.ok(!merged.some((m) => m.preset === "system-bars"));
  });
});

describe("spec validation", () => {
  test("accepts a generated plan", () => {
    const spec = { captures: buildCapturePlan(scan, { devices: ["phone"] }) };
    assert.equal(validateSpec(spec).ok, true);
  });

  test("rejects missing fields and unknown states", () => {
    const v = validateSpec({ captures: [{ id: "home", route: "/", device: "phone", states: ["bogus"] }, {}] });
    assert.equal(v.ok, false);
    assert.match(v.errors.join(" "), /unknown state "bogus"/);
    assert.match(v.errors.join(" "), /captures\[1\]\.id is required/);
  });

  test("rejects a non-object spec", () => {
    assert.equal(validateSpec(null).ok, false);
    assert.equal(validateSpec({}).ok, false);
  });
});
