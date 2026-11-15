import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const SCRIPT = path.join(ROOT, "scripts", "geometry-compare.mjs");

const REF = [
  { text: "Home", role: "heading", x: 16, y: 24, w: 120, h: 32 },
  { text: "Play", role: "button", x: 16, y: 400, w: 56, h: 56 },
  { text: "Library", role: "tab", x: 16, y: 800, w: 80, h: 48 },
];

function files(refNodes, candNodes) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "uiport-geom-"));
  const ref = path.join(dir, "default.geometry.json");
  const cand = path.join(dir, "default.semantics.json");
  fs.writeFileSync(ref, JSON.stringify(refNodes));
  fs.writeFileSync(cand, JSON.stringify(candNodes));
  return { dir, ref, cand };
}

test("geometry-compare exits 0 when everything is within tolerance", () => {
  const f = files(REF, REF.map((n) => ({ ...n, x: n.x + 0.4, y: n.y - 0.5 })));
  const out = execFileSync(process.execPath, [SCRIPT, "--ref", f.ref, "--cand", f.cand], { encoding: "utf8" });
  assert.match(out, /3 matched, 0 mismatched/);
  assert.match(out, /coverage 100%/);
  fs.rmSync(f.dir, { recursive: true, force: true });
});

test("geometry-compare exits 3 and names the offset when a node moved", () => {
  const cand = REF.map((n) => (n.text === "Play" ? { ...n, y: n.y + 8 } : n));
  const f = files(REF, cand);
  const r = spawnSync(process.execPath, [SCRIPT, "--ref", f.ref, "--cand", f.cand, "--md", path.join(f.dir, "g.md")], { encoding: "utf8" });
  assert.equal(r.status, 3);
  assert.match(r.stdout, /1 mismatched/);
  assert.match(r.stdout, /dy=\s*8/);
  const md = fs.readFileSync(path.join(f.dir, "g.md"), "utf8");
  assert.match(md, /Play/);
  assert.match(md, /\| 8 \|/);
  fs.rmSync(f.dir, { recursive: true, force: true });
});

test("geometry-compare reports a node that was never ported as missing", () => {
  const f = files(REF, REF.filter((n) => n.text !== "Library"));
  const r = spawnSync(process.execPath, [SCRIPT, "--ref", f.ref, "--cand", f.cand], { encoding: "utf8" });
  assert.equal(r.status, 3);
  assert.match(r.stdout, /missing in candidate: Library/);
  fs.rmSync(f.dir, { recursive: true, force: true });
});

test("geometry-compare fails on unreadable input instead of reporting a pass", () => {
  const f = files(REF, REF);
  const missing = spawnSync(process.execPath, [SCRIPT, "--ref", f.ref, "--cand", path.join(f.dir, "nope.json")], { encoding: "utf8" });
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /cannot read candidate/);

  const notArray = spawnSync(process.execPath, [SCRIPT, "--ref", f.ref, "--cand", f.ref], {
    encoding: "utf8",
    env: { ...process.env },
  });
  assert.equal(notArray.status, 0, "an array is valid input whichever side it is on");

  fs.writeFileSync(path.join(f.dir, "obj.json"), "{}");
  const bad = spawnSync(process.execPath, [SCRIPT, "--ref", f.ref, "--cand", path.join(f.dir, "obj.json")], { encoding: "utf8" });
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /not a JSON array/);

  const usage = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8" });
  assert.equal(usage.status, 2);
  fs.rmSync(f.dir, { recursive: true, force: true });
});
