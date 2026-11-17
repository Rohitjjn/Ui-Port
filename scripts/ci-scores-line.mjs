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

const file = process.argv[2] ?? ".uiport/diffs/summary.json";
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
process.stdout.write(`${summary.device ?? "?"}: ${rows.join(" | ")}\n`);
