/**
 * .uiport/answers.json — headless mode.
 *
 * When this file exists (or UIPORT_HEADLESS=1), the plugin must take its
 * decision-gate answers from here instead of asking the user. CI relies on it.
 * Validation is strict so a typo fails loudly in CI instead of silently
 * choosing "phone only" for a three-device run.
 */
import path from "node:path";
import { exists, readJsonSafe } from "./fs-utils.mjs";

export const SIZE_TIERS = ["SIMPLE", "MEDIUM", "LARGE"];

export const REQUIRED_GATE_KEYS = ["deviceTargets", "executionMode", "extraFeatures", "allowEngineEdits", "delivery"];

export const ANSWERS_SCHEMA = {
  deviceTargets: "array of \"phone\" | \"tablet\" | \"desktop\" (non-empty, unique)",
  executionMode: "LOCAL_FULL | CI_ONLY | HYBRID | LIMITED",
  heavyTasksLocation: "optional override string, informational",
  ponytail: "boolean (optional, default false) — use the Ponytail plugin",
  extraFeatures: "object: prototype feature id -> \"build-in-engine\" | \"remove-from-ui\"",
  allowEngineEdits: "boolean",
  delivery: "array of \"zip\" | \"branch\" | \"pr\"",
  screens: "optional array of screen ids to limit the run",
  sizeOverride:
    'optional { tier: "SIMPLE" | "MEDIUM" | "LARGE", reason: string } — overrides the computed size verdict at the decision gate. The assessment\'s own numbers are kept in .uiport/size-assessment.json and are never rewritten by an override.', 
  notes: "optional free text",
};

const DEVICES = ["phone", "tablet", "desktop"];
const MODES = ["LOCAL_FULL", "CI_ONLY", "HYBRID", "LIMITED"];
const FEATURE_ACTIONS = ["build-in-engine", "remove-from-ui"];
const DELIVERY = ["zip", "branch", "pr"];

export function validateAnswers(raw) {
  const errors = [];
  const warnings = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, errors: ["answers.json must be a JSON object"], warnings, answers: null };
  }
  const a = raw;

  if (!Array.isArray(a.deviceTargets) || a.deviceTargets.length === 0) {
    errors.push("deviceTargets must be a non-empty array");
  } else {
    for (const d of a.deviceTargets) {
      if (!DEVICES.includes(d)) errors.push(`deviceTargets contains unknown device "${d}" (allowed: ${DEVICES.join(", ")})`);
    }
    if (new Set(a.deviceTargets).size !== a.deviceTargets.length) errors.push("deviceTargets contains duplicates");
    if (a.deviceTargets.length === 3) warnings.push("deviceTargets covers all three targets; the run will be ~3x longer");
  }

  if (!MODES.includes(a.executionMode)) {
    errors.push(`executionMode must be one of ${MODES.join(", ")}`);
  }

  if (typeof a.allowEngineEdits !== "boolean") errors.push("allowEngineEdits must be true or false");

  if (!Array.isArray(a.delivery) || a.delivery.length === 0) {
    errors.push("delivery must be a non-empty array");
  } else {
    for (const d of a.delivery) if (!DELIVERY.includes(d)) errors.push(`delivery contains unknown option "${d}"`);
  }

  if (a.extraFeatures === undefined) {
    errors.push("extraFeatures must be present (may be an empty object)");
  } else if (typeof a.extraFeatures !== "object" || a.extraFeatures === null || Array.isArray(a.extraFeatures)) {
    errors.push("extraFeatures must be an object mapping feature id to an action");
  } else {
    for (const [k, v] of Object.entries(a.extraFeatures)) {
      if (!FEATURE_ACTIONS.includes(v)) {
        errors.push(`extraFeatures["${k}"] must be one of ${FEATURE_ACTIONS.join(", ")} (got "${v}")`);
      }
    }
  }

  if (a.ponytail !== undefined && typeof a.ponytail !== "boolean") errors.push("ponytail must be a boolean");
  if (a.screens !== undefined && (!Array.isArray(a.screens) || a.screens.some((s) => typeof s !== "string"))) {
    errors.push("screens must be an array of strings");
  }

  // An override without a reason is not a decision, it is a shrug. The reason is what the worklog
  // and the final report quote when the tier that ran differs from the tier that was computed.
  if (a.sizeOverride !== undefined) {
    const o = a.sizeOverride;
    if (!o || typeof o !== "object" || Array.isArray(o)) {
      errors.push("sizeOverride must be an object { tier, reason }");
    } else {
      if (!SIZE_TIERS.includes(o.tier)) errors.push(`sizeOverride.tier must be one of ${SIZE_TIERS.join(", ")} (got ${JSON.stringify(o.tier)})`);
      if (typeof o.reason !== "string" || o.reason.trim().length < 8) {
        errors.push("sizeOverride.reason is required (a sentence: why the computed tier is wrong)");
      }
    }
  }

  for (const key of REQUIRED_GATE_KEYS) {
    if (a[key] === undefined) errors.push(`missing required key "${key}"`);
  }

  return { ok: errors.length === 0, errors, warnings, answers: errors.length ? null : normalizeAnswers(a) };
}

export function normalizeAnswers(a) {
  return {
    deviceTargets: [...a.deviceTargets],
    executionMode: a.executionMode,
    ponytail: Boolean(a.ponytail),
    extraFeatures: { ...(a.extraFeatures ?? {}) },
    allowEngineEdits: Boolean(a.allowEngineEdits),
    delivery: [...a.delivery],
    screens: a.screens ? [...a.screens] : null,
    sizeOverride: a.sizeOverride ? { tier: a.sizeOverride.tier, reason: a.sizeOverride.reason.trim() } : null,
    notes: typeof a.notes === "string" ? a.notes : null,
  };
}

/**
 * Which tier actually governs the run.
 *
 * Never a silent merge: the assessment is what was measured, the override is what the user
 * decided, and both survive into the worklog. A run that says "MEDIUM" while the numbers say
 * "LARGE" is only honest if the reason travels with it.
 */
export function resolveTier(assessment, answers) {
  const computed = assessment?.tier ?? null;
  const override = answers?.sizeOverride ?? null;
  if (!override) {
    return { tier: computed, computed, overridden: false, reason: assessment?.why ?? null, strategy: assessment?.strategy ?? null };
  }
  const strategy = assessment?.strategies?.[override.tier]?.strategy ?? { SIMPLE: "batch", MEDIUM: "slices", LARGE: "strangler" }[override.tier];
  return {
    tier: override.tier,
    computed,
    overridden: computed !== null && computed !== override.tier,
    reason: override.reason,
    computedReason: assessment?.why ?? null,
    strategy,
  };
}

export function answersPath(projectRoot) {
  return path.join(projectRoot, ".uiport", "answers.json");
}

/** Headless mode is on when the file exists and env does not force it off. */
export function loadAnswers(projectRoot, env = process.env) {
  const file = answersPath(projectRoot);
  const forcedOff = env.UIPORT_HEADLESS === "0";
  if (env.UIPORT_HEADLESS === "1" && !exists(file)) {
    return { present: false, headless: true, error: `UIPORT_HEADLESS=1 but ${file} does not exist`, answers: null };
  }
  if (forcedOff || !exists(file)) return { present: false, headless: false, error: null, answers: null };
  const res = readJsonSafe(file);
  if (!res.ok) return { present: true, headless: true, error: `answers.json is not valid JSON: ${res.error}`, answers: null };
  const v = validateAnswers(res.value);
  return { present: true, headless: true, error: v.ok ? null : v.errors.join("; "), answers: v.answers, warnings: v.warnings };
}
