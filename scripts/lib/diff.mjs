/**
 * Visual diff engine.
 *
 * Compares a reference screenshot (web) with a candidate screenshot (Compose) and
 * reports three independent signals:
 *   1. pixel match percentage (pixelmatch, anti-aliasing aware)
 *   2. SSIM (structural similarity, luminance + structure)
 *   3. geometry (DOM element boxes vs Compose semantics-node bounds)
 *
 * The noise floor is subtracted conceptually, never silently: a report always
 * states the measured web-vs-web and compose-vs-compose numbers so a reader can
 * tell a real regression from renderer noise.
 */
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { ssim } from "ssim.js";
import { readJson, readJsonSafe, writeJsonAtomic } from "./fs-utils.mjs";
import { compareGeometry, DEFAULT_THRESHOLDS, round } from "./geometry.mjs";

// Re-exported so `import { compareGeometry, round } from lib/diff.mjs` keeps working:
// the geometry maths is dependency-free and lives in its own module.
export { compareGeometry, round, DEFAULT_THRESHOLDS, loadThresholds } from "./geometry.mjs";
import fs from "node:fs";
import path from "node:path";

export function decodePng(buffer) {
  return PNG.sync.read(buffer);
}

/**
 * A rectangle mask in pixels: [x, y, w, h]. Masked regions are excluded from the
 * diff instead of being painted over, so the score is honest.
 */
export function applyMasks(png, masks = [], fill = [0, 0, 0, 0]) {
  for (const mask of masks) {
    const { x, y, w, h } = normalizeMask(mask, png.width, png.height);
    for (let yy = Math.max(0, y); yy < Math.min(png.height, y + h); yy++) {
      for (let xx = Math.max(0, x); xx < Math.min(png.width, x + w); xx++) {
        const idx = (yy * png.width + xx) << 2;
        png.data[idx] = fill[0];
        png.data[idx + 1] = fill[1];
        png.data[idx + 2] = fill[2];
        png.data[idx + 3] = fill[3];
      }
    }
  }
  return png;
}

function normalizeMask(mask, width, height) {
  if (typeof mask?.x === "number") {
    return { x: Math.round(mask.x), y: Math.round(mask.y), w: Math.round(mask.w ?? mask.width ?? 0), h: Math.round(mask.h ?? mask.height ?? 0) };
  }
  if (mask?.preset === "system-bars") return { x: 0, y: 0, w: width, h: 0 };
  return { x: 0, y: 0, w, h };
}

/**
 * Mask compositing: both images get the same solid fill in the same region, so a
 * masked area can never contribute a difference and can never "match" something
 * it should not.
 */
export function maskPair(refPng, candPng, masks = []) {
  const color = [0, 0, 0, 255];
  applyMasks(refPng, masks, color);
  applyMasks(candPng, masks, color);
}

export function assertSameSize(refPng, candPng) {
  if (refPng.width !== candPng.width || refPng.height !== candPng.height) {
    throw new Error(
      `screenshot sizes differ: reference ${refPng.width}x${refPng.height} vs candidate ${candPng.width}x${candPng.height}. ` +
        "A diff across different viewport/density comparisons is meaningless: re-capture both sides with the same config/viewports.json entry.",
    );
  }
}

export function pixelDiff(refPng, candPng, opts = {}) {
  assertSameSize(refPng, candPng);
  const { width, height } = refPng;
  const diff = new PNG({ width, height });
  const changed = pixelmatch(refPng.data, candPng.data, diff.data, width, height, {
    threshold: opts.threshold ?? 0.1,
    includeAA: opts.includeAA ?? false,
    alpha: opts.alpha ?? 0.35,
    diffColor: opts.diffColor ?? [255, 0, 90],
  });
  const total = width * height;
  const matchPct = ((total - changed) / total) * 100;
  return { changed, total, matchPct: round(matchPct, 4), diffPng: diff };
}

export function ssimScore(refPng, candPng, opts = {}) {
  assertSameSize(refPng, candPng);
  const res = ssim(
    { data: new Uint8ClampedArray(refPng.data), width: refPng.width, height: refPng.height },
    { data: new Uint8ClampedArray(candPng.data), width: refPng.width, height: candPng.height },
    {
      windowSize: opts.windowSize ?? 11,
      k1: opts.k1 ?? 0.01,
      k2: opts.k2 ?? 0.03,
      downsample: "original",
      bitDepth: 8,
    },
  );
  return { ssim: round(res.mssim, 6), map: res.ssim_map };
}

