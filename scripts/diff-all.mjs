#!/usr/bin/env node
/**
 * Diff every captured screen for a device in one command, and maintain a baseline.
 *
 *   node scripts/diff-all.mjs --device phone \
 *     --reference .uiport/reference --candidate .uiport/output \
 *     --out .uiport/output --tolerance 0.15 [--calibrate] [--baseline .uiport/baseline.json]
 *
 * `--calibrate` compares reference against candidate as a same-side re-render check and
 * reports the noise floor instead of screen verdicts.
 *
 * Exit codes: 0 all matched/accepted, 3 some accepted with notes, 5 still building,
 * 6 something blocked, 1 usage/harness error.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { compareScreens, loadThresholds, renderReport } from "./lib/diff.mjs";
import { readJsonSafe, toPosix, walk, writeJsonAtomic } from "./lib/fs-utils.mjs";

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = args[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
};

const device = String(flag("device", "phone"));
const referenceRoot = path.resolve(String(flag("reference", ".uiport/reference")));
const candidateRoot = path.resolve(String(flag("candidate", ".uiport/output")));
const outRoot = flag("out") ? path.resolve(String(flag("out"))) : candidateRoot;
const tolerance = Number(flag("tolerance", 0.15));
const calibrate = Boolean(flag("calibrate", false));
const baselineFile = path.resolve(String(flag("baseline", ".uiport/baseline.json")));
const updateBaseline = Boolean(flag("update-baseline", false));
const thresholds = loadThresholds(path.resolve(import.meta.dirname, "..", "config", "thresholds.json"));

const refDir = path.join(referenceRoot, device);
if (!fs.existsSync(refDir)) {
  process.stderr.write(`diff-all: no reference directory for "${device}" at ${toPosix(path.relative(process.cwd(), refDir))}\n`);
  process.exit(1);
}

const screens = fs
  .readdirSync(refDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

if (!screens.length) {
  process.stderr.write(`diff-all: no screens captured for "${device}"\n`);
  process.exit(1);
}

/** Candidate layouts vary: .uiport/output/<device>/<screen>/ or .uiport/output/<screen>/. */
function candidateDirFor(screen) {
  const withDevice = path.join(candidateRoot, device, screen);
  if (fs.existsSync(withDevice)) return withDevice;
  const withoutDevice = path.join(candidateRoot, screen);
  if (fs.existsSync(withoutDevice)) return withoutDevice;
  return withDevice;
}

/**
 * Per-screen port-loop bookkeeping, kept next to the state file the port loop writes.
 *
 * `iterations` is what the cap is enforced against, and `residuals` is what the acceptance gate
 * needs. Both are read from disk rather than assumed, so a run cannot accept a screen by
 * forgetting how many times it has been tried or by declaring no residual.
 */
const portStateRes = readJsonSafe(path.resolve(flag("state", ".uiport/state.json")));
const portState = portStateRes.ok ? portStateRes.value : null;
const SKIP_RESIDUALS = new Set(["harness"]);

function loopInfo(screen, device) {
  const key = `${screen}::${device}`;
  const counts = portState?.iterationCounts ?? {};
  const residuals = portState?.residuals ?? {};
  const raw = counts[key] ?? 0;
  // Harness fixes (capture, fonts, viewport, diff config) are not port iterations: they are
  // logged separately and excluded here, because counting them would let a broken harness burn
  // a screen's budget before any layout work happened.
  const harness = (portState?.harnessFixes?.[key] ?? []).length;
  return {
    iterations: Math.max(0, raw - harness),
    harnessFixes: harness,
    residualCategories: residuals[key]?.categories ?? [],
  };
}

const baselineRes = readJsonSafe(baselineFile);
const baseline = baselineRes.ok ? baselineRes.value : { schemaVersion: 1, scores: {} };

const results = [];
const regressions = [];

for (const screen of screens) {
  const refPng = path.join(refDir, screen, "default.png");
  if (!fs.existsSync(refPng)) continue;
  const candDir = candidateDirFor(screen);
  const candPng = path.join(candDir, "default.png");
  if (!fs.existsSync(candPng)) {
    results.push({ screen, device, status: "missing-candidate", reason: `no Compose render at ${toPosix(path.relative(process.cwd(), candPng))}` });
    continue;
  }
  const refGeometry = path.join(refDir, screen, "default.geometry.json");
  const candGeometry = path.join(candDir, "default.semantics.json");
  const outDir = calibrate ? outRoot : path.join(outRoot, device, screen);
  try {
    const loop = loopInfo(screen, device);
    const result = compareScreens({
      referenceFile: refPng,
      candidateFile: candPng,
      referenceGeometryFile: fs.existsSync(refGeometry) ? refGeometry : null,
      candidateGeometryFile: fs.existsSync(candGeometry) ? candGeometry : null,
      outputDir: outDir,
      thresholds,
      iterations: loop.iterations,
      residualCategories: loop.residualCategories,
      screenName: screen,
      device,
    });
    result.harnessFixes = loop.harnessFixes;
    results.push(result);

    const key = `${screen}::${device}`;
    const previous = baseline.scores?.[key];
    if (!calibrate && typeof previous === "number" && result.pixel.matchPct < previous - tolerance) {
      regressions.push({ screen, device, previous, current: result.pixel.matchPct, drop: Number((previous - result.pixel.matchPct).toFixed(4)) });
    }
    if (updateBaseline && !calibrate) baseline.scores[key] = result.pixel.matchPct;
  } catch (err) {
    results.push({ screen, device, status: "error", reason: err.message });
  }
}

