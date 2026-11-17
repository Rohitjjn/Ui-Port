import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PNG } from "pngjs";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const SCRIPT = path.join(ROOT, "scripts", "noise-floor.mjs");

function image(file, pixel) {
  const p = new PNG({ width: 40, height: 40 });
  for (let y = 0; y < 40; y++) {
    for (let x = 0; x < 40; x++) {
      const i = (y * 40 + x) * 4;
      const [r, g, b] = pixel(x, y);
      p.data[i] = r;
      p.data[i + 1] = g;
      p.data[i + 2] = b;
      p.data[i + 3] = 255;
    }
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, PNG.sync.write(p));
}

function fixture(bPixel = (x, y) => [x * 6, y * 6, 100]) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "uiport-noise-"));
  const rel = path.join("phone", "home", "default.png");
  image(path.join(dir, "a", rel), (x, y) => [x * 6, y * 6, 100]);
  image(path.join(dir, "b", rel), bPixel);
  fs.writeFileSync(
    path.join(dir, "spec.json"),
    JSON.stringify({ captures: [{ id: "home", device: "phone", route: "/", states: ["default"] }] }),
  );
  return { dir, run: (extra = []) => spawnSync(process.execPath, [SCRIPT, "--a", path.join(dir, "a"), "--b", path.join(dir, "b"), "--spec", path.join(dir, "spec.json"), ...extra], { encoding: "utf8" }) };
}

test("identical captures measure a zero noise floor and keep the configured thresholds", () => {
  const f = fixture();
  const r = f.run(["--json", path.join(f.dir, "n.json"), "--md", path.join(f.dir, "n.md")]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /worst 100%/);
  assert.match(r.stdout, /deterministic: true/);
  const report = JSON.parse(fs.readFileSync(path.join(f.dir, "n.json"), "utf8"));
  assert.equal(report.effectiveFloorPct, report.configuredFloorPct);
  assert.match(fs.readFileSync(path.join(f.dir, "n.md"), "utf8"), /Effective acceptance floor/);
  fs.rmSync(f.dir, { recursive: true, force: true });
});

test("a noisy capture lowers the floor instead of pretending the noise is a design bug", () => {
  // Every 200th pixel differs: small enough to be renderer wobble, big enough to matter.
  const f = fixture((x, y) => ((y * 40 + x) % 200 === 0 ? [0, 0, 0] : [x * 6, y * 6, 100]));
  const r = f.run(["--json", path.join(f.dir, "n.json")]);
  assert.equal(r.status, 0, r.stderr);
  const report = JSON.parse(fs.readFileSync(path.join(f.dir, "n.json"), "utf8"));
  assert.ok(report.worstSameSideMatchPct < 100, "expected a non-perfect same-side match");
  assert.ok(report.effectiveFloorPct <= report.configuredFloorPct, "the floor may only get stricter, never looser");
  fs.rmSync(f.dir, { recursive: true, force: true });
});

test("a non-deterministic capture is reported as unusable, not averaged away", () => {
  // A capture that differs by ~5% cannot judge a 98.5% acceptance floor.
  const f = fixture((x, y) => ((y * 40 + x) % 20 === 0 ? [0, 0, 0] : [x * 6, y * 6, 100]));
  const r = f.run();
  assert.equal(r.status, 4, "a noisy capture must fail loudly");
  assert.match(r.stderr, /not deterministic|differ by/);
  fs.rmSync(f.dir, { recursive: true, force: true });
});

test("missing inputs are a usage error, never a silent pass", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "uiport-noise-bad-"));
  const r = spawnSync(process.execPath, [SCRIPT, "--a", dir], { encoding: "utf8" });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /are required/);
  fs.rmSync(dir, { recursive: true, force: true });
});
