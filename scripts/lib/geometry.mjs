/**
 * Geometry comparison: DOM boxes vs Compose semantics bounds.
 *
 * Deliberately has no dependencies. It is the one check that can run anywhere —
 * inside a hook, in a bare Node install, on a machine with no image libraries — and
 * it answers the question a pixel count cannot: which element moved, and by how much.
 *
 * The fidelity thresholds live here too: they are plain numbers, and every consumer
 * needs them, including the ones that never load an image library.
 */
import { readJsonSafe } from "./fs-utils.mjs";

export const DEFAULT_THRESHOLDS = {
  pixelmatch: { threshold: 0.1, includeAA: false, alpha: 0.35, diffColor: [255, 0, 90] },
  geometry: { toleranceDp: 1.0, tolerancePct: 1.0, minNodeCoveragePct: 90.0 },
  // 95% is the acceptance floor and 99% the goal. Chrome and Android rasterise text, shadows
  // and blur with different engines, so 98%+ is not reliably reachable even when the layout is
  // correct; gating at 95% and gating layout separately is the honest pair of gates.
  acceptanceFloorPct: 95.0,
  goalPixelMatchPct: 99.0,
  maxIterationsPerScreenPerDevice: 5,
  ssim: { windowSize: 11, k1: 0.01, k2: 0.03, gate: false },
  acceptance: { requiresGeometry: true, requiresAll: true },
  residualCategories: {
    required: true,
    categories: [
      "font-rasterization",
      "text-rendering",
      "shadow-elevation",
      "blur-unsupported",
      "blend-mode-unsupported",
      "filter-unsupported",
      "subpixel-layout",
      "scrollbar",
      "platform-chrome",
      "artwork-vector",
    ],
  },
};

export function loadThresholds(file) {
  const res = readJsonSafe(file);
  if (!res.ok) return DEFAULT_THRESHOLDS;
  const v = res.value?.visual ?? res.value ?? {};
  return {
    pixelmatch: { ...DEFAULT_THRESHOLDS.pixelmatch, ...(v.pixelmatch ?? {}) },
    ssim: { ...DEFAULT_THRESHOLDS.ssim, ...(v.ssim ?? {}) },
    geometry: { ...DEFAULT_THRESHOLDS.geometry, ...(v.geometry ?? {}) },
    acceptanceFloorPct: v.acceptanceFloorPct ?? DEFAULT_THRESHOLDS.acceptanceFloorPct,
    goalPixelMatchPct: v.goalPixelMatchPct ?? DEFAULT_THRESHOLDS.goalPixelMatchPct,
    maxIterationsPerScreenPerDevice: v.maxIterationsPerScreenPerDevice ?? DEFAULT_THRESHOLDS.maxIterationsPerScreenPerDevice,
    // The acceptance rules themselves are configuration, not code: a project can require the
    // geometry gate, and a project can extend the residual vocabulary. Dropping these keys on
    // load would silently turn "unknown residual category" into "no categories allowed at all".
    acceptance: v.acceptance ?? DEFAULT_THRESHOLDS.acceptance,
    residualCategories: v.residualCategories ?? DEFAULT_THRESHOLDS.residualCategories,
    acceptedWithNotes: v.acceptedWithNotes ?? DEFAULT_THRESHOLDS.acceptedWithNotes,
    noiseFloor: v.noiseFloor ?? DEFAULT_THRESHOLDS.noiseFloor,
    masks: v.masks ?? DEFAULT_THRESHOLDS.masks,
  };
}

/**
 * Both dumps describe the same screen at different granularities.
 *
 * The DOM dump records every element that has text *or* is a role-bearing container, so a card
 * appears as `<article>` → `<div>` → `<h3>Title</h3>` → `<p>Subtitle</p>`: 402 nodes for the
 * home screen. Compose semantics is the opposite — text nodes are leaves and containers usually
 * carry nothing — so the same screen yields ~300 nodes, none of them the `article` wrapper.
 * Comparing the raw lists therefore reports hundreds of "missing" wrappers and a coverage of 0%,
 * which reads exactly like an unported screen. It is not.
 *
 * Canonicalising both sides to *nodes that carry their own text* compares what a reader can see,
 * and drops the wrapper chain that exists only because HTML needs it. Anchored nodes (test ids)
 * are kept with no text: they are the only handle on an icon button.
 */
export function canonicalNodes(nodes = []) {
  const list = Array.isArray(nodes) ? nodes : (nodes?.nodes ?? []);
  return list
    .filter((n) => {
      const hasText = typeof n?.text === "string" && n.text.trim().length > 0;
      const anchored = n?.testId != null && String(n.testId).length > 0;
      return hasText || anchored;
    })
    .map((n) => ({
      ...n,
      text: typeof n?.text === "string" ? n.text.trim().replace(/\s+/g, " ") : null,
    }));
}

