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
  // The decisive number on a 0% screen: how close the best node came. "0%" cannot distinguish a
  // 1.4 dp tolerance problem from a layout that is 20 dp away, and those need opposite fixes.
  assert.equal(d.nearest, 2, "the closest node missed by 2 dp (dw on the third)");
  assert.equal(d.furthest, 40, "the furthest missed by 40 dp (dy on the first)");
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

// ---------------------------------------------------------------------------------------------
// The per-node table. Three samples per screen say a screen fails; they cannot say why, and the
// fix lives in the rows that were not sampled. This runs in its own CI job only because the
// annotation limit is per job — the test covers the rows and the ordering, the workflow covers the
// budget.
// ---------------------------------------------------------------------------------------------
test("geometry report: worst row first, both boxes, and the deltas that decide the fix", async () => {
  const { execFileSync } = await import("node:child_process");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "uiport-georeport-"));
  try {
    const refDir = path.join(dir, "reference/phone/library");
    const candDir = path.join(dir, "candidate/phone/library");
    fs.mkdirSync(refDir, { recursive: true });
    fs.mkdirSync(candDir, { recursive: true });
    fs.writeFileSync(
      path.join(refDir, "default.geometry.json"),
      JSON.stringify([
        { text: "Liked songs", role: "node", x: 85, y: 192.09, w: 80.2, h: 20.3, ancestors: [] },
        { text: "Most played", role: "node", x: 16, y: 56, w: 100, h: 24, ancestors: [] },
        { text: "COLLECTION", role: "node", x: 16, y: 16, w: 82, h: 16, ancestors: [] },
      ]),
    );
    fs.writeFileSync(
      path.join(candDir, "default.semantics.json"),
      JSON.stringify([
        // 2.41 dp low: the near-miss that N-2 is about.
        { text: "Liked songs", role: "node", x: 85, y: 194.5, w: 80, h: 20, ancestors: [] },
        // 44 dp low: a real layout error, and it must sort above the near-miss.
        { text: "COLLECTION", role: "node", x: 16, y: 60, w: 82, h: 16, ancestors: [] },
      ]),
    );
    const out = execFileSync(
      process.execPath,
      [path.join(ROOT, "scripts/ci-geometry-report.mjs"), "--reference", path.join(dir, "reference"), "--candidate", path.join(dir, "candidate"), "--device", "phone"],
      { encoding: "utf8" },
    ).trim();

    const lines = out.split("\n");
    assert.match(lines[0], /^::notice title=geometry library \(phone\)::ref=3 cand=2 matched=0 mismatched=2 missing=1 coverage=0% canonical=3\/2 rows=3$/);
    // Worst first: the 44 dp error must be printed before the 2.41 dp near-miss, or a reader who
    // stops after two lines chases the smaller problem.
    const off = lines.filter((l) => l.includes(" off::"));
    assert.equal(off.length, 2);
    assert.match(off[0], /COLLECTION.*d=\(0,44,0,0\)/);
    assert.match(off[1], /Liked songs.*ref\[85,192\.09 80\.2x20\.3\] cand\[85,194\.5 80x20\] d=\(0,2\.41,0\.2,0\.3\)/);
    // A node the candidate never produced is its own line: "missing" is not "0 dp off".
    assert.ok(lines.some((l) => l.includes(" missing::\"Most played\"") && l.includes("no candidate node with the same text/role")));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("geometry report: a missing semantics dump is an error, not a pass", async () => {
  const { execFileSync } = await import("node:child_process");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "uiport-georeport2-"));
  try {
    const refDir = path.join(dir, "reference/phone/home");
    fs.mkdirSync(refDir, { recursive: true });
    fs.writeFileSync(path.join(refDir, "default.geometry.json"), JSON.stringify([{ text: "Hi", role: "node", x: 1, y: 2, w: 3, h: 4 }]));
    const out = execFileSync(
      process.execPath,
      [path.join(ROOT, "scripts/ci-geometry-report.mjs"), "--reference", path.join(dir, "reference"), "--candidate", path.join(dir, "candidate"), "--device", "phone"],
      { encoding: "utf8" },
    );
    assert.match(out, /::error title=geometry home::no candidate semantics — not measured is not a pass/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a label is never paired with a different label: missing beats a confident wrong row", async () => {
  const { compareGeometry } = await import("../../scripts/lib/geometry.mjs");
  const reference = [{ text: "Most played", role: "node", x: 16, y: 56, w: 100, h: 24 }];
  // Same role, different text, adjacent box. Before the fix this scored 1 on role alone and was
  // reported as "off by (0,4,18,8)" — a confident row about the wrong element, which sends the
  // next iteration after an innocent node and hides the fact that the label never rendered.
  const candidate = [{ text: "COLLECTION", role: "node", x: 16, y: 60, w: 82, h: 16 }];
  const g = compareGeometry(reference, candidate, { canonical: true, toleranceDp: 1 });
  assert.equal(g.mismatched.length, 0, "no mismatched row may be invented from a role match");
  assert.equal(g.missing.length, 1);
  assert.match(g.missing[0].reason, /no candidate node with the same text\/role/);

  // An exact testId is identity even when the text differs, so that pairing still happens.
  const anchored = compareGeometry(
    [{ text: "Play", role: "button", testId: "play-1", x: 0, y: 0, w: 10, h: 10 }],
    [{ text: "Pause", role: "button", testId: "play-1", x: 0, y: 0, w: 10, h: 10 }],
    { canonical: true, toleranceDp: 1 },
  );
  assert.equal(anchored.matched.length, 1, "a shared testId is the same element");
});

// ---------------------------------------------------------------------------------------------
// Artifact layout. upload-artifact roots an archive at the least common ancestor of the uploaded
// paths, so the same upload list can arrive as `reference/...` or `.uiport/reference/...`. Fixed
// paths broke quietly once: the detail job reported "nothing to read" and looked like a run with
// nothing to say. Discovery has to handle both layouts, and the test says so.
// ---------------------------------------------------------------------------------------------
test("geometry report finds its inputs in an artifact whatever prefix the uploader chose", async () => {
  const { resolveRoots } = await import("../../scripts/ci-geometry-report.mjs");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "uiport-artifact-"));
  try {
    for (const [prefix, label] of [
      ["", "flat archive rooted at .uiport/"],
      [".uiport/", "archive that kept the .uiport prefix"],
      ["some/nested/depth/", "archive with an unexpected extra level"],
    ]) {
      const base = path.join(dir, label.replace(/\W+/g, "-"));
      fs.mkdirSync(path.join(base, prefix, "reference/phone/home"), { recursive: true });
      fs.mkdirSync(path.join(base, prefix, "output/phone/home"), { recursive: true });
      const roots = resolveRoots({ artifactDir: base, device: "phone" });
      assert.equal(roots.error, undefined, `${label}: ${roots.error}`);
      assert.ok(roots.reference.endsWith(path.join("reference")), `${label}: got ${roots.reference}`);
      assert.ok(roots.candidate.endsWith(path.join("output")), `${label}: got ${roots.candidate}`);
    }

    // An explicit pair always wins over searching, so the script stays usable outside CI.
    const explicit = resolveRoots({ artifactDir: dir, device: "phone", reference: "/a/reference", candidate: "/a/output" });
    assert.deepEqual(explicit, { reference: "/a/reference", candidate: "/a/output" });

    // A missing directory is an error, not an empty successful report.
    const missing = resolveRoots({ artifactDir: path.join(dir, "nowhere"), device: "phone" });
    assert.match(missing.error, /no reference\/phone under/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("the same label at the same box is one node, however many elements carry it", async () => {
  const { canonicalNodes } = await import("../../scripts/lib/geometry.mjs");
  // The DOM repeats a label when it repeats the element: `<p>4 items</p>` beside a
  // `<span>4 items</span>` for the same count, at the same coordinates. Counting both made the
  // report list the same text as "missing" twice, which reads like two dropped labels when the
  // port can only ever produce one node.
  const nodes = canonicalNodes([
    // Real boxes differ in the second decimal: the DOM gives one count a <p> and a <span> that are
    // separate line boxes. An exact key matched nothing, which is what the first fix did.
    { text: "Downloaded 4 items", role: "p", x: 16, y: 100.02, w: 120.5, h: 16.2 },
    { text: "Downloaded 4 items", role: "span", x: 16, y: 100.4, w: 120.9, h: 16.8 },
    { text: "Downloaded 4 items", role: "p", x: 16, y: 400, w: 120, h: 16 },
    // Two buttons with the same label in different rows are two buttons, not one.
    { text: "Play", role: "button", x: 16, y: 500, w: 80, h: 16 },
    { text: "Play", role: "button", x: 16, y: 600, w: 80, h: 16 },
  ]);
  assert.equal(nodes.length, 4, "same text within 1 dp collapses; a different row does not");
  // The survivor carries the ancestors: for the same box and text it is the more informative node.
  const withAncestors = canonicalNodes([
    { text: "Play", role: "span", x: 0, y: 0, w: 10, h: 10 },
    { text: "Play", role: "button", x: 0, y: 0, w: 10, h: 10, ancestors: [{ x: 0, y: 0, w: 10, h: 10 }] },
  ]);
  assert.equal(withAncestors.length, 1);
  assert.equal(withAncestors[0].role, "button");
});

test("rows are ordered by severity: a node that never rendered outranks any near-miss", async () => {
  const { execFileSync } = await import("node:child_process");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "uiport-order-"));
  try {
    const refDir = path.join(dir, "reference/phone/library");
    const candDir = path.join(dir, "candidate/phone/library");
    fs.mkdirSync(refDir, { recursive: true });
    fs.mkdirSync(candDir, { recursive: true });
    fs.writeFileSync(
      path.join(refDir, "default.geometry.json"),
      JSON.stringify([
        { text: "Gone", role: "p", x: 16, y: 200, w: 80, h: 16 },
        { text: "Kept", role: "p", x: 16, y: 300, w: 80, h: 16 },
      ]),
    );
    fs.writeFileSync(path.join(candDir, "default.semantics.json"), JSON.stringify([{ text: "Kept", role: "node", x: 16, y: 300, w: 80, h: 16 }]));
    const out = execFileSync(
      process.execPath,
      [path.join(ROOT, "scripts/ci-geometry-report.mjs"), "--reference", path.join(dir, "reference"), "--candidate", path.join(dir, "candidate"), "--device", "phone"],
      { encoding: "utf8" },
    ).trim();
    const rows = out.split("\n").slice(1);
    assert.match(rows[0], /missing::"Gone"/, "the node that never rendered is the first row");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("when nothing matches, the report says where each side's content sits", async () => {
  const { execFileSync } = await import("node:child_process");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "uiport-shape-"));
  try {
    const refDir = path.join(dir, "reference/phone/library");
    const candDir = path.join(dir, "candidate/phone/library");
    fs.mkdirSync(refDir, { recursive: true });
    fs.mkdirSync(candDir, { recursive: true });
    fs.writeFileSync(
      path.join(refDir, "default.geometry.json"),
      JSON.stringify([
        { text: "Most played", role: "button", x: 85, y: 274.09, w: 81.86, h: 20.3 },
        { text: "Cached", role: "button", x: 85, y: 356.09, w: 51.61, h: 20.3 },
      ]),
    );
    fs.writeFileSync(
      path.join(candDir, "default.semantics.json"),
      JSON.stringify([
        { text: "COLLECTION", role: "node", x: 16, y: 16, w: 82, h: 16 },
        { text: "Your Library", role: "node", x: 16, y: 36, w: 135.5, h: 42 },
      ]),
    );
    const out = execFileSync(
      process.execPath,
      [path.join(ROOT, "scripts/ci-geometry-report.mjs"), "--reference", path.join(dir, "reference"), "--candidate", path.join(dir, "candidate"), "--device", "phone"],
      { encoding: "utf8" },
    );
    // "8 rows missing" says nothing; "missing at y 274..356, candidate nodes at y 16..36" says the
    // candidate's content stops before the reference's begins — a different bug entirely.
    assert.match(out, /shape::2 missing at y 274\.09\.\.356\.09 \/ x 85\.\.85; candidate nodes at y 16\.\.36/);
    // A screen with no missing rows gets no digest: it would be noise.
    fs.writeFileSync(path.join(refDir, "default.geometry.json"), JSON.stringify([{ text: "COLLECTION", role: "node", x: 16, y: 16, w: 82, h: 16 }]));
    const clean = execFileSync(
      process.execPath,
      [path.join(ROOT, "scripts/ci-geometry-report.mjs"), "--reference", path.join(dir, "reference"), "--candidate", path.join(dir, "candidate"), "--device", "phone"],
      { encoding: "utf8" },
    );
    assert.doesNotMatch(clean, /shape::/, "no missing rows means nothing to explain");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("the candidate extent is the whole set, not the first few nodes", async () => {
  const { execFileSync } = await import("node:child_process");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "uiport-extent-"));
  try {
    const refDir = path.join(dir, "reference/phone/library");
    const candDir = path.join(dir, "candidate/phone/library");
    fs.mkdirSync(refDir, { recursive: true });
    fs.mkdirSync(candDir, { recursive: true });
    fs.writeFileSync(
      path.join(refDir, "default.geometry.json"),
      JSON.stringify([{ text: "Most played", role: "button", x: 85, y: 274.09, w: 81.86, h: 20.3 }]),
    );
    // A header, four chips, and one node far down the page. Reporting the extent of the first six
    // nodes says the screen ends at y=100 when it runs to y=640 — which would send the next
    // investigation after a missing layout when the layout is there.
    const cand = [
      { text: "COLLECTION", role: "node", x: 16, y: 16, w: 82, h: 16 },
      ...Array.from({ length: 4 }, (_, i) => ({ text: `chip${i}`, role: "node", x: 16 + i * 40, y: 100, w: 36, h: 28 })),
      { text: "Late Shift", role: "node", x: 16, y: 640, w: 150, h: 180 },
    ];
    fs.writeFileSync(path.join(candDir, "default.semantics.json"), JSON.stringify(cand));
    const out = execFileSync(
      process.execPath,
      [path.join(ROOT, "scripts/ci-geometry-report.mjs"), "--reference", path.join(dir, "reference"), "--candidate", path.join(dir, "candidate"), "--device", "phone"],
      { encoding: "utf8" },
    );
    assert.match(out, /candidate nodes at y 16\.\.640/, "the extent is over every candidate node");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a missing row says whether the label is absent or merely named differently", async () => {
  const { execFileSync } = await import("node:child_process");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "uiport-near-"));
  try {
    const refDir = path.join(dir, "reference/phone/library");
    const candDir = path.join(dir, "candidate/phone/library");
    fs.mkdirSync(refDir, { recursive: true });
    fs.mkdirSync(candDir, { recursive: true });
    fs.writeFileSync(
      path.join(refDir, "default.geometry.json"),
      JSON.stringify([
        { text: "Recently added", role: "button", x: 268.03, y: 356.09, w: 95.97, h: 20.3 },
        { text: "Nonexistent", role: "button", x: 16, y: 600, w: 80, h: 20 },
      ]),
    );
    fs.writeFileSync(
      path.join(candDir, "default.semantics.json"),
      JSON.stringify([{ text: "Recently played", role: "node", x: 268, y: 356, w: 96, h: 20 }]),
    );
    const out = execFileSync(
      process.execPath,
      [path.join(ROOT, "scripts/ci-geometry-report.mjs"), "--reference", path.join(dir, "reference"), "--candidate", path.join(dir, "candidate"), "--device", "phone"],
      { encoding: "utf8" },
    );
    // Two different defects: a label under another name is a copy or naming bug, a label with no
    // relative anywhere is content that never rendered. The reader cannot afford one CI run each.
    assert.match(out, /similarly named candidate exists \(nearest: "Recently played" \[268,356 96x20\]\)/);
    assert.match(out, /no candidate node with the same text\/role/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
