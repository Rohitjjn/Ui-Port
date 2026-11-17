#!/usr/bin/env node
/**
 * Size assessment: how big is this port, really?
 *
 *   node scripts/size-assessment.mjs <prototypeOrAppRoot> [anotherRoot] [--json] [--out .uiport/size-assessment.json]
 *
 * Runs in preflight and again when the maps are built, because it is the input to a decision the
 * user is asked to make: SIMPLE / MEDIUM / LARGE changes whether the work runs in one batch, in
 * slices, or as a strangler migration behind a per-route flag. Those strategies cost very
 * different amounts, so the verdict is computed from measurements and shown with its reasoning —
 * never asserted.
 *
 * `config/tiers.json` holds the budgets; this script only counts, compares and explains.
 *
 * Exit codes: 0 ok, 2 usage error, 4 a subject could not be scanned.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { readJson } from "./lib/fs-utils.mjs";
import { scanPrototype } from "./lib/scan-prototype.mjs";
import { scanApp } from "./lib/scan-app.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const asJson = args.includes("--json");
const outIdx = args.indexOf("--out");
const outFile = outIdx === -1 ? null : args[outIdx + 1];
const subjects = args.filter((a, i) => !a.startsWith("--") && (outIdx === -1 || i !== outIdx + 1));

if (!subjects.length) {
  process.stderr.write("size-assessment: give at least one path (a prototype root or an Android app root)\n");
  process.exit(2);
}

const config = readJson(path.join(ROOT, "config", "tiers.json"));
const TIERS = config.tiers;
const ORDER = ["SIMPLE", "MEDIUM", "LARGE"];

/**
 * Counts, per subject. Every number here comes from a scanner that already existed for the maps,
 * so the assessment cannot disagree with the map the port is actually built from.
 */
export function measureSubject(root) {
  const abs = path.resolve(root);
  const pkgFile = path.join(abs, "package.json");
  const gradleFile = path.join(abs, "settings.gradle.kts");
  const gradleFileKts = path.join(abs, "settings.gradle");
  if (fs.existsSync(pkgFile)) {
    const p = scanPrototype(abs);
    return {
      root: abs,
      kind: "prototype",
      metrics: {
        screens: p.screens.length,
        files: p.files.total,
        sourceLines: p.files.sourceLines,
        components: p.components.length,
        stores: p.stores.length,
        libs: p.libraries.length,
        handlers: Object.values(p.handlers).reduce((n, h) => n + h.length, 0),
        motionItems: p.motion.items.length,
      },
      detail: {
        screens: p.screens.map((s) => s.id ?? s.name),
        states: p.screens.reduce((n, s) => n + (s.states?.length ?? 0), 0),
        responsive: Object.keys(p.responsive?.breakpoints ?? {}).length,
        warnings: p.warnings ?? [],
      },
    };
  }
  if (fs.existsSync(gradleFile) || fs.existsSync(gradleFileKts)) {
    const a = scanApp(abs);
    return {
      root: abs,
      kind: "app",
      metrics: {
        screens: a.screens.length,
        files: a.files.total,
        kotlin: a.files.kotlin,
        uiFiles: a.files.ui,
        engineFiles: a.files.engine,
        composables: a.composables.length,
        viewModels: a.viewModels.length,
        navDestinations: a.navigation.length,
        diModules: a.di.length,
        modules: a.modules.length,
      },
      detail: {
        screens: a.screens.map((s) => s.name),
        engineEntryPoints: a.engineEntryPoints.length,
        hasComposeDesktop: fs.existsSync(path.join(abs, "desktopApp")),
      },
    };
  }
  throw new Error(`size-assessment: ${abs} looks like neither a prototype (package.json) nor an Android app (settings.gradle*)`);
}

/** The tier a single subject fits, and why. */
export function classifySubject(subject, { tiers = TIERS, rules = config.rules } = {}) {
  const over = {};
  for (const tierName of ["SIMPLE", "MEDIUM"]) {
    const budget = tiers[tierName].budget ?? {};
    const exceeded = Object.entries(budget)
      .filter(([metric, limit]) => typeof subject.metrics[metric] === "number" && subject.metrics[metric] > limit)
      .map(([metric, limit]) => ({ metric, value: subject.metrics[metric], limit }));
    if (!exceeded.length) {
      return {
        tier: tierName,
        reason:
          tierName === "SIMPLE"
            ? `fits the SIMPLE budget on every measured dimension (largest relative pressure: ${pressure(subject, budget)})`
            : `exceeds SIMPLE and fits MEDIUM on every measured dimension (largest relative pressure: ${pressure(subject, budget)})`,
        exceeded: [],
      };
    }
    over[tierName] = exceeded;
  }
  const mediumOver = over.MEDIUM ?? [];
  const escalateAt = rules?.escalation?.threshold ?? 2;
  // A single dimension over MEDIUM is usually a heuristic artefact: a prototype carrying a large
  // generated data fixture has many files and few screens. Two dimensions over is a pattern.
  if (mediumOver.length >= escalateAt) {
    return { tier: "LARGE", reason: `exceeds the MEDIUM budget in ${mediumOver.length} dimensions`, exceeded: mediumOver };
  }
  return {
    tier: "MEDIUM",
    reason: `exceeds MEDIUM in ${mediumOver.length} dimension (below the escalation threshold of ${escalateAt}), so it stays MEDIUM with a note`,
    exceeded: mediumOver,
    note: mediumOver,
  };
}

