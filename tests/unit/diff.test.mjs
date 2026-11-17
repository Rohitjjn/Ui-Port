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
import { canonicalNodes } from "../../scripts/lib/geometry.mjs";
import { GEOMETRY_SCRIPT } from "../../scripts/lib/browser-inject.mjs";

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
  const T = {
    ...DEFAULT_THRESHOLDS,
    acceptance: { requiresGeometry: true },
    residualCategories: { categories: ["font-rasterization", "shadow-elevation", "artwork-vector"] },
  };
  const geoOk = { coveragePct: 99 };
  const residual = ["font-rasterization"];

  test("above the goal is matched and accepted", () => {
    const r = decideOutcome({
      pixelMatchPct: 99.5,
      ssimValue: 1,
      geometry: geoOk,
      iterations: 1,
      thresholds: T,
      residualCategories: residual,
    });
    assert.equal(r.status, "matched");
    assert.equal(r.accepted, true);
    assert.match(r.reason, /goal/);
  });

  test("between the floor and the goal is accepted when layout and residuals are accounted for", () => {
    const r = decideOutcome({
      pixelMatchPct: 96.0,
      ssimValue: 0.62,
      geometry: geoOk,
      iterations: 3,
      thresholds: T,
      residualCategories: residual,
    });
    assert.equal(r.status, "matched");
    assert.equal(r.accepted, true);
    // A low SSIM must not block acceptance: it is reported, not gated.
    assert.equal(r.ssim.gating, false);
    assert.match(r.reason, /below goal/);
  });

  test("a perfect pixel match needs no residual category, and says so", () => {
    // 100% means there are no residual pixels to explain; requiring a category there would
    // force a run to invent one, which is exactly the dishonesty the gate exists to prevent.
    const r = decideOutcome({ pixelMatchPct: 100, ssimValue: 1, geometry: geoOk, iterations: 0, thresholds: T });
    assert.equal(r.status, "matched");
    assert.match(r.reason, /no residual pixels to explain/);
  });

  test("the configured acceptance block is read, not assumed", () => {
    // requiresGeometry=false is the only way to accept an unmeasured screen, and it has to come
    // from config rather than a default, so a project can deliberately trade the gate away.
    const noGeo = { ...T, acceptance: { requiresGeometry: false } };
    const r = decideOutcome({ pixelMatchPct: 96, ssimValue: 0.9, geometry: null, iterations: 1, thresholds: noGeo, residualCategories: residual });
    assert.equal(r.status, "matched");
    assert.equal(r.unmet.length, 0);
  });

  test("above the floor with an unexplained residual keeps building", () => {
    const r = decideOutcome({ pixelMatchPct: 96.0, ssimValue: 0.9, geometry: geoOk, iterations: 1, thresholds: T });
    assert.equal(r.status, "building");
    assert.match(r.unmet.join(" "), /residual/);
  });

  test("a residual category outside the configured list is not an explanation", () => {
    const r = decideOutcome({
      pixelMatchPct: 97.0,
      ssimValue: 0.9,
      geometry: geoOk,
      iterations: 1,
      thresholds: T,
      residualCategories: ["because I said so"],
    });
    assert.equal(r.status, "building");
    assert.match(r.unmet.join(" "), /unknown residual category/);
  });

  test("a missing semantics dump is not a pass: geometry unmeasured blocks acceptance", () => {
    const r = decideOutcome({
      pixelMatchPct: 99.9,
      ssimValue: 1,
      geometry: null,
      iterations: 1,
      thresholds: T,
      residualCategories: residual,
    });
    assert.equal(r.status, "building");
    assert.equal(r.accepted, false);
    assert.match(r.unmet.join(" "), /geometry not measured/);
  });

  test("below the floor at the iteration cap is blocked and asks the user", () => {
    const r = decideOutcome({
      pixelMatchPct: 94.9,
      ssimValue: 0.9,
      geometry: geoOk,
      iterations: 5,
      thresholds: T,
      residualCategories: residual,
    });
    assert.equal(r.status, "blocked");
    assert.match(r.reason, /iteration cap/);
  });

  test("good pixels but a broken layout is not accepted", () => {
    const r = decideOutcome({
      pixelMatchPct: 99.5,
      ssimValue: 1,
      geometry: { coveragePct: 50 },
      iterations: 1,
      thresholds: T,
      residualCategories: residual,
    });
    assert.equal(r.status, "building");
    assert.match(r.unmet.join(" "), /geometry coverage/);
  });

  test("the configured floor is 95 and the goal 99", () => {
    assert.equal(DEFAULT_THRESHOLDS.acceptanceFloorPct, 95);
    assert.equal(DEFAULT_THRESHOLDS.goalPixelMatchPct, 99);
  });
});

