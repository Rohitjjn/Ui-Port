import assert from "node:assert/strict";
import fs from "node:fs";
import test, { describe } from "node:test";
import { fakeScreen, rect, save, solid } from "../helpers/images.mjs";
import { tmpProject } from "../helpers/fixtures.mjs";
import {
  calibrateNoiseFloor,
  compareGeometry,
  compareScreens,
  decideOutcome,
  decodePng,
  DEFAULT_THRESHOLDS,
  heatMap,
  loadThresholds,
  maskPair,
  pixelDiff,
  round,
  ssimScore,
  thresholdFloorFromNoise,
} from "../../scripts/lib/diff.mjs";

describe("pixel diff", () => {
  test("identical images score exactly 100%", () => {
    const a = fakeScreen();
    const b = fakeScreen();
    const r = pixelDiff(a, b);
    assert.equal(r.matchPct, 100);
    assert.equal(r.changed, 0);
  });

  test("a shifted card is detected and the score drops", () => {
    const a = fakeScreen({ shift: 0 });
    const b = fakeScreen({ shift: 3 });
    const r = pixelDiff(a, b);
    assert.ok(r.changed > 0);
    assert.ok(r.matchPct < 100);
    assert.ok(r.matchPct > 80, `a 3px shift should not destroy the score (${r.matchPct}%)`);
  });

  test("a colour change is detected", () => {
    const a = fakeScreen();
    const b = fakeScreen({ tint: [100, 0, 0] });
    const r = pixelDiff(a, b);
    assert.ok(r.changed > 0);
  });

  test("anti-aliasing tolerance reduces spurious differences", () => {
    const a = solid(40, 40, [255, 255, 255, 255]);
    const b = solid(40, 40, [250, 250, 250, 255]);
    const strict = pixelDiff(a, b, { threshold: 0.05 });
    const loose = pixelDiff(a, b, { threshold: 0.2 });
    assert.ok(strict.changed >= loose.changed);
    assert.equal(loose.matchPct, 100);
  });

  test("size mismatch is a hard error, not a silent bad score", () => {
    assert.throws(() => pixelDiff(solid(10, 10), solid(10, 11)), /screenshot sizes differ/);
  });
});

describe("masks", () => {
  test("a masked region cannot contribute a difference", () => {
    const a = fakeScreen();
    const b = fakeScreen();
    rect(b, 0, 0, 80, 20, [255, 0, 0, 255]); // big red block top-left
    const before = pixelDiff(a, b);
    assert.ok(before.changed > 0);
    // mask the same region on BOTH sides
    maskPair(a, b, [{ x: 0, y: 0, w: 80, h: 20 }]);
    const after = pixelDiff(a, b);
    assert.equal(after.changed, 0, "masked pixels must be identical on both sides");
    assert.equal(after.matchPct, 100);
  });

  test("masking is symmetric", () => {
    const a = fakeScreen();
    const b = fakeScreen();
    maskPair(a, b, [{ x: 10, y: 10, w: 10, h: 10 }]);
    const px = (png, x, y) => Array.from(png.data.slice((y * png.width + x) << 2, ((y * png.width + x) << 2) + 4));
    assert.deepEqual(px(a, 12, 12), px(b, 12, 12));
    assert.deepEqual(px(a, 12, 12), [0, 0, 0, 255]);
  });
});

describe("ssim", () => {
  test("identical images score 1", () => {
    const a = fakeScreen();
    assert.equal(ssimScore(a, fakeScreen()).ssim, 1);
  });

  test("a structural change lowers the score but stays in (0,1)", () => {
    const a = fakeScreen();
    const b = fakeScreen();
    rect(b, 0, 0, 80, 120, [255, 255, 255, 255]);
    const s = ssimScore(a, b).ssim;
    assert.ok(s > 0 && s < 1, `ssim ${s}`);
  });
});

