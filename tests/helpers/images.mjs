import { PNG } from "pngjs";
import fs from "node:fs";
import path from "node:path";

export function solid(width, height, rgba = [255, 255, 255, 255]) {
  const png = new PNG({ width, height });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = rgba[0];
    png.data[i + 1] = rgba[1];
    png.data[i + 2] = rgba[2];
    png.data[i + 3] = rgba[3];
  }
  return png;
}

export function rect(png, x, y, w, h, rgba) {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      if (xx < 0 || yy < 0 || xx >= png.width || yy >= png.height) continue;
      const i = (yy * png.width + xx) << 2;
      png.data[i] = rgba[0];
      png.data[i + 1] = rgba[1];
      png.data[i + 2] = rgba[2];
      png.data[i + 3] = rgba[3] ?? 255;
    }
  }
  return png;
}

export function save(dir, name, png) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  fs.writeFileSync(file, PNG.sync.write(png));
  return file;
}

/** A small "screen": paper background, a header bar, a card and a text block. */
export function fakeScreen({ width = 80, height = 120, shift = 0, tint = [0, 0, 0] } = {}) {
  const png = solid(width, height, [250, 248, 243, 255]);
  rect(png, 0, 0, width, 10, [37, 35, 31, 255]);
  rect(png, 8 + shift, 20, 40, 30, [255, 255, 255, 255]);
  rect(png, 12 + shift, 24, 20, 6, [120 + tint[0], 115 + tint[1], 100 + tint[2], 255]);
  rect(png, 8, 60, width - 16, 4, [200, 200, 200, 255]);
  rect(png, 8, 70, width - 30, 4, [210, 210, 210, 255]);
  rect(png, 8, 100, 24, 12, [113, 131, 107, 255]);
  return png;
}

/** Matching geometry dumps for fakeScreen(): one header, one card, one label, one button. */
export function fakeNodes({ shift = 0 } = {}) {
  return [
    { text: "Library", role: "heading", x: 0, y: 0, w: 80, h: 10 },
    { text: "Album", role: "img", x: 8 + shift, y: 20, w: 40, h: 30 },
    { text: "Artist", role: "text", x: 12 + shift, y: 24, w: 20, h: 6 },
    { text: "Play", role: "button", x: 8, y: 100, w: 24, h: 12 },
  ];
}
