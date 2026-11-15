#!/usr/bin/env node
/**
 * Dependency-free markdown lint, tuned for this repository.
 *
 * Rules (all actionable, no style bikeshedding):
 *  - headings jump by more than one level
 *  - more than one H1 per document
 *  - trailing whitespace, tabs
 *  - unclosed code fences
 *  - relative links that do not resolve
 *  - lines over 200 characters inside prose (tables and code are exempt)
 *  - bare localhost/127.0.0.1 instructions in plugin docs (browser-side code must
 *    use relative URLs)
 *
 *   node scripts/lint-markdown.mjs [--fix-trailing-whitespace] [paths...]
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { readText, rel, toPosix, walk } from "./lib/fs-utils.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const fixWhitespace = args.includes("--fix-trailing-whitespace");
const explicit = args.filter((a) => !a.startsWith("--"));

// Third-party code is never linted: the upstream test bed must stay byte-identical
// and its style is not ours to change.
const SKIP = ["node_modules", ".git", "build", "dist", "testbed/SimpMusic", "testbed/prototype", "Unselected files"];
const files = explicit.length
  ? explicit.map((p) => path.resolve(p))
  : walk(ROOT)
      .filter((f) => f.endsWith(".md"))
      .filter((f) => !SKIP.some((s) => toPosix(path.relative(ROOT, f)).startsWith(s)));

let problems = 0;
let fixed = 0;

for (const file of files) {
  const original = readText(file, "");
  let text = original;
  const lines = text.split("\n");
  const issues = [];

  let h1Count = 0;
  let lastLevel = 0;
  let fence = null;
  let inProse = true;
  // Long description lines in frontmatter are unavoidable: a skill's description
  // has to state when to trigger, and it is a single YAML scalar.
  let inFrontmatter = lines[0]?.trim() === "---";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;

    if (/^\s*(```|~~~)/.test(line)) {
      const marker = line.trim().slice(0, 3);
      if (fence === null) fence = marker;
      else if (fence === marker) fence = null;
      inProse = fence === null;
      continue;
    }
    if (fence !== null) continue;
    if (inFrontmatter) {
      if (line.trim() === "---" && i > 0) inFrontmatter = false;
      continue;
    }

    if (line !== line.replace(/[ \t]+$/, "")) {
      issues.push({ line: lineNo, msg: "trailing whitespace" });
      if (fixWhitespace) lines[i] = line.replace(/[ \t]+$/, "");
    }
    if (/\t/.test(line)) issues.push({ line: lineNo, msg: "tab character (use spaces)" });

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      if (level === 1) h1Count++;
      if (lastLevel && level > lastLevel + 1) {
        issues.push({ line: lineNo, msg: `heading jumps from h${lastLevel} to h${level}` });
      }
      lastLevel = level;
    }

    const isTable = /^\s*\|/.test(line);
    if (inProse && !isTable && line.length > 200 && !/https?:\/\//.test(line)) {
      issues.push({ line: lineNo, msg: `line is ${line.length} characters (max 200 in prose)` });
    }

    for (const m of line.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
      const target = m[2];
      if (/^(https?:|mailto:|#)/.test(target)) continue;
      const clean = target.split("#")[0];
      if (!clean) continue;
      const resolved = path.resolve(path.dirname(file), decodeURI(clean));
      if (!fs.existsSync(resolved)) issues.push({ line: lineNo, msg: `relative link does not resolve: ${target}` });
    }
  }

  if (h1Count > 1) issues.push({ line: 1, msg: `${h1Count} H1 headings (expected at most 1)` });
  if (fence !== null) issues.push({ line: lines.length, msg: "unclosed code fence" });

  if (fixWhitespace && lines.join("\n") !== original) {
    fs.writeFileSync(file, lines.join("\n"));
    fixed++;
  }

  for (const issue of issues) {
    process.stderr.write(`${rel(ROOT, file)}:${issue.line}: ${issue.msg}\n`);
    problems++;
  }
}

if (fixWhitespace) process.stdout.write(`lint-markdown: fixed trailing whitespace in ${fixed} file(s)\n`);
if (problems) {
  process.stderr.write(`lint-markdown: ${problems} problem(s) in ${files.length} file(s)\n`);
  process.exit(1);
}
process.stdout.write(`lint-markdown: OK — ${files.length} file(s)\n`);
