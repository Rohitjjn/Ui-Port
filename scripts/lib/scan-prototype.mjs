/**
 * Prototype scanner — static analysis of a React/TSX web prototype.
 *
 * Goal: produce a compact, reliable map without asking the model to read every
 * file. Regex + token heuristics only (no TypeScript compiler dependency), so it
 * runs anywhere Node runs and stays fast on large prototypes.
 *
 * Everything returned is data; rendering to markdown happens in the skill.
 */
import path from "node:path";
import { readText, rel, toPosix, walk } from "./fs-utils.mjs";

const SOURCE_EXT = new Set([".tsx", ".jsx", ".ts", ".js", ".css", ".scss"]);

const MOTION_LIBS = ["framer-motion", "gsap", "react-spring", "@react-spring/web", "motion", "lottie-react", "auto-animate"];
const CHART_LIBS = ["recharts", "chart.js", "react-chartjs-2", "d3", "victory", "nivo", "@nivo/core", "apexcharts", "echarts"];
const UI_LIBS = [
  "@radix-ui/react-dialog",
  "@radix-ui/react-slider",
  "@radix-ui/react-tabs",
  "react-select",
  "@headlessui/react",
  "react-hot-toast",
  "sonner",
  "vaul",
  "embla-carousel-react",
  "react-window",
  "react-virtuoso",
];

const TAILWIND_BREAKPOINTS = ["sm", "md", "lg", "xl", "2xl"];

