#!/usr/bin/env node
/**
 * Build the capture spec from a prototype scan + chosen device targets + states.
 *
 *   node scripts/plan-capture.mjs testbed/prototype --devices phone --states default,overlay \
 *     --out .uiport/capture-spec.json [--screens home,search]
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { scanPrototype } from "./lib/scan-prototype.mjs";
import { buildCapturePlan, deviceTargetsFromConfig, validateSpec, STATES } from "./lib/capture-spec.mjs";
import { readJson, writeJsonAtomic } from "./lib/fs-utils.mjs";

const args = process.argv.slice(2);
const root = args[0];
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = args[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
};

if (!root) {
  process.stderr.write("usage: plan-capture.mjs <prototypeRoot> --devices phone [--states default,overlay] --out file\n");
  process.exit(2);
}

const viewports = readJson(path.resolve(flag("viewports", path.join(import.meta.dirname, "..", "config", "viewports.json"))));
const devices = deviceTargetsFromConfig(viewports, flag("devices", "phone"));
const statesRaw = String(flag("states", "default")).split(",").map((s) => s.trim()).filter(Boolean);
const unknownStates = statesRaw.filter((s) => !STATES.includes(s));
if (unknownStates.length) {
  process.stderr.write(`plan-capture: unknown state(s) ${unknownStates.join(", ")}. Known: ${STATES.join(", ")}\n`);
  process.exit(2);
}

const scan = scanPrototype(path.resolve(root));
const screens = flag("screens") ? String(flag("screens")).split(",").map((s) => s.trim()) : null;
const captures = buildCapturePlan(scan, { devices, states: statesRaw, screens });

const spec = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  prototypeRoot: path.resolve(root),
  baseUrl: flag("base-url", "http://localhost:4173"),
  viewports: Object.fromEntries(devices.map((d) => [d, viewports.targets[d]])),
  captures,
};
const v = validateSpec(spec);
if (!v.ok) {
  process.stderr.write(`plan-capture: generated an invalid spec: ${v.errors.join("; ")}\n`);
  process.exit(1);
}

const out = path.resolve(flag("out", ".uiport/capture-spec.json"));
writeJsonAtomic(out, spec);
const shots = captures.reduce((n, c) => n + c.states.length, 0);
process.stdout.write(`wrote ${out} — ${captures.length} capture unit(s), ${shots} screenshot(s) over ${devices.join(", ")}\n`);
fs.statSync(out);
