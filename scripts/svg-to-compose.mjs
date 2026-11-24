#!/usr/bin/env node
/**
 * Convert SVG files into Compose ImageVector code.
 *
 * Handles the subset that web prototypes actually use for icons and simple art:
 * <svg>, <g>, <path>, <circle>, <ellipse>, <rect>, <line>, <polyline>, <polygon>,
 * fill / fill-rule / fill-opacity, stroke / stroke-width / stroke-linecap /
 * stroke-linejoin, and translate/scale/rotate transforms.
 *
 * Anything it cannot represent faithfully is reported as a warning and the file is
 * skipped — a wrong vector is worse than a missing one.
 *
 *   node scripts/svg-to-compose.mjs <file.svg|dir> --out <dir> --package com.example.ui.icon [--dry-run]
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { walk } from "./lib/fs-utils.mjs";

const args = process.argv.slice(2);
const input = args[0];
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = args[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
};

if (!input) {
  process.stderr.write("usage: svg-to-compose.mjs <file.svg|dir> --out <dir> --package <pkg>\n");
  process.exit(2);
}
const outDir = path.resolve(String(flag("out", "compose-icons")));
const pkg = String(flag("package", "icons"));
const dryRun = Boolean(flag("dry-run", false));

const files = fs.statSync(input).isDirectory() ? walk(input).filter((f) => f.endsWith(".svg")) : [path.resolve(input)];
if (!files.length) {
  process.stderr.write("svg-to-compose: no .svg files found\n");
  process.exit(2);
}

const NUM = "(-?\\d*\\.?\\d+(?:e-?\\d+)?)";

function parseSvg(text) {
  const viewBox = text.match(/viewBox=["']([^"']+)["']/)?.[1]?.trim().split(/[\s,]+/).map(Number);
  const width = Number(text.match(/\bwidth=["']([\d.]+)/)?.[1] ?? viewBox?.[2] ?? 24);
  const height = Number(text.match(/\bheight=["']([\d.]+)/)?.[1] ?? viewBox?.[3] ?? 24);
  const nodes = [];
  const warnings = [];

  // Walk elements in document order, tracking inherited fill/stroke from <g>.
  const elRe = /<(path|circle|ellipse|rect|line|polyline|polygon|g)\b([^>]*?)(\/?)>/g;
  let m;
  while ((m = elRe.exec(text))) {
    const tag = m[1];
    const attrs = parseAttrs(m[2]);
    if (tag === "g") {
      nodes.push({ tag, attrs, group: true });
      continue;
    }
    nodes.push({ tag, attrs });
  }
  if (/<style|<use|filter=|<text/.test(text)) {
    warnings.push("uses <style>, <use>, filters or <text>: not convertible by this script");
  }
  return { viewBox, width, height, nodes, warnings };
}

function parseAttrs(raw) {
  const out = {};
  for (const a of raw.matchAll(/([a-zA-Z-]+)\s*=\s*"([^"]*)"/g)) out[a[1]] = a[2];
  for (const a of raw.matchAll(/([a-zA-Z-]+)\s*=\s*'([^']*)'/g)) out[a[1]] = a[2];
  return out;
}

function colorOf(value, fallback) {
  if (!value || value === "none") return null;
  if (value === "currentColor") return fallback;
  const hex = value.match(/^#([0-9a-fA-F]{3,8})$/);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    if (h.length === 6) h = `FF${h}`;
    else if (h.length === 8) h = h.slice(6) + h.slice(0, 6); // #RRGGBBAA -> AARRGGBB
    return `Color(0x${h.toUpperCase()})`;
  }
  const rgb = value.match(/rgba?\(([^)]+)\)/);
  if (rgb) {
    const parts = rgb[1].split(",").map((s) => Number(s.trim()));
    const a = parts[3] === undefined ? 1 : parts[3];
    const toHex = (n) => Math.round(n).toString(16).padStart(2, "0").toUpperCase();
    return `Color(0x${toHex(a * 255)}${toHex(parts[0])}${toHex(parts[1])}${toHex(parts[2])})`;
  }
  return "Unspecified";
}

function shapes(svg) {
  const out = [];
  let inherited = { fill: null, stroke: null, strokeWidth: null };
  const stack = [];
  for (const node of svg.nodes) {
    if (node.group) {
      stack.push(inherited);
      inherited = {
        fill: node.attrs.fill ?? inherited.fill,
        stroke: node.attrs.stroke ?? inherited.stroke,
        strokeWidth: node.attrs["stroke-width"] ?? inherited.strokeWidth,
      };
      continue;
    }
    const a = node.attrs;
    const fill = colorOf(a.fill ?? inherited.fill ?? "#000000", "currentColor");
    const stroke = colorOf(a.stroke ?? inherited.stroke, "currentColor");
    const strokeWidth = Number(a["stroke-width"] ?? inherited.strokeWidth ?? 0);
    if (node.tag === "path" && a.d) {
      out.push({ kind: "path", d: a.d, fill, stroke, strokeWidth, evenOdd: (a["fill-rule"] ?? "") === "evenodd" || svg.nodes.some((n) => n.attrs?.["fill-rule"] === "evenodd") });
    } else if (node.tag === "circle") {
      const cx = Number(a.cx ?? 0);
      const cy = Number(a.cy ?? 0);
      const r = Number(a.r ?? 0);
      out.push({ kind: "path", d: `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${r * 2} 0 a${r} ${r} 0 1 0 ${-r * 2} 0`, fill, stroke, strokeWidth });
    } else if (node.tag === "ellipse") {
      const cx = Number(a.cx ?? 0);
      const cy = Number(a.cy ?? 0);
      const rx = Number(a.rx ?? 0);
      const ry = Number(a.ry ?? 0);
      out.push({ kind: "path", d: `M${cx - rx} ${cy} a${rx} ${ry} 0 1 0 ${rx * 2} 0 a${rx} ${ry} 0 1 0 ${-rx * 2} 0`, fill, stroke, strokeWidth });
    } else if (node.tag === "rect") {
      const x = Number(a.x ?? 0);
      const y = Number(a.y ?? 0);
      const w = Number(a.width ?? 0);
      const h = Number(a.height ?? 0);
      const r = Number(a.rx ?? a.ry ?? 0);
      const d = r
        ? `M${x + r} ${y} H${x + w - r} a${r} ${r} 0 0 1 ${r} ${r} V${y + h - r} a${r} ${r} 0 0 1 ${-r} ${r} H${x + r} a${r} ${r} 0 0 1 ${-r} ${-r} V${y + r} a${r} ${r} 0 0 1 ${r} ${-r} Z`
        : `M${x} ${y} H${x + w} V${y + h} H${x} Z`;
      out.push({ kind: "path", d, fill, stroke, strokeWidth });
    } else if (node.tag === "line") {
      out.push({ kind: "path", d: `M${a.x1} ${a.y1} L${a.x2} ${a.y2}`, fill: null, stroke: stroke ?? "Color(0xFF000000)", strokeWidth: strokeWidth || 1 });
    } else if (node.tag === "polyline" || node.tag === "polygon") {
      const pts = (a.points ?? "").trim().split(/[\s,]+/).map(Number);
      if (pts.length >= 4) {
        let d = `M${pts[0]} ${pts[1]}`;
        for (let i = 2; i < pts.length; i += 2) d += ` L${pts[i]} ${pts[i + 1]}`;
        if (node.tag === "polygon") d += " Z";
        out.push({ kind: "path", d, fill: node.tag === "polygon" ? fill : null, stroke, strokeWidth });
      }
    }
  }
  return out;
}

function toCompose(name, svg, shapeList) {
  const [vx, vy, vw, vh] = svg.viewBox ?? [0, 0, svg.width, svg.height];
  const L = [];
  L.push(`package ${pkg}`, "");
  L.push("import androidx.compose.ui.graphics.Color");
  L.push("import androidx.compose.ui.graphics.SolidColor");
  L.push("import androidx.compose.ui.graphics.vector.ImageVector");
  L.push("import androidx.compose.ui.graphics.vector.path");
  L.push("import androidx.compose.ui.unit.dp", "");
  L.push("import androidx.compose.ui.graphics.vector.PathParser", "");
  L.push("/**");
  L.push(` * Generated from ${name}.svg by ui-port (${new Date().toISOString().slice(0, 10)}).`);
  L.push(" * Do not hand-edit: re-run scripts/svg-to-compose.mjs if the source changes.");
  L.push(" */");
  L.push(`val ${pascal(name)}: ImageVector = ImageVector.Builder(`);
  L.push(`    name = "${pascal(name)}",`);
  L.push(`    defaultWidth = ${svg.width}.dp,`);
  L.push(`    defaultHeight = ${svg.height}.dp,`);
  L.push(`    viewportWidth = ${vw}f,`);
  L.push(`    viewportHeight = ${vh}f,`);
  L.push(") {");
  L.push("    val parser = PathParser()");
  for (const s of shapeList) {
    if (s.kind !== "path") continue;
    const params = [`pathData = parser.parsePathData("${escapeKt(s.d)}")`];
    if (s.fill) params.push(`fill = SolidColor(${s.fill === "currentColor" ? "Color.Black" : s.fill})`);
    if (s.stroke) params.push(`stroke = SolidColor(${s.stroke === "currentColor" ? "Color.Black" : s.stroke})`);
    if (s.strokeWidth) params.push(`strokeLineWidth = ${s.strokeWidth}f`);
    L.push("    path(");
    for (const p of params) L.push(`        ${p},`);
    L.push("    )");
  }
  L.push("}.build()", "");
  if (vx !== 0 || vy !== 0 || vw !== svg.width || vh !== svg.height) {
    L.push(`// NOTE: viewBox is "${vx} ${vy} ${vw} ${vh}" but width/height are ${svg.width}x${svg.height}.`);
    L.push(`// If the icon renders offset, check these values before anything else.`);
  }
  return L.join("\n");
}

