#!/usr/bin/env node
/**
 * Compare a web reference screenshot with a Compose screenshot.
 *
 *   node scripts/visual-diff.mjs \
 *     --reference .uiport/reference/phone/home/default.png \
 *     --candidate .uiport/output/phone/home/default.png \
 *     --ref-geometry .uiport/reference/phone/home/geometry.json \
 *     --cand-geometry .uiport/output/phone/home/semantics.json \
 *     --screen home --device phone --out .uiport/output/phone/home [--iterations 2]
 *
 *   node scripts/visual-diff.mjs --calibrate a.png b.png      # noise floor
 */
import path from "node:path";
import process from "node:process";
import fs from "node:fs";
import {
  calibrateNoiseFloor,
  compareScreens,
  decodePng,
  heatMap,
  loadThresholds,
  renderReport,
} from "./lib/diff.mjs";

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = args[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
};

const thresholdsFile = flag("thresholds", path.resolve(import.meta.dirname, "..", "config", "thresholds.json"));
const thresholds = loadThresholds(thresholdsFile);

if (args.includes("--calibrate")) {
  const i = args.indexOf("--calibrate");
  const a = args[i + 1];
  const b = args[i + 2];
  if (!a || !b) {
    process.stderr.write("usage: visual-diff.mjs --calibrate <a.png> <b.png>\n");
    process.exit(2);
  }
  const result = calibrateNoiseFloor({ sameSideA: a, sameSideB: b, thresholds });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.identical) process.exitCode = 4;
  process.exit(0);
}

const reference = flag("reference");
const candidate = flag("candidate");
if (!reference || !candidate) {
  process.stderr.write("usage: visual-diff.mjs --reference a.png --candidate b.png [--screen name] [--device phone] [--out dir]\n");
  process.exit(2);
}

let masks = [];
if (flag("masks")) {
  try {
    masks = JSON.parse(fs.readFileSync(flag("masks"), "utf8"));
  } catch (err) {
    process.stderr.write(`cannot read masks file: ${err.message}\n`);
    process.exit(2);
  }
}

let residualCategories = [];
if (flag("residual")) {
  residualCategories = String(flag("residual"))
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const result = compareScreens({
  referenceFile: reference,
  candidateFile: candidate,
  referenceGeometryFile: flag("ref-geometry"),
  candidateGeometryFile: flag("cand-geometry"),
  masks,
  outputDir: flag("out"),
  thresholds,
  iterations: Number(flag("iterations", 0)),
  residualCategories,
  screenName: String(flag("screen", path.basename(reference, ".png"))),
  device: String(flag("device", "phone")),
});

// Optional heat map, alongside the pixelmatch diff image.
const heatFile = flag("heat");
if (heatFile) {
  const ref = decodePng(fs.readFileSync(reference));
  const cand = decodePng(fs.readFileSync(candidate));
  const hm = heatMap(ref, cand);
  fs.mkdirSync(path.dirname(path.resolve(heatFile)), { recursive: true });
  const { PNG } = await import("pngjs");
  fs.writeFileSync(path.resolve(heatFile), PNG.sync.write(hm));
}

if (flag("json")) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
else process.stdout.write(`${renderReport(result)}\n`);

// Exit codes are the contract with the port loop:
//   0 = matched, 3 = accepted-with-notes, 5 = still building, 6 = blocked
const code = { matched: 0, "accepted-with-notes": 3, building: 5, blocked: 6 }[result.status] ?? 5;
process.exitCode = code;
