#!/usr/bin/env node
/**
 * Prints one line with every screen's score, for a CI annotation.
 *
 * Why a script rather than an inline `node -e`: the workflow's `run:` block has already lost
 * output twice to nested-quote mistakes, and an annotation is the only part of a run that is
 * readable from every environment. A file can be tested; a shell fragment cannot.
 *
 *   node scripts/ci-scores-line.mjs [.uiport/diffs/summary.json] [--shapes]
 *
 * The line carries each screen's geometry *failure signature* inline when there is one, because
 * the annotation budget is per job (50), not per step: a separate shapes notice in a later step
 * was silently dropped when the diff step had already spent the budget on geometry detail.
 * One line, one annotation, nothing to compete with. `--shapes` prints only the signatures, for
 * use from a terminal.
 */
import fs from "node:fs";
import process from "node:process";

const args = process.argv.slice(2);
const shapes = args.includes("--shapes");
const file = args.find((a) => !a.startsWith("--")) ?? ".uiport/diffs/summary.json";
if (!fs.existsSync(file)) {
  process.stderr.write(`ci-scores-line: no summary at ${file}\n`);
  process.exit(2);
}
const summary = JSON.parse(fs.readFileSync(file, "utf8"));

/**
 * `systematic-offset — 100% of mismatched nodes sit within 0.5 dp of dx=0 dp, dy=2.1 dp` becomes
 * `systematic-offset(dx0,dy2.1)`. The sentence stays in the report; the annotation only has room
 * for the numbers that decide the next fix.
 */
function shortShape(text) {
  const signature = String(text).split("—")[0].trim().replace(/\s+/g, "-");
  const dx = /dx=(-?[\d.]+) dp/.exec(text)?.[1];
  const dy = /dy=(-?[\d.]+) dp/.exec(text)?.[1];
  const dw = /dw=(-?[\d.]+) dp/.exec(text)?.[1];
  const dh = /dh=(-?[\d.]+) dp/.exec(text)?.[1];
  const parts = [];
  if (dx !== undefined) parts.push(`dx${dx}`);
  if (dy !== undefined) parts.push(`dy${dy}`);
  if (dw !== undefined) parts.push(`dw${dw}`);
  if (dh !== undefined) parts.push(`dh${dh}`);
  return parts.length ? `${signature}(${parts.join(",")})` : signature;
}
const rows = (summary.results ?? []).map((s) => {
  const gates = s.gates ? Object.entries(s.gates).map(([k, v]) => `${k}=${v.pass ? "pass" : "fail"}`).join(",") : "gates=?";
  const residuals = (s.residualCategories ?? []).join(",") || "none";
  // Compact on purpose: the whole table has to survive as one annotation, and a signature is
  // worth more than a sentence when the alternative is that it is not seen at all.
  const shape = s.geometryDelta ? ` shape=${shortShape(s.geometryDelta)}` : "";
  return (
    `${s.screen} ${s.status} pixel=${s.pixelMatchPct ?? "-"} ssim=${s.ssim ?? "-"} ` +
    `geom=${s.geometryCoveragePct ?? "-"} iter=${s.iterations ?? 0} resid=${residuals} [${gates}]${shape}`
  );
});
// `--shapes` prints the failure signature instead of the scores, one line for all screens.
// It lives here rather than in the diff step because a step keeps only its first 50 annotations:
// the geometry detail in that step is 40+ lines and silently swallowed these the first time.
// Two small steps with one line each always survive.
if (shapes) {
  const parts = (summary.results ?? [])
    .filter((s) => s.geometryDelta)
    .map((s) => `${s.screen}: ${s.geometryDelta}`);
  if (!parts.length) {
    process.stdout.write(`no geometry shape to report: ${(summary.results ?? []).filter((s) => s.geometryCoveragePct != null).length} screen(s) measured geometry and none has a failure signature\n`);
  } else {
    process.stdout.write(`${parts.join(" | ")}\n`);
  }
} else {
  process.stdout.write(`${summary.device ?? "?"}: ${rows.join(" | ")}\n`);
}