export function compareGeometry(refNodes = [], candNodes = [], opts = {}) {
  // A dump can be the wrong shape: the web capture writes an array, but a semantics dump that
  // wrapped it (or an older report that stored `{ nodes: [...] }`) would otherwise be compared as
  // an empty list and every reference node would be reported "missing" — a confident 0% that
  // looks like a ported-nothing screen instead of a reader bug.
  refNodes = Array.isArray(refNodes) ? refNodes : (refNodes?.nodes ?? []);
  candNodes = Array.isArray(candNodes) ? candNodes : (candNodes?.nodes ?? []);
  const rawRef = refNodes.length;
  const rawCand = candNodes.length;
  // Opt-in, because the diff path's own fixtures are already leaf-level and a silent filter there
  // would hide a genuinely dropped node. The real DOM-vs-semantics path turns it on.
  if (opts.canonical) {
    refNodes = canonicalNodes(refNodes);
    candNodes = canonicalNodes(candNodes);
  }
  const tolerance = opts.toleranceDp ?? 1.0;
  const matched = [];
  const mismatched = [];
  const missing = [];
  // Track used candidates by identity, not by text: a screen has many nodes called
  // "Play"/"More", and keying on text marks all but the first as already consumed, which
  // makes two identical dumps report phantom mismatches and a false coverage failure.
  const usedCand = new Set();
  for (const ref of refNodes) {
    const candidates = candNodes.filter((c) => !usedCand.has(c));
    const best = pickBestMatch(ref, candidates);
    if (!best) {
      missing.push({ node: ref, reason: "no candidate node with the same text/role" });
      continue;
    }
    usedCand.add(best);
    const dx = Math.abs((ref.x ?? 0) - (best.x ?? 0));
    const dy = Math.abs((ref.y ?? 0) - (best.y ?? 0));
    const dw = Math.abs((ref.w ?? 0) - (best.w ?? 0));
    const dh = Math.abs((ref.h ?? 0) - (best.h ?? 0));
    const entry = { ref: describe(ref), cand: describe(best), dx: round(dx, 2), dy: round(dy, 2), dw: round(dw, 2), dh: round(dh, 2) };
    if (dx <= tolerance && dy <= tolerance && dw <= tolerance && dh <= tolerance) matched.push(entry);
    else mismatched.push({ ...entry, tolerance });
  }
  const coverage = refNodes.length ? (matched.length / refNodes.length) * 100 : 100;
  return {
    matched,
    mismatched,
    missing,
    coveragePct: round(coverage, 2),
    toleranceDp: tolerance,
    refCount: refNodes.length,
    candCount: candNodes.length,
    rawRefCount: rawRef,
    rawCandCount: rawCand,
  };
}

function pickBestMatch(ref, candidates) {
  const norm = (s) => String(s ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  const refText = norm(ref.text);
  const refRole = norm(ref.role);
  let best = null;
  let bestScore = -1;
  for (const c of candidates) {
    let score = 0;
    if (refText && norm(c.text) === refText) score += 3;
    if (refRole && norm(c.role) === refRole) score += 1;
    if (ref.testId && c.testId && ref.testId === c.testId) score += 5;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  if (bestScore <= 0) return null;
  // Several elements can carry the same text ("Play" appears many times on one screen).
  // Among equally good candidates prefer the nearest box: otherwise the first "Play" in
  // the candidate list is paired with every "Play" in the reference, and two *identical*
  // dumps report dozens of phantom mismatches.
  if (bestScore >= 3) {
    const sameText = candidates.filter((c) => {
      let score = 0;
      if (refText && norm(c.text) === refText) score += 3;
      if (refRole && norm(c.role) === refRole) score += 1;
      if (ref.testId && c.testId && ref.testId === c.testId) score += 5;
      return score === bestScore;
    });
    if (sameText.length > 1) {
      const dist = (c) =>
        Math.abs((c.x ?? 0) - (ref.x ?? 0)) + Math.abs((c.y ?? 0) - (ref.y ?? 0)) +
        Math.abs((c.w ?? 0) - (ref.w ?? 0)) + Math.abs((c.h ?? 0) - (ref.h ?? 0));
      sameText.sort((a, b) => dist(a) - dist(b));
      best = sameText[0];
    }
  }
  return best;
}

function describe(n) {
  return { text: n.text ?? null, role: n.role ?? null, box: [round(n.x ?? 0, 2), round(n.y ?? 0, 2), round(n.w ?? 0, 2), round(n.h ?? 0, 2)] };
}

export function round(n, digits = 2) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/**
 * Decide the outcome of one screen/device comparison.
 * "matched" | "accepted-with-notes" | "blocked"
 */
