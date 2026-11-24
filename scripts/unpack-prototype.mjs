#!/usr/bin/env node
/**
 * Unpack a prototype archive without touching the original.
 *
 *   node scripts/unpack-prototype.mjs <archive.zip> [--out dir] [--force]
 *
 * Node has no built-in zip reader, so this shells out to the first available tool
 * in a documented order and verifies the result by looking for a package.json or an
 * index.html. Never overwrites a non-empty destination unless --force is passed:
 * an accidental overwrite of a hand-edited prototype is unrecoverable.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const archive = args.find((a) => !a.startsWith("--"));
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = args[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
};

if (!archive) {
  process.stderr.write("usage: unpack-prototype.mjs <archive.zip> [--out dir] [--force]\n");
  process.exit(2);
}

const archivePath = path.resolve(String(archive));
if (!fs.existsSync(archivePath)) {
  process.stderr.write(`unpack-prototype: ${archivePath} does not exist\n`);
  process.exit(2);
}

const outDir = path.resolve(String(flag("out", path.join(path.dirname(archivePath), path.basename(archivePath, path.extname(archivePath))))));
const force = Boolean(flag("force", false));

if (fs.existsSync(outDir) && fs.readdirSync(outDir).length > 0) {
  if (!force) {
    process.stderr.write(
      `unpack-prototype: ${outDir} already exists and is not empty. Pass --force only if you are sure the current contents can be replaced.\n`,
    );
    process.exit(3);
  }
}
fs.mkdirSync(outDir, { recursive: true });

function attempt(name, command, cmdArgs) {
  const res = spawnSync(command, cmdArgs, { encoding: "utf8" });
  if (res.error || res.status !== 0) {
    return { ok: false, tool: name, error: (res.error?.message ?? res.stderr ?? "").trim().split("\n")[0] };
  }
  return { ok: true, tool: name };
}

const isWindows = process.platform === "win32";
const attempts = [];

// 1. unzip (macOS, Linux, git-bash)
if (!isWindows) attempts.push(attempt("unzip", "unzip", ["-q", "-o", archivePath, "-d", outDir]));
// 2. python3 zipfile (present almost everywhere, including this sandbox)
attempts.push(
  attempt("python3", "python3", [
    "-c",
    `import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])`,
    archivePath,
    outDir,
  ]),
);
// 3. PowerShell (Windows)
if (isWindows) {
  attempts.push(
    attempt("powershell", "powershell", [
      "-NoProfile",
      "-Command",
      `Expand-Archive -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${outDir.replace(/'/g, "''")}' -Force`,
    ]),
  );
}

const winner = attempts.find((a) => a.ok);
if (!winner) {
  process.stderr.write(
    `unpack-prototype: no working unzip tool found.\n${attempts.map((a) => `  ${a.tool}: ${a.error}`).join("\n")}\n` +
      "Install unzip (Linux/macOS) or Python 3, or unpack the archive by hand and pass the folder to /uiport-start.\n",
  );
  process.exit(4);
}

// Verify the result looks like a web prototype, not an empty or nested archive.
const hasPackageJson = fs.existsSync(path.join(outDir, "package.json"));
const hasIndexHtml = fs.existsSync(path.join(outDir, "index.html"));
const entries = fs.readdirSync(outDir);

// A very common shape: the archive wraps everything in one folder ("my-app/").
// Hoist that folder's contents so the caller always gets a project root, instead of
// making the agent remember a special case.
let hoisted = null;
if (!hasPackageJson && !hasIndexHtml) {
  const single = entries.length === 1 && fs.statSync(path.join(outDir, entries[0])).isDirectory();
  if (single) {
    const inner = path.join(outDir, entries[0]);
    const innerEntries = fs.readdirSync(inner);
    if (innerEntries.includes("package.json") || innerEntries.includes("index.html")) {
      for (const name of innerEntries) fs.renameSync(path.join(inner, name), path.join(outDir, name));
      fs.rmdirSync(inner);
      hoisted = entries[0];
    }
  }
}

if (!fs.existsSync(path.join(outDir, "package.json")) && !fs.existsSync(path.join(outDir, "index.html"))) {
  const now = fs.readdirSync(outDir);
  process.stderr.write(
    `unpack-prototype: extracted with ${winner.tool}, but ${outDir} has no package.json or index.html.\n` +
      `Entries: ${now.slice(0, 10).join(", ")}${now.length > 10 ? ", …" : ""}\n`,
  );
  process.exit(5);
}

process.stdout.write(
  `unpack-prototype: ${path.relative(process.cwd(), archivePath)} -> ${path.relative(process.cwd(), outDir)} using ${winner.tool} ` +
    `(${entries.length} top-level entries${hoisted ? `, hoisted from ${hoisted}/` : ", flat"}` +
    `${fs.existsSync(path.join(outDir, "package.json")) ? ", package.json found" : ", no package.json"})\n`,
);
