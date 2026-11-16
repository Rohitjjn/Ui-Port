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
import { FREEZE_CSS, GEOMETRY_SCRIPT, SEED_SCRIPT, STATE_SCRIPT, STABILITY_SCRIPT, validateInjection } from "./lib/browser-inject.mjs";
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

{
  const problems = validateInjection();
  if (problems.length) {
    process.stderr.write(`capture-reference: injected scripts are invalid:\n- ${problems.join("\n- ")}\n`);
    process.exit(2);
  }
}

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  process.stderr.write("capture-reference: playwright is not installed. Install with: npm i -D playwright && npx playwright install chromium\n");
  process.exit(EXIT_NO_BROWSER);
}

async function waitForStable(page, maxMs = 15000) {
  const start = Date.now();
  let last = -1;
  let stableSince = 0;
  while (Date.now() - start < maxMs) {
    const sig = await page.evaluate(STABILITY_SCRIPT);
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
async function applyState(page, state) {
  switch (state) {
    case "default":
      return true;
    case "overlay": {
      const opened = await page.evaluate(STATE_SCRIPT, "overlay");
      await page.waitForTimeout(400);
      return opened;
    }
    case "focus": {
      const focused = await page.evaluate(STATE_SCRIPT, "focus");
      await page.waitForTimeout(150);
      return focused;
    }
    case "player": {
      // Two separate evaluations, because React needs a tick between the two clicks: start
      // the first track, let the mini player mount, then open the player from it.
      const started = await page.evaluate(STATE_SCRIPT, "player-start");
      if (!started) return false;
      await page.waitForTimeout(400);
      const opened = await page.evaluate(STATE_SCRIPT, "player-open");
      await page.waitForTimeout(500);
      return opened;
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
    // Freeze time-dependent UI: fixed clock, seeded random.
    await page.addInitScript(SEED_SCRIPT);
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.addStyleTag({ content: FREEZE_CSS });

    for (const capture of captures) {
      for (const state of capture.states ?? ["default"]) {
        const url = hashUrl(baseUrl, capture.route);
        const dir = path.join(outRoot, deviceName, capture.id);
        fs.mkdirSync(dir, { recursive: true });
        const started = Date.now();
        try {
          // A state can outlive its own capture: the player overlay opened on the home route
          // stays open when the next capture navigates to the hash route, and it then dominates
          // that screen's screenshot (library dropped from 86.9% to 68.3% when this happened).
          // Each capture therefore starts from a cold document, not from whatever the previous
          // state left behind.
          await page.goto("about:blank");
          await page.goto(url, { waitUntil: "domcontentloaded" });
          await page.addStyleTag({ content: FREEZE_CSS });
          await page.waitForTimeout(150);
          const applied = await applyState(page, state);
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
          // Which track the page is playing, so a ported now-playing screen can be rendered
          // with the same one. Comparing two screenshots of different tracks measures content,
          // not layout, and this is the only cheap way to know.
          const playing = await page
            .evaluate(() => {
              const el = document.querySelector("[aria-label='Open player'] div, [aria-label='Open player'] span");
              return el ? (el.textContent || "").trim().slice(0, 80) : null;
            })
            .catch(() => null);
          fs.writeFileSync(path.join(dir, `${state}.geometry.json`), `${JSON.stringify(geometry, null, 2)}\n`);
          results.push({
            screen: capture.id,
            device: deviceName,
            state,
            status: "captured",
            screenshot: path.relative(process.cwd(), png),
            nodeCount: geometry.length,
            playing,
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