describe("noise floor", () => {
  test("a deterministic renderer keeps the configured thresholds", () => {
    const r = thresholdFloorFromNoise(100, DEFAULT_THRESHOLDS);
    assert.equal(r.adjusted, false);
    assert.equal(r.effectiveFloorPct, DEFAULT_THRESHOLDS.acceptanceFloorPct);
  });

  test("a jittery renderer lowers the thresholds and says so", () => {
    // 90% same-side noise is worse than the 95% floor, so the floor must come down and the
    // adjustment must be recorded — cross-platform noise is not a layout bug.
    const r = thresholdFloorFromNoise(90.0, DEFAULT_THRESHOLDS);
    assert.equal(r.adjusted, true);
    assert.equal(r.effectiveFloorPct, 89);
    assert.equal(r.effectiveGoalPct, 90);
    assert.match(r.note, /renderer noise/);
  });

  test("noise better than the floor leaves the floor alone", () => {
    // A 99% same-side score is consistent with a 95% cross-engine floor: two different engines
    // are allowed to differ more than two captures of the same one.
    const r = thresholdFloorFromNoise(99.0, DEFAULT_THRESHOLDS);
    assert.equal(r.adjusted, false);
    assert.equal(r.effectiveFloorPct, 95);
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
      // 100% pixels but no geometry dump and no declared residual: not accepted, by design.
      assert.equal(result.pixel.matchPct, 100);
      assert.equal(result.accepted, false);
      assert.equal(result.status, "building");
      assert.match(result.unmet.join(" "), /geometry not measured/);
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
    assert.equal(t.acceptanceFloorPct, 95);
    assert.equal(t.goalPixelMatchPct, 99);
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

describe("geometry dump shape", () => {
  test("a wrapped dump is read, not treated as empty", () => {
    // A 0% coverage verdict is indistinguishable from "nothing was ported" when the real cause is
    // a reader that did not understand the file. The dump is accepted either bare or wrapped.
    const ref = [{ text: "Home", role: "heading", x: 0, y: 0, w: 100, h: 20 }];
    const cand = [{ text: "Home", role: "heading", x: 0, y: 0, w: 100, h: 20 }];
    assert.equal(compareGeometry(ref, cand).coveragePct, 100);
    assert.equal(compareGeometry({ nodes: ref }, { nodes: cand }).coveragePct, 100);
    assert.equal(compareGeometry({ nodes: ref }, cand).coveragePct, 100);
  });
});

describe("dump granularity", () => {
  test("wrapper elements are not counted as missing nodes by the gate", () => {
    // The web dump has `<article>` -> `<div>` -> `<h3>`; Compose has only the text leaf. Comparing
    // the raw lists reports the wrappers as missing and the coverage as 0% for a correct layout —
    // which is exactly what the first real 2x run showed (393 "missing" nodes, 0% coverage).
    const dom = [
      { text: null, role: "article", x: 0, y: 0, w: 200, h: 100 },
      { text: null, role: "div", x: 0, y: 0, w: 200, h: 100 },
      { text: "Album", role: "h3", x: 8, y: 8, w: 100, h: 20 },
    ];
    const cand = [{ text: "Album", role: "heading", x: 8, y: 8, w: 100, h: 20 }];
    // Raw: one of the two wrappers happens to pair with the only candidate and "matches" at a
    // different size, so the score is a misleading 33% rather than a telling 0%.
    assert.equal(compareGeometry(dom, cand).coveragePct, 33.33, "the raw comparison is the trap");
    const canonical = compareGeometry(dom, cand, { canonical: true });
    assert.equal(canonical.coveragePct, 100);
    assert.equal(canonical.refCount, 1);
    assert.equal(canonical.rawRefCount, 3);
  });

  test("a node with no text and no test id is not an anchor", () => {
    // Otherwise every layout div enters the comparison as an unmatched phantom.
    const dom = [{ text: null, role: "presentation", x: 0, y: 0, w: 10, h: 10 }];
    assert.equal(canonicalNodes(dom).length, 0);
    assert.equal(canonicalNodes([{ text: null, testId: "play", x: 0, y: 0, w: 10, h: 10 }]).length, 1);
    assert.equal(canonicalNodes([{ text: "  Hello   world ", role: "p" }])[0].text, "Hello world");
  });
});

describe("viewport clipping", () => {
  test("the DOM dump only lists what the screenshot can contain", () => {
    // Compose composes only what is inside the scroll container and clips the rest, while
    // getBoundingClientRect reports elements scrolled out of sight. Without clipping, the DOM
    // side lists ~400 nodes against a Compose side that can produce ~16: a correct screen scores
    // 0% and looks unported.
    const source = GEOMETRY_SCRIPT.toString();
    assert.match(source, /window\.innerWidth/);
    assert.match(source, /window\.innerHeight/);
    assert.match(source, /if \(!visible\(r\)\) continue;/);
    assert.match(source, /clipped:/, "a clipped node must say so, so it is not read as a layout error");
  });

  test("a decorative wrapper is not a node, but a semantic one is", () => {
    // `<span><span>Most played</span><span>10 items</span></span>` makes a reference node reading
    // "Most played 10 items" that nothing in Compose can produce, because the port has two nodes
    // for the two labels. 22 of library's 44 reference nodes were that shape.
    const source = GEOMETRY_SCRIPT.toString();
    assert.match(source, /const SEMANTIC = "a,button,input,textarea,select,label,summary,\[role\],\[data-testid\],\[aria-label\]"/);
    assert.match(source, /if \(isDecorativeWrapper\(el\)\) continue;/);
    // The rule must be keyed on semantics, not on having children: the nav `<a>` composes its text
    // from the pill and the label and is a legitimate 64x65.94 node — dropping it would undo the
    // fix that took `home` from 0% to 33%.
    assert.match(source, /!el\.matches\(SEMANTIC\) && composesItsText\(el\)/);
  });

  test("a node hidden under an overlay is not in the reference either", () => {
    // The now-playing player is a full-frame overlay: the library rows beneath it are still in the
    // DOM and still have boxes, but the port renders an overlay, not those rows. Counting them made
    // the reference claim ~40 nodes the candidate could never produce — `nowplaying` compared 55
    // reference nodes against 14, so no amount of porting effort could have passed it.
    const source = GEOMETRY_SCRIPT.toString();
    assert.match(source, /document\.elementFromPoint/, "a hit test at the node's centre decides");
    assert.match(source, /if \(covered\(el, r\)\) continue;/);
    // It must be a point test, not an area test: a half-covered label is still readable, and
    // dropping it would be the opposite error.
    assert.doesNotMatch(source, /coveredArea|intersectionArea/);
    // And it must not drop a node that merely contains the topmost element (the overlay is often a
    // descendant of the screen's own scroll container).
    assert.match(source, /!el\.contains\(top\) && !top\.contains\(el\)/);
  });
});

describe("nested label matching", () => {
  test("a label inside a link is not reported as shifted", () => {
    // The DOM's canonical node for a nav label is the `<a>` (the text is a bare text node), while
    // Compose's is the `Text`. Comparing them raw reports a 38 dp shift for a correct layout.
    const ref = [{ text: "Home", role: "a", x: 0, y: 786, w: 64, h: 66 }];
    const cand = [
      {
        text: "Home",
        role: "node",
        x: 24,
        y: 800,
        w: 16,
        h: 16,
        ancestors: [{ x: 0, y: 786, w: 64, h: 66 }],
      },
    ];
    // Ancestor reconciliation is part of matching a box, not part of the canonical filter, so it
    // applies on both paths — a leaf whose enclosing link is exactly where the reference's link
    // is has not moved, and saying otherwise would send an iteration after a correct layout.
    const direct = compareGeometry(ref, cand);
    assert.equal(direct.coveragePct, 100);
    assert.equal(direct.mismatched.length, 0);
    const nested = compareGeometry(ref, cand, { canonical: true });
    assert.equal(nested.coveragePct, 100);
    assert.equal(nested.matched[0].matchedAgainst, "ancestor1");
  });

  test("an ancestor is not a free pass: a genuinely misplaced label still fails", () => {
    const ref = [{ text: "Home", role: "a", x: 0, y: 786, w: 64, h: 66 }];
    const cand = [
      { text: "Home", role: "node", x: 24, y: 800, w: 16, h: 16, ancestors: [{ x: 0, y: 700, w: 64, h: 66 }] },
    ];
    assert.equal(compareGeometry(ref, cand, { canonical: true }).coveragePct, 0);
  });
});
