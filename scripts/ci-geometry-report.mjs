#!/usr/bin/env node
/**
 * Per-node geometry table, for a job that has annotation budget to spare.
 *
 * The diff step spends a job's 50 annotations on three samples per screen, which is enough to see
 * that a screen fails and not enough to see why: a 0% coverage screen has 25-80 nodes, and the fix
 * lives in the rows the samples did not print. Artifacts hold the full data but are not readable
 * from every environment — they were not readable from mine.
 *
 * So this prints one annotation per node: both boxes, the four deltas, and which side owns the
 * text. It runs in a *separate job*, which is what gets it a fresh 50 — the limit is per job, not
 * per workflow, and that is the only reason this is affordable.
 *
 *   node scripts/ci-geometry-report.mjs --reference <dir> --candidate <dir> --device phone
 *        [--screen home] [--limit 40] [--json]
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { canonicalNodes, compareGeometry, loadThresholds } from "./lib/geometry.mjs";

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = args[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
};

const device = String(flag("device", "phone"));
const artifactDir = flag("from-artifact", null);

/**
 * Find the two directories the report needs inside a downloaded artifact.
 *
 * An uploaded artifact is rooted at the least common ancestor of the paths that were uploaded, so
 * `.uiport/reference/**` plus `.uiport/output/**` arrives as `reference/...` and `output/...`, but a
 * different listing can arrive as `.uiport/reference/...`. Fixed paths therefore break whenever the
 * upload list changes, and they break *quietly* — the job reports "nothing to read" and looks like
 * a passing run with nothing to say. Searching for the directories is immune to the layout.
 */
export function resolveRoots({ artifactDir, device, reference, candidate }) {
  if (reference && candidate) return { reference, candidate };
  const search = (base, name, depth = 0) => {
    if (depth > 4) return null;
    let entries;
    try {
      entries = fs.readdirSync(base, { withFileTypes: true });
    } catch {
      return null;
    }
    // A directory is the right one when it contains the device subdirectory: `reference/phone`.
    if (entries.some((e) => e.isDirectory() && e.name === device) && base.split(path.sep).includes(name)) return base;
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const found = search(path.join(base, e.name), name, depth + 1);
      if (found) return found;
    }
    return null;
  };
  const root = artifactDir ? path.resolve(String(artifactDir)) : null;
  if (!root) return { error: "no --reference/--candidate and no --from-artifact to search" };
  const found = { reference: search(root, "reference"), candidate: search(root, "output") };
  if (!found.reference) return { error: `no reference/${device} under ${root}` };
  if (!found.candidate) return { error: `no output/${device} under ${root}` };
  return found;
}

function main() {
  const roots = resolveRoots({
    artifactDir,
    device,
    reference: flag("reference", null),
    candidate: flag("candidate", null),
  });
  if (roots.error) {
    process.stderr.write(`ci-geometry-report: ${roots.error}\n`);
    process.exit(2);
  }
  const referenceDir = roots.reference;
  const candidateDir = roots.candidate;
  const onlyScreen = flag("screen", null);
  const limit = Number(flag("limit", 40));
  const asJson = Boolean(flag("json", false));

  const thresholds = loadThresholds(path.resolve(import.meta.dirname, "..", "config", "thresholds.json"));
  const tolerance = thresholds.geometry?.toleranceDp ?? 1;

  const readJsonMaybe = (file) => {
    try {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      return null;
    }
  };

  const refRoot = path.join(referenceDir, device);
  if (!fs.existsSync(refRoot)) {
    process.stderr.write(`ci-geometry-report: no reference at ${refRoot}\n`);
    process.exit(2);
  }

  const screens = fs
    .readdirSync(refRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => !onlyScreen || name === onlyScreen)
    .sort();

  // Shared by the row builder and the printer: the same box in both places, so a reader cannot
  // mistake one for a different measurement.
  const box = (b) => (b ? `[${b[0]},${b[1]} ${b[2]}x${b[3]}]` : "—");

  const out = [];
  for (const screen of screens) {
    const refGeom = readJsonMaybe(path.join(refRoot, screen, "default.geometry.json"));
    const candGeom = readJsonMaybe(path.join(candidateDir, device, screen, "default.semantics.json"));
    if (!refGeom || !candGeom) {
      out.push({ screen, error: !refGeom ? "no reference geometry" : "no candidate semantics — not measured is not a pass" });
      continue;
    }
    const comparison = compareGeometry(refGeom, candGeom, { ...thresholds.geometry, canonical: true });
    const rows = [
      ...comparison.mismatched.map((m) => ({
        kind: "mismatch",
        text: m.ref.text ?? m.ref.role ?? "(unnamed)",
        ref: m.ref.box,
        cand: m.cand.box,
        d: [m.dx, m.dy, m.dw, m.dh],
        against: m.matchedAgainst ?? "self",
        worst: Math.max(m.dx, m.dy, m.dw, m.dh),
      })),
      ...comparison.missing.map((m) => ({
        kind: "missing",
        text: m.node.text ?? m.node.role ?? "(unnamed)",
        ref: m.node.box ?? null,
        cand: null,
        d: null,
        worst: Infinity,
      })),
    ].sort((a, b) => b.worst - a.worst);

    out.push({
      screen,
      // A screen with rows and a screen with no rows look identical in an annotation list, and
      // "no rows" is what "not reported" has meant twice now. Count the canonical sets too, so an
      // empty comparison is visible as an empty comparison rather than as a clean one.
      canonical: {
        reference: canonicalNodes(refGeom).length,
        candidate: canonicalNodes(candGeom).length,
      },
      coveragePct: comparison.coveragePct,
      counts: {
        reference: comparison.refCount,
        candidate: comparison.candCount,
        matched: comparison.matched.length,
        mismatched: comparison.mismatched.length,
        missing: comparison.missing.length,
      },
      deltaSummary: comparison.deltaSummary,
      // Mismatches first, worst first: a reader who stops after three lines should have seen the
      // three rows that matter most.
      rows: rows.slice(0, limit),
      rowsTotal: rows.length,
    });
  }

  if (asJson) {
    process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
    process.exit(0);
  }

  // Annotation-friendly output: one line per row, prefixed with the GitHub command.
  const lines = [];
  for (const s of out) {
    if (s.error) {
      lines.push(`::error title=geometry ${s.screen}::${s.error}`);
      continue;
    }
    const c = s.counts;
    const head = `ref=${c.reference} cand=${c.candidate} matched=${c.matched} mismatched=${c.mismatched} missing=${c.missing} coverage=${s.coveragePct}% canonical=${s.canonical.reference}/${s.canonical.candidate} rows=${s.rowsTotal}`;
    lines.push(`::notice title=geometry ${s.screen} (${device})::${head}`);
    for (const r of s.rows) {
      if (r.kind === "missing") {
        lines.push(`::notice title=${s.screen} missing::"${String(r.text).slice(0, 34)}" ref${box(r.ref)} has no candidate node with the same text`);
        continue;
      }
      // `slowest` notes when the comparison used an ancestor box, because a label matched against
      // its enclosing row is a different claim than the label itself being off.
      const via = r.against && r.against !== "self" ? ` via ${r.against}` : "";
      lines.push(
        `::notice title=${s.screen} off::"${String(r.text).slice(0, 34)}" ref${box(r.ref)} cand${box(r.cand)} d=(${r.d.join(",")})${via}`,
      );
    }
    if (s.rowsTotal > s.rows.length) lines.push(`::notice title=${s.screen} truncated::${s.rowsTotal - s.rows.length} more row(s), raise --limit`);
  }
  process.stdout.write(`${lines.join("\n")}\n`);

}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  main();
}