if (calibrate) {
  const worst = results.filter((r) => typeof r.pixel?.matchPct === "number").sort((a, b) => a.pixel.matchPct - b.pixel.matchPct);
  const lowest = worst[0]?.pixel?.matchPct ?? null;
  const payload = {
    measuredAt: new Date().toISOString(),
    device,
    screens: results.map((r) => ({ screen: r.screen, sameSideMatchPct: r.pixel?.matchPct ?? null })),
    lowestSameSideMatchPct: lowest,
    deterministic: lowest === 100,
    note:
      lowest === 100
        ? "the capture reproduces itself exactly; cross-platform thresholds stay as configured"
        : "the capture is not perfectly reproducible; cross-platform expectations must be adjusted down accordingly",
  };
  writeJsonAtomic(path.join(outRoot, "noise-floor.json"), payload);
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exitCode = payload.deterministic ? 0 : 4;
} else {
  if (updateBaseline) {
    baseline.updatedAt = new Date().toISOString();
    baseline.schemaVersion = baseline.schemaVersion ?? 1;
    writeJsonAtomic(baselineFile, baseline);
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    device,
    tolerance,
    counts: {
      matched: results.filter((r) => r.status === "matched").length,
      acceptedWithNotes: results.filter((r) => r.status === "accepted-with-notes").length,
      building: results.filter((r) => r.status === "building").length,
      blocked: results.filter((r) => r.status === "blocked").length,
      missing: results.filter((r) => r.status === "missing-candidate").length,
      error: results.filter((r) => r.status === "error").length,
    },
    regressions,
    results: results.map((r) => ({
      screen: r.screen,
      status: r.status,
      accepted: r.accepted ?? false,
      pixelMatchPct: r.pixel?.matchPct ?? null,
      ssim: r.ssim?.value ?? null,
      geometryCoveragePct: r.geometry?.coveragePct ?? null,
      // One sentence per screen: the signature of the failure, not just its size.
      geometryDelta: r.geometry?.deltaSummary ? `${r.geometry.deltaSummary.signature} — ${r.geometry.deltaSummary.hint}` : null,
      iterations: r.iterations ?? 0,
      residualCategories: r.residualCategories ?? [],
      gates: r.gates ?? null,
      reason: r.reason ?? null,
    })),
  };
  fs.mkdirSync(outRoot, { recursive: true });
  writeJsonAtomic(path.join(outRoot, "summary.json"), summary);
  fs.writeFileSync(path.join(outRoot, "summary.md"), renderSummary(summary));

  process.stdout.write(`${renderSummary(summary)}\n`);

  if (regressions.length) {
    process.stderr.write(`diff-all: ${regressions.length} regression(s) against the baseline (tolerance ${tolerance})\n`);
    process.exitCode = 6;
  } else if (summary.counts.blocked || summary.counts.missing || summary.counts.error) {
    process.exitCode = 6;
  } else if (summary.counts.building) {
    process.exitCode = 5;
  } else if (summary.counts.acceptedWithNotes) {
    process.exitCode = 3;
  }
}

function renderSummary(s) {
  const L = [];
  L.push(`# Diff summary — ${s.device}`, "");
  L.push(`Generated ${s.generatedAt}. Regression tolerance ${s.tolerance} points.`, "");
  L.push(
    "| Screen | Status | Accepted | Pixel | SSIM (not gated) | Geometry | Iter | Residuals |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const r of s.results) {
    L.push(
      `| ${r.screen} | ${r.status} | ${r.accepted ? "yes" : "no"} | ${r.pixelMatchPct ?? "-"} | ${r.ssim ?? "-"} | ` +
        `${r.geometryCoveragePct ?? "not measured"} | ${r.iterations ?? 0} | ${(r.residualCategories ?? []).join(", ") || "-"} |`,
    );
  }
  L.push("");
  L.push(
    `matched ${s.counts.matched} · accepted-with-notes ${s.counts.acceptedWithNotes} · building ${s.counts.building} · blocked ${s.counts.blocked} · missing ${s.counts.missing} · errors ${s.counts.error}`,
  );
  if (s.regressions.length) {
    L.push("", "## Regressions", "", "| Screen | Was | Now | Drop |", "| --- | --- | --- | --- |");
    for (const r of s.regressions) L.push(`| ${r.screen} | ${r.previous} | ${r.current} | -${r.drop} |`);
  }
  return L.join("\n");
}
