/**
 * Engine-protect decision logic, extracted from the hook so it is unit-testable
 * without spawning a process.
 *
 * Rules:
 *  - Only paths inside the project are considered (no escaping via "..").
 *  - A path is protected when it matches a glob in .uiport/engine-paths.json.
 *  - Edits are allowed when .uiport/state.json has protectedPathsApproved === true.
 *  - Bash commands are inspected for destructive operations targeting a protected
 *    path (rm, mv, truncate, sed -i, git checkout --, > redirect).
 *  - Everything else is allowed: the hook must not produce false blocks.
 */
import path from "node:path";
import { globToRegExp, matchesAnyGlob, readJsonSafe, toPosix } from "../../scripts/lib/fs-utils.mjs";

export const ENGINE_PATHS_FILE = ".uiport/engine-paths.json";

const DESTRUCTIVE = [
  /\brm\s+(-\w+\s+)*/,
  /\bmv\s+/,
  /\btruncate\s+/,
  /\bsed\s+-i/,
  /\bgit\s+(checkout|restore|reset)\b/,
  /\bdd\s+/,
  /\bshred\s+/,
];

export function loadEnginePaths(projectRoot) {
  const res = readJsonSafe(path.join(projectRoot, ENGINE_PATHS_FILE));
  if (!res.ok) return { globs: [], source: null, error: res.error };
  const data = res.value ?? {};
  const globs = Array.isArray(data.globs) ? data.globs.filter((g) => typeof g === "string") : [];
  return { globs, source: ENGINE_PATHS_FILE, error: null, approved: Boolean(data.approved) };
}

export function loadApproval(projectRoot) {
  const res = readJsonSafe(path.join(projectRoot, ".uiport/state.json"));
  if (!res.ok) return false;
  return Boolean(res.value?.protectedPathsApproved);
}

function normalize(projectRoot, candidate) {
  if (!candidate) return null;
  const abs = path.isAbsolute(candidate) ? candidate : path.resolve(projectRoot, candidate);
  const rel = path.relative(projectRoot, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null; // outside the project
  return toPosix(rel);
}

/** Collect candidate file paths from a tool input of any supported shape. */
export function candidatePaths(toolName, toolInput, projectRoot) {
  const out = [];
  const push = (p) => {
    const n = normalize(projectRoot, p);
    if (n && !out.includes(n)) out.push(n);
  };
  if (!toolInput || typeof toolInput !== "object") return out;
  switch (toolName) {
    case "Write":
    case "Edit":
    case "MultiEdit":
    case "NotebookEdit":
      push(toolInput.file_path ?? toolInput.path ?? toolInput.notebook_path);
      break;
    case "Bash": {
      const cmd = String(toolInput.command ?? "");
      // Extract every token that looks like a path, then keep those inside the project.
      const tokens = cmd.match(/[^\s"']+/g) ?? [];
      for (const t of tokens) {
        // Strip shell operators/quotes, and also parentheses left over from
        // `rm -rf (foo)` style grouping, so path matching stays reliable.
        const cleaned = t
          .replace(/^[<>|&;()]+|[<>|&;()]+$/g, "")
          .replace(/^["']|["']$/g, "")
          .replace(/\/+$/, "");
        if (!cleaned || cleaned.startsWith("-")) continue;
        if (cleaned.includes("/") || /\.[a-zA-Z0-9]+$/.test(cleaned)) push(cleaned);
      }
      break;
    }
    default:
      break;
  }
  return out;
}

export function isDestructive(command) {
  return DESTRUCTIVE.some((re) => re.test(command));
}

/**
 * @returns {{decision: "approve"|"block", matched: string[], reason: string}}
 */
export function evaluate({ toolName, toolInput, projectRoot, enginePaths, approved }) {
  const { globs } = enginePaths;
  if (!globs.length) return { decision: "approve", matched: [], reason: "no protected paths configured" };
  const candidates = candidatePaths(toolName, toolInput, projectRoot);
  const matched = candidates.filter((c) => matchesAnyGlob(c, globs));
  // A directory that contains protected files is itself protected: deleting
  // `core/data/` must not slip past a `core/**/*.kt` glob.
  const dirHit = candidates.find((c) => globs.some((g) => globToRegExp(g).test(`${c}/__probe__.kt`)));
  if (!matched.length && !dirHit) return { decision: "approve", matched: [], reason: "no protected path involved" };
  if (dirHit && !matched.includes(dirHit)) matched.push(dirHit);
  if (approved) return { decision: "approve", matched, reason: "engine edits approved in state.json" };
  if (toolName === "Bash") {
    const cmd = String(toolInput?.command ?? "");
    if (!isDestructive(cmd)) {
      return { decision: "approve", matched, reason: "read-only or non-destructive command on a protected path" };
    }
  }
  return {
    decision: "block",
    matched,
    reason: [
      "ui-port protects engine files. This action touches protected paths:",
      ...matched.map((m) => `  - ${m}`),
      "",
      "Do NOT work around this hook. Instead ask the user, in one question:",
      '"The new UI needs changes in engine files (list them). May I edit these engine files?"',
      "If the user agrees, set the approval flag:",
      '  node scripts/uiport.mjs state ... (or edit .uiport/state.json) "protectedPathsApproved": true',
      "and record the decision in .uiport/worklog/ and .uiport/state.json options.allowEngineEdits.",
    ].join("\n"),
  };
}
