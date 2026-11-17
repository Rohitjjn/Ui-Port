#!/usr/bin/env node
/**
 * Measure the renderer's noise floor.
 *
 * Two independent captures of the same screens are diffed against each other. Whatever
 * they disagree about is not a porting defect — it is the noise of the machine (font
 * hinting, subpixel rounding, rasteriser differences). The acceptance thresholds are
 * calibrated from that number: a port is never asked to beat the renderer's own
 * reproducibility.
 *
 *   node scripts/noise-floor.mjs --a .uiport/reference-a --b .uiport/reference-b \
 *     --spec .uiport/capture-spec.json --json .uiport/noise-floor.json --md .uiport/noise-floor.md
 *
 * Exit 0 measured, 2 usage/input error, 4 the capture is not deterministic enough to
 * judge a port (the two runs differ by more than `noiseFloor.webVsWebMinPct` allows).
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { compareGeometry, loadThresholds } from "./lib/geometry.mjs";
import { assertSameSize, calibrateNoiseFloor, decodePng, pixelDiff, ssimScore } from "./lib/diff.mjs";
import { readJsonSafe, writeJsonAtomic } from "./lib/fs-utils.mjs";

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = args[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
};

const EXIT_BAD_INPUT = 2;
const EXIT_NON_DETERMINISTIC = 4;

const aRoot = flag("a");
const bRoot = flag("b");
const specFile = flag("spec");
if (!aRoot || !bRoot || !specFile) {
  process.stderr.write("noise-floor: --a <runA> --b <runB> --spec <capture-spec.json> are required\n");
  process.exit(EXIT_BAD_INPUT);
}

const specRes = readJsonSafe(path.resolve(String(specFile)));
if (!specRes.ok) {
  process.stderr.write(`noise-floor: cannot read spec: ${specRes.error}\n`);
  process.exit(EXIT_BAD_INPUT);
}

const config = readJsonSafe(path.resolve(flag("thresholds", path.join(import.meta.dirname, "..", "config", "thresholds.json"))));
const thresholds = loadThresholds(flag("thresholds", null));
const minSameSidePct = config.ok ? (config.value?.visual?.noiseFloor?.webVsWebMinPct ?? 99.5) : 99.5;

const spec = specRes.value;
const perScreen = [];
const skipped = [];

for (const capture of spec.captures ?? []) {
  for (const state of capture.states ?? ["default"]) {
    const rel = path.join(capture.device, capture.id, `${state}.png`);
    const a = path.join(path.resolve(String(aRoot)), rel);
    const b = path.join(path.resolve(String(bRoot)), rel);
    if (!fs.existsSync(a) || !fs.existsSync(b)) {
      skipped.push({ screen: capture.id, device: capture.device, state, reason: "capture missing in one of the runs" });
      continue;
    }
    const pngA = decodePng(fs.readFileSync(a));
    const pngB = decodePng(fs.readFileSync(b));
    assertSameSize(pngA, pngB);
    const px = pixelDiff(pngA, pngB, thresholds.pixelmatch);
    const ss = ssimScore(pngA, pngB, thresholds.ssim);

    // Geometry noise matters too: two captures of the same page should report identical
    // boxes, so any wobble here is a source of phantom "element moved" findings.
    const geoA = readJsonSafe(path.join(path.resolve(String(aRoot)), capture.device, capture.id, `${state}.geometry.json`));
    const geoB = readJsonSafe(path.join(path.resolve(String(bRoot)), capture.device, capture.id, `${state}.geometry.json`));
    const geometry =
      geoA.ok && geoB.ok ? compareGeometry(geoA.value, geoB.value, thresholds.geometry) : null;

    perScreen.push({
      screen: capture.id,
      device: capture.device,
      state,
      matchPct: px.matchPct,
      ssim: ss.ssim,
      changedPixels: px.changed,
      totalPixels: px.total,
      geometryMismatched: geometry ? geometry.mismatched.length : null,
      geometryCoveragePct: geometry ? geometry.coveragePct : null,
    });
  }
}

if (!perScreen.length) {
  process.stderr.write("noise-floor: no comparable capture pairs were found\n");
  process.exit(EXIT_BAD_INPUT);
}

// The worst screen defines the noise floor: a screen that wobbles by 0.6% must not be
// judged by the 0.1% wobble of a screen that happens to be a solid colour.
const worst = perScreen.reduce((w, s) => (s.matchPct < w.matchPct ? s : w), perScreen[0]);
// calibrateNoiseFloor diffs two PNG files of the same screen; the worst screen is the
// one whose reproducibility decides the floor.
const worstRel = path.join(worst.device, worst.screen, `${worst.state}.png`);
const calibration = calibrateNoiseFloor({
  sameSideA: path.join(path.resolve(String(aRoot)), worstRel),
  sameSideB: path.join(path.resolve(String(bRoot)), worstRel),
  thresholds,
});
const deterministic = worst.matchPct >= minSameSidePct;

const report = {
  generatedAt: new Date().toISOString(),
  runA: path.resolve(String(aRoot)),
  runB: path.resolve(String(bRoot)),
  screens: perScreen.length,
  skipped,
  worstScreen: { screen: worst.screen, device: worst.device, matchPct: worst.matchPct },
  worstSameSideMatchPct: worst.matchPct,
  noisePct: Number((100 - worst.matchPct).toFixed(4)),
  minSameSidePct,
  deterministic,
  configuredFloorPct: thresholds.acceptanceFloorPct,
  effectiveFloorPct: calibration.effectiveFloorPct,
  goalPct: thresholds.goalPixelMatchPct,
  effectiveGoalPct: calibration.effectiveGoalPct,
  calibrationNote: calibration.note,
  perScreen,
};

if (flag("json")) writeJsonAtomic(path.resolve(String(flag("json"))), report);

const md = [
  "# Noise floor",
  "",
  `Two independent captures of the same ${report.screens} screen(s), diffed against each other.`,
  "",
  "| Metric | Value |",
  "| --- | --- |",
  `| Worst screen | ${worst.screen} (${worst.device}) |`,
  `| Worst same-side pixel match | ${report.worstSameSideMatchPct}% |`,
  `| Measured noise | ${report.noisePct}% |`,
  `| Required minimum (web vs web) | ${minSameSidePct}% |`,
  `| Deterministic enough to judge a port | ${deterministic ? "yes" : "**no**"} |`,
  `| Configured acceptance floor | ${report.configuredFloorPct}% |`,
  `| Effective acceptance floor | ${report.effectiveFloorPct}% |`,
  `| Configured fidelity goal | ${report.goalPct}% |`,
  `| Effective fidelity goal | ${report.effectiveGoalPct}% |`,
  "",
  `Calibration: ${calibration.note}.`,
  "",
  "| Screen | Device | Match | SSIM | Changed px | Geometry mismatches |",
  "| --- | --- | --- | --- | --- | --- |",
  ...perScreen.map(
    (s) =>
      `| ${s.screen} | ${s.device} | ${s.matchPct}% | ${s.ssim} | ${s.changedPixels}/${s.totalPixels} | ${s.geometryMismatched ?? "-"} |`,
  ),
];
if (skipped.length) {
  md.push("", "Skipped:", "", ...skipped.map((s) => `- ${s.screen} (${s.device}, ${s.state}): ${s.reason}`));
}
if (flag("md")) fs.writeFileSync(path.resolve(String(flag("md"))), `${md.join("\n")}\n`);

process.stdout.write(
  `noise-floor: ${report.screens} pair(s), worst ${report.worstSameSideMatchPct}% (noise ${report.noisePct}%), ` +
    `effective floor ${report.effectiveFloorPct}%, deterministic: ${deterministic}\n`,
);

if (!deterministic) {
  process.stderr.write(
    `noise-floor: two captures of the same page differ by ${report.noisePct}%, above the ${(100 - minSameSidePct).toFixed(1)}% ` +
      "that is tolerable. Fix capture determinism (fonts, animation freezing, DPR) before judging any port.\n",
  );
  process.exit(EXIT_NON_DETERMINISTIC);
}
