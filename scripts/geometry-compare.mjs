#!/usr/bin/env node
/**
 * Compare a web geometry dump with a Compose semantics dump — no images involved.
 *
 * This answers a different question from `visual-diff.mjs`: when two screenshots
 * differ, "which element moved?" instead of "how many pixels changed?". It is fast
 * enough to run on every iteration, and it is the only check that can name a
 * mismatch in dp.
 *
 *   node scripts/geometry-compare.mjs \
 *     --ref .uiport/reference/phone/home/default.geometry.json \
 *     --cand .uiport/output/phone/home/default.semantics.json \
 *     [--json out.json] [--md out.md] [--tolerance 1.0] [--only-mismatched]
 *
 * Exit codes: 0 all compared nodes within tolerance, 3 mismatches, 2 usage/read error.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
// Imported from the dependency-free module on purpose: this CLI must work on a bare
// Node install, without pngjs/pixelmatch/ssim, because it decodes no images.
import { compareGeometry, loadThresholds, round } from "./lib/geometry.mjs";
import { readJsonSafe, writeJsonAtomic } from "./lib/fs-utils.mjs";

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = args[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
};

const EXIT_MISMATCH = 3;

const refFile = flag("ref");
const candFile = flag("cand");
if (!refFile || !candFile) {
  process.stderr.write("geometry-compare: --ref <web geometry.json> and --cand <compose semantics.json> are required\n");
  process.exit(2);
}

const readNodes = (file, label) => {
  const res = readJsonSafe(path.resolve(String(file)));
  if (!res.ok) {
    process.stderr.write(`geometry-compare: cannot read ${label} ${file}: ${res.error}\n`);
    process.exit(2);
  }
  if (!Array.isArray(res.value)) {
    process.stderr.write(`geometry-compare: ${label} ${file} is not a JSON array of nodes\n`);
    process.exit(2);
  }
  return res.value;
};

const refNodes = readNodes(refFile, "reference");
const candNodes = readNodes(candFile, "candidate");

const thresholds = loadThresholds(flag("thresholds", null));
const tolerance = Number(flag("tolerance", thresholds.geometry.toleranceDp));
const opts = { ...thresholds.geometry, toleranceDp: tolerance };

const result = compareGeometry(refNodes, candNodes, opts);
const onlyMismatched = Boolean(flag("only-mismatched", false));

const summary = {
  reference: path.resolve(String(refFile)),
  candidate: path.resolve(String(candFile)),
  toleranceDp: tolerance,
  referenceNodes: refNodes.length,
  candidateNodes: candNodes.length,
  matched: result.matched.length,
  mismatched: result.mismatched.length,
  missing: result.missing.length,
  coveragePct: result.coveragePct,
  coverageFloorPct: thresholds.geometry.minNodeCoveragePct,
  worst: result.mismatched
    .slice()
    .sort((a, b) => maxDelta(b) - maxDelta(a))
    .slice(0, 15),
};

const label = (node) => String(node?.text ?? node?.testId ?? node?.role ?? "node").slice(0, 48);

function maxDelta(node) {
  return Math.max(Math.abs(node.dx ?? 0), Math.abs(node.dy ?? 0), Math.abs(node.dw ?? 0), Math.abs(node.dh ?? 0));
}

const jsonOut = flag("json");
if (jsonOut) writeJsonAtomic(path.resolve(String(jsonOut)), summary);

const mdOut = flag("md");
if (mdOut) {
  const lines = [
    "# Geometry comparison",
    "",
    `- reference nodes: ${summary.referenceNodes}`,
    `- candidate nodes: ${summary.candidateNodes}`,
    `- matched: ${summary.matched}, mismatched: ${summary.mismatched}, missing: ${summary.missing}`,
    `- coverage: ${summary.coveragePct}% (floor ${thresholds.geometry.minNodeCoveragePct}%)`,
    `- tolerance: ${tolerance} dp`,
    "",
    "Missing means no Compose node carried the same text/role — usually an element that was not",
    "ported, or one whose text was reworded. Mismatched means it exists but moved.",
    "",
    "| Element | dx | dy | dw | dh |",
    "| --- | --- | --- | --- | --- |",
    ...(summary.worst.length
      ? summary.worst.map(
          (n) =>
            `| ${label(n.ref)} ${JSON.stringify(n.ref.box)} -> ${JSON.stringify(n.cand.box)} ` +
            `| ${round(n.dx ?? 0)} | ${round(n.dy ?? 0)} | ${round(n.dw ?? 0)} | ${round(n.dh ?? 0)} |`,
        )
      : ["| _no mismatches_ | - | - | - | - |"]),
  ];
  fs.mkdirSync(path.dirname(path.resolve(String(mdOut))), { recursive: true });
  fs.writeFileSync(path.resolve(String(mdOut)), `${lines.join("\n")}\n`);
}

process.stdout.write(
  `geometry-compare: ${summary.matched} matched, ${summary.mismatched} mismatched, ${summary.missing} missing, ` +
    `coverage ${summary.coveragePct}% (tolerance ${tolerance} dp)\n`,
);

if (!onlyMismatched) {
  // A plain listing is useful when a human is reading the terminal.
  for (const n of summary.worst.slice(0, 10)) {
    process.stdout.write(
      `  ${label(n.ref).padEnd(48)} ` +
        `dx=${round(n.dx ?? 0).toString().padStart(7)} dy=${round(n.dy ?? 0).toString().padStart(7)} ` +
        `dw=${round(n.dw ?? 0).toString().padStart(7)} dh=${round(n.dh ?? 0).toString().padStart(7)}\n`,
    );
  }
}

for (const m of result.missing.slice(0, 5)) {
  process.stdout.write(`  missing in candidate: ${label(m.node)} — ${m.reason}\n`);
}

if (summary.mismatched > 0 || summary.coveragePct < thresholds.geometry.minNodeCoveragePct) {
  process.exit(EXIT_MISMATCH);
}