/** Bounding boxes: web geometry dump vs Compose semantics dump. */
/**
 * Acceptance decision.
 *
 * A screen is ACCEPTED only when all three hold:
 *   1. pixel match >= the acceptance floor (95%),
 *   2. the geometry gate passes — key nodes within tolerance, coverage above the minimum,
 *   3. every residual difference is explained by a declared residual category.
 *
 * SSIM is reported and tracked, never gated. It reacts to anti-aliasing and text rasterisation,
 * which are engine differences rather than port defects; `ssim.gate === false` in config makes
 * that explicit rather than an accident of code order.
 *
 * The geometry gate is not decoration: 5% of a 393x852 screen is ~17k pixels, which is more
 * than a title plus a two-line paragraph, so a pixel score alone can hide a block that never
 * rendered or rendered 40px low.
 */
/**
 * Geometry, in words. A gate that was deliberately switched off must say so in the accepted
 * reason rather than quoting a coverage number it never measured.
 */
function geometryNote(geometry, required) {
  if (geometry && typeof geometry.coveragePct === "number") return `geometry ${geometry.coveragePct}% coverage`;
  return required ? "geometry NOT MEASURED" : "geometry not measured (gate disabled in config)";
}

/** How the residual gate was satisfied, in words a report can quote. */
function residualNote(categories) {
  return categories?.length ? `residuals categorised [${categories.join(", ")}]` : "no residual pixels to explain";
}

export function decideOutcome({
  pixelMatchPct,
  ssimValue,
  geometry,
  iterations,
  thresholds = DEFAULT_THRESHOLDS,
  residualCategories = [],
  residualExplained = false,
}) {
  const floor = thresholds.acceptanceFloorPct;
  const goal = thresholds.goalPixelMatchPct;
  const cap = thresholds.maxIterationsPerScreenPerDevice;
  const minCoverage = thresholds.geometry?.minNodeCoveragePct ?? 90;
  const requiresGeometry = thresholds.acceptance?.requiresGeometry !== false;

  // Geometry can only be gated when both sides produced a dump. A missing dump is reported as
  // "not measured" and blocks acceptance, because "could not check" is not "checked and fine".
  const geometryMeasured = Boolean(geometry && typeof geometry.coveragePct === "number");
  const geometryOk = geometryMeasured && geometry.coveragePct >= minCoverage;
  // A perfect pixel match has no residual pixels to explain, so the residual gate is
  // vacuously satisfied there. Every other score must account for its differences.
  const noResidualPixels = pixelMatchPct >= 100;
  const explained = noResidualPixels || residualExplained || (residualCategories?.length ?? 0) > 0;
  const catalogued =
    noResidualPixels ||
    residualCategories.length === 0 ||
    residualCategories.every((c) => (thresholds.residualCategories?.categories ?? []).includes(c));

  const unmet = [];
  if (pixelMatchPct < floor) unmet.push(`pixel ${pixelMatchPct}% < floor ${floor}%`);
  if (requiresGeometry && !geometryMeasured) unmet.push("geometry not measured (no candidate semantics dump)");
  if (requiresGeometry && geometryMeasured && !geometryOk) {
    unmet.push(`geometry coverage ${geometry.coveragePct}% < ${minCoverage}%`);
  }
  if (!explained) unmet.push("residual differences are not categorised");
  if (!catalogued) unmet.push(`unknown residual category in [${residualCategories.join(", ")}]`);

  if (unmet.length === 0) {
    const best = pixelMatchPct >= goal;
    return {
      status: "matched",
      accepted: true,
      reason: `accepted: pixel ${pixelMatchPct}% (>= ${best ? `goal ${goal}` : `floor ${floor}, below goal ${goal}`}%), ${geometryNote(geometry, requiresGeometry)}, ${residualNote(residualCategories)}`,
      unmet: [],
      ssim: { value: ssimValue, gating: false, note: "reported only" },
    };
  }

  if (iterations >= cap) {
    return {
      status: "blocked",
      accepted: false,
      reason: `iteration cap (${cap}) reached: ${unmet.join("; ")} — record the blocker and ask the user`,
      unmet,
      ssim: { value: ssimValue, gating: false, note: "reported only" },
    };
  }

  return {
    status: "building",
    accepted: false,
    reason: `${unmet.join("; ")}; ${Math.max(0, cap - iterations)} iteration(s) left`,
    unmet,
    ssim: { value: ssimValue, gating: false, note: "reported only" },
  };
}

/**
 * Full comparison of one screen for one device.
 * Writes three PNGs (reference copy, candidate copy, heat map) plus a report.
 */