/** Extract `path: "..."` + `element: <X />` pairs from a router file. */
export function parseRoutes(source, file) {
  const routes = [];
  const routeRe = /\{\s*(?:path|index)\s*:\s*("([^"]*)"|true)/g;
  let m;
  while ((m = routeRe.exec(source))) {
    const index = m[1] === "true";
    const routePath = index ? "/" : m[2];
    const tail = source.slice(m.index, m.index + 400);
    const el = tail.match(/element\s*:\s*<([A-Za-z0-9_.]+)[^>]*?\/?>/);
    const component = el ? el[1] : null;
    const redirect = component === "Navigate" || component === "Redirect";
    // A route with `children` is a layout/shell wrapper, not a screen.
    const layout = /children\s*:/.test(tail.slice(el?.index ?? 0, (el?.index ?? 0) + 300));
    routes.push({ path: routePath, index, component, redirect, layout, file: toPosix(file) });
  }
  // Nested <Route path="x" element={<Y/>} /> (react-router v6 JSX style)
  const jsxRe = /<Route\s+[^>]*path=["']([^"']+)["'][^>]*?(?:element=\{<([A-Za-z0-9_.]+)|component=\{([A-Za-z0-9_.]+))/g;
  while ((m = jsxRe.exec(source))) {
    const component = m[2] ?? m[3] ?? null;
    routes.push({ path: m[1], index: false, component, redirect: component === "Navigate" || component === "Redirect", file: toPosix(file) });
  }
  return dedupe(routes, (r) => `${r.path}::${r.component}`);
}

function dedupe(arr, keyFn) {
  const seen = new Map();
  for (const item of arr) if (!seen.has(keyFn(item))) seen.set(keyFn(item), item);
  return [...seen.values()];
}

export function parseImports(source) {
  const out = [];
  const re = /(?:^|\n)\s*import\s+(?:type\s+)?([^;]*?)\s+from\s+["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(source))) {
    const clause = m[1];
    const from = m[2];
    const names = [];
    const named = clause.match(/\{([^}]*)\}/);
    if (named) {
      for (const part of named[1].split(",")) {
        const clean = part.trim().split(/\s+as\s+/)[0].trim();
        if (clean && !clean.startsWith("type ")) names.push(clean);
      }
    }
    const def = clause.match(/^([A-Za-z0-9_$]+)\s*(?:,|$)/);
    if (def && !clause.startsWith("{") && !clause.startsWith("*")) names.push(def[1]);
    const ns = clause.match(/\*\s+as\s+([A-Za-z0-9_$]+)/);
    if (ns) names.push(ns[1]);
    out.push({ from, names, typeOnly: /^\s*import\s+type/.test(source.slice(Math.max(0, m.index), m.index + 40)) });
  }
  return out;
}

/** Tailwind responsive prefixes actually used, per file, with the utilities they modify. */
export function parseBreakpoints(source) {
  const hits = {};
  for (const bp of TAILWIND_BREAKPOINTS) {
    const re = new RegExp(`\\b${bp}:([a-zA-Z0-9!:_./\\[\\]-]+)`, "g");
    const utils = new Set();
    let m;
    while ((m = re.exec(source))) {
      // keep only the utility family, not the whole value list
      const fam = m[1].split("-")[0].replace(/[![\]]/g, "");
      if (fam) utils.add(fam);
    }
    if (utils.size) hits[bp] = [...utils].sort();
  }
  return hits;
}

export function parseMediaQueries(source) {
  const out = [];
  const re = /@media[^{]+/g;
  let m;
  while ((m = re.exec(source))) out.push(m[0].trim());
  const mq = source.match(/matchMedia\(\s*["']([^"']+)["']/g) ?? [];
  for (const q of mq) out.push(q.replace(/matchMedia\(\s*["']|["']/g, ""));
  return [...new Set(out)];
}

/** Exported components with a cheap props summary. */
export function parseComponents(source) {
  const out = [];
  const fnRe = /export\s+(?:default\s+)?function\s+([A-Z][A-Za-z0-9_]*)\s*(?:<[^>]*>)?\s*\(([^)]*)\)/g;
  let m;
  while ((m = fnRe.exec(source))) out.push({ name: m[1], props: summarizeProps(m[2]) });
  const constRe = /export\s+const\s+([A-Z][A-Za-z0-9_]*)\s*(?::[^=]+)?=\s*(?:\(([^)]*)\)|[A-Za-z0-9_]+)\s*=>/g;
  while ((m = constRe.exec(source))) out.push({ name: m[1], props: summarizeProps(m[2] ?? "") });
  return dedupe(out, (c) => c.name);
}

function summarizeProps(params) {
  if (!params) return [];
  const inner = params.replace(/^\{|\}$/g, "").trim();
  if (!inner) return [];
  return inner
    .split(",")
    .map((p) => p.split(":")[0].replace("?", "").trim())
    .filter((p) => p && p !== "...rest" && !p.startsWith("..."))
    .map((p) => p.trim());
}

export function parseStateStores(source) {
  const stores = [];
  const re = /export\s+const\s+use([A-Za-z0-9_]*)Store\s*=\s*create(?:<[^>]*>)?\(/g;
  let m;
  while ((m = re.exec(source))) {
    const name = `use${m[1]}Store`;
    // Keys: `key: value` at two spaces of indentation inside the create() body.
    const body = storeBody(source, m.index);
    const keys = [...body.matchAll(/^\s+([a-zA-Z0-9_]+)\s*[:(]/gm)].map((k) => k[1]);
    const actions = [...body.matchAll(/^\s+([a-zA-Z0-9_]+)\s*:\s*\([^)]*\)\s*=>/gm)].map((k) => k[1]);
    const NON_KEY_WORDS = new Set(["persist", "createJSONStorage", "partialize", "merge", "onRehydrateStorage", "name", "version", "storage", "skipHydration"]);
    stores.push({
      name,
      stateKeys: [...new Set(keys)].filter((k) => !actions.includes(k) && !NON_KEY_WORDS.has(k)),
      actions: [...new Set(actions)],
    });
  }
  return stores;
}

/**
 * Body of a zustand store declaration.
 *
 * The store is often wrapped (`create<T>()(persist((set, get) => ({...})))`), so the
 * first balanced parenthesis is not the state object. Taking the span from the
 * declaration to the next top-level `export` is simple, tolerant, and precise
 * enough for line-anchored key extraction.
 */
function storeBody(source, startIndex) {
  const window = source.slice(startIndex, startIndex + 16000);
  const nextExport = window.slice(20).search(/\nexport\s/);
  return nextExport === -1 ? window : window.slice(0, nextExport + 20);
}

export function parseHandlers(source) {
  const out = new Set();
  for (const m of source.matchAll(/on([A-Z][A-Za-z]+)\s*=\s*\{([^}=]{1,80})\}/g)) {
    out.add(`${m[1].toLowerCase()}:${m[2].trim()}`);
  }
  for (const m of source.matchAll(/handle([A-Z][A-Za-z]+)\s*=/g)) out.add(`handle${m[1]}`);
  return [...out].slice(0, 60);
}

/** Animations: framer-motion props, CSS animations/keyframes. */
export function parseMotion(source) {
  const found = [];
  const fm = /<(?:motion\.([a-zA-Z]+)|AnimatePresence)/g;
  for (const m of source.matchAll(fm)) found.push({ kind: "framer-motion", element: m[1] ?? "AnimatePresence" });
  for (const m of source.matchAll(/\b(initial|animate|exit|transition|whileHover|whileTap|layoutId)\s*=\s*\{\{?/g)) {
    found.push({ kind: "framer-motion-prop", prop: m[1] });
  }
  for (const m of source.matchAll(/animation:\s*([a-zA-Z0-9_,\s.-]+);/g)) found.push({ kind: "css-animation", value: m[1].trim() });
  for (const m of source.matchAll(/@keyframes\s+([a-zA-Z0-9_-]+)/g)) found.push({ kind: "css-keyframes", name: m[1] });
  return dedupe(found, (f) => JSON.stringify(f));
}

export function parseAssets(source) {
  const out = [];
  for (const m of source.matchAll(/url\((?:["']?)(data:image\/svg\+xml[^)]{0,200})/g)) out.push({ kind: "inline-svg", sample: m[1].slice(0, 60) });
  for (const m of source.matchAll(/(?:src|href)=["']([^"']+\.(?:png|jpe?g|webp|svg|gif|mp4|webm|woff2?|ttf|otf))["']/g)) {
    out.push({ kind: "file", path: m[1] });
  }
  for (const m of source.matchAll(/<svg\b[^>]*?viewBox=["']([^"']+)["']/g)) out.push({ kind: "svg-element", viewBox: m[1] });
  for (const m of source.matchAll(/fontFamily:\s*["']([^"']+)["']/g)) out.push({ kind: "font-family", value: m[1] });
  return dedupe(out, (a) => JSON.stringify(a));
}

/**
 * CSS custom properties (design tokens), split into the light ("@theme" / :root)
 * values and the dark-mode overrides (".dark" block). A flat map would silently
 * keep only the dark values, which is exactly the kind of bug that makes a port
 * look wrong in light mode.
 */
export function parseDesignTokens(source) {
  const grab = (text) => {
    const out = {};
    for (const m of text.matchAll(/--([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
    return out;
  };
  const block = (selectorRe) => {
    const match = selectorRe.exec(source);
    if (!match) return "";
    const open = source.indexOf("{", match.index + match[0].length - 1);
    if (open === -1) return "";
    let depth = 0;
    for (let j = open; j < source.length; j++) {
      if (source[j] === "{") depth++;
      else if (source[j] === "}") {
        depth--;
        if (depth === 0) return source.slice(open + 1, j);
      }
    }
    return "";
  };
  const light = { ...grab(block(/@theme\s*\{/)), ...grab(block(/:root\s*\{/)) };
  const dark = grab(block(/(?:^|\n)\s*\.dark\s*\{/));
  const all = grab(source);
  return { light, dark, all, count: Object.keys(all).length };
}

export function parseFonts({ html = "", css = "", sources = {} }) {
  const families = new Set();
  for (const src of [html, css, ...Object.values(sources)]) {
    for (const m of String(src).matchAll(/font-family\s*:\s*([^;"'}]+)/g)) {
      for (const f of m[1].split(",")) {
        const name = f.trim().replace(/^["']|["']$/g, "");
        if (
          name &&
          !name.startsWith("var(") &&
          !/^(ui-|system-ui|sans-serif|serif|monospace|inherit|-apple-system|Segoe UI|Georgia|Arial|Helvetica)/i.test(name)
        ) {
          families.add(name);
        }
      }
    }
    for (const m of String(src).matchAll(/family=([A-Za-z+0-9:;@,._ -]+)/g)) {
      for (const part of m[1].split("&")) {
        const name = part.split(":")[0].replace(/\+/g, " ").trim();
        if (name) families.add(name);
      }
    }
    for (const m of String(src).matchAll(/--font-([a-zA-Z0-9-]+)\s*:\s*([^;]+)/g)) {
      const first = m[2].split(",")[0].trim().replace(/^["']|["']$/g, "");
      if (first && !first.startsWith("var(") && !/^(ui-|system-ui|sans-serif|serif|monospace)$/.test(first)) families.add(first);
    }
  }
  return [...families].sort();
}

/** TS interfaces = the data shapes the UI needs from the engine. */
export function parseDataShapes(sources) {
  const shapes = {};
  for (const [file, src] of Object.entries(sources)) {
    for (const m of src.matchAll(/export\s+interface\s+([A-Za-z0-9_]+)\s*\{([\s\S]*?)\n\}/g)) {
      const fields = m[2]
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("//") && !l.startsWith("/*"))
        .map((l) => {
          const fm = l.match(/^([A-Za-z0-9_]+)(\??):\s*([^;]+);?/);
          return fm ? { name: fm[1], optional: fm[2] === "?", type: fm[3].trim() } : null;
        })
        .filter(Boolean);
      shapes[m[1]] = { file: toPosix(file), fields };
    }
  }
  return shapes;
}

/** State variants a screen can show, inferred from conditionals and shared components. */
export function inferStates(source) {
  const states = new Set(["default"]);
  if (/if\s*\(!?\s*\w*[Ll]oading|isLoading|Skeleton|Spinner|Loading\b/.test(source)) states.add("loading");
  if (/if\s*\(!?\s*\w*[Ee]rror|error\s*&&|isError/.test(source)) states.add("error");
  if (/length\s*===\s*0|\.length\s*\?\s*|Empty\b|No results|empty/i.test(source)) states.add("empty");
  if (/<dialog|Modal|Sheet|Drawer|open=/.test(source)) states.add("overlay");
  if (/onFocus|focus-visible|:focus/.test(source)) states.add("focus");
  if (/Tabs|tab\s*===|activeTab/.test(source)) states.add("tabbed");
  return [...states];
}

export function scanPrototype(root, { maxFiles = 4000 } = {}) {
  const files = walk(root, { maxFiles }).filter((f) => SOURCE_EXT.has(path.extname(f).toLowerCase()));
  const sources = {};
  const pkgRaw = readText(path.join(root, "package.json"), null);
  let pkg = {};
  try {
    pkg = pkgRaw ? JSON.parse(pkgRaw) : {};
  } catch {
    pkg = {};
  }
  const html = readText(path.join(root, "index.html"), "");
  for (const f of files) sources[rel(root, f)] = readText(f, "");

  const cssFiles = files.filter((f) => /\.(css|scss)$/.test(f));
  const css = cssFiles.map((f) => readText(f, "")).join("\n");
  const tsxFiles = files.filter((f) => /\.(tsx|jsx)$/.test(f));

  const routes = [];
  const components = [];
  const importsByFile = {};
  const breakpointUsage = {};
  const fileStates = {};
  const motion = [];
  const assets = [];
  const handlers = {};

  for (const f of files) {
    const src = sources[rel(root, f)] ?? "";
    const r = rel(root, f);
    // Imports are collected from every source file (.ts included: that is where
    // zustand stores and services live), UI facts only from TSX/JSX.
    const imps = parseImports(src);
    if (imps.length) importsByFile[r] = imps;
    if (!/\.(tsx|jsx)$/.test(r)) continue;
    for (const route of parseRoutes(src, r)) routes.push(route);
    for (const c of parseComponents(src)) components.push({ ...c, file: r });
    const bps = parseBreakpoints(src);
    if (Object.keys(bps).length) breakpointUsage[r] = bps;
    const st = inferStates(src);
    if (st.length > 1) fileStates[r] = st;
    for (const mo of parseMotion(src)) motion.push({ ...mo, file: r });
    for (const a of parseAssets(src)) assets.push({ ...a, file: r });
    const hs = parseHandlers(src);
    if (hs.length) handlers[r] = hs;
  }
  for (const f of cssFiles) {
    const src = sources[rel(root, f)] ?? "";
    for (const mo of parseMotion(src)) motion.push({ ...mo, file: rel(root, f) });
    for (const a of parseAssets(src)) assets.push({ ...a, file: rel(root, f) });
  }

  // External libraries with usage counts
  const libs = new Map();
  for (const [file, imps] of Object.entries(importsByFile)) {
    for (const imp of imps) {
      if (imp.from.startsWith(".") || imp.from.startsWith("@/")) continue;
      const pkgName = imp.from.startsWith("@") ? imp.from.split("/").slice(0, 2).join("/") : imp.from.split("/")[0];
      const entry = libs.get(pkgName) ?? { name: pkgName, usedIn: new Set(), names: new Set(), kind: classifyLib(pkgName) };
      entry.usedIn.add(file);
      for (const n of imp.names) entry.names.add(n);
      libs.set(pkgName, entry);
    }
  }
  const libraries = [...libs.values()]
    .map((l) => ({ name: l.name, kind: l.kind, files: l.usedIn.size, symbols: [...l.names].slice(0, 30) }))
    .sort((a, b) => b.files - a.files);

  const stores = [];
  for (const [file, src] of Object.entries(sources)) {
    for (const s of parseStateStores(src)) stores.push({ ...s, file });
  }

  return {
    root: path.resolve(root),
    // Source text per relative path. Downstream steps (fixture resolution, token
    // extraction) reuse this instead of walking the tree a second time.
    sources,
    generatedAt: new Date().toISOString(),
    stack: {
      name: pkg.name ?? null,
      scripts: pkg.scripts ?? {},
      dependencies: pkg.dependencies ?? {},
      devDependencies: pkg.devDependencies ?? {},
      framework: detectFramework(pkg),
      bundler: pkg.devDependencies?.vite || pkg.dependencies?.vite ? "vite" : pkg.dependencies?.["react-scripts"] ? "cra" : "unknown",
      typescript: Boolean(pkg.devDependencies?.typescript || pkg.dependencies?.typescript),
    },
    files: {
      total: files.length,
      tsx: tsxFiles.length,
      css: cssFiles.length,
      sourceLines: Object.values(sources).reduce((n, s) => n + s.split("\n").length, 0),
    },
    routes: dedupe(routes, (r) => r.path),
    screens: buildScreens(routes, components, fileStates, breakpointUsage),
    components: dedupe(components, (c) => c.name),
    libraries,
    stores,
    responsive: {
      breakpoints: breakpointUsage,
      mediaQueries: parseMediaQueries(css + Object.values(sources).join("\n")),
      usesContainerQueries: /@container/.test(css),
      darkMode: /dark/.test(css) ? (/classList\.toggle\(\s*["']dark/.test(Object.values(sources).join("\n")) ? "class-toggle" : "css") : "none",
    },
    motion: {
      libraries: MOTION_LIBS.filter((l) => libraries.some((x) => x.name === l)),
      items: dedupe(motion, (m) => JSON.stringify(m)).slice(0, 200),
      counts: countBy(motion, (m) => m.kind),
    },
    assets: {
      items: dedupe(assets, (a) => JSON.stringify(a)).slice(0, 200),
      counts: countBy(assets, (a) => a.kind),
    },
    fonts: parseFonts({ html, css, sources }),
    designTokens: parseDesignTokens(css),
    dataShapes: parseDataShapes(sources),
    handlers,
    warnings: buildWarnings({ libraries, assets: { items: dedupe(assets, (a) => JSON.stringify(a)) }, motion: { libraries: MOTION_LIBS.filter((l) => libraries.some((x) => x.name === l)) } }),
  };
}

function classifyLib(name) {
  if (MOTION_LIBS.includes(name)) return "motion";
  if (CHART_LIBS.includes(name)) return "charts";
  if (UI_LIBS.includes(name)) return "ui";
  if (name === "react") return "framework";
  if (name === "react-dom") return "framework";
  if (name === "react-router-dom" || name === "react-router") return "navigation";
  if (name === "zustand" || name === "redux" || name === "@reduxjs/toolkit" || name === "jotai" || name === "mobx") return "state";
  if (name === "tailwindcss" || name.startsWith("tailwind")) return "styling";
  if (name === "lucide-react" || name === "react-icons" || name.startsWith("@heroicons")) return "icons";
  if (name === "clsx" || name === "class-variance-authority" || name === "tailwind-merge") return "utility";
  return "other";
}

function detectFramework(pkg) {
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  if (deps.next) return "next";
  if (deps["react-scripts"]) return "create-react-app";
  if (deps.vite && deps.react) return "vite-react";
  if (deps.react) return "react";
  if (deps.vue) return "vue";
  if (deps.svelte) return "svelte";
  return "unknown";
}

function buildScreens(routes, components, fileStates, breakpointUsage) {
  const byComponent = new Map(components.map((c) => [c.name, c]));
  const used = new Set();
  const screens = [];
  for (const r of routes) {
    if (r.redirect) continue; // <Navigate> is not a screen
    if (r.layout) continue; // a route with children is the shell, not a screen
    const comp = r.component ? byComponent.get(r.component) : null;
    const file = comp?.file ?? r.file;
    const bps = breakpointUsage[file] ?? {};
    let id = r.path === "/" || r.index ? "home" : r.path.replace(/^\//, "").replace(/[/:]/g, "-").replace(/-+$/, "");
    if (used.has(id)) {
      let n = 2;
      while (used.has(`${id}-${n}`)) n++;
      id = `${id}-${n}`;
    }
    used.add(id);
    screens.push({
      id,
      route: r.path,
      component: r.component,
      file,
      states: fileStates[file] ?? ["default"],
      responsive: Object.keys(bps),
      hasParams: r.path.includes(":"),
      // A route whose component is the layout shell is a container, not a screen.
      isShell: false,
    });
  }
  return screens;
}

function buildWarnings({ libraries, assets, motion }) {
  const w = [];
  if (libraries.some((l) => l.kind === "charts")) w.push("chart library present: plan a Compose chart approach or ask the user (docs/LIMITS.md#charts)");
  if (libraries.some((l) => l.name === "lottie-react")) w.push("Lottie animation present: needs lottie-compose or a static fallback");
  if (assets.items.some((a) => a.kind === "inline-svg")) w.push("inline SVG art present: must be converted to ImageVector (script) or drawn with Canvas");
  if (motion.libraries.length) w.push(`motion library present (${motion.libraries.join(", ")}): map to Compose animation APIs, freeze at capture time`);
  if (!libraries.length) w.push("no external libraries detected: check that the prototype sources were found at the given root");
  return w;
}

function countBy(arr, fn) {
  const out = {};
  for (const item of arr) {
    const k = fn(item);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

/** Markdown renderer kept in the scanner so `scan-prototype --md` is one command. */
export function renderPrototypeMap(scan) {
  const L = [];
  L.push("# Prototype map", "");
  L.push(`Scanned \`${scan.root}\` at ${scan.generatedAt}.`, "");
  L.push("## Stack", "", "| Item | Value |", "| --- | --- |");
  L.push(`| Framework | ${scan.stack.framework} |`);
  L.push(`| Bundler | ${scan.stack.bundler} |`);
  L.push(`| TypeScript | ${scan.stack.typescript ? "yes" : "no"} |`);
  L.push(`| Source files | ${scan.files.total} (${scan.files.tsx} TSX/JSX, ${scan.files.css} CSS) |`);
  L.push(`| Source lines | ${scan.files.sourceLines} |`);
  L.push("");
  L.push("## Screens / routes", "");
  L.push("| id | route | component | file | states | responsive |", "| --- | --- | --- | --- | --- | --- |");
  for (const s of scan.screens) {
    L.push(`| ${s.id} | \`${s.route}\` | ${s.component ?? "-"} | \`${s.file}\` | ${s.states.join(", ")} | ${s.responsive.join(", ") || "-"} |`);
  }
  L.push("", `${scan.screens.length} screens.`, "");
  L.push("## Libraries (need a Compose equivalent)", "");
  L.push("| Library | Kind | Files | Symbols |", "| --- | --- | --- | --- |");
  for (const l of scan.libraries) L.push(`| \`${l.name}\` | ${l.kind} | ${l.files} | ${l.symbols.slice(0, 8).join(", ")} |`);
  L.push("", "## State stores", "");
  for (const s of scan.stores) {
    L.push(`- \`${s.name}\` (${s.file}): ${s.stateKeys.length} keys, ${s.actions.length} actions`);
    if (s.stateKeys.length) L.push(`  - state: ${s.stateKeys.join(", ")}`);
  }
  L.push("", "## Responsive behaviour", "");
  const bpCounts = {};
  for (const per of Object.values(scan.responsive.breakpoints)) for (const bp of Object.keys(per)) bpCounts[bp] = (bpCounts[bp] ?? 0) + 1;
  L.push(`Files using breakpoints: ${Object.keys(scan.responsive.breakpoints).length}. Per breakpoint: ${Object.entries(bpCounts).map(([k, v]) => `${k} (${v} files)`).join(", ") || "none"}.`);
  if (scan.responsive.mediaQueries.length) L.push("", `Media queries / matchMedia: ${scan.responsive.mediaQueries.map((q) => `\`${q}\``).join(", ")}`);
  L.push("", `Dark mode: ${scan.responsive.darkMode}. Container queries: ${scan.responsive.usesContainerQueries ? "yes" : "no"}.`);
  L.push("", "## Motion", "");
  L.push(`Libraries: ${scan.motion.libraries.join(", ") || "none"}. Items: ${Object.entries(scan.motion.counts).map(([k, v]) => `${k}=${v}`).join(", ") || "none"}.`);
  L.push("", "## Assets", "");
  L.push(`Counts: ${Object.entries(scan.assets.counts).map(([k, v]) => `${k}=${v}`).join(", ") || "none"}.`);
  L.push("", "## Fonts", "", scan.fonts.length ? scan.fonts.map((f) => `- ${f}`).join("\n") : "- none detected");
  L.push("", "## Design tokens", "");
  const light = Object.entries(scan.designTokens?.light ?? {});
  const dark = scan.designTokens?.dark ?? {};
  if (light.length) {
    L.push("| Token | Light | Dark override |", "| --- | --- | --- |");
    for (const [k, v] of light) L.push(`| \`--${k}\` | \`${v}\` | ${dark[k] ? `\`${dark[k]}\`` : "-"} |`);
    const onlyDark = Object.keys(dark).filter((k) => !(k in (scan.designTokens.light ?? {})));
    if (onlyDark.length) L.push("", `Dark-only tokens: ${onlyDark.map((k) => `\`--${k}\``).join(", ")}`);
  } else L.push("_none_");
  L.push("", "## Data shapes (what the UI needs from the engine)", "");
  for (const [name, shape] of Object.entries(scan.dataShapes)) {
    L.push(`### ${name} (${shape.file})`, "", "| Field | Type | Optional |", "| --- | --- | --- |");
    for (const f of shape.fields) L.push(`| ${f.name} | \`${f.type}\` | ${f.optional ? "yes" : "no"} |`);
    L.push("");
  }
  if (scan.warnings.length) {
    L.push("## Warnings", "");
    for (const w of scan.warnings) L.push(`- ${w}`);
    L.push("");
  }
  return L.join("\n");
}
