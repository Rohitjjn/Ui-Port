#!/usr/bin/env node
/**
 * Compact geometry digest.
 *
 * The web capture writes `<state>.geometry.json`: every visible element's box. That file
 * is uploaded as an artifact, which is only useful to someone who can open the build.
 * This turns it into a few lines of text that fit in a CI annotation, sorted down the
 * page, so layout can be corrected from a log rather than guessed at.
 *
 *   node scripts/annotate-geometry.mjs --file ref.geometry.json [--max-y 860] [--limit 40]
 *        [--text-only] [--json]
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = args[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
};

const file = String(flag("file"));
if (!fs.existsSync(file)) {
  process.stderr.write(`annotate-geometry: cannot read ${file}\n`);
  process.exit(1);
}
const maxY = Number(flag("max-y", 900));
const limit = Number(flag("limit", 44));
const textOnly = Boolean(flag("text-only", false));
void flag("json");

const nodes = JSON.parse(fs.readFileSync(file, "utf8"));
if (!Array.isArray(nodes)) {
  process.stderr.write("annotate-geometry: expected a JSON array of nodes\n");
  process.exit(1);
}

const clip = (s, n) => (s && s.length > n ? `${s.slice(0, n - 1)}~` : s || "");
const visible = nodes
  .filter((n) => typeof n.y === "number" && n.y < maxY && n.h > 0)
  .filter((n) => !textOnly || n.text)
  .sort((a, b) => a.y - b.y || a.x - b.x)
  .slice(0, limit);

const lines = visible.map((n) => {
  const tag = clip(n.role || "", 7).padEnd(7);
  const box = `${Math.round(n.x)},${Math.round(n.y)} ${Math.round(n.w)}x${Math.round(n.h)}`.padEnd(20);
  const extra = n.fontSize ? ` fs${parseFloat(n.fontSize)}` : "";
  return `${tag}${box}${clip(n.text, 30)}${extra}`;
});

process.stdout.write(`geometry ${path.basename(file)} — ${nodes.length} nodes, showing ${visible.length} with y<${maxY}\n`);
process.stdout.write("role   x,y wxh         text\n");
process.stdout.write(`${lines.join("\n")}\n`);

// Intrinsic layout summary: the y of every full-bleed block boundary is what a port has
// to reproduce first; exact text metrics come later.
const wide = nodes
  .filter((n) => n.y < maxY && n.w >= 300 && n.h >= 8)
  .sort((a, b) => a.y - b.y)
  .slice(0, 24)
  .map((n) => `${Math.round(n.y)}+${Math.round(n.h)}`);
if (wide.length) process.stdout.write(`\nwide blocks (y+height): ${wide.join(" ")}\n`);
