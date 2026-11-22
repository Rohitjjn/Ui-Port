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
  const kept = list
    .filter((n) => {
      const hasText = typeof n?.text === "string" && n.text.trim().length > 0;
      const anchored = n?.testId != null && String(n.testId).length > 0;
      return hasText || anchored;
    })
    .map((n) => ({
      ...n,
      text: typeof n?.text === "string" ? n.text.trim().replace(/\s+/g, " ") : null,
    }));

  // One node per (text, box). The DOM repeats a label when it repeats the element — `<p>4 items</p>`
  // next to a `<span>4 items</span>` for the same count, at the same coordinates — and counting
  // both inflates the reference set with a node the port can only ever produce once. The report
  // then shows the same text "missing" twice, which reads like two dropped labels.
  // Same text within 1 dp of the same box is the same label. The tolerance matters: the DOM's
  // `<p>` and `<span>` for one count are laid out as separate line boxes and differ in the second
  // decimal, so an exact key merges nothing — which is what the first version of this did.
  const out = [];
  for (const n of kept) {
    if (n.text != null) {
      const near = out.find(
        (o) =>
          o.text === n.text &&
          Math.abs((o.x ?? 0) - (n.x ?? 0)) <= 1 &&
          Math.abs((o.y ?? 0) - (n.y ?? 0)) <= 1 &&
          Math.abs((o.w ?? 0) - (n.w ?? 0)) <= 1 &&
          Math.abs((o.h ?? 0) - (n.h ?? 0)) <= 1,
      );
      if (near) {
        // Keep the node that carries ancestors: for the same label it is the same element with
        // more information for the comparator.
        if ((n.ancestors?.length ?? 0) > (near.ancestors?.length ?? 0)) Object.assign(near, n);
        continue;
      }
    }
    out.push(n);
  }
  return out;
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
      // Say *how* it is missing. "no node with the same text" and "a node with that text exists but
      // is not pairable" are different defects — the first is content that never rendered, the
      // second is a label whose text or role differs — and a reader with ten notice slots and
      // thirty missing rows cannot spend a CI run on each to find out which.
      const sameText = candNodes.find((c) => (c.text ?? "") === (ref.text ?? ""));
      const nearName =
        sameText ??
        candNodes.find((c) => {
          const a = (c.text ?? "").toLowerCase();
          const b = (ref.text ?? "").toLowerCase();
          return a && b && (a.startsWith(b.slice(0, 6)) || b.startsWith(a.slice(0, 6)));
        });
      missing.push({
        node: ref,
        reason: sameText ? "same text present but not pairable" : nearName ? "similarly named candidate exists" : "no candidate node with the same text/role",
        nearest: nearName ? describe(nearName) : null,
      });
      continue;
    }
    usedCand.add(best);
    const bestBox = bestBoxFor(ref, best, tolerance);
    const dx = Math.abs((ref.x ?? 0) - bestBox.x);
    const dy = Math.abs((ref.y ?? 0) - bestBox.y);
    const dw = Math.abs((ref.w ?? 0) - bestBox.w);
    const dh = Math.abs((ref.h ?? 0) - bestBox.h);
    const entry = {
      ref: describe(ref),
      cand: describe(best),
      dx: round(dx, 2),
      dy: round(dy, 2),
      dw: round(dw, 2),
      dh: round(dh, 2),
      // Which candidate box was compared, when it was not the candidate's own: the reader of a
      // report has to be able to see that a label was matched against its link, not its glyphs.
      matchedAgainst: bestBox.source,
    };
    if (dx <= tolerance && dy <= tolerance && dw <= tolerance && dh <= tolerance) matched.push(entry);
    else mismatched.push({ ...entry, tolerance });
  }
  const coverage = refNodes.length ? (matched.length / refNodes.length) * 100 : 100;
  return {
    matched,
    mismatched,
    missing,
    // Why a screen failed, in the form a porter can act on.
    //
    // A 0% coverage number says "nothing is within tolerance" and nothing else: the per-node list
    // names the nodes but not the *pattern*, and three sample annotations cannot tell a systematic
    // 2 dp text-rendering gap from a layout that is 40 dp low. Those two need opposite fixes, so
    // the summary has to distinguish them:
    //   - `constantOffset` (median dx/dy across mismatched nodes, with the share of nodes within
    //     0.5 dp of it) is the signature of an engine-level offset — every box shifts together.
    //   - a wide spread with no dominant offset is a real layout difference.
    // The dimension split matters too: text boxes differ systematically in height between
    // Chromium and Skia while containers do not, so `byDimension` says which to chase first.
    deltaSummary: summariseDeltas(mismatched),
    coveragePct: round(coverage, 2),
    toleranceDp: tolerance,
    refCount: refNodes.length,
    candCount: candNodes.length,
    rawRefCount: rawRef,
    rawCandCount: rawCand,
  };
}

