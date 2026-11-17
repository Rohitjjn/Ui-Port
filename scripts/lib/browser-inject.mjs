/**
 * Code injected into the prototype page during capture.
 *
 * Kept in one place, and unit-tested for syntactic validity and for the invariants
 * they guarantee: a typo here would otherwise only surface after a full CI round,
 * and a capture that silently stops freezing time produces a reference nobody can
 * match.
 */

export const FREEZE_CSS = `
  *, *::before, *::after {
    animation-delay: 0s !important;
    animation-duration: 0s !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    caret-color: transparent !important;
    scroll-behavior: auto !important;
  }
  html { scrollbar-width: none !important; }
  ::-webkit-scrollbar { display: none !important; }
`;

/**
 * Runs before any app code: pins the clock and seeds Math.random so that
 * time-dependent greetings and procedurally generated artwork are identical on
 * every run.
 */
export const SEED_SCRIPT = () => {
  const FIXED = new Date("2026-01-01T10:00:00Z").getTime();
  const RealDate = Date;
  class FixedDate extends RealDate {
    constructor(...a) {
      super(...(a.length ? a : [FIXED]));
    }
    static now() {
      return FIXED;
    }
  }
  window.Date = FixedDate;
  let seed = 42;
  Math.random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
};

/** Collects the DOM geometry dump the diff step compares against Compose semantics. */
export const GEOMETRY_SCRIPT = () => {
  const out = [];
  const SEL = "h1,h2,h3,h4,h5,h6,p,span,a,button,input,textarea,label,li,img,svg,[role],[data-testid]";
  const seen = new Set();
  const round = (n) => Math.round(n * 100) / 100;
  // The viewport, not the document. Compose only composes what is inside its scroll container and
  // clips the rest, while `getBoundingClientRect` happily reports elements that are scrolled out of
  // sight — so without this the DOM side lists ~400 nodes for a screen whose Compose side can only
  // ever produce the ~16 that are visible, and the geometry gate scores a correct screen at 0%.
  // Clipping here makes both dumps describe the same thing: the pixels in the screenshot.
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // Vertical extent against the viewport, not area. A wide banner below the fold can still have
  // half of its area inside the viewport horizontally, so an area test keeps it in the reference
  // while Compose — which clips the scroll container — cannot emit it. That asymmetry is what made
  // the geometry gate compare "reference 80 nodes" against "candidate 28 nodes".
  const visible = (r) => {
    if (r.bottom <= 0.5 || r.right <= 0.5 || r.top >= vh - 0.5 || r.left >= vw - 0.5) return false;
    const shownH = Math.min(r.bottom, vh) - Math.max(r.top, 0);
    return shownH >= Math.min(r.height, vh) * 0.5;
  };
  for (const el of document.querySelectorAll(SEL)) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (!visible(r)) continue;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) continue;
    const text = (el.innerText ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
    const role = el.getAttribute("role") ?? el.tagName.toLowerCase();
    const key = `${role}|${text}|${Math.round(r.x)}|${Math.round(r.y)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      text: text || null,
      role,
      testId: el.getAttribute("data-testid"),
      x: round(r.x),
      y: round(r.y),
      w: round(r.width),
      // `clipped` records that the element extends past the viewport, so a reviewer can tell a
      // layout mistake from content that simply continues below the fold.
      clipped: r.bottom > vh + 0.5 || r.top < -0.5 || r.right > vw + 0.5 || r.left < -0.5,
      h: round(r.height),
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      color: style.color,
      background: style.backgroundColor,
      radius: style.borderRadius,
    });
  }
  return out;
};

/** Signature used to decide the page has stopped changing. */
export const STABILITY_SCRIPT = () => {
  const el = document.querySelector("main") ?? document.body;
  return `${el.scrollHeight}:${document.querySelectorAll("*").length}`;
};

/**
 * State-triggering helpers. Each returns true when it actually changed the page —
 * states that cannot be reached are reported, never faked with injected DOM.
 */
export const STATE_SCRIPT = (state) => {
  if (state === "overlay") {
    const candidates = [
      ...document.querySelectorAll("[aria-haspopup='dialog'],[data-testid*='open'],[aria-label*='More'],[aria-label*='Options']"),
    ];
    if (!candidates.length) return false;
    candidates[0].click();
    return true;
  }
  if (state === "player-start") {
    // The now-playing surface is not a route: it is an overlay the mini player opens, and the
    // mini player only exists once something is queued. So start a track by clicking one — but
    // "the first button in main" is the header's Notifications control, which navigates away.
    // A track row is identified by what it renders: cover art (an <img>) and a duration in its
    // text. If neither exists, this is a page with no playable content and the state is
    // honestly reported as unreachable rather than faked.
    const buttons = [...document.querySelectorAll("main button")];
    const track = buttons.find((b) => b.querySelector("img") && /\d+:\d\d/.test(b.textContent || "")) || buttons.find((b) => b.querySelector("img"));
    if (!track) return false;
    track.click();
    return true;
  }
  if (state === "player-open") {
    const open = document.querySelector("[aria-label='Open player']");
    if (!open) return false;
    open.click();
    return true;
  }
  if (state === "focus") {
    const el = document.querySelector("input,textarea,[tabindex='0'],button");
    if (!el) return false;
    el.focus();
    return true;
  }
  return false;
};

/** Every injected function must be syntactically valid and serialisable to the page. */
export function validateInjection() {
  const problems = [];
  const fns = { SEED_SCRIPT, GEOMETRY_SCRIPT, STABILITY_SCRIPT };
  for (const [name, fn] of Object.entries(fns)) {
    try {
      new Function(`return (${fn.toString()})`);
    } catch (err) {
      problems.push(`${name} is not a valid function body: ${err.message}`);
    }
    if (!fn.toString().includes("=>") && !fn.toString().startsWith("function")) {
      problems.push(`${name} does not serialise to a function`);
    }
  }
  try {
    new Function(`return (${STATE_SCRIPT.toString()})`);
  } catch (err) {
    problems.push(`STATE_SCRIPT is not a valid function body: ${err.message}`);
  }
  // The freeze stylesheet must actually neutralise animation and transitions.
  for (const needed of ["animation-duration", "transition-duration", "caret-color", "scrollbar-width"]) {
    if (!FREEZE_CSS.includes(needed)) problems.push(`FREEZE_CSS is missing a ${needed} rule`);
  }
  if (/0s\s*!important/.test(FREEZE_CSS) === false) problems.push("FREEZE_CSS does not zero out durations");
  return problems;
}
