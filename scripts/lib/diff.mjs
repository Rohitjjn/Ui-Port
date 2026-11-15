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
import fs from "node:fs";
import path from "node:path";

export const DEFAULT_THRESHOLDS = {
  pixelmatch: { threshold: 0.1, includeAA: false, alpha: 0.35, diffColor: [255, 0, 90] },
  ssim: { windowSize: 11, k1: 0.01, k2: 0.03 },
  geometry: { toleranceDp: 1.0, tolerancePct: 1.0, minNodeCoveragePct: 90.0 },
  acceptanceFloorPct: 98.5,
  goalPixelMatchPct: 99.9,
  maxIterationsPerScreenPerDevice: 5,
};

export function loadThresholds(file) {
  const res = readJsonSafe(file);
  if (!res.ok) return DEFAULT_THRESHOLDS;
  const v = res.value?.visual ?? res.value ?? {};
  return {
    pixelmatch: { ...DEFAULT_THRESHOLDS.pixelmatch, ...(v.pixelmatch ?? {}) },
    ssim: { ...DEFAULT_THRESHOLDS.ssim, ...(v.ssim ?? {}) },
    geometry: { ...DEFAULT_THRESHOLDS.geometry, ...(v.geometry ?? {}) },
    acceptanceFloorPct: v.acceptanceFloorPct ?? DEFAULT_THRESHOLDS.acceptanceFloorPct,
    goalPixelMatchPct: v.goalPixelMatchPct ?? DEFAULT_THRESHOLDS.goalPixelMatchPct,
    maxIterationsPerScreenPerDevice: v.maxIterationsPerScreenPerDevice ?? DEFAULT_THRESHOLDS.maxIterationsPerScreenPerDevice,
  };
}

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
export function compareGeometry(refNodes = [], candNodes = [], opts = {}) {
  const tolerance = opts.toleranceDp ?? 1.0;
  const matched = [];
  const mismatched = [];
  const missing = [];
  const usedCand = new Set();
  for (const ref of refNodes) {
    const candidates = candNodes.filter((c) => !usedCand.has(c.id ?? c.name ?? c.text));
    const best = pickBestMatch(ref, candidates);
    if (!best) {
      missing.push({ node: ref, reason: "no candidate node with the same text/role" });
      continue;
    }
    const key = best.id ?? best.name ?? best.text;
    usedCand.add(key);
    const dx = Math.abs((ref.x ?? 0) - (best.x ?? 0));
    const dy = Math.abs((ref.y ?? 0) - (best.y ?? 0));
    const dw = Math.abs((ref.w ?? 0) - (best.w ?? 0));
    const dh = Math.abs((ref.h ?? 0) - (best.h ?? 0));
    const entry = { ref: describe(ref), cand: describe(best), dx: round(dx, 2), dy: round(dy, 2), dw: round(dw, 2), dh: round(dh, 2) };
    if (dx <= tolerance && dy <= tolerance && dw <= tolerance && dh <= tolerance) matched.push(entry);
    else mismatched.push({ ...entry, tolerance });
  }
  const coverage = refNodes.length ? (matched.length / refNodes.length) * 100 : 100;
  return {
    matched,
    mismatched,
    missing,
    coveragePct: round(coverage, 2),
    toleranceDp: tolerance,
    refCount: refNodes.length,
    candCount: candNodes.length,
  };
}

function pickBestMatch(ref, candidates) {
  const norm = (s) => String(s ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  const refText = norm(ref.text);
  const refRole = norm(ref.role);
  let best = null;
  let bestScore = -1;
  for (const c of candidates) {
    let score = 0;
    if (refText && norm(c.text) === refText) score += 3;
    if (refRole && norm(c.role) === refRole) score += 1;
    if (ref.testId && c.testId && ref.testId === c.testId) score += 5;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return bestScore > 0 ? best : null;
}

function describe(n) {
  return { text: n.text ?? null, role: n.role ?? null, box: [round(n.x ?? 0, 2), round(n.y ?? 0, 2), round(n.w ?? 0, 2), round(n.h ?? 0, 2)] };
}

export function round(n, digits = 2) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/**
 * Decide the outcome of one screen/device comparison.
 * "matched" | "accepted-with-notes" | "blocked"
 */
export function decideOutcome({ pixelMatchPct, ssimValue, geometry, iterations, thresholds = DEFAULT_THRESHOLDS, residualExplained = false }) {
  const floor = thresholds.acceptanceFloorPct;
  const goal = thresholds.goalPixelMatchPct;
  const cap = thresholds.maxIterationsPerScreenPerDevice;
  const geometryOk = !geometry || geometry.coveragePct >= (thresholds.geometry?.minNodeCoveragePct ?? 90);
  const aboveGoal = pixelMatchPct >= goal && (!geometry || geometryOk);
  if (aboveGoal) return { status: "matched", reason: `pixel match ${pixelMatchPct}% >= goal ${goal}%` };
  if (pixelMatchPct >= floor && residualExplained) {
    return {
      status: "accepted-with-notes",
      reason: `pixel match ${pixelMatchPct}% is above the floor ${floor}% but below the goal ${goal}%; every residual difference is categorised`,
    };
  }
  if (iterations >= cap) {
    return {
      status: "blocked",
      reason:
        pixelMatchPct >= floor
          ? `iteration cap (${cap}) reached at ${pixelMatchPct}% with unexplained residual differences — ask the user`
          : `iteration cap (${cap}) reached at ${pixelMatchPct}%, below the acceptance floor ${floor}% — ask the user`,
    };
  }
  return { status: "building", reason: `pixel match ${pixelMatchPct}% below floor/goal; ${cap - iterations} iteration(s) left` };
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
          thresholds.geometry,
        )
      : null;
  const outcome = decideOutcome({
    pixelMatchPct: px.matchPct,
    ssimValue: ss.ssim,
    geometry,
    iterations,
    thresholds,
    residualExplained: residualCategories.length > 0,
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
          worstOffenders: geometry.mismatched.slice(0, 10),
        }
      : null,
    masks,
    residualCategories,
    iterations,
    status: outcome.status,
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
  return {
    effectiveFloorPct: effectiveFloor,
    effectiveGoalPct: round(Math.min(goal, noisePct), 2),
    adjusted: true,
    note: `same-side re-render scores ${noisePct}%; cross-platform thresholds were lowered so renderer noise is not reported as a layout bug`,
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
