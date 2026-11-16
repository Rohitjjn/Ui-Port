#!/usr/bin/env node
/**
 * Textual diff map.
 *
 * The visual diff already produces a heat map PNG, but a PNG is only useful to a
 * human who can open it. When the only channel back from CI is the log, the useful
 * artifact is a compact, honest, text version of the same information:
 *
 *   - a coarse character map of where reference and candidate diverge,
 *   - per-band percentages so a whole row of the layout can be judged at once,
 *   - mean colours per band, which distinguishes "nothing rendered here" (the
 *     candidate band is a single flat colour) from "rendered, wrong content".
 *
 * It compares nothing new: it reads the same two PNGs as `diff-all.mjs`.
 *
 *   node scripts/diff-map.mjs --reference a.png --candidate b.png [--cols 48] [--rows 64]
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { PNG } from "pngjs";

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = args[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
};

const referenceFile = String(flag("reference"));
const candidateFile = String(flag("candidate"));
const cols = Number(flag("cols", 48));
const rows = Number(flag("rows", 64));
const band = Number(flag("band", 40));
const pixelThreshold = Number(flag("threshold", 0.12));

if (!fs.existsSync(referenceFile) || !fs.existsSync(candidateFile)) {
  process.stderr.write(`diff-map: missing input (${referenceFile} / ${candidateFile})\n`);
  process.exit(1);
}

const ref = PNG.sync.read(fs.readFileSync(referenceFile));
const cand = PNG.sync.read(fs.readFileSync(candidateFile));
if (ref.width !== cand.width || ref.height !== cand.height) {
  process.stderr.write(
    `diff-map: sizes differ, reference ${ref.width}x${ref.height} vs candidate ${cand.width}x${cand.height}\n`,
  );
  process.exit(1);
}
const { width, height } = ref;
const at = (img, x, y) => {
  const i = (y * img.width + x) << 2;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
};
/** Normalised distance in 0..1, so a threshold means the same at any brightness. */
const delta = (a, b) => (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])) / (3 * 255);
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

/** Coarse map: each cell is the share of differing pixels inside it. */
const mapLines = [];
for (let ry = 0; ry < rows; ry++) {
  let line = "";
  for (let cx = 0; cx < cols; cx++) {
    const x0 = Math.floor((cx * width) / cols);
    const x1 = Math.max(x0 + 1, Math.floor(((cx + 1) * width) / cols));
    const y0 = Math.floor((ry * height) / rows);
    const y1 = Math.max(y0 + 1, Math.floor(((ry + 1) * height) / rows));
    let diff = 0;
    let total = 0;
    let refL = 0;
    let candL = 0;
    for (let y = y0; y < y1; y += 2) {
      for (let x = x0; x < x1; x += 2) {
        const a = at(ref, x, y);
        const b = at(cand, x, y);
        total++;
        refL += lum(a);
        candL += lum(b);
        if (delta(a, b) > pixelThreshold) diff++;
      }
    }
    const share = total ? diff / total : 0;
    if (share < 0.02) line += ".";
    else if (share < 0.2) line += ":";
    else if (share < 0.5) line += "+";
    else if (share < 0.8) line += "#";
    else line += "@";
    if (share >= 0.8 && total) {
      // Keep a light/empty distinction: an all-white block and a dense photo block
      // both differ 100%, but they mean very different fixes.
      const lighter = candL / total > refL / total;
      line = line.slice(0, -1) + (lighter ? "w" : "b");
    }
  }
  mapLines.push(`${String(Math.floor((ry * height) / rows)).padStart(4)} ${line}`);
}

/** Horizontal bands with mean colour, so "flat band" reads as "did not render". */
const bands = [];
for (let y = 0; y < height; y += band) {
  const y1 = Math.min(height, y + band);
  let diff = 0;
  let total = 0;
  const sum = { r: [0, 0, 0], c: [0, 0, 0] };
  const spread = { r: [0, 0, 0], c: [0, 0, 0] };
  for (let yy = y; yy < y1; yy++) {
    for (let x = 0; x < width; x += 2) {
      const a = at(ref, x, yy);
      const b = at(cand, x, yy);
      total++;
      if (delta(a, b) > pixelThreshold) diff++;
      for (let k = 0; k < 3; k++) {
        sum.r[k] += a[k];
        sum.c[k] += b[k];
      }
    }
  }
  const mean = (s) => s.map((v) => Math.round(v / Math.max(1, total)));
  bands.push({
    y,
    diffPct: Number(((diff / Math.max(1, total)) * 100).toFixed(1)),
    refMean: mean(sum.r),
    candMean: mean(sum.c),
  });
}

/**
 * Row bands: compress each image into runs of rows that share a dominant (modal) colour.
 * A vertical shift of a block then reads as "reference ivory 201..269, candidate ivory
 * 240..308" instead of as a percentage, which is the difference between knowing what to
 * move and guessing.
 */
function rowBands(img) {
  const rows = [];
  for (let y = 0; y < img.height; y++) {
    const counts = new Map();
    for (let x = 0; x < img.width; x += 3) {
      const c = at(img, x, y);
      const key = ((c[0] >> 3) << 10) | ((c[1] >> 3) << 5) | (c[2] >> 3);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    let bestKey = 0;
    let best = -1;
    for (const [k, v] of counts) {
      if (v > best) {
        best = v;
        bestKey = k;
      }
    }
    const r = ((bestKey >> 10) & 31) << 3;
    const g = ((bestKey >> 5) & 31) << 3;
    const b = (bestKey & 31) << 3;
    const share = best / Math.max(1, Math.ceil(img.width / 3));
    rows.push({ color: [r, g, b], share });
  }
  const bands = [];
  let start = 0;
  const same = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 12;
  for (let y = 1; y <= rows.length; y++) {
    if (y === rows.length || !same(rows[y].color, rows[start].color) || y - start >= 400) {
      bands.push({ from: start, to: y - 1, color: rows[start].color, share: rows[Math.floor((start + y - 1) / 2)].share });
      start = y;
    }
  }
  return bands.filter((b) => b.to - b.from >= 2);
}

const hex = (c) => `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
const out = [];
out.push(`diff-map ${width}x${height} — threshold ${pixelThreshold}, cell ${cols}x${rows}`);
out.push("");
out.push("legend: . <2% : <20% + <50% # <80% @ >=80% w = candidate brighter  b = candidate darker");
out.push("");
out.push("     " + Array.from({ length: cols }, (_, i) => (i % 10 === 0 ? "|" : " ")).join(""));
out.push(...mapLines);
out.push("");
out.push("band   diff%   reference mean   candidate mean");
for (const b of bands) {
  out.push(
    `${String(b.y).padStart(4)}  ${String(b.diffPct).padStart(6)}   ${hex(b.refMean)}  ${hex(b.candMean)}`,
  );
}
out.push("");
out.push("row bands (dominant colour per run of rows)");
out.push("  reference:  " + rowBands(ref).map((b) => `${b.from}-${b.to} ${hex(b.color)}`).join("  "));
out.push("  candidate:  " + rowBands(cand).map((b) => `${b.from}-${b.to} ${hex(b.color)}`).join("  "));
process.stdout.write(out.join("\n") + "\n");
void path;