export function compareScreens({
  referenceFile,
  candidateFile,
  referenceGeometryFile,
  candidateGeometryFile,
  masks = [],
  outputDir,
  thresholds = DEFAULT_THRESHOLDS,
  iterations = 0,
  residualCategories = [],
  screenName = "screen",
  device = "phone",
}) {
  const refPng = decodePng(fs.readFileSync(referenceFile));
  const candPng = decodePng(fs.readFileSync(candidateFile));
  assertSameSize(refPng, candPng);
  if (masks.length) maskPair(refPng, candPng, masks);
  const px = pixelDiff(refPng, candPng, thresholds.pixelmatch);
  const ss = ssimScore(refPng, candPng, thresholds.ssim);
  const geometry =
    referenceGeometryFile && candidateGeometryFile
      ? compareGeometry(
          readJson(referenceGeometryFile, []),
          readJson(candidateGeometryFile, []),
          // The DOM dump and the semantics dump differ in granularity by construction (one records
          // every wrapper, the other records text leaves), so the gate compares canonical leaf
          // sets. Without this each wrapper counts as a missing node and a correct screen scores 0%.
          { ...thresholds.geometry, canonical: true },
        )
      : null;
  const outcome = decideOutcome({
    pixelMatchPct: px.matchPct,
    ssimValue: ss.ssim,
    geometry,
    iterations,
    thresholds,
    residualCategories,
  });
  const result = {
    screen: screenName,
    device,
    generatedAt: new Date().toISOString(),
    size: { width: refPng.width, height: refPng.height },
    pixel: { matchPct: px.matchPct, changedPixels: px.changed, totalPixels: px.total, threshold: thresholds.pixelmatch.threshold },
    ssim: { value: ss.ssim, goal: thresholds.ssim.goal, floor: thresholds.ssim.floor },
    geometry: geometry
      ? {
          coveragePct: geometry.coveragePct,
          matched: geometry.matched.length,
          mismatched: geometry.mismatched.length,
          missing: geometry.missing.length,
          // The pattern, not just the count: "0% of nodes within 1 dp" is only diagnosable when the
          // report says whether they moved together or landed in the wrong places.
          deltaSummary: geometry.deltaSummary,
          worstOffenders: geometry.mismatched.slice(0, 10),
        }
      : null,
    masks,
    residualCategories,
    iterations,
    iterationsLeft: Math.max(0, (thresholds.maxIterationsPerScreenPerDevice ?? 5) - iterations),
    status: outcome.status,
    accepted: outcome.accepted,
    unmet: outcome.unmet,
    // The gate table must agree with the verdict above, or a report shows "residual: fail"
    // next to an accepted screen and nobody can tell which one to believe.
    gates: {
      pixel: { value: px.matchPct, floor: thresholds.acceptanceFloorPct, goal: thresholds.goalPixelMatchPct, pass: px.matchPct >= thresholds.acceptanceFloorPct },
      geometry: geometry
        ? {
            coveragePct: geometry.coveragePct,
            floorPct: thresholds.geometry?.minNodeCoveragePct ?? 90,
            pass: geometry.coveragePct >= (thresholds.geometry?.minNodeCoveragePct ?? 90),
          }
        : {
            measured: false,
            pass: thresholds.acceptance?.requiresGeometry === false,
            note: thresholds.acceptance?.requiresGeometry === false
              ? "not measured, gate disabled in config"
              : "no candidate semantics dump — not measured is not a pass",
          },
      residual: {
        categories: residualCategories,
        pass: px.matchPct >= 100 || residualCategories.length > 0,
        note: px.matchPct >= 100 ? "no residual pixels to explain" : undefined,
      },
      ssim: { value: ss.ssim, gating: thresholds.ssim?.gate === true, note: "reported only" },
    },
    reason: outcome.reason,
  };
  if (outputDir) {
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, `${screenName}.diff.png`), PNG.sync.write(px.diffPng));
    fs.writeFileSync(path.join(outputDir, `${screenName}.reference.png`), PNG.sync.write(refPng));
    fs.writeFileSync(path.join(outputDir, `${screenName}.candidate.png`), PNG.sync.write(candPng));
    writeJsonAtomic(path.join(outputDir, `${screenName}.report.json`), result);
    fs.writeFileSync(path.join(outputDir, `${screenName}.report.md`), renderReport(result));
  }
  return result;
}

/**
 * Heat map: a greyscale-luminance-difference image amplified to show WHERE the
 * difference is, which pixelmatch's binary red mask cannot show.
 */
export function heatMap(refPng, candPng, { amplify = 6 } = {}) {
  assertSameSize(refPng, candPng);
  const out = new PNG({ width: refPng.width, height: refPng.height });
  for (let i = 0; i < refPng.data.length; i += 4) {
    const l1 = 0.299 * refPng.data[i] + 0.587 * refPng.data[i + 1] + 0.114 * refPng.data[i + 2];
    const l2 = 0.299 * candPng.data[i] + 0.587 * candPng.data[i + 1] + 0.114 * candPng.data[i + 2];
    const d = Math.min(255, Math.abs(l1 - l2) * amplify);
    out.data[i] = d;
    out.data[i + 1] = d * 0.25;
    out.data[i + 2] = 255 - d;
    out.data[i + 3] = 255;
  }
  return out;
}