/**
 * The candidate box that should represent this node.
 *
 * A DOM label is often a bare text node inside a link (`<a><span/><span>Home</span></a>`): the
 * reference's canonical node for "Home" is therefore the whole 64x66 link, while Compose's is the
 * 16 dp `Text` inside it. Comparing those two boxes reports a 38 dp "shift" for a label that is
 * exactly where the prototype puts it — a false failure of the geometry gate, which is worse than
 * a missed one because it sends the next iteration after a layout that is already correct.
 *
 * So: if the reference box *contains* the candidate leaf (within tolerance) and one of the
 * candidate's ancestors matches the reference box, that ancestor is the honest comparison.
 */
function bestBoxFor(ref, cand, tolerance) {
  const own = { x: cand.x ?? 0, y: cand.y ?? 0, w: cand.w ?? 0, h: cand.h ?? 0, source: "self" };
  const refBox = { x: ref.x ?? 0, y: ref.y ?? 0, w: ref.w ?? 0, h: ref.h ?? 0 };
  const counts = (box) =>
    Math.abs(box.x - refBox.x) <= tolerance &&
    Math.abs(box.y - refBox.y) <= tolerance &&
    Math.abs(box.w - refBox.w) <= tolerance &&
    Math.abs(box.h - refBox.h) <= tolerance;
  if (counts(own)) return own;
  const boxes = [];
  for (const [i, box] of (cand.ancestors ?? []).entries()) {
    if (!box) continue;
    boxes.push({ x: box.x ?? 0, y: box.y ?? 0, w: box.w ?? 0, h: box.h ?? 0, source: `ancestor${i + 1}` });
  }
  for (const candidate of boxes) if (counts(candidate)) return candidate;
  // Nothing matched, so report against the *closest* box rather than always the leaf.
  //
  // Returning `own` here made a correct shape look like a size error: the library chip is a 36 dp
  // box with a 19 dp text run in it, and the chip sat 2.06 dp low. Measured as the text run that is
  // "17 dp too short"; measured as the box it is "2 dp low". The first sends the next iteration
  // after a height that is already right, and the second is the truth.
  const deviation = (b) =>
    Math.max(Math.abs(b.x - refBox.x), Math.abs(b.y - refBox.y), Math.abs(b.w - refBox.w), Math.abs(b.h - refBox.h));
  const closest = boxes.reduce((best, b) => (best === null || deviation(b) < deviation(best) ? b : best), null);
  if (closest && deviation(closest) < deviation(own)) return closest;
  return own;
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
  // A node that carries text may only be matched to a node that carries the *same* text.
  //
  // Role alone scores 1 (the DOM's `node` role and Compose's absence of a role both normalise to
  // something the role check can award), so a reference label with no counterpart in the candidate
  // used to be paired with whatever candidate happened to be first, and reported as a confident
  // "off by (0, 4, 18, 8)" against an unrelated element. That is worse than reporting it missing:
  // a wrong row sends the next iteration after an innocent node, and the real gap — a label that
  // never rendered — stays invisible. Anchored nodes (testId) are exempt: that is exact identity.
  if (refText && !(ref.testId && best.testId === ref.testId) && norm(best.text) !== refText) return null;
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

/**
 * Median and spread of the per-node deltas: the difference between "everything moved together"
 * and "things are in the wrong places". Returns null when nothing mismatched, so a report can
 * print "no mismatches" instead of a row of zeroes that looks like a pass.
 */
export function summariseDeltas(mismatched = []) {
  if (!mismatched.length) return null;
  const median = (values) => {
    const v = [...values].sort((a, b) => a - b);
    const mid = Math.floor(v.length / 2);
    return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
  };
  const dims = ["dx", "dy", "dw", "dh"];
  const medians = Object.fromEntries(dims.map((d) => [d, round(median(mismatched.map((m) => m[d])), 2)]));
  const spreads = Object.fromEntries(
    dims.map((d) => {
      const vals = mismatched.map((m) => m[d]);
      return [d, { min: round(Math.min(...vals), 2), max: round(Math.max(...vals), 2) }];
    }),
  );
  // A node counts as "explained by the common offset" when it sits within 0.5 dp of the median on
  // both offsets. A high share means one number would fix most of the screen.
  const within = mismatched.filter((m) => Math.abs(m.dx - medians.dx) <= 0.5 && Math.abs(m.dy - medians.dy) <= 0.5).length;
  const total = mismatched.length;
  const dominantSharePct = round((within / total) * 100, 1);
  // The closest any node came to passing, in the same units as the tolerance. This is the single
  // most decisive number on a screen that scores 0%: if the nearest node missed by 1.4 dp the
  // problem is the tolerance (see N-2) or a one-line metric; if it missed by 20 dp the layout is
  // somewhere else entirely. Without it "0%" reads the same in both cases.
  const maxDelta = (m) => Math.max(m.dx, m.dy, m.dw, m.dh);
  const nearest = round(Math.min(...mismatched.map(maxDelta)), 2);
  const furthest = round(Math.max(...mismatched.map(maxDelta)), 2);
  const signature =
    dominantSharePct >= 60 && (Math.abs(medians.dx) >= 0.5 || Math.abs(medians.dy) >= 0.5)
      ? "systematic-offset"
      : dominantSharePct >= 60
        ? "size-driven"
        : "scattered";
  // The two nodes that came closest to passing, with both boxes. On a 0% screen this is the only
  // output that says *how* a node differs rather than how much: a candidate box that is 3 dp
  // narrower than the reference is text metrics; one that is 40 dp to the left is placement.
  const maxOf = (m) => Math.max(m.dx, m.dy, m.dw, m.dh);
  const closest = [...mismatched]
    .sort((a, b) => maxOf(a) - maxOf(b))
    .slice(0, 2)
    .map((m) => ({
      text: (m.ref?.text ?? m.ref?.role ?? "").slice(0, 24) || null,
      ref: m.ref?.box ?? null,
      cand: m.cand?.box ?? null,
      d: [m.dx, m.dy, m.dw, m.dh],
    }));
  // How many nodes are over tolerance *per dimension*. Position-only failures and size-only
  // failures share no fix, and a median hides the split.
  const over = Object.fromEntries(
    dims.map((d) => [d, mismatched.filter((m) => m[d] > (m.tolerance ?? 1)).length]),
  );
  return {
    count: total,
    medians,
    spreads,
    over,
    closest,
    dominantSharePct,
    nearest,
    furthest,
    signature,
    // The sentence a human reads first, and the one the worklog quotes.
    hint:
      signature === "systematic-offset"
        ? `${dominantSharePct}% of mismatched nodes sit within 0.5 dp of dx=${medians.dx} dp, dy=${medians.dy} dp — this is one offset, not many layout errors`
        : signature === "size-driven"
        ? `positions agree but sizes do not: median dw=${medians.dw} dp, dh=${medians.dh} dp across ${dominantSharePct}% of nodes — text metrics or padding, not placement`
        : `no dominant offset (${dominantSharePct}% within 0.5 dp of the medians): the mismatches are individual layout errors, nearest ${nearest} dp from passing, furthest ${furthest} dp`,
  };
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