function pressure(subject, budget) {
  let worst = { metric: "-", ratio: 0 };
  for (const [metric, limit] of Object.entries(budget)) {
    if (typeof subject.metrics[metric] !== "number" || !limit) continue;
    const ratio = subject.metrics[metric] / limit;
    if (ratio > worst.ratio) worst = { metric, ratio };
  }
  return `${worst.metric} at ${(worst.ratio * 100).toFixed(0)}% of budget`;
}

/**
 * The verdict for the whole run, and the strategy it implies.
 *
 * The strategy follows the *larger* of the two subjects: the cost of a port is dominated by the
 * app's constraints (navigation, DI, engine risk), not by how much UI happens to be drawn. A
 * SIMPLE prototype inside a LARGE app still needs a flag and a slice order.
 */
export function assessRun(subjects, { tiers = TIERS, rules = config.rules } = {}) {
  const per = subjects.map((s) => ({ root: s.root, kind: s.kind, ...classifySubject(s, { tiers, rules }) }));
  const worst = per.reduce((acc, c) => (ORDER.indexOf(c.tier) > ORDER.indexOf(acc.tier) ? c : acc), per[0]);
  const tier = worst.tier;
  const strategy = tiers[tier].strategy;

  // Slice count is a plan, not a promise: it is derived from the screen count and the tier's slice
  // size so `.uiport/plan/estimate.md` can state a number instead of "some slices".
  const screens = subjects.find((s) => s.kind === "prototype")?.metrics.screens ?? subjects[0].metrics.screens ?? 0;
  const sizes = tiers[strategy]?.sliceSize ?? (strategy === "batch" ? { min: screens, max: screens } : { min: 3, max: 8 });
  const sliceCount = strategy === "batch" ? 1 : Math.max(1, Math.ceil(screens / (sizes.max ?? 5)));

  return {
    generatedAt: new Date().toISOString(),
    tier,
    strategy,
    tierLabel: tiers[tier].label,
    why: worst.reason,
    drivingSubject: worst.root,
    perSubject: per,
    slices: { count: sliceCount, sizeMin: sizes.min, sizeMax: sizes.max, screens },
    override: { allowed: rules?.override?.allowed !== false, recordedIn: rules?.override?.where ?? "the decision gate" },
  };
}

export function renderAssessment(assessment, subjects) {
  const lines = ["# Size assessment", "", `**Verdict: \`${assessment.tier}\` — ${assessment.tierLabel}** (strategy: \`${assessment.strategy}\`)`, ""];
  lines.push(`Driven by \`${path.basename(assessment.drivingSubject)}\`: ${assessment.why}.`, "");
  lines.push("| Subject | Kind | Screens | Files | Lines | Components / Composables | Engine files | Nav destinations | Verdict |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const [i, s] of subjects.entries()) {
    const c = assessment.perSubject[i];
    const m = s.metrics;
    lines.push(
      `| ${path.basename(s.root)} | ${s.kind} | ${m.screens} | ${m.files} | ${m.sourceLines ?? `${m.kotlin} kotlin`} | ${m.components ?? m.composables} | ${m.engineFiles ?? "—"} | ${m.navDestinations ?? "—"} | \`${c.tier}\` |`,
    );
  }
  lines.push("", "## Budget comparison", "");
  for (const tierName of ["SIMPLE", "MEDIUM"]) {
    const budget = TIERS[tierName].budget;
    lines.push(`**${tierName}** (${TIERS[tierName].meaning})`, "");
    lines.push("| Metric | Budget | " + subjects.map((s) => path.basename(s.root)).join(" | ") + " |");
    lines.push("| --- | --- | " + subjects.map(() => "---").join(" | ") + " |");
    for (const [metric, limit] of Object.entries(budget)) {
      const cells = subjects.map((s) => {
        const v = s.metrics[metric];
        if (typeof v !== "number") return "—";
        return v > limit ? `**${v}** (over)` : `${v}`;
      });
      lines.push(`| ${metric} | ${limit} | ${cells.join(" | ")} |`);
    }
    lines.push("");
  }
  lines.push("## What the tier changes", "");
  const strat = config.strategies[assessment.strategy];
  lines.push(`- **Slices:** ${assessment.slices.count} (${assessment.slices.sizeMin}-${assessment.slices.sizeMax} screens each)`);
  lines.push(`- **Order:** ${strat.order.join(" → ")}`);
  lines.push(`- **Checks per batch:** ${strat.checksPerBatch.join(", ")}`);
  lines.push(`- **Rollback:** ${strat.rollback}`);
  if (strat.flag) lines.push(`- **Flag:** ${strat.flag.kind}, default ${strat.flag.default} — ${strat.flag.why}`);
  lines.push(`- **Subagents:** ${strat.subagents === false ? "not needed" : strat.subagents}`, "");
  lines.push("## Override", "");
  lines.push(`Allowed at ${assessment.override.recordedIn}. An override records the chosen tier and a one-line reason; it never rewrites these numbers, and the worklog keeps both so a later reader can see the disagreement.`, "");
  return lines.join("\n");
}

// ---------- CLI ----------
const measured = [];
for (const subject of subjects) {
  try {
    measured.push(measureSubject(subject));
  } catch (err) {
    process.stderr.write(`size-assessment: ${err.message}\n`);
    process.exit(4);
  }
}
const assessment = assessRun(measured);

if (outFile) {
  fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
  fs.writeFileSync(path.resolve(outFile), `${JSON.stringify({ assessment, subjects: measured }, null, 2)}\n`);
}
if (asJson) process.stdout.write(`${JSON.stringify({ assessment, subjects: measured }, null, 2)}\n`);
else process.stdout.write(`${renderAssessment(assessment, measured)}\n`);
