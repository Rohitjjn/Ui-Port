#!/usr/bin/env node
/**
 * Capture reference screenshots of the web prototype with Playwright.
 *
 * Deterministic by construction:
 *  - fixed viewport + device scale factor from config/viewports.json
 *  - CSS animations/transitions frozen, requestAnimationFrame available but
 *    framer-motion animations are pre-seeded via prefers-reduced-motion
 *  - all network requests blocked (the prototype must run on bundled data)
 *  - fonts awaited, caret hidden, scrollbars hidden by fixed viewport
 *  - DOM geometry dump next to each screenshot
 *
 *   node scripts/capture-reference.mjs --base-url http://localhost:4173 \
 *     --spec .uiport/capture-spec.json --out .uiport/reference [--only home,search]
 *
 * If Playwright or its browser is unavailable, exit code 7 with a clear message:
 * the caller then re-plans the work for CI (see docs/PLAN.md D3).
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { buildCapturePlan, hashUrl, validateSpec } from "./lib/capture-spec.mjs";
import { readJson, readJsonSafe, walk } from "./lib/fs-utils.mjs";

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = args[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
};

const EXIT_NO_BROWSER = 7;

const baseUrl = flag("base-url", "http://localhost:4173");
const outRoot = path.resolve(flag("out", ".uiport/reference"));
const specFile = flag("spec");
const viewportsFile = path.resolve(flag("viewports", path.join(import.meta.dirname, "..", "config", "viewports.json")));
const viewports = readJson(viewportsFile);
const only = flag("only") ? String(flag("only")).split(",").map((s) => s.trim()) : null;

let spec;
if (specFile) {
  const res = readJsonSafe(path.resolve(String(specFile)));
  if (!res.ok) {
    process.stderr.write(`capture-reference: cannot read spec ${specFile}: ${res.error}\n`);
    process.exit(2);
  }
  const v = validateSpec(res.value);
  if (!v.ok) {
    process.stderr.write(`capture-reference: invalid spec:\n- ${v.errors.join("\n- ")}\n`);
    process.exit(2);
  }
  spec = res.value;
} else {
  process.stderr.write("capture-reference: --spec is required (build it with scripts/plan-capture.mjs)\n");
  process.exit(2);
}

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  process.stderr.write("capture-reference: playwright is not installed. Install with: npm i -D playwright && npx playwright install chromium\n");
  process.exit(EXIT_NO_BROWSER);
}

const FREEZE_CSS = `
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

const GEOMETRY_SCRIPT = () => {
  const out = [];
  const SEL = "h1,h2,h3,h4,h5,h6,p,span,a,button,input,textarea,label,li,img,svg,[role],[data-testid]";
  const seen = new Set();
  for (const el of document.querySelectorAll(SEL)) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
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
      h: round(r.height),
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      color: style.color,
      background: style.backgroundColor,
      radius: style.borderRadius,
    });
  }
  return out;
  function round(n) {
    return Math.round(n * 100) / 100;
  }
};

async function waitForStable(page, maxMs = 15000) {
  const start = Date.now();
  let last = -1;
  let stableSince = 0;
  while (Date.now() - start < maxMs) {
    const sig = await page.evaluate(() => {
      const el = document.querySelector("main") ?? document.body;
      return `${el.scrollHeight}:${document.querySelectorAll("*").length}`;
    });
    if (sig === last) {
      if (Date.now() - stableSince > 250) return true;
    } else {
      last = sig;
      stableSince = Date.now();
    }
    await page.waitForTimeout(100);
  }
  return false;
}

/** Trigger a non-default state without inventing behaviour the app does not have. */
async function applyState(page, state, screenRoute) {
  switch (state) {
    case "default":
      return true;
    case "overlay": {
      // Open the first obvious affordance that yields a sheet/dialog.
      const opened = await page.evaluate(() => {
        const candidates = [
          ...document.querySelectorAll("[aria-haspopup='dialog'],[data-testid*='open'],[aria-label*='More'],[aria-label*='Options']"),
        ];
        if (!candidates.length) return false;
        candidates[0].click();
        return true;
      });
      await page.waitForTimeout(400);
      return opened;
    }
    case "focus": {
      const focused = await page.evaluate(() => {
        const el = document.querySelector("input,textarea,[tabindex='0'],button");
        if (!el) return false;
        el.focus();
        return true;
      });
      await page.waitForTimeout(150);
      return focused;
    }
    case "empty":
    case "loading":
    case "error":
    case "tabbed":
      // These need app-specific fixtures; a generic click would fabricate UI.
      // The state is recorded as "not reproducible" instead of faked.
      return false;
    default:
      return false;
  }
}