describe("geometry comparison", () => {
  const refNodes = [
    { text: "Good morning", role: "heading", x: 16, y: 24, w: 200, h: 32 },
    { text: "Play", role: "button", x: 320, y: 24, w: 40, h: 40 },
    { text: "PaperCraft", role: "text", x: 16, y: 300, w: 80, h: 16 },
  ];

  test("a 1dp tolerance absorbs sub-pixel differences", () => {
    const cand = refNodes.map((n) => ({ ...n, x: n.x + 1, y: n.y + 0.8 }));
    const r = compareGeometry(refNodes, cand, { toleranceDp: 1 });
    assert.equal(r.coveragePct, 100);
    assert.equal(r.mismatched.length, 0);
  });

  test("a 5dp shift is reported with the offending element", () => {
    const cand = refNodes.map((n) => (n.text === "Play" ? { ...n, x: n.x + 5 } : { ...n }));
    const r = compareGeometry(refNodes, cand, { toleranceDp: 1 });
    assert.equal(r.mismatched.length, 1);
    assert.equal(r.mismatched[0].ref.text, "Play");
    assert.equal(r.mismatched[0].dx, 5);
    assert.ok(r.coveragePct < 100);
  });

  test("a node missing from the Compose tree is reported", () => {
    const r = compareGeometry(refNodes, refNodes.slice(0, 2), { toleranceDp: 1 });
    assert.equal(r.missing.length, 1);
    assert.equal(r.missing[0].node.text, "PaperCraft");
  });

  test("an empty reference has nothing to check and counts as full coverage", () => {
    assert.equal(compareGeometry([], []).coveragePct, 100);
  });
});

describe("acceptance decisions", () => {
  const T = DEFAULT_THRESHOLDS;
  const geoOk = { coveragePct: 99 };

  test("above the goal is matched", () => {
    const r = decideOutcome({ pixelMatchPct: 99.95, ssimValue: 1, geometry: geoOk, iterations: 1, thresholds: T });
    assert.equal(r.status, "matched");
  });

  test("between floor and goal with explained residuals is accepted with notes", () => {
    const r = decideOutcome({
      pixelMatchPct: 99.0,
      ssimValue: 0.998,
      geometry: geoOk,
      iterations: 3,
      thresholds: T,
      residualExplained: true,
    });
    assert.equal(r.status, "accepted-with-notes");
    assert.match(r.reason, /categorised/);
  });

  test("between floor and goal with unexplained residuals keeps building", () => {
    const r = decideOutcome({ pixelMatchPct: 99.0, ssimValue: 0.998, geometry: geoOk, iterations: 1, thresholds: T });
    assert.equal(r.status, "building");
  });

  test("below the floor at the iteration cap is blocked and asks the user", () => {
    const r = decideOutcome({ pixelMatchPct: 97.0, ssimValue: 0.9, geometry: geoOk, iterations: 5, thresholds: T });
    assert.equal(r.status, "blocked");
    assert.match(r.reason, /below the acceptance floor/);
  });

  test("good pixels but a broken layout is not matched", () => {
    const r = decideOutcome({ pixelMatchPct: 99.95, ssimValue: 1, geometry: { coveragePct: 50 }, iterations: 1, thresholds: T });
    assert.equal(r.status, "building");
  });
});

describe("noise floor", () => {
  test("a deterministic renderer keeps the configured thresholds", () => {
    const r = thresholdFloorFromNoise(100, DEFAULT_THRESHOLDS);
    assert.equal(r.adjusted, false);
    assert.equal(r.effectiveFloorPct, DEFAULT_THRESHOLDS.acceptanceFloorPct);
  });

  test("a jittery renderer lowers the thresholds and says so", () => {
    const r = thresholdFloorFromNoise(99.0, DEFAULT_THRESHOLDS);
    assert.equal(r.adjusted, true);
    assert.equal(r.effectiveFloorPct, 98);
    assert.equal(r.effectiveGoalPct, 99);
    assert.match(r.note, /renderer noise/);
  });

  test("calibration on disk reads both renders", () => {
    const p = tmpProject();
    try {
      const a = save(p.dir, "a.png", fakeScreen());
      const b = save(p.dir, "b.png", fakeScreen());
      const r = calibrateNoiseFloor({ sameSideA: a, sameSideB: b, thresholds: DEFAULT_THRESHOLDS });
      assert.equal(r.identical, true);
      assert.equal(r.sameSideMatchPct, 100);
    } finally {
      p.cleanup();
    }
  });
});

