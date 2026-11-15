/**
 * .uiport/state.json — the single source of truth for resume support.
 *
 * Schema version 1. Everything the plugin needs to continue without redoing
 * finished work, plus the numbers used for acceptance decisions, lives here.
 * Unknown top-level keys are preserved on write so a newer plugin version's
 * data is never silently destroyed by an older script.
 */
import fs from "node:fs";
import path from "node:path";
import { UIPORT_DIR, readJsonSafe, writeJsonAtomic, exists } from "./fs-utils.mjs";

export const STATE_SCHEMA_VERSION = 1;
export const PLUGIN_VERSION = "0.1.0";

export const STEPS = [
  "step-0-preflight",
  "step-1-maps",
  "step-2-analysis",
  "step-3-port",
  "step-4-wiring",
  "step-5-verify",
];

export const SCREEN_STATUS = [
  "pending",
  "building",
  "matched",
  "accepted-with-notes",
  "blocked",
];

export const EXECUTION_MODES = ["LOCAL_FULL", "CI_ONLY", "HYBRID", "LIMITED"];
export const PROJECT_CASES = ["case-1-old-ui-plus-engine", "case-2-engine-only", "case-3-nothing"];
export const DEVICE_TARGETS = ["phone", "tablet", "desktop"];

export function statePath(projectRoot) {
  return path.join(projectRoot, UIPORT_DIR, "state.json");
}

export function emptyState({ pluginVersion = PLUGIN_VERSION } = {}) {
  const now = new Date().toISOString();
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    pluginVersion,
    createdAt: now,
    updatedAt: now,
    projectCase: null,
    executionMode: null,
    deviceTargets: [],
    options: {
      ponytail: false,
      allowEngineEdits: false,
      delivery: [],
      extraFeaturePolicy: {},
      headless: false,
    },
    currentStep: STEPS[0],
    steps: Object.fromEntries(STEPS.map((s) => [s, { status: "pending", updatedAt: null }])),
    screens: {},
    noiseFloor: null,
    iterationCounts: {},
    lastScores: {},
    protectedPathsApproved: false,
    timestamps: { startedAt: now, lastResumeAt: null, finishedAt: null },
  };
}

/**
 * Load, migrating older schema versions and repairing a corrupt file instead of
 * crashing the session.
 * @returns {{state: object, recovered: boolean, warning: string|null}}
 */
export function loadState(projectRoot, { repair = true } = {}) {
  const file = statePath(projectRoot);
  if (!exists(file)) return { state: emptyState(), recovered: false, warning: null };
  const res = readJsonSafe(file);
  if (!res.ok) {
    const warning = `state.json is not valid JSON (${res.error}); a fresh state was created and the damaged file kept as state.corrupt.json`;
    if (repair) {
      try {
        fs.copyFileSync(file, `${file}.corrupt.json`);
      } catch {
        /* keep going: a corrupt state must never break the session */
      }
      const state = emptyState();
      writeJsonAtomic(file, state);
      return { state, recovered: true, warning };
    }
    return { state: emptyState(), recovered: true, warning };
  }
  const migrated = migrate(res.value);
  return { state: migrated.state, recovered: false, warning: migrated.warning };
}

export function migrate(raw) {
  if (!raw || typeof raw !== "object") {
    return { state: emptyState(), warning: "state.json was not an object; a fresh state was created" };
  }
  let state = { ...raw };
  let warning = null;
  const version = Number(state.schemaVersion ?? 0);
  if (version > STATE_SCHEMA_VERSION) {
    warning = `state.json has schemaVersion ${version} but this plugin understands ${STATE_SCHEMA_VERSION}; unknown keys are preserved.`;
  }
  if (version < 1) {
    state = { ...emptyState(), ...state, schemaVersion: STATE_SCHEMA_VERSION };
  }
  // Fill in anything missing without dropping unknown keys.
  const base = emptyState();
  state.schemaVersion = STATE_SCHEMA_VERSION;
  state.options = { ...base.options, ...(state.options ?? {}) };
  state.steps = { ...base.steps, ...(state.steps ?? {}) };
  state.screens = state.screens ?? {};
  state.iterationCounts = state.iterationCounts ?? {};
  state.lastScores = state.lastScores ?? {};
  state.deviceTargets = Array.isArray(state.deviceTargets) ? state.deviceTargets : [];
  state.timestamps = { ...base.timestamps, ...(state.timestamps ?? {}) };
  state.protectedPathsApproved = Boolean(state.protectedPathsApproved);
  return { state, warning };
}

export function saveState(projectRoot, state) {
  const next = { ...state, updatedAt: new Date().toISOString() };
  writeJsonAtomic(statePath(projectRoot), next);
  return next;
}

export function setStep(state, step, status, note) {
  if (!STEPS.includes(step)) throw new Error(`Unknown step "${step}". Known: ${STEPS.join(", ")}`);
  state.steps = state.steps ?? {};
  state.steps[step] = { ...(state.steps[step] ?? {}), status, updatedAt: new Date().toISOString() };
  if (note) state.steps[step].note = note;
  state.currentStep = step;
  return state;
}

export function setScreenStatus(state, { screen, device, status, score, iterations, notes }) {
  if (!DEVICE_TARGETS.includes(device)) throw new Error(`Unknown device "${device}"`);
  if (!SCREEN_STATUS.includes(status)) throw new Error(`Unknown status "${status}"`);
  state.screens = state.screens ?? {};
  const entry = state.screens[screen] ?? { devices: {}, notes: [] };
  const prev = entry.devices[device] ?? { status: "pending", iterations: 0 };
  entry.devices[device] = {
    status,
    score: score ?? prev.score ?? null,
    iterations: iterations ?? prev.iterations ?? 0,
    updatedAt: new Date().toISOString(),
    ...(notes ? { notes } : {}),
  };
  state.screens[screen] = entry;
  if (typeof score === "number") {
    state.lastScores = state.lastScores ?? {};
    state.lastScores[screen] = { ...(state.lastScores[screen] ?? {}), [device]: score };
  }
  return state;
}

export function bumpIteration(state, screen, device) {
  state.iterationCounts = state.iterationCounts ?? {};
  const key = `${screen}::${device}`;
  state.iterationCounts[key] = (state.iterationCounts[key] ?? 0) + 1;
  return state.iterationCounts[key];
}

/** Next step that is not done, used by /uiport-resume. */
export function nextStep(state) {
  for (const s of STEPS) {
    const st = state.steps?.[s]?.status;
    if (st !== "done" && st !== "skipped") return s;
  }
  return null;
}

export function summarize(state) {
  const screens = Object.entries(state.screens ?? {}).map(([name, v]) => ({
    name,
    devices: Object.entries(v.devices ?? {}).map(([d, dv]) => ({
      device: d,
      status: dv.status,
      score: dv.score ?? null,
      iterations: dv.iterations ?? 0,
    })),
  }));
  return {
    pluginVersion: state.pluginVersion,
    case: state.projectCase,
    executionMode: state.executionMode,
    deviceTargets: state.deviceTargets,
    currentStep: state.currentStep,
    nextStep: nextStep(state),
    steps: state.steps,
    screens,
    protectedPathsApproved: state.protectedPathsApproved,
    updatedAt: state.updatedAt,
  };
}
