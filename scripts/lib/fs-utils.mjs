/**
 * Small, dependency-free file helpers shared by every ui-port script.
 * Deliberately boring: no globals, no side effects on import, always
 * resolved against an explicit project root.
 */
import fs from "node:fs";
import path from "node:path";

export const UIPORT_DIR = ".uiport";

export function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

export function readJson(file, fallback = undefined) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Cannot read JSON ${file}: ${err.message}`);
  }
}

export function readJsonSafe(file) {
  try {
    return { ok: true, value: JSON.parse(fs.readFileSync(file, "utf8")) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/** Write JSON atomically (tmp file + rename) so a crash can never leave a half-written state.json. */
export function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

export function writeTextAtomic(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

export function readText(file, fallback = undefined) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch (err) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Cannot read ${file}: ${err.message}`);
  }
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Recursively list files, skipping heavy/irrelevant directories. */
const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "build",
  ".gradle",
  ".idea",
  "dist",
  ".next",
  ".cache",
  "out",
  "Pods",
  ".kotlin",
  ".uiport",
]);

export function walk(root, { skipDirs = SKIP_DIRS, maxFiles = 200000 } = {}) {
  const out = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (skipDirs.has(entry.name)) continue;
        stack.push(full);
      } else if (entry.isFile()) {
        out.push(full);
        if (out.length >= maxFiles) return out;
      }
    }
  }
  return out.sort();
}

export function rel(root, file) {
  return path.relative(root, file).split(path.sep).join("/");
}

export function toPosix(p) {
  return p.split(path.sep).join("/");
}

/** Cheap glob matcher: **, *, ?, and {a,b} are supported; everything else is literal. */
export function globToRegExp(glob) {
  let re = "";
  const g = toPosix(glob);
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === "*") {
      if (g[i + 1] === "*") {
        // ** or **/
        if (g[i + 2] === "/") {
          re += "(?:[^/]+/)*";
          i += 2;
        } else {
          re += ".*";
          i += 1;
        }
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else if (c === "{") {
      const end = g.indexOf("}", i);
      if (end === -1) {
        re += "\\{";
      } else {
        const alts = g.slice(i + 1, end).split(",");
        re += `(?:${alts.map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`;
        i = end;
      }
    } else {
      re += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${re}$`);
}

export function matchesAnyGlob(posixPath, globs) {
  return globs.some((g) => globToRegExp(g).test(posixPath));
}
