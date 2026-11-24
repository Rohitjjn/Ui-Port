#!/usr/bin/env node
/**
 * PreToolUse — engine protect.
 *
 * Blocks Write/Edit/MultiEdit/NotebookEdit and destructive Bash commands that
 * touch a path listed in .uiport/engine-paths.json, unless the user approved
 * engine edits (state.json -> protectedPathsApproved).
 *
 * Fails open: any internal error approves the call. A broken hook must never
 * stop the session.
 */
import { decide, guard, projectDirOf, readHookInput } from "./lib/io.mjs";
import { evaluate, loadApproval, loadEnginePaths } from "./lib/protect.mjs";

guard(() => {
  const input = readHookInput();
  const projectRoot = projectDirOf(input);
  const toolName = input.tool_name ?? input.toolName ?? "";
  const toolInput = input.tool_input ?? input.toolInput ?? {};
  const enginePaths = loadEnginePaths(projectRoot);
  const approved = loadApproval(projectRoot);
  const result = evaluate({ toolName, toolInput, projectRoot, enginePaths, approved });
  if (result.decision === "block") decide("block", result.reason);
  decide("approve", result.reason);
});
