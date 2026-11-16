/**
 * Font manifest: the two sides of the comparison must resolve the *same files*.
 *
 * The failure this prevents is subtle and was measured on this project: the capture blocks all
 * off-origin requests, so the prototype's Google Fonts stylesheet never loaded and the reference
 * was rendered with the browser's fallback stacks while the Compose side rendered with
 * `FontFamily.Serif`/`SansSerif`. Both sides looked "fine" alone; the comparison between them was
 * measuring two different typefaces. Bundling just the Compose side made it worse (89.26% vs
 * 94.96%) because only one side changed.
 *
 * So: one manifest, one source directory, byte-identical mirrors, and the capture asserts that the
 * families it *expects* are the families the page *actually used* before it takes a screenshot.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const DEFAULT_FONT_CONFIG = "config/fonts.json";

/**
 * The prototype's font stacks are replaced with the vendored families only.
 *
 * This is the difference between "we injected @font-face rules and hope the page uses them" and
 * "the page cannot use anything else". The prototype's stacks end in `Georgia, serif` and
 * `ui-sans-serif, system-ui`, so a single failed fetch silently falls back to a platform font and
 * the reference photographs it. These rules keep the CSS variables the prototype already reads
 * and remove every fallback behind them.
 */
export function fontStackOverrideCss(config) {
  const familyOf = (name) => config.families.find((f) => f.cssFamily === name)?.cssFamily;
  const sans = familyOf("Inter");
  const serif = familyOf("Instrument Serif");
  const rules = [];
  if (sans) rules.push(`:root{--font-sans:"${sans}" !important;}`);
  if (serif) rules.push(`:root{--font-serif:"${serif}" !important;}`);
  if (sans) rules.push(`body,[class*="font-sans"]{font-family:"${sans}" !important;}`);
  if (serif) rules.push(`[class*="font-serif"]{font-family:"${serif}" !important;}`);
  return rules.join("\n");
}

/** @font-face rules for the vendored files, in the order the manifest declares them. */
export function fontFaceCss(config) {
  return config.families
    .flatMap((family) =>
      family.files.map(
        (f) =>
          `@font-face{font-family:"${family.cssFamily}";src:url("${config.urlBase}/${f.file}") format("truetype");` +
          `font-weight:${f.weight};font-style:${f.style};font-display:block}`,
      ),
    )
    .join("\n");
}

/** Families and weights a capture must find in `document.fonts`, as the browser sees them. */
export function expectedFaces(config) {
  return config.families.flatMap((family) =>
    family.files.map((f) => ({ family: family.cssFamily, weight: String(f.weight), style: f.style, file: f.file })),
  );
}

/** Every file the manifest promises: font files first, then the licence texts beside them. */
export function requiredFiles(config) {
  return [
    ...config.families.flatMap((f) => f.files.map((x) => x.file)),
    ...(config.licenses ?? []).map((l) => l.file),
  ];
}

export function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

/**
 * Compares every mirror against the source directory.
 * Returns `[]` when in sync, otherwise one entry per problem, with both fingerprints so the
 * difference is diagnosable from a CI log alone.
 */
export function checkMirrors(config, root) {
  const sourceDir = path.resolve(root, config.sources.directory);
  const problems = [];
  const required = requiredFiles(config);
  for (const f of required) {
    if (!fs.existsSync(path.join(sourceDir, f))) problems.push({ file: f, dir: sourceDir, problem: "missing from source" });
  }
  const sourcePrints = new Map(
    required.filter((f) => fs.existsSync(path.join(sourceDir, f))).map((f) => [f, sha256File(path.join(sourceDir, f))]),
  );
  for (const mirror of config.sources.mirrors ?? []) {
    const dir = path.resolve(root, mirror);
    for (const f of required) {
      const target = path.join(dir, f);
      if (!fs.existsSync(target)) {
        problems.push({ file: f, dir, problem: "missing" });
        continue;
      }
      const actual = sha256File(target);
      if (actual !== sourcePrints.get(f)) problems.push({ file: f, dir, problem: "different bytes", expected: sourcePrints.get(f), actual });
    }
  }
  return problems;
}

