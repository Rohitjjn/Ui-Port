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
 * One annotation has to carry the whole diagnosis, because the budget is 50 per job and the diff
 * step has already spent most of it. So this is not a summary of the sentence — it is the numbers
 * that decide the next fix:
 *
 *   scattered(near3/16, dw2 dh1, "COLLECTION" ref[16,16 82x16] cand[16,16 79x15])
 *
 * nearest/furthest = how close the best and worst node came to passing, in dp. `dw2 dh1` = how
 * many nodes were over tolerance per dimension, which separates placement from sizing. The box
 * pair names one real node with both boxes: a candidate that is 3 dp narrower is text metrics, one
 * 40 dp to the left is placement. The full sentence stays in the report.
 */
function shortShape(delta) {
  const parts = [];
  if (delta.nearest !== undefined) parts.push(`near${delta.nearest}/${delta.furthest}`);
  if (delta.over) {
    const over = Object.entries(delta.over)
      .filter(([, n]) => n > 0)
      .map(([d, n]) => `${d}${n}`);
    if (over.length) parts.push(over.join(" "));
  }
  const first = delta.closest?.[0];
  if (first?.ref && first?.cand) {
    const box = (b) => `[${b[0]},${b[1]} ${b[2]}x${b[3]}]`;
    parts.push(`"${first.text ?? "?"}" ref${box(first.ref)} cand${box(first.cand)}`);
  }
  return parts.length ? `${delta.signature}(${parts.join(", ")})` : delta.signature;
}
const rows = (summary.results ?? []).map((s) => {
  const gates = s.gates ? Object.entries(s.gates).map(([k, v]) => `${k}=${v.pass ? "pass" : "fail"}`).join(",") : "gates=?";
  const residuals = (s.residualCategories ?? []).join(",") || "none";
  // Compact on purpose: the whole table has to survive as one annotation, and a signature is
  // worth more than a sentence when the alternative is that it is not seen at all.
  const shape = s.geometryShape ? ` shape=${shortShape(s.geometryShape)}` : "";
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
    .filter((s) => s.geometryShape || s.geometryDelta)
    .map((s) => `${s.screen}: ${s.geometryShape ? shortShape(s.geometryShape) : s.geometryDelta}`);
  if (!parts.length) {
    process.stdout.write(`no geometry shape to report: ${(summary.results ?? []).filter((s) => s.geometryCoveragePct != null).length} screen(s) measured geometry and none has a failure signature\n`);
  } else {
    process.stdout.write(`${parts.join(" | ")}\n`);
  }
} else {
  process.stdout.write(`${summary.device ?? "?"}: ${rows.join(" | ")}\n`);
}