describe("full comparison report", () => {
  test("writes report json/md and three images", () => {
    const p = tmpProject();
    try {
      const ref = save(p.dir, "ref.png", fakeScreen());
      const cand = save(p.dir, "cand.png", fakeScreen({ shift: 2 }));
      const out = p.file("out", "phone", "home");
      fs.mkdirSync(out, { recursive: true });
      const result = compareScreens({
        referenceFile: ref,
        candidateFile: cand,
        outputDir: out,
        screenName: "home",
        device: "phone",
        iterations: 1,
      });
      assert.ok(result.pixel.matchPct < 100);
      for (const f of ["home.diff.png", "home.reference.png", "home.candidate.png", "home.report.json", "home.report.md"]) {
        assert.ok(fs.existsSync(`${out}/${f}`), `missing ${f}`);
      }
      const md = fs.readFileSync(`${out}/home.report.md`, "utf8");
      assert.match(md, /Pixel match/);
      assert.match(md, /Status: \*\*building\*\*/);
    } finally {
      p.cleanup();
    }
  });

  test("a perfect pair is reported as matched", () => {
    const p = tmpProject();
    try {
      const ref = save(p.dir, "ref.png", fakeScreen());
      const cand = save(p.dir, "cand.png", fakeScreen());
      const result = compareScreens({ referenceFile: ref, candidateFile: cand, screenName: "home", device: "phone" });
      assert.equal(result.status, "matched");
      assert.equal(result.pixel.matchPct, 100);
    } finally {
      p.cleanup();
    }
  });

  test("geometry files are picked up when provided", () => {
    const p = tmpProject();
    try {
      const ref = save(p.dir, "ref.png", fakeScreen());
      const cand = save(p.dir, "cand.png", fakeScreen());
      const refGeo = p.json("ref-geo.json", [{ text: "Buy", role: "button", x: 8, y: 100, w: 24, h: 12 }]);
      const candGeo = p.json("cand-geo.json", [{ text: "Buy", role: "button", x: 8, y: 104, w: 24, h: 12 }]);
      const result = compareScreens({
        referenceFile: ref,
        candidateFile: cand,
        referenceGeometryFile: refGeo,
        candidateGeometryFile: candGeo,
        screenName: "home",
        device: "phone",
      });
      assert.ok(result.geometry);
      assert.equal(result.geometry.mismatched, 1);
      assert.equal(result.geometry.worstOffenders[0].dy, 4);
    } finally {
      p.cleanup();
    }
  });

  test("heat map highlights luminance differences", () => {
    const a = fakeScreen();
    const b = fakeScreen({ shift: 4 });
    const hm = heatMap(a, b);
    let max = 0;
    for (let i = 0; i < hm.data.length; i += 4) max = Math.max(max, hm.data[i]);
    assert.ok(max > 0, "heat map must show the difference");
    const same = heatMap(a, fakeScreen());
    let maxSame = 0;
    for (let i = 0; i < same.data.length; i += 4) maxSame = Math.max(maxSame, same.data[i]);
    assert.equal(maxSame, 0);
  });
});

describe("thresholds config", () => {
  test("reads the repository's real config/thresholds.json", () => {
    const t = loadThresholds("config/thresholds.json");
    assert.equal(t.acceptanceFloorPct, 98.5);
    assert.equal(t.goalPixelMatchPct, 99.9);
    assert.equal(t.maxIterationsPerScreenPerDevice, 5);
    assert.equal(t.pixelmatch.threshold, 0.1);
    assert.equal(t.geometry.toleranceDp, 1.0);
  });

  test("falls back to defaults when the file is missing or broken", () => {
    const p = tmpProject();
    try {
      assert.deepEqual(loadThresholds(`${p.dir}/nope.json`), DEFAULT_THRESHOLDS);
      p.write("bad.json", "{");
      assert.deepEqual(loadThresholds(`${p.dir}/bad.json`), DEFAULT_THRESHOLDS);
    } finally {
      p.cleanup();
    }
  });

  test("round keeps scores readable", () => {
    assert.equal(round(99.999999, 4), 100);
    assert.equal(round(98.123456, 2), 98.12);
  });
});

describe("png round-trip", () => {
  test("decode returns the same pixels", () => {
    const p = tmpProject();
    try {
      const file = save(p.dir, "a.png", fakeScreen());
      const png = decodePng(fs.readFileSync(file));
      assert.equal(png.width, 80);
      assert.equal(png.height, 120);
    } finally {
      p.cleanup();
    }
  });
});
