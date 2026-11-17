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

test("geometry comparison needs no image libraries (runs on a bare Node install)", () => {
  // The web geometry dump and the Compose semantics dump are JSON. Requiring pngjs or
  // pixelmatch here would break the one check that can run in a hook or on a machine
  // without the image stack, so the module boundary is asserted, not assumed.
  const geometry = fs.readFileSync(path.join(ROOT, "scripts", "lib", "geometry.mjs"), "utf8");
  const cli = fs.readFileSync(SCRIPT, "utf8");
  // Check import statements, not mentions: the threshold config legitimately has keys
  // named after the libraries it configures.
  const imports = (text) => [...text.matchAll(/^import .*?from\s+"([^"]+)"/gm)].map((m) => m[1]);
  for (const banned of ["pngjs", "pixelmatch", "ssim.js"]) {
    assert.ok(
      !imports(geometry).some((m) => m === banned || m.startsWith(`${banned}/`)),
      `geometry.mjs must not import ${banned}`,
    );
  }
  assert.ok(
    !imports(cli).some((m) => m.endsWith("/lib/diff.mjs")),
    "the CLI must not import the image diff module",
  );
  const f = files(REF, REF);
  const out = execFileSync(process.execPath, [SCRIPT, "--ref", f.ref, "--cand", f.cand], { encoding: "utf8" });
  assert.match(out, /3 matched/);
  fs.rmSync(f.dir, { recursive: true, force: true });
});

test("two identical dumps with duplicate texts match perfectly (no phantom mismatches)", () => {
  // A real screen has ten nodes called "Play". Matching them to each other must pair
  // nearest-to-nearest; pairing by text alone reported dozens of false mismatches on
  // two captures of the same page, which would have poisoned the noise-floor measurement.
  const nodes = [];
  for (let i = 0; i < 10; i++) nodes.push({ text: "Play", role: "button", x: 10 + i * 30, y: 100, w: 24, h: 24 });
  nodes.push({ text: "Home", role: "heading", x: 16, y: 24, w: 120, h: 32 });
  for (let i = 0; i < 40; i++) nodes.push({ text: `Track ${i}`, role: "node", x: 16, y: 200 + i * 20, w: 200, h: 18 });
  const f = files(nodes, JSON.parse(JSON.stringify(nodes)));
  const r = spawnSync(process.execPath, [SCRIPT, "--ref", f.ref, "--cand", f.cand], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /51 matched, 0 mismatched, 0 missing/);
  assert.match(r.stdout, /coverage 100%/);
  fs.rmSync(f.dir, { recursive: true, force: true });
});

test("a real move is still caught among duplicate texts", () => {
  const nodes = [];
  for (let i = 0; i < 6; i++) nodes.push({ text: "Play", role: "button", x: 10 + i * 30, y: 100, w: 24, h: 24 });
  const moved = JSON.parse(JSON.stringify(nodes));
  moved[3].y += 8;
  const f = files(nodes, moved);
  const r = spawnSync(process.execPath, [SCRIPT, "--ref", f.ref, "--cand", f.cand], { encoding: "utf8" });
  assert.equal(r.status, 3);
  assert.match(r.stdout, /1 mismatched/);
  assert.match(r.stdout, /dy=\s*8/);
  fs.rmSync(f.dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------------------------
// The failure signature: a 0% coverage number says nothing was within tolerance, which is true of
// two completely different situations — every node shifted together, or the layout is wrong.
// Those need opposite fixes, so the summary has to tell them apart, and the tests say so.
// ---------------------------------------------------------------------------------------------
test("delta summary: a common offset is named as one offset, not as many errors", async () => {
  const { summariseDeltas } = await import("../../scripts/lib/geometry.mjs");
  const nodes = [...Array(9)].map(() => ({ dx: 0, dy: 2.1, dw: 0.2, dh: 0.3 })).concat([{ dx: 0.1, dy: 1.9, dw: 0.1, dh: 0.2 }]);
  const d = summariseDeltas(nodes);
  assert.equal(d.signature, "systematic-offset");
  assert.equal(d.medians.dy, 2.1);
  assert.equal(d.dominantSharePct, 100);
  assert.match(d.hint, /one offset, not many layout errors/);
});

test("delta summary: agreeing positions with disagreeing sizes is its own signature", async () => {
  const { summariseDeltas } = await import("../../scripts/lib/geometry.mjs");
  const d = summariseDeltas([...Array(8)].map(() => ({ dx: 0.1, dy: 0.1, dw: 3.2, dh: -2.4 })));
  assert.equal(d.signature, "size-driven");
  assert.match(d.hint, /positions agree but sizes do not/);
});

test("delta summary: scattered mismatches are not blamed on an offset that does not exist", async () => {
  const { summariseDeltas } = await import("../../scripts/lib/geometry.mjs");
  const d = summariseDeltas([
    { dx: 0, dy: 40, dw: 0, dh: 0 },
    { dx: 30, dy: 0, dw: 5, dh: 5 },
    { dx: 0, dy: -20, dw: 2, dh: 1 },
    { dx: -12, dy: 8, dw: 0, dh: 0 },
  ]);
  assert.equal(d.signature, "scattered");
  assert.match(d.hint, /individual layout errors/);
});

test("delta summary: nothing mismatched is null, not a row of zeroes that reads as a pass", async () => {
  const { summariseDeltas } = await import("../../scripts/lib/geometry.mjs");
  assert.equal(summariseDeltas([]), null);
});

test("compareGeometry carries the summary only when something actually mismatched", async () => {
  const { compareGeometry } = await import("../../scripts/lib/geometry.mjs");
  const n = { text: "Hello", role: "text", x: 16, y: 40, w: 100, h: 20 };
  const same = compareGeometry([n], [{ ...n }], { canonical: false, toleranceDp: 1 });
  assert.equal(same.coveragePct, 100);
  assert.equal(same.deltaSummary, null, "a passing screen has no failure signature to explain");
  const moved = compareGeometry([n], [{ ...n, y: 42.1 }], { canonical: false, toleranceDp: 1 });
  assert.equal(moved.coveragePct, 0);
  assert.equal(moved.deltaSummary.signature, "systematic-offset");
  assert.equal(moved.deltaSummary.medians.dy, 2.1);
});
