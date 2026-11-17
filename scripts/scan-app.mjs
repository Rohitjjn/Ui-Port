#!/usr/bin/env node
/**
 * Scan an Android / Kotlin project and emit a compact app map.
 *
 *   node scripts/scan-app.mjs <projectRoot> [--json out.json] [--md out.md] [--engine-paths out.json]
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { renderAppMap, scanApp } from "./lib/scan-app.mjs";

const args = process.argv.slice(2);
const root = args[0];
if (!root) {
  process.stderr.write("usage: scan-app.mjs <projectRoot> [--json file] [--md file] [--engine-paths file]\n");
  process.exit(2);
}
function value(name) {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? null : args[i + 1];
}

const scan = scanApp(path.resolve(root));
const jsonOut = value("json");
const mdOut = value("md");
const engineOut = value("engine-paths");
if (jsonOut) {
  fs.mkdirSync(path.dirname(path.resolve(jsonOut)), { recursive: true });
  fs.writeFileSync(path.resolve(jsonOut), `${JSON.stringify(scan, null, 2)}\n`);
}
if (mdOut) {
  fs.mkdirSync(path.dirname(path.resolve(mdOut)), { recursive: true });
  fs.writeFileSync(path.resolve(mdOut), renderAppMap(scan));
}
if (engineOut) {
  fs.mkdirSync(path.dirname(path.resolve(engineOut)), { recursive: true });
  fs.writeFileSync(
    path.resolve(engineOut),
    `${JSON.stringify({ globs: scan.split.engineGlobs, approved: false, generatedAt: scan.generatedAt, note: scan.split.heuristicNote }, null, 2)}\n`,
  );
}
if (!jsonOut && !mdOut && !engineOut) process.stdout.write(`${renderAppMap(scan)}\n`);
else {
  process.stdout.write(
    `scanned ${scan.files.kotlin} Kotlin files — UI ${scan.files.ui}, engine ${scan.files.engine}, shared ${scan.files.shared}; ${scan.screens.length} screens, ${scan.viewModels.length} ViewModels, ${scan.engineEntryPoints.length} engine entry points\n`,
  );
}
