#!/usr/bin/env node
/**
 * Scan a web prototype and emit a compact map.
 *
 *   node scripts/scan-prototype.mjs <prototypeRoot> [--json out.json] [--md out.md]
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { renderPrototypeMap, scanPrototype } from "./lib/scan-prototype.mjs";

const args = process.argv.slice(2);
const root = args[0];
if (!root) {
  process.stderr.write("usage: scan-prototype.mjs <prototypeRoot> [--json file] [--md file]\n");
  process.exit(2);
}

function value(name) {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? null : args[i + 1];
}

const scan = scanPrototype(path.resolve(root));
const jsonOut = value("json");
const mdOut = value("md");
if (jsonOut) {
  fs.mkdirSync(path.dirname(path.resolve(jsonOut)), { recursive: true });
  fs.writeFileSync(path.resolve(jsonOut), `${JSON.stringify(scan, null, 2)}\n`);
}
if (mdOut) {
  fs.mkdirSync(path.dirname(path.resolve(mdOut)), { recursive: true });
  fs.writeFileSync(path.resolve(mdOut), renderPrototypeMap(scan));
}
if (!jsonOut && !mdOut) process.stdout.write(`${renderPrototypeMap(scan)}\n`);
else {
  process.stdout.write(
    `scanned ${scan.files.total} files, ${scan.screens.length} screens, ${scan.libraries.length} libraries, ${scan.stores.length} stores\n`,
  );
}
