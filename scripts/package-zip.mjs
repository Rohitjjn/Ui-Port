#!/usr/bin/env node
/**
 * Package a ported project into a ZIP that a human can open.
 *
 * Excludes build outputs, caches, IDE files, secrets and — by default — the plugin's own
 * deletable test bed (`testbed/`), which must never travel with a delivery.
 * Includes `.uiport/`
 * (worklog, maps, reports, reference screenshots) but not `.uiport/output/`
 * unless --include-output is passed.
 *
 *   node scripts/package-zip.mjs --project ../myapp --out myapp-uiport.zip [--include-output]
 *     [--include-testbed] [--max-mb 200] [--dry-run]
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { toPosix, walk } from "./lib/fs-utils.mjs";

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = args[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
};

const project = path.resolve(String(flag("project", ".")));
const out = path.resolve(String(flag("out", `${path.basename(project)}-uiport.zip`)));
const includeOutput = Boolean(flag("include-output", false));
const includeTestbed = Boolean(flag("include-testbed", false));
const maxMb = Number(flag("max-mb", 200));
const dryRun = Boolean(flag("dry-run", false));

if (!fs.existsSync(project)) {
  process.stderr.write(`package-zip: project not found: ${project}\n`);
  process.exit(2);
}

const EXCLUDE_DIRS = new Set([
  ".git",
  ".gradle",
  ".idea",
  ".kotlin",
  "build",
  "node_modules",
  "dist",
  "out",
  "coverage",
  ".cxx",
  ".next",
  ".venv",
  "__pycache__",
  ".cache",
]);
// Plugin-development fixtures: deleted before delivery, never shipped inside one.
if (!includeTestbed) EXCLUDE_DIRS.add("testbed");
const EXCLUDE_FILES = [
  /(^|\/)local\.properties$/,
  /\.jks$/,
  /\.keystore$/,
  /(^|\/)\.env(\..*)?$/,
  /(^|\/)google-services\.json$/,
  /\.iml$/,
  /(^|\/)\.DS_Store$/,
];

function excluded(relPath) {
  const parts = relPath.split("/");
  if (parts.some((p) => EXCLUDE_DIRS.has(p))) return true;
  if (!includeOutput && parts[0] === ".uiport" && parts[1] === "output") return true;
  return EXCLUDE_FILES.some((re) => re.test(relPath));
}

const files = walk(project, { skipDirs: new Set() })
  .map((f) => toPosix(path.relative(project, f)))
  .filter((f) => !excluded(f));

let bytes = 0;
for (const f of files) {
  try {
    bytes += fs.statSync(path.join(project, f)).size;
  } catch {
    /* ignore */
  }
}
const mb = bytes / 1024 ** 2;

process.stdout.write(`package-zip: ${files.length} file(s), ${mb.toFixed(1)} MB before compression\n`);

if (mb > maxMb) {
  process.stderr.write(
    `package-zip: refusing to package ${mb.toFixed(1)} MB (limit ${maxMb} MB). Pass --max-mb to override, or check that build outputs are not being included.\n`,
  );
  process.exit(3);
}

const worklogFiles = files.filter((f) => f.startsWith(".uiport/worklog/"));
if (!worklogFiles.length) {
  process.stderr.write("package-zip: warning — no .uiport/worklog files found; the delivery would not contain a worklog\n");
}

if (dryRun) {
  process.stdout.write(`${files.slice(0, 40).join("\n")}\n${files.length > 40 ? `… and ${files.length - 40} more\n` : ""}`);
  process.exit(0);
}

fs.mkdirSync(path.dirname(out), { recursive: true });
if (fs.existsSync(out)) fs.rmSync(out);

// Prefer the system zip (streaming, no memory spike); fall back to Python.
// os.tmpdir() respects TMPDIR/TMP/TEMP per platform; a hard-coded "/tmp" does not
// exist on Windows, which silently breaks packaging on a whole OS.
const listFile = path.join(os.tmpdir(), `uiport-zip-${process.pid}.txt`);
fs.writeFileSync(listFile, files.join("\n"));
try {
  const isWindows = process.platform === "win32";
  if (!isWindows) {
    const zipBin = ["/usr/bin/zip", "/bin/zip"].find((p) => fs.existsSync(p));
    if (zipBin) {
      execFileSync(zipBin, ["-q", "-X", out, "-@"], { cwd: project, input: fs.readFileSync(listFile) });
    } else {
      execFileSync("python3", ["-c", zipWithPython(project, out, listFile)], { stdio: "inherit" });
    }
  } else {
    execFileSync("tar", ["-a", "-c", "-f", out, "-T", listFile], { cwd: project, stdio: "inherit" });
  }
} finally {
  fs.rmSync(listFile, { force: true });
}

const stat = fs.statSync(out);
process.stdout.write(`package-zip: wrote ${out} (${(stat.size / 1024 ** 2).toFixed(2)} MB, ${files.length} entries)\n`);

function zipWithPython(projectRoot, outFile, listPath) {
  return `
import sys, zipfile
out, root, listfile = ${JSON.stringify(outFile)}, ${JSON.stringify(projectRoot)}, ${JSON.stringify(listPath)}
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for line in open(listfile, encoding="utf-8"):
        rel = line.strip()
        if not rel: continue
        z.write(f"{root}/{rel}", rel)
print("zip written")
`;
}
