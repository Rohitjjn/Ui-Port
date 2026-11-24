/**
 * Fast, dependency-free source sanity checks used by the PostToolUse hook.
 * Pure functions only: safe to import from tests and from the wrapper.
 */
const CHECKED = [".kt", ".kts", ".ts", ".tsx", ".js", ".mjs"];

export function isCheckedExtension(ext) {
  return CHECKED.includes(ext);
}

export function checkSource(text, ext) {
  const problems = [];
  if (text.includes("\r\n")) problems.push("file contains CRLF line endings (the project standard is LF)");
  if (text.length && !text.endsWith("\n")) problems.push("file does not end with a newline");
  // Bracket balance, ignoring strings and comments well enough for a fast hint.
  const stack = [];
  const pairs = { "(": ")", "[": "]", "{": "}" };
  const closers = new Set([")", "]", "}"]);
  let inBlockComment = false;
  let inLineComment = false;
  let quote = null;
  let templateDepth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];
    if (inLineComment) {
      if (c === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (c === "*" && n === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (quote) {
      if (c === "\\") {
        i++;
        continue;
      }
      if (ext === ".kt" || ext === ".kts") {
        if (c === quote) quote = null;
        continue;
      }
      // TS/JS: template literals may nest
      if (c === "`") {
        if (quote === "`" && templateDepth === 0) quote = null;
        continue;
      }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "/" && n === "/") {
      inLineComment = true;
      i++;
      continue;
    }
    if (c === "/" && n === "*") {
      inBlockComment = true;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || (c === "`" && ext !== ".kt" && ext !== ".kts")) {
      quote = c;
      continue;
    }
    if (pairs[c]) {
      stack.push(c);
      continue;
    }
    if (closers.has(c)) {
      const open = stack.pop();
      if (!open || pairs[open] !== c) {
        problems.push(`unbalanced "${c}" near character ${i}`);
        break;
      }
    }
  }
  if (quote) problems.push(`unterminated string literal (${quote})`);
  if (inBlockComment) problems.push("unterminated block comment");
  if (stack.length) problems.push(`unclosed "${stack[stack.length - 1]}" (${stack.length} unclosed bracket(s))`);
  return problems;
}
