/**
 * The font harness is a measuring instrument, so it gets tests like one.
 *
 * The failure being guarded against was not a typo: the reference was captured with the browser's
 * fallback stacks while the app rendered platform families, and nothing anywhere said so. Every
 * check below exists because that silence was possible.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { describe } from "node:test";
import {
  FONT_ASSERT_SCRIPT,
  FONT_LOAD_SCRIPT,
  checkMirrors,
  defaultFontConfigPath,
  expectedFaces,
  fontFaceCss,
  fontStackOverrideCss,
  loadFontConfig,
  requiredFiles,
} from "../../scripts/lib/fonts.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");

describe("font manifest", () => {
  const config = loadFontConfig(defaultFontConfigPath());

  test("declares the two families the prototype's CSS stacks name", () => {
    const families = config.families.map((f) => f.cssFamily);
    assert.ok(families.includes("Inter"), "Inter is the --font-sans family");
    assert.ok(families.includes("Instrument Serif"), "Instrument Serif is the --font-serif family");
  });

  test("every declared file exists in the source directory, with its licence beside it", () => {
    const files = requiredFiles(config);
    for (const f of files) {
      assert.ok(fs.existsSync(path.join(ROOT, config.sources.directory, f)), `${f} missing from ${config.sources.directory}`);
    }
    // A font without its licence text is not vendorable, whatever the licence says.
    const covered = new Set((config.licenses ?? []).flatMap((l) => l.covers.split(",").map((s) => s.trim())));
    for (const family of config.families) {
      for (const f of family.files) assert.ok(covered.has(f.file), `${f.file} has no licence entry`);
    }
  });

  test("weights are numbers, so a synthesised weight cannot pass as a vendored one", () => {
    for (const family of config.families) {
      for (const f of family.files) {
        assert.equal(typeof f.weight, "number");
        assert.equal(f.style, "normal");
      }
    }
  });

  test("@font-face rules point at the served path, one per file", () => {
    const css = fontFaceCss(config);
    const faces = expectedFaces(config);
    assert.equal(css.split("@font-face").length - 1, faces.length);
    for (const face of faces) {
      assert.match(css, new RegExp(`url\\("${config.urlBase}/${face.file}"\\)`));
      assert.ok(css.includes(`font-family:"${face.family}"`));
      assert.ok(css.includes(`font-weight:${face.weight}`));
    }
    // font-display:block, not swap: a swap face can be screenshotted before it lands.
    assert.ok(!css.includes("font-display:swap"));
    assert.ok(css.includes("font-display:block"));
  });

  test("a valid manifest round-trips through the loader", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "uiport-fonts-"));
    const file = path.join(dir, "fonts.json");
    fs.writeFileSync(file, JSON.stringify(config));
    assert.deepEqual(loadFontConfig(file).families, config.families);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test("a malformed manifest is a hard error, not a warning", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "uiport-fonts-bad-"));
    const cases = [
      { sources: { directory: "res/font" } }, // no families
      { families: [{ cssFamily: "Inter", files: [{ file: "a.ttf" }] }], sources: { directory: "res/font" } }, // weight not numeric
      { families: [{ cssFamily: "Inter", files: [] }], sources: { directory: "res/font" } }, // no files
    ];
    for (const [i, config] of cases.entries()) {
      const file = path.join(dir, `bad-${i}.json`);
      fs.writeFileSync(file, JSON.stringify(config));
      assert.throws(() => loadFontConfig(file), /invalid font manifest/);
    }
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe("font mirrors", () => {
  const config = loadFontConfig(defaultFontConfigPath());

  test("the repository's own mirrors are in sync", () => {
    assert.deepEqual(checkMirrors(config, ROOT), []);
  });

  test("a one-byte drift is detected, and both fingerprints are reported", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "uiport-fonts-mirror-"));
    try {
      const source = path.join(dir, "res/font");
      const mirror = path.join(dir, "mirror");
      fs.mkdirSync(source, { recursive: true });
      fs.mkdirSync(mirror, { recursive: true });
      const local = { ...config, sources: { directory: "res/font", mirrors: ["mirror"] } };
      for (const f of requiredFiles(config)) {
        fs.writeFileSync(path.join(source, f), `source:${f}`);
        fs.writeFileSync(path.join(mirror, f), `source:${f}`);
      }
      assert.deepEqual(checkMirrors(local, dir), []);
      const target = requiredFiles(config)[0];
      fs.appendFileSync(path.join(mirror, target), " ");
      const problems = checkMirrors(local, dir);
      assert.equal(problems.length, 1);
      assert.equal(problems[0].problem, "different bytes");
      assert.notEqual(problems[0].expected, problems[0].actual);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a missing mirror file is reported by name", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "uiport-fonts-missing-"));
    try {
      const source = path.join(dir, "res/font");
      const mirror = path.join(dir, "mirror");
      fs.mkdirSync(source, { recursive: true });
      fs.mkdirSync(mirror, { recursive: true });
      const local = { ...config, sources: { directory: "res/font", mirrors: ["mirror"] } };
      for (const f of requiredFiles(config)) fs.writeFileSync(path.join(source, f), f);
      for (const f of requiredFiles(config).slice(1)) fs.writeFileSync(path.join(mirror, f), f);
      const problems = checkMirrors(local, dir);
      assert.equal(problems.length, 1);
      assert.equal(problems[0].problem, "missing");
      assert.equal(problems[0].file, requiredFiles(config)[0]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("in-page font assertion", () => {
  test("it is a serialisable function body, since Playwright evaluates it in the page", () => {
    const source = FONT_ASSERT_SCRIPT.toString();
    assert.ok(source.startsWith("("), "must be an arrow function to serialise");
    assert.doesNotThrow(() => new Function(`return (${source})`));
  });

  test("it checks loaded status, not just presence", () => {
    // document.fonts.check() returns true for unknown families in some engines and says nothing
    // about which file was used; the assertion therefore reads the FontFace set and requires
    // status === 'loaded'.
    const source = FONT_ASSERT_SCRIPT.toString();
    assert.match(source, /status === "loaded"/);
    assert.match(source, /getComputedStyle/);
    assert.match(source, /usedButNotVendored/);
  });
});

describe("font stack override", () => {
  const config = loadFontConfig(defaultFontConfigPath());

  test("the fallback stacks are removed, not merely prepended", () => {
    // The prototype declares `"Inter", ui-sans-serif, system-ui, ...`. Injecting an @font-face
    // for Inter does not stop `ui-sans-serif` from being used if Inter fails to load — and a
    // reference captured with a platform font is a reference the app can never match.
    const css = fontStackOverrideCss(config);
    assert.match(css, /--font-sans:"Inter" !important/);
    assert.match(css, /--font-serif:"Instrument Serif" !important/);
    assert.ok(!/ui-sans-serif|Georgia/.test(css), "no fallback family may survive the override");
    assert.match(css, /font-family:"Inter" !important/);
  });
});

describe("lazy font loading", () => {
  test("every declared face is requested explicitly before its status is judged", () => {
    // Chromium will not load a face the page never renders. Asserting "loaded" without asking
    // for it would fail on a weight that is simply unused, and — worse — pass on a face that was
    // never checked at all if the assertion were relaxed. So the capture loads each face first.
    const source = FONT_LOAD_SCRIPT.toString();
    assert.doesNotThrow(() => new Function(`return (${source})`));
    assert.match(source, /document\.fonts\.load/);
    assert.match(source, /results\.push/);
  });
});