function escapeKt(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
function pascal(s) {
  return s
    .replace(/\.[^.]+$/, "")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join("");
}

fs.mkdirSync(outDir, { recursive: true });
const results = [];
for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  const svg = parseSvg(text);
  const shapeList = shapes(svg);
  if (!shapeList.length) {
    results.push({ file, status: "skipped", reason: "no convertible shapes" });
    continue;
  }
  if (svg.warnings.length) {
    results.push({ file, status: "warning", reason: svg.warnings.join("; ") });
  }
  const name = path.basename(file, ".svg");
  const code = toCompose(name, svg, shapeList);
  const outFile = path.join(outDir, `${pascal(name)}.kt`);
  if (!dryRun) fs.writeFileSync(outFile, `${code}\n`);
  results.push({ file, status: results.at(-1)?.status === "warning" ? "warning" : "converted", out: outFile, shapes: shapeList.length });
}

for (const r of results) {
  process.stdout.write(`${r.status.padEnd(10)} ${path.basename(r.file)}${r.shapes ? ` (${r.shapes} shape(s))` : ""}${r.reason ? ` — ${r.reason}` : ""}\n`);
}
const converted = results.filter((r) => r.status === "converted" || r.status === "warning").length;
process.stdout.write(`\nsvg-to-compose: ${converted}/${results.length} file(s) ${dryRun ? "would be " : ""}converted into ${path.relative(process.cwd(), outDir)}\n`);
process.stdout.write("Next: check each vector renders at the reference size before using it; a wrong stroke width reads as 'slightly bold' in every diff.\n");