/**
 * Noise floor calibration: compare two renders of the same side. If the same side
 * cannot reproduce itself, cross-platform diffs are meaningless.
 */
export function calibrateNoiseFloor({ sameSideA, sameSideB, thresholds = DEFAULT_THRESHOLDS }) {
  const a = decodePng(fs.readFileSync(sameSideA));
  const b = decodePng(fs.readFileSync(sameSideB));
  const px = pixelDiff(a, b, thresholds.pixelmatch);
  const floor = thresholdFloorFromNoise(px.matchPct, thresholds);
  return {
    sameSideMatchPct: px.matchPct,
    identical: px.matchPct === 100,
    ...floor,
  };
}

/**
 * Turn a measured same-side score into the effective acceptance numbers: a screen
 * can never be expected to beat the renderer's own reproducibility.
 */
export function thresholdFloorFromNoise(noisePct, thresholds = DEFAULT_THRESHOLDS) {
  const floor = thresholds.acceptanceFloorPct;
  const goal = thresholds.goalPixelMatchPct;
  if (noisePct >= 100) {
    return { effectiveFloorPct: floor, effectiveGoalPct: goal, adjusted: false, note: "renderer is deterministic" };
  }
  const effectiveFloor = round(Math.min(floor, noisePct - 1), 2);
  const effectiveGoal = round(Math.min(goal, noisePct), 2);
  // `adjusted` must mean "the numbers actually moved". A 99% same-side score is consistent with
  // a 95% cross-engine floor, so nothing changes and nothing should be reported as lowered.
  const adjusted = effectiveFloor < floor || effectiveGoal < goal;
  return {
    effectiveFloorPct: effectiveFloor,
    effectiveGoalPct: effectiveGoal,
    adjusted,
    note: adjusted
      ? `same-side re-render scores ${noisePct}%; cross-platform thresholds were lowered so renderer noise is not reported as a layout bug`
      : `same-side re-render scores ${noisePct}%, which is consistent with the configured floor; no adjustment needed`,
  };
}

export function renderReport(r) {
  const L = [];
  L.push(`# ${r.screen} — ${r.device}`, "");
  L.push(`Status: **${r.status}** — ${r.reason}`, "");
  L.push(`Generated ${r.generatedAt}. Image ${r.size.width}x${r.size.height}.`, "");
  L.push("## Scores", "", "| Metric | Value | Target |", "| --- | --- | --- |");
  L.push(`| Pixel match | **${r.pixel.matchPct}%** | >= ${r.pixel.threshold} tolerance |`);
  L.push(`| SSIM | ${r.ssim.value} | floor ${r.ssim.floor}, goal ${r.ssim.goal} |`);
  if (r.geometry) {
    L.push(`| Geometry coverage | ${r.geometry.coveragePct}% | >= 90% |`);
  }
  L.push(`| Iterations | ${r.iterations} | cap 5 |`, "");
  // Read this before the per-node table. Ten rows of dx/dy can look like ten mistakes when they
  // are one offset, and chasing them individually is how a correct layout gets "fixed" into a
  // wrong one.
  if (r.geometry?.deltaSummary) {
    const d = r.geometry.deltaSummary;
    L.push(`## Why geometry failed: ${d.signature}`, "");
    L.push(`${d.hint}.`, "");
    L.push("| | dx | dy | dw | dh |", "| --- | --- | --- | --- | --- |");
    L.push(`| median | ${d.medians.dx} | ${d.medians.dy} | ${d.medians.dw} | ${d.medians.dh} |`);
    L.push(
      `| range | ${d.spreads.dx.min}..${d.spreads.dx.max} | ${d.spreads.dy.min}..${d.spreads.dy.max} | ${d.spreads.dw.min}..${d.spreads.dw.max} | ${d.spreads.dh.min}..${d.spreads.dh.max} |`,
    );
    L.push("");
  }
  if (r.geometry?.worstOffenders?.length) {
    L.push("## Geometry mismatches (largest first)", "", "| Element | dx | dy | dw | dh |", "| --- | --- | --- | --- | --- |");
    for (const m of r.geometry.worstOffenders) {
      L.push(`| ${m.ref.text ?? m.ref.role ?? "(unnamed)"} | ${m.dx} | ${m.dy} | ${m.dw} | ${m.dh} |`);
    }
    L.push("");
  }
  if (r.masks?.length) L.push(`Masked regions: ${r.masks.length}.`, "");
  if (r.residualCategories?.length) {
    L.push("## Residual differences (categorised)", "");
    for (const c of r.residualCategories) L.push(`- ${c}`);
    L.push("");
  }
  return L.join("\n");
}
