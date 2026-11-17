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
  // Covered by something painted on top, at the element's own centre.
  //
  // A full-screen overlay — the port's now-playing player — does not remove the page beneath it
  // from the DOM, so `getBoundingClientRect` still reports the library rows it hides. The port
  // renders an overlay, not those rows, so counting them makes the reference claim ~40 nodes the
  // candidate can never have: `nowplaying` compared 55 reference nodes against 14 and could not
  // have passed at any level of porting effort.
  //
  // This is the same argument as the viewport clip: compare only what the screenshot shows. It is
  // deliberately a hit test at one point rather than a rectangle intersection, because a
  // half-covered label is still readable and hiding it would be the opposite error.
  const covered = (el, r) => {
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    if (x < 0 || y < 0 || x >= vw || y >= vh) return false;
    const top = document.elementFromPoint(x, y);
    if (!top) return false;
    return top !== el && !el.contains(top) && !top.contains(el);
  };
  // A *decorative* wrapper whose text is only its children's text is not a node.
  //
  // `<span class="min-w-0"><span>Most played</span><span>10 items</span></span>` yields a reference
  // node reading "Most played 10 items" — `innerText` joins the two lines with a newline — while the
  // port has two nodes for the same two labels, and nothing can ever produce that combined string.
  // Counting it made 22 of `library`'s 44 reference nodes unsatisfiable.
  //
  // The distinction that matters is semantic, not structural. A `<button>` or `<a>` composing its
  // text from children is one interactive target and an honest node: the nav link's 64x65.94 box is
  // exactly that, and dropping it would undo the fix that got `home` from 0% to 33%. A plain
  // `<span>` doing the same is a layout artefact with no semantics to match against.
  const SEMANTIC = "a,button,input,textarea,select,label,summary,[role],[data-testid],[aria-label]";
  const composesItsText = (el) => {
    const directText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (directText) return false;
    return [...el.children].some((c) => (c.innerText ?? "").trim());
  };
  const isDecorativeWrapper = (el) => !el.matches(SEMANTIC) && composesItsText(el);

  for (const el of document.querySelectorAll(SEL)) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (isDecorativeWrapper(el)) continue;
    if (!visible(r)) continue;
    if (covered(el, r)) continue;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) continue;
    // The label, not the concatenation.
    //
    // A tile is `<button><span>[icon]</span><span><span>Most played</span><span>10 items</span>
    // </span></button>`. `innerText` on the button yields "Most played 10 items" — one string no
    // Compose node can ever produce, because the port draws the two labels as two nodes. All eight
    // `library` tiles were therefore "missing" while every one of them was rendered.
    //
    // So a semantic container (button, link, role-bearing element) takes its text from its first
    // text-bearing leaf, which is its label: the thing a reader sees first, the thing the port
    // draws as a node, and the thing the box belongs to. Everything else keeps `innerText`, and the
    // fallback is the element's own text, so this can only ever narrow a name, never invent one.
    const firstTextLeaf = (node) => {
      if (node.children.length === 0) return node;
      for (const child of node.children) {
        if ((child.innerText ?? "").trim()) {
          const leaf = firstTextLeaf(child);
          if (leaf) return leaf;
        }
      }
      return null;
    };
    const semanticContainer = el.matches("a,button,[role],[aria-label]");
    const labelLeaf = semanticContainer ? firstTextLeaf(el) : null;
    // ...unless that leaf is itself a node we will emit.
    //
    // Then the container is not carrying its own text, it is re-announcing a child: the tile
    // `<button>` and the `<span>Most played</span>` inside it would both enter the reference as
    // "Most played", the port has that text once, and the second copy is reported missing for ever.
    // Six `library` tiles plus five playlist cards were doing this — 11 of 33 reference nodes were
    // duplicates of their own children, which caps coverage at 67% no matter how good the port is.
    //
    // The nav `<a>` is unaffected because its label is a bare text node with no element of its own,
    // so the leaf falls back to the `<a>` and the 64x65.94 box survives.
    if (labelLeaf && labelLeaf !== el && labelLeaf.matches(SEL)) continue;
    const text = (labelLeaf?.innerText ?? el.innerText ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
    // Width of the text, not of the box it happens to sit in.
    //
    // `.block` makes a span take the whole column, so `<span class="block text-[12px]">4 items</span>`
    // reports 83.97 dp while the four glyphs are 42.5 — and Compose's `Text` reports exactly the glyph
    // extent. Every block-level text run therefore looked like a 40 dp width error on a correct port:
    // `home`'s headline read 209 against 189 for the same sentence, and `library`'s counts read 84
    // against 42. The reference was comparing a text run to a container.
    //
    // The text's own rect is clamped to the element's box, so a `truncate` with an ellipsis still
    // measures only what is drawn. Only the horizontal extent is taken: the vertical box is the line
    // box, which is what Compose reports and what matched all along.
    const textExtent = (() => {
      // A target is a box, not a text run: the nav `<a>` is a 64 dp tap area whose icon and label
      // together span 56, and the "Log in" button is 36 dp tall with a 23 dp word inside. Measuring
      // those as text shrank the reference below its own hit area and unmatched every one of them.
      if (el.matches(SEMANTIC)) return null;
      if ([...el.children].some((c) => (c.innerText ?? "").trim())) return null;
      if (!(el.innerText ?? "").trim()) return null;
      const range = document.createRange();
      range.selectNodeContents(el);
      const rects = [...range.getClientRects()].filter((q) => q.width > 0.5 && q.height > 0.5);
      if (!rects.length) return null;
      const left = Math.max(Math.min(...rects.map((q) => q.left)), r.left);
      const right = Math.min(Math.max(...rects.map((q) => q.right)), r.right);
      return right - left > 0.5 ? { left, right } : null;
    })();
    const role = el.getAttribute("role") ?? el.tagName.toLowerCase();
    const key = `${role}|${text}|${Math.round(r.x)}|${Math.round(r.y)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      text: text || null,
      role,
      testId: el.getAttribute("data-testid"),
      x: round(textExtent ? textExtent.left : r.x),
      y: round(r.y),
      w: round(textExtent ? textExtent.right - textExtent.left : r.width),
      // `clipped` records that the element extends past the viewport, so a reviewer can tell a
      // layout mistake from content that simply continues below the fold.
      clipped: r.bottom > vh + 0.5 || r.top < -0.5 || r.right > vw + 0.5 || r.left < -0.5,
      // Enclosing boxes, smallest first — the same field the Compose dump writes. The comparator
      // uses it to accept "the label is inside the link, and the link is where the prototype puts
      // it" instead of reporting a 38 dp shift for a nav item that is correct.
      ancestors: (() => {
        const out = [];
        let parent = el.parentElement;
        while (parent && out.length < 3) {
          const pr = parent.getBoundingClientRect();
          if (pr.width > 0 && pr.height > 0) out.push({ x: round(pr.x), y: round(pr.y), w: round(pr.width), h: round(pr.height) });
          parent = parent.parentElement;
        }
        return out;
      })(),
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
