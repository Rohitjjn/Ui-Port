#!/usr/bin/env node
/**
 * Prints one line with every screen's score, for a CI annotation.
 *
 * Why a script rather than an inline `node -e`: the workflow's `run:` block has already lost
 * output twice to nested-quote mistakes, and an annotation is the only part of a run that is
 * readable from every environment. A file can be tested; a shell fragment cannot.
 *
 *   node scripts/ci-scores-line.mjs [.uiport/diffs/summary.json]
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
const rows = (summary.results ?? []).map((s) => {
  const gates = s.gates ? Object.entries(s.gates).map(([k, v]) => `${k}=${v.pass ? "pass" : "fail"}`).join(",") : "gates=?";
  const residuals = (s.residualCategories ?? []).join(",") || "none";
  return (
    `${s.screen} ${s.status} pixel=${s.pixelMatchPct ?? "-"} ssim=${s.ssim ?? "-"} ` +
    `geom=${s.geometryCoveragePct ?? "-"} iter=${s.iterations ?? 0} resid=${residuals} [${gates}]`
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
