/**
 * Shared hook IO. Hooks read one JSON object from stdin and may print one JSON
 * object to stdout. Everything is wrapped so a hook can never brick a session:
 * on any unexpected error the hook exits 0 with no output (allow, stay silent).
 */
import fs from "node:fs";

export const EXIT_ALLOW = 0;
export const EXIT_BLOCK = 2;

export function readHookInput() {
  try {
    const raw = fs.readFileSync(0, "utf8");
    if (!raw.trim()) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function projectDirOf(input) {
  return input?.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

export function emit(obj) {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

/** PreToolUse/PostToolUse style decision. */
export function decide(decision, reason, extra = {}) {
  emit({ decision, reason, ...extra });
  process.exit(decision === "block" ? EXIT_BLOCK : EXIT_ALLOW);
}

/** Stop/SubagentStop style decision (top-level "decision": "block" continues the agent). */
export function stopDecision(decision, reason, extra = {}) {
  emit({ decision, reason, ...extra });
  process.exit(EXIT_ALLOW);
}

export function addContext(event, text) {
  emit({ hookSpecificOutput: { hookEventName: event, additionalContext: text } });
  process.exit(EXIT_ALLOW);
}

/** Never let a hook crash the session. */
export function guard(fn) {
  try {
    fn();
  } catch {
    process.exit(EXIT_ALLOW);
  }
}