/**
 * The check the capture runs inside the page, after `document.fonts.ready`.
 *
 * `document.fonts.check()` alone is not enough: it returns true for a *fallback* when the family
 * is unknown to some engines, and it says nothing about which file was used. So this walks the
 * loaded `FontFace` set and requires each expected family/weight to be present, then verifies that
 * the fonts are `loaded` rather than `unloaded`/`error`.
 */
export const FONT_ASSERT_SCRIPT = (expected) => {
  const loaded = [...document.fonts].map((f) => ({ family: f.family.replace(/^["']|["']$/g, ""), weight: String(f.weight), style: f.style, status: f.status }));
  const missing = [];
  for (const want of expected) {
    const hit = loaded.find(
      (l) => l.family.toLowerCase() === want.family.toLowerCase() && l.weight === want.weight && l.style === want.style && l.status === "loaded",
    );
    if (!hit) missing.push(want);
  }
  // What the page *actually rendered* with, which is the part that matters: a face can be loaded
  // and still unused, and an unused face means the CSS did not reach the text.
  const used = new Set();
  for (const el of document.querySelectorAll("body *")) {
    if (!el.textContent || !el.textContent.trim()) continue;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    used.add(`${cs.fontFamily.split(",")[0].replace(/^["']|["']$/g, "").trim()}|${cs.fontWeight}`);
  }
  const expectedKeys = expected.map((e) => `${e.family}|${e.weight}`);
  const usedButNotVendored = [...used].filter((u) => {
    const [family] = u.split("|");
    return !expected.some((e) => e.family.toLowerCase() === family.toLowerCase());
  });
  return { loaded, missing, used: [...used], expectedKeys, usedButNotVendored, ok: missing.length === 0 };
};

/** Path to the plugin's own manifest, used when a caller does not pass --fonts. */
export function defaultFontConfigPath() {
  return path.resolve(import.meta.dirname, "..", "..", DEFAULT_FONT_CONFIG);
}

/**
 * Reads and validates the manifest. A malformed manifest is a hard error rather than a warning:
 * silently continuing would capture a reference with unknowable fonts, which is worse than
 * stopping.
 */
export function loadFontConfig(file) {
  let config;
  try {
    config = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    throw new Error(`cannot read font manifest ${file}: ${err.message}`);
  }
  const problems = [];
  if (!Array.isArray(config.families) || !config.families.length) problems.push("families must be a non-empty array");
  for (const family of config.families ?? []) {
    if (!family.cssFamily) problems.push("a family has no cssFamily");
    if (!Array.isArray(family.files) || !family.files.length) problems.push(`family ${family.cssFamily} has no files`);
    for (const f of family.files ?? []) {
      if (!f.file) problems.push(`family ${family.cssFamily} has a file with no name`);
      if (typeof f.weight !== "number") problems.push(`family ${family.cssFamily} file ${f.file} has no numeric weight`);
    }
  }
  if (!config.sources?.directory) problems.push("sources.directory is required");
  if (problems.length) throw new Error(`invalid font manifest ${file}:\n- ${problems.join("\n- ")}`);
  return config;
}

/**
 * Forces every declared face to load, then lets the assertion read an honest status.
 *
 * Chromium loads a `FontFace` lazily: a weight the page happens not to use stays `unloaded`
 * forever, and an assertion on "every face is loaded" would fail for the wrong reason. Loading
 * them explicitly turns the assertion into what it should be — *the file is served, parses, and
 * describes the family and weight the manifest claims* — which is exactly the property that was
 * silently false when the reference was captured with fallback stacks.
 */
export const FONT_LOAD_SCRIPT = async (expected) => {
  const results = [];
  for (const face of expected) {
    try {
      const loaded = await document.fonts.load(`${face.style} ${face.weight} 16px "${face.family}"`);
      results.push({ family: face.family, weight: face.weight, requested: true, faces: loaded.length });
    } catch (err) {
      results.push({ family: face.family, weight: face.weight, requested: true, error: String(err).slice(0, 120) });
    }
  }
  return results;
};
