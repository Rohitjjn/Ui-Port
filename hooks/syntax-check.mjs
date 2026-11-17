#!/usr/bin/env node
/**
 * PostToolUse — light syntax check on edited Kotlin/TS files.
 *
 * Deliberately cheap: balanced-bracket / unbalanced-quote / stray-CRLF checks that
 * run in a few milliseconds. Never runs Gradle, ktlint or tsc — a hook must not
 * stall the session. Deeper checks live in the verify step.
 *
 * Reports problems as additional context (never blocks) so the agent can fix them
 * immediately instead of discovering them three files later.
 */
import fs from "node:fs";
import path from "node:path";
import { addContext, guard, projectDirOf, readHookInput } from "./lib/io.mjs";
import { checkSource, isCheckedExtension } from "./lib/syntax.mjs";

guard(() => {
  const input = readHookInput();
  const projectRoot = projectDirOf(input);
  const toolInput = input.tool_input ?? input.toolInput ?? {};
  const file = toolInput.file_path ?? toolInput.path;
  if (!file || typeof file !== "string") return;
  const ext = path.extname(file).toLowerCase();
  if (!isCheckedExtension(ext)) return;
  let text;
  try {
    text = fs.readFileSync(path.isAbsolute(file) ? file : path.join(projectRoot, file), "utf8");
  } catch {
    return;
  }
  if (text.length > 2_000_000) return; // never chew on generated blobs
  const problems = checkSource(text, ext);
  if (!problems.length) return;
  addContext(
    "PostToolUse",
    `ui-port syntax check found problems in ${path.basename(file)}:\n${problems.map((p) => `- ${p}`).join("\n")}\nFix them before continuing.`,
  );
});
