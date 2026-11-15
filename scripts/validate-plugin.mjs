#!/usr/bin/env node
/**
 * Static validation of the plugin itself. Runs in CI on every push.
 *
 * Checks:
 *  - .claude-plugin/plugin.json and marketplace.json exist, parse, have required fields
 *  - every skill has SKILL.md with name + description frontmatter, and the name matches its folder
 *  - every agent has name + description frontmatter, and the name matches its filename
 *  - every command has a description frontmatter and an allowed-tools list that parses
 *  - hooks.json parses, has the plugin wrapper shape, every command points at an existing file
 *  - every script referenced in docs/skills exists
 *  - config JSON files parse and satisfy their minimal schema
 *  - no absolute local paths, no unfinished-task markers left in shipped files
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { readJson, readText, rel, walk } from "./lib/fs-utils.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const problems = [];
const notes = [];
const fail = (msg) => problems.push(msg);

function parseFrontmatter(file) {
  const text = readText(file, "");
  if (!text.startsWith("---")) return { ok: false, error: "file does not start with ---", data: null, body: text };
  const end = text.indexOf("\n---", 3);
  if (end === -1) return { ok: false, error: "frontmatter is not closed", data: null, body: text };
  const raw = text.slice(3, end);
  const data = {};
  let currentKey = null;
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (m) {
      currentKey = m[1];
      data[currentKey] = m[2].trim() === "" ? "" : m[2].trim();
      if (data[currentKey] === "|" || data[currentKey] === ">") data[currentKey] = "";
    } else if (currentKey && /^\s+/.test(line)) {
      data[currentKey] = `${data[currentKey]} ${line.trim()}`.trim();
    } else if (currentKey) {
      // multi-line flow list (allowed-tools) or continuation
      data[currentKey] = `${data[currentKey]} ${line.trim()}`.trim();
    }
  }
  return { ok: true, data, body: text.slice(end + 4) };
}

// ---------- manifest ----------
const pluginJson = path.join(ROOT, ".claude-plugin", "plugin.json");
const marketJson = path.join(ROOT, ".claude-plugin", "marketplace.json");
for (const [file, required] of [
  [pluginJson, ["name", "description", "version"]],
  [marketJson, ["name", "owner", "plugins"]],
]) {
  if (!fs.existsSync(file)) {
    fail(`${rel(ROOT, file)} is missing`);
    continue;
  }
  let json;
  try {
    json = JSON.parse(readText(file));
  } catch (err) {
    fail(`${rel(ROOT, file)} is not valid JSON: ${err.message}`);
    continue;
  }
  for (const key of required) if (!(key in json)) fail(`${rel(ROOT, file)} is missing "${key}"`);
}

const plugin = readJson(pluginJson, {});
if (plugin.name && !/^[a-z0-9-]+$/.test(plugin.name)) fail(`plugin name "${plugin.name}" must be lower-case kebab-case`);
if (plugin.version && !/^\d+\.\d+\.\d+/.test(plugin.version)) fail(`plugin version "${plugin.version}" is not semver-like`);
if (plugin.license !== "MIT") notes.push(`plugin license is "${plugin.license}", expected MIT`);

const market = readJson(marketJson, {});
for (const [i, p] of (market.plugins ?? []).entries()) {
  if (!p.name) fail(`marketplace plugins[${i}] has no name`);
  if (!p.source?.source) fail(`marketplace plugins[${i}] has no source.source`);
  if (p.source?.url && !/^https:\/\/github\.com\//.test(p.source.url)) {
    fail(`marketplace plugins[${i}].source.url should be a github https URL`);
  }
}

// ---------- skills ----------
const skillsDir = path.join(ROOT, "skills");
const expectedSkills = [
  "preflight",
  "map-app",
  "map-prototype",
  "plan-screens",
  "capture-reference",
  "port-screen",
  "port-motion-and-assets",
  "visual-diff",
  "wire-engine",
  "verify-and-fix",
  "finalize-delivery",
];
if (!fs.existsSync(skillsDir)) fail("skills/ is missing");
else {
  const present = fs.readdirSync(skillsDir).filter((d) => fs.statSync(path.join(skillsDir, d)).isDirectory());
  for (const want of expectedSkills) if (!present.includes(want)) fail(`skills/${want}/ is missing (expected by the spec)`);
  for (const dir of present) {
    const file = path.join(skillsDir, dir, "SKILL.md");
    if (!fs.existsSync(file)) {
      fail(`skills/${dir}/SKILL.md is missing`);
      continue;
    }
    const fm = parseFrontmatter(file);
    if (!fm.ok) {
      fail(`skills/${dir}/SKILL.md: ${fm.error}`);
      continue;
    }
    if (!fm.data.name) fail(`skills/${dir}/SKILL.md has no name`);
    else if (fm.data.name !== dir) fail(`skills/${dir}/SKILL.md name "${fm.data.name}" does not match its folder`);
    if (!fm.data.description) fail(`skills/${dir}/SKILL.md has no description`);
    else if (String(fm.data.description).length < 40) fail(`skills/${dir}/SKILL.md description is too short to trigger reliably`);
    if (String(fm.data.name ?? "").length > 64) fail(`skills/${dir}/SKILL.md name is longer than 64 characters`);
    const words = fm.body.trim().split(/\s+/).length;
    if (words > 900) notes.push(`skills/${dir}/SKILL.md is ${words} words; move detail to references/`);
    // referenced files must exist
    for (const m of fm.body.matchAll(/`(references\/[A-Za-z0-9._-]+\.md)`/g)) {
      const ref = path.join(skillsDir, dir, m[1]);
      if (!fs.existsSync(ref)) fail(`skills/${dir}/${m[1]} is referenced but does not exist`);
    }
  }
}

// ---------- agents ----------
const agentsDir = path.join(ROOT, "agents");
const expectedAgents = ["mapper", "screen-builder", "diff-reviewer", "wiring-engineer"];
if (!fs.existsSync(agentsDir)) fail("agents/ is missing");
else {
  const files = fs.readdirSync(agentsDir).filter((f) => f.endsWith(".md"));
  for (const want of expectedAgents) if (!files.includes(`${want}.md`)) fail(`agents/${want}.md is missing`);
  for (const f of files) {
    const file = path.join(agentsDir, f);
    const fm = parseFrontmatter(file);
    if (!fm.ok) {
      fail(`agents/${f}: ${fm.error}`);
      continue;
    }
    const stem = f.replace(/\.md$/, "");
    if (!fm.data.name) fail(`agents/${f} has no name`);
    else if (fm.data.name !== stem) fail(`agents/${f} name "${fm.data.name}" does not match its filename`);
    if (!fm.data.description) fail(`agents/${f} has no description`);
    const tools = fm.data.tools;
    if (tools && !/^\[.*\]$/.test(String(tools).replace(/\n/g, " "))) {
      notes.push(`agents/${f} tools is not a plain JSON-style array: ${String(tools).slice(0, 60)}`);
    }
  }
}

// ---------- commands ----------
const commandsDir = path.join(ROOT, "commands");
const expectedCommands = ["uiport-start", "uiport-resume", "uiport-status", "uiport-package"];
if (!fs.existsSync(commandsDir)) fail("commands/ is missing");
else {
  const files = fs.readdirSync(commandsDir).filter((f) => f.endsWith(".md"));
  for (const want of expectedCommands) if (!files.includes(`${want}.md`)) fail(`commands/${want}.md is missing`);
  for (const f of files) {
    const fm = parseFrontmatter(path.join(commandsDir, f));
    if (!fm.ok) {
      fail(`commands/${f}: ${fm.error}`);
      continue;
    }
    if (!fm.data.description) fail(`commands/${f} has no description`);
    if (fm.data["allowed-tools"]) {
      const raw = String(fm.data["allowed-tools"]).replace(/\n/g, " ");
      try {
        JSON.parse(raw);
      } catch {
        fail(`commands/${f} allowed-tools is not valid JSON: ${raw.slice(0, 80)}`);
      }
    }
  }
}

// ---------- hooks ----------
const hooksFile = path.join(ROOT, "hooks", "hooks.json");
if (!fs.existsSync(hooksFile)) fail("hooks/hooks.json is missing");
else {
  let hooks;
  try {
    hooks = JSON.parse(readText(hooksFile));
  } catch (err) {
    fail(`hooks/hooks.json is not valid JSON: ${err.message}`);
    hooks = null;
  }
  if (hooks) {
    if (!hooks.hooks || typeof hooks.hooks !== "object") fail("hooks.json must use the plugin wrapper shape: { \"hooks\": { ... } }");
    const known = new Set([
      "PreToolUse",
      "PostToolUse",
      "PostToolUseFailure",
      "Notification",
      "UserPromptSubmit",
      "Stop",
      "SubagentStart",
      "SubagentStop",
      "PreCompact",
      "SessionStart",
      "SessionEnd",
    ]);
    for (const [event, groups] of Object.entries(hooks.hooks ?? {})) {
      if (!known.has(event)) fail(`hooks.json declares unknown event "${event}"`);
      if (!Array.isArray(groups)) {
        fail(`hooks.json ${event} must be an array`);
        continue;
      }
      for (const group of groups) {
        if (!Array.isArray(group.hooks) || group.hooks.length === 0) fail(`hooks.json ${event} entry has no hooks array`);
        for (const h of group.hooks ?? []) {
          if (h.type !== "command") fail(`hooks.json ${event} hook type must be "command" (got "${h.type}")`);
          const m = String(h.command ?? "").match(/\$\{CLAUDE_PLUGIN_ROOT\}\/([^"']+)/);
          if (!m) fail(`hooks.json ${event} command does not use \${CLAUDE_PLUGIN_ROOT}: ${h.command}`);
          else if (!fs.existsSync(path.join(ROOT, m[1]))) fail(`hooks.json ${event} points at a missing file: ${m[1]}`);
          if (typeof h.timeout !== "number" || h.timeout > 30) notes.push(`hooks.json ${event} timeout ${h.timeout}s is high for a hook`);
        }
      }
    }
    for (const required of ["PreToolUse", "PostToolUse", "Stop", "SessionStart"]) {
      if (!hooks.hooks?.[required]) fail(`hooks.json is missing the required ${required} hook group`);
    }
  }
}

// ---------- config ----------
for (const name of ["tools.json", "viewports.json", "thresholds.json"]) {
  const file = path.join(ROOT, "config", name);
  if (!fs.existsSync(file)) {
    fail(`config/${name} is missing`);
    continue;
  }
  try {
    JSON.parse(readText(file));
  } catch (err) {
    fail(`config/${name} is not valid JSON: ${err.message}`);
  }
}
const tools = readJson(path.join(ROOT, "config", "tools.json"), { tools: [] });
for (const tool of tools.tools ?? []) {
  for (const key of ["id", "purpose", "type", "source", "requiresApproval", "phase"]) {
    if (!(key in tool)) fail(`config/tools.json tool "${tool.id ?? "?"}" is missing "${key}"`);
  }
  if (tool.version === null && tool.status !== "needs-user-input") {
    fail(`config/tools.json tool "${tool.id}" has no version but no needs-user-input status`);
  }
  if (tool.type === "npm" && tool.source && !/^https:\/\/www\.npmjs\.com\/package\//.test(tool.source)) {
    fail(`config/tools.json tool "${tool.id}" npm source must be an npmjs URL`);
  }
}
const vp = readJson(path.join(ROOT, "config", "viewports.json"), { targets: {} });
for (const [name, t] of Object.entries(vp.targets ?? {})) {
  for (const key of ["width", "height", "dpr"]) if (typeof t[key] !== "number") fail(`viewports.targets.${name}.${key} must be a number`);
}
if (!vp.defaults) fail("viewports.json has no defaults block");

// ---------- scripts referenced everywhere exist ----------
const referencedScripts = new Set();
// Path suffix tests must run on posix-normalised relative paths: on Windows the raw
// paths use backslashes, so includes("/testbed/") is always false and the plugin's own
// deletable fixture would be validated as if it were shipped code.
const isShipped = (f) => {
  const r = rel(ROOT, f);
  return !r.startsWith("testbed/") && !r.split("/").includes("node_modules");
};
for (const file of walk(ROOT).filter((f) => /\.(md|json|mjs)$/.test(f) && isShipped(f))) {
  const text = readText(file, "");
  for (const m of text.matchAll(/scripts\/([A-Za-z0-9._-]+\.mjs)/g)) referencedScripts.add(m[1]);
}
for (const script of referencedScripts) {
  if (!fs.existsSync(path.join(ROOT, "scripts", script))) fail(`scripts/${script} is referenced but does not exist`);
}

// ---------- hygiene ----------
const SHIPPED = walk(ROOT).filter((f) => /\.(md|mjs|json)$/.test(f) && isShipped(f));
for (const file of SHIPPED) {
  const text = readText(file, "");
  const r = rel(ROOT, file);
  // Absolute machine paths must never be baked into the plugin.
  if (new RegExp("/hom" + "e/[a-z]+/").test(text)) fail(`${r} contains an absolute machine path`);
  if (new RegExp("\\bTO" + "DO\\b|\\bFIX" + "ME\\b").test(text) && !r.startsWith("docs/")) {
    notes.push(`${r} contains unfinished-task markers`);
  }
}

// ---------- report ----------
for (const n of notes) process.stdout.write(`note: ${n}\n`);
if (problems.length) {
  for (const p of problems) process.stderr.write(`error: ${p}\n`);
  process.stderr.write(`\nvalidate-plugin: ${problems.length} problem(s)\n`);
  process.exit(1);
}
process.stdout.write(
  `validate-plugin: OK — manifest, ${expectedSkills.length} skills, ${expectedAgents.length} agents, ${expectedCommands.length} commands, hooks, config and ${referencedScripts.size} referenced scripts\n`,
);
