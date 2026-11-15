import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const NODE = process.execPath;
const LINT = path.join(ROOT, "scripts", "lint-markdown.mjs");
const UNPACK = path.join(ROOT, "scripts", "unpack-prototype.mjs");

function tmp(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `uiport-${name}-`));
  return dir;
}

function run(script, argv) {
  const r = spawnSync(NODE, [script, ...argv], { encoding: "utf8" });
  return { code: r.status, out: r.stdout ?? "", err: r.stderr ?? "" };
}

test("lint-markdown passes on the repository", () => {
  const r = run(LINT, []);
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /lint-markdown: OK/);
});

test("lint-markdown rejects the mistakes it exists for", () => {
  const dir = tmp("lint");
  const cases = {
    "trailing.md": "# t\n\ntrailing space   \n",
    "jump.md": "# t\n\n### skipped h2\n",
    "fence.md": "# t\n\n```js\nconst a = 1;\n",
    "link.md": "# t\n\n[missing](./nope.md)\n",
    "long.md": `# t\n\n${"word ".repeat(60).trim()}\n`,
  };
  for (const [name, body] of Object.entries(cases)) fs.writeFileSync(path.join(dir, name), body);
  const r = run(LINT, [dir]);
  assert.equal(r.code, 1);
  for (const needle of ["trailing whitespace", "heading jumps", "unclosed code fence", "does not resolve", "characters (max 200"]) {
    assert.match(r.err, new RegExp(needle.replace(/[()]/g, "\\$&")), `expected a ${needle} problem`);
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

test("lint-verbatim documents keep upstream formatting", () => {
  const dir = tmp("verbatim");
  fs.writeFileSync(
    path.join(dir, "spec.md"),
    `# Wrapper\n\n<!-- lint-verbatim -->\n# The original title\n\n${"x".repeat(260)}\n\n## Upstream heading\n`,
  );
  const r = run(LINT, [dir]);
  assert.equal(r.code, 0, r.err);
  fs.rmSync(dir, { recursive: true, force: true });
});

/** Build a minimal zip with the system `zip` if present, else skip the pack tests. */
function makeZip(dir, files) {
  const src = path.join(dir, "src");
  for (const [rel, body] of Object.entries(files)) {
    const p = path.join(src, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
  }
  const zip = path.join(dir, "p.zip");
  const r = spawnSync("zip", ["-qr", zip, "."], { cwd: src });
  if (r.status !== 0) return null;
  return zip;
}

const hasZip = spawnSync("zip", ["-v"], { encoding: "utf8" }).status === 0;

test("unpack-prototype extracts an archive and reports it", { skip: !hasZip && "zip not installed" }, () => {
  const dir = tmp("unpack");
  const zip = makeZip(dir, { "package.json": "{\"name\":\"p\"}", "index.html": "<html></html>", "src/App.tsx": "export {}" });
  assert.ok(zip);
  const out = path.join(dir, "out");
  const r = run(UNPACK, [zip, "--out", out]);
  assert.equal(r.code, 0, r.err);
  assert.ok(fs.existsSync(path.join(out, "package.json")));
  assert.ok(fs.existsSync(path.join(out, "src", "App.tsx")));
  fs.rmSync(dir, { recursive: true, force: true });
});

test("unpack-prototype refuses to overwrite a populated folder", { skip: !hasZip && "zip not installed" }, () => {
  const dir = tmp("unpack2");
  const zip = makeZip(dir, { "package.json": "{}" });
  const out = path.join(dir, "out");
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, "keep.txt"), "mine");
  const refused = run(UNPACK, [zip, "--out", out]);
  assert.equal(refused.code, 3);
  assert.ok(fs.existsSync(path.join(out, "keep.txt")), "existing content must survive");
  const forced = run(UNPACK, [zip, "--out", out, "--force"]);
  assert.equal(forced.code, 0, forced.err);
  assert.ok(fs.existsSync(path.join(out, "package.json")));
  fs.rmSync(dir, { recursive: true, force: true });
});

test("unpack-prototype reports a missing archive and a non-web archive", { skip: !hasZip && "zip not installed" }, () => {
  const dir = tmp("unpack3");
  const missing = run(UNPACK, [path.join(dir, "nope.zip"), "--out", path.join(dir, "a")]);
  assert.equal(missing.code, 2);

  const zip = makeZip(dir, { "notes.txt": "no package.json here" });
  const notWeb = run(UNPACK, [zip, "--out", path.join(dir, "b")]);
  assert.equal(notWeb.code, 5);
  assert.match(notWeb.err, /package\.json|index\.html/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("unpack-prototype finds a project inside a single nested folder", { skip: !hasZip && "zip not installed" }, () => {
  const dir = tmp("unpack4");
  const zip = makeZip(dir, { "my-app/package.json": "{}", "my-app/src/main.tsx": "export {}" });
  const out = path.join(dir, "out");
  const r = run(UNPACK, [zip, "--out", out]);
  assert.equal(r.code, 0, r.err);
  assert.ok(fs.existsSync(path.join(out, "package.json")), "nested project should be hoisted");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("package-zip excludes the test bed and build output but keeps the plugin", () => {
  const dir = tmp("zip");
  const out = path.join(dir, "plugin.zip");
  execFileSync(NODE, [path.join(ROOT, "scripts", "package-zip.mjs"), "--out", out], { encoding: "utf8", cwd: ROOT });
  assert.ok(fs.existsSync(out));
  const listing = execFileSync("unzip", ["-Z1", out], { encoding: "utf8" });
  assert.match(listing, /^\s*skills\/preflight\/SKILL\.md$/m);
  assert.match(listing, /^\s*\.claude-plugin\/plugin\.json$/m);
  assert.doesNotMatch(listing, /testbed\//);
  assert.doesNotMatch(listing, /node_modules\//);
  assert.doesNotMatch(listing, /\.git\//);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("the CI hook probe passes (same script the matrix workflow runs)", () => {
  // This is the workflow's step, run locally: if it regresses, it regresses here first.
  const r = spawnSync(NODE, [path.join(ROOT, "scripts", "ci-hook-probe.mjs")], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /7\/7 hook probes passed/);
});