let browser;
try {
  browser = await chromium.launch({ args: ["--font-render-hinting=none", "--disable-lcd-text"] });
} catch (err) {
  process.stderr.write(
    `capture-reference: could not launch Chromium (${err.message.split("\n")[0]}).\n` +
      "Run: npx playwright install chromium\n" +
      "If this machine cannot download browsers, capture must run in CI (execution mode CI_ONLY/HYBRID).\n",
  );
  process.exit(EXIT_NO_BROWSER);
}

const results = [];
let failures = 0;

try {
  const byDevice = new Map();
  for (const capture of spec.captures) {
    if (only && !only.includes(capture.id)) continue;
    if (!byDevice.has(capture.device)) byDevice.set(capture.device, []);
    byDevice.get(capture.device).push(capture);
  }

  for (const [deviceName, captures] of byDevice) {
    const vp = viewports.targets[deviceName];
    if (!vp) {
      process.stderr.write(`capture-reference: unknown device "${deviceName}"\n`);
      failures++;
      continue;
    }
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.dpr,
      locale: viewports.defaults?.locale ?? "en-US",
      timezoneId: viewports.defaults?.timezone ?? "UTC",
      colorScheme: viewports.defaults?.colorScheme ?? "light",
      reducedMotion: "reduce",
    });
    // No network: the prototype must be self-contained (bundled fonts, bundled data).
    await context.route("**/*", (route) => {
      const url = route.request().url();
      if (url.startsWith(baseUrl) || url.startsWith("data:") || url.startsWith("blob:")) return route.continue();
      return route.abort();
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      // Freeze time-dependent UI: fixed clock, no random.
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
    });
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.addStyleTag({ content: FREEZE_CSS });

    for (const capture of captures) {
      for (const state of capture.states ?? ["default"]) {
        const url = hashUrl(baseUrl, capture.route);
        const dir = path.join(outRoot, deviceName, capture.id);
        fs.mkdirSync(dir, { recursive: true });
        const started = Date.now();
        try {
          await page.goto(url, { waitUntil: "domcontentloaded" });
          await page.waitForTimeout(150);
          const applied = await applyState(page, state, capture.route);
          if (!applied && state !== "default") {
            results.push({ screen: capture.id, device: deviceName, state, status: "state-not-reproducible", ms: Date.now() - started });
            continue;
          }
          await waitForStable(page);
          await page.evaluate(() => document.fonts?.ready);
          await page.waitForTimeout(250);
          const png = path.join(dir, `${state}.png`);
          await page.screenshot({ path: png, animations: "disabled", caret: "hide", fullPage: false });
          const geometry = await page.evaluate(GEOMETRY_SCRIPT);
          fs.writeFileSync(path.join(dir, `${state}.geometry.json`), `${JSON.stringify(geometry, null, 2)}\n`);
          results.push({
            screen: capture.id,
            device: deviceName,
            state,
            status: "captured",
            screenshot: path.relative(process.cwd(), png),
            nodeCount: geometry.length,
            ms: Date.now() - started,
          });
        } catch (err) {
          failures++;
          results.push({ screen: capture.id, device: deviceName, state, status: "error", error: err.message, ms: Date.now() - started });
        }
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}

fs.mkdirSync(outRoot, { recursive: true });
fs.writeFileSync(path.join(outRoot, "capture-report.json"), `${JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl, results }, null, 2)}\n`);

const captured = results.filter((r) => r.status === "captured").length;
const skipped = results.filter((r) => r.status === "state-not-reproducible").length;
process.stdout.write(
  `captured ${captured} screenshot(s), ${skipped} state(s) not reproducible, ${failures} error(s) -> ${path.relative(process.cwd(), outRoot)}\n`,
);
if (failures) process.exitCode = 1;
