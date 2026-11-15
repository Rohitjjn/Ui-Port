#!/usr/bin/env node
/**
 * Resolve / verify the pinned versions in config/tools.json against their real
 * sources, and report (never silently apply) newer stable releases.
 *
 *   node scripts/resolve-versions.mjs --check          # verify the pins exist
 *   node scripts/resolve-versions.mjs --check --json   # machine-readable output
 *
 * Network use: npm registry only (the one registry reachable from every
 * environment this plugin targets). Maven artefacts are verified by the Gradle
 * build that consumes them — this script reports them as "unverified-here"
 * instead of pretending to know.
 */
import process from "node:process";
import { readJson } from "./lib/fs-utils.mjs";

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const tools = readJson(new URL("../config/tools.json", import.meta.url), { tools: [], policy: {} });

const results = [];

for (const tool of tools.tools ?? []) {
  const entry = { id: tool.id, type: tool.type, pinned: tool.version, status: "unknown" };
  if (tool.version === null) {
    entry.status = tool.status ?? "needs-user-input";
    results.push(entry);
    continue;
  }
  if (tool.type === "npm") {
    try {
      // The abbreviated metadata document omits publish times; we need them for
      // the "at least two weeks old" policy, so ask for the full document.
      const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(tool.package ?? tool.id)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const versions = Object.keys(data.versions ?? {});
      const time = data.time ?? {};
      if (!versions.includes(tool.version)) {
        entry.status = "pinned-version-missing";
      } else {
        const published = time[tool.version];
        const ageDays = published ? Math.floor((Date.now() - Date.parse(published)) / 86400000) : null;
        const latest = data["dist-tags"]?.latest ?? null;
        entry.status = "exists";
        entry.publishedAt = published ?? null;
        entry.ageDays = ageDays;
        entry.latest = latest;
        entry.olderThanMinAge = ageDays === null ? null : ageDays >= (tools.policy?.minAgeDays ?? 14);
        if (latest && latest !== tool.version) entry.newerStable = latest;
      }
    } catch (err) {
      entry.status = "lookup-failed";
      entry.error = err.message;
    }
  } else {
    // Maven / github-plugin pins: verified by the build that consumes them.
    entry.status = "unverified-here";
    entry.note = "Maven/Gradle pins are verified by the Gradle build; no network lookup is attempted here.";
  }
  results.push(entry);
}

if (asJson) {
  process.stdout.write(`${JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2)}\n`);
} else {
  const lines = [];
  for (const r of results) {
    const age = r.ageDays === null || r.ageDays === undefined ? "age unknown" : `${r.ageDays}d old`;
    const extra =
      r.status === "exists"
        ? ` (${r.publishedAt ? `published ${r.publishedAt.slice(0, 10)}, ` : ""}${age}${r.newerStable ? `, newer stable: ${r.newerStable}` : ""})`
        : r.error
          ? ` (${r.error})`
          : "";
    lines.push(`${r.status.padEnd(20)} ${r.id}${r.pinned ? `@${r.pinned}` : ""}${extra}`);
  }
  // One write: a closed pipe (e.g. `| head`) must not crash the script.
  try {
    process.stdout.write(`${lines.join("\n")}\n`);
  } catch {
    /* consumer went away */
  }
}

const broken = results.filter((r) => r.status === "pinned-version-missing" || r.status === "lookup-failed");
if (broken.length) {
  process.stderr.write(`\nresolve-versions: ${broken.length} pin(s) could not be verified\n`);
  process.exitCode = 1;
}
