/**
 * Deterministic "paper-cut botanical" artwork generator.
 * Produces inline SVG data URIs so the prototype never depends on
 * external image services. Each palette index renders a distinct cover.
 */
const PALETTES: [string, string, string, string][] = [
  ["#E9DDD0", "#71836B", "#25231F", "#FAF8F3"],
  ["#D9CBB7", "#C49A94", "#555149", "#FFFFFF"],
  ["#F0E6D6", "#A2A58A", "#71836B", "#25231F"],
  ["#CDBFA9", "#25231F", "#C49A94", "#FAF8F3"],
  ["#E6E3D6", "#5A6A55", "#D9CBB7", "#25231F"],
  ["#F2E9E3", "#B97E76", "#71836B", "#25231F"],
  ["#D6D9C8", "#3E4A3A", "#D9CBB7", "#FFFFFF"],
  ["#EBD9C9", "#8A6A5A", "#A2A58A", "#25231F"],
  ["#DCE1DA", "#71836B", "#C49A94", "#25231F"],
  ["#F6EFE4", "#25231F", "#71836B", "#C49A94"],
  ["#C9C4B2", "#2F2D28", "#E6DCCB", "#C49A94"],
  ["#E4D3CC", "#6D5B55", "#A2A58A", "#FAF8F3"],
  ["#D2D8CF", "#4F6650", "#F2E9E3", "#25231F"],
  ["#EFE4D2", "#9A7A4A", "#71836B", "#25231F"],
  ["#D8D4CC", "#25231F", "#D9CBB7", "#71836B"],
  ["#EAD9D6", "#8C5F5A", "#D9CBB7", "#25231F"],
];

function rng(seed: number) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const cache = new Map<string, string>();

export function artwork(palette: number, seed = 0, shape: "square" | "wide" | "circle" = "square"): string {
  const key = `${palette}-${seed}-${shape}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [bg, a, b, c] = PALETTES[Math.abs(palette) % PALETTES.length];
  const r = rng(palette * 31 + seed * 7 + 1);
  const w = shape === "wide" ? 600 : 400;
  const h = 400;
  const variant = (palette + seed) % 6;
  let body = "";
  if (variant === 0) {
    // large flower
    const cx = w * (0.35 + r() * 0.3);
    const cy = 200 + (r() - 0.5) * 60;
    const petals = 6 + Math.floor(r() * 3);
    for (let i = 0; i < petals; i++) {
      const ang = (360 / petals) * i;
      body += `<ellipse cx="${cx}" cy="${cy - 70}" rx="34" ry="78" fill="${c}" opacity="0.92" transform="rotate(${ang} ${cx} ${cy})"/>`;
    }
    body += `<circle cx="${cx}" cy="${cy}" r="30" fill="${a}"/>`;
    body += `<path d="M${cx} ${cy + 20} Q ${cx - 40} ${h} ${cx - 60} ${h + 10}" stroke="${b}" stroke-width="6" fill="none"/>`;
  } else if (variant === 1) {
    // arcs
    for (let i = 0; i < 5; i++) {
      body += `<circle cx="${w * 0.7}" cy="${h * 0.3}" r="${60 + i * 48}" fill="none" stroke="${i % 2 ? a : b}" stroke-width="${14 - i * 2}" opacity="${0.9 - i * 0.12}"/>`;
    }
    body += `<rect x="${w * 0.12}" y="${h * 0.6}" width="${w * 0.3}" height="${h * 0.3}" rx="8" fill="${c}"/>`;
  } else if (variant === 2) {
    // stems & leaves
    for (let i = 0; i < 4; i++) {
      const x = w * (0.2 + i * 0.2);
      body += `<path d="M${x} ${h} C ${x - 20} ${h * 0.6}, ${x + 30} ${h * 0.4}, ${x} ${h * 0.12}" stroke="${a}" stroke-width="4" fill="none"/>`;
      for (let j = 0; j < 3; j++) {
        const y = h * (0.3 + j * 0.2);
        body += `<path d="M${x} ${y} q 40 -30 60 0 q -20 30 -60 0z" fill="${j % 2 ? b : c}" opacity="0.9"/>`;
      }
    }
  } else if (variant === 3) {
    // sun & hills
    body += `<circle cx="${w * 0.6}" cy="${h * 0.35}" r="90" fill="${c}"/>`;
    body += `<path d="M0 ${h * 0.7} Q ${w * 0.3} ${h * 0.5} ${w * 0.55} ${h * 0.72} T ${w} ${h * 0.65} V ${h} H0z" fill="${a}"/>`;
    body += `<path d="M0 ${h * 0.85} Q ${w * 0.4} ${h * 0.7} ${w} ${h * 0.88} V ${h} H0z" fill="${b}"/>`;
  } else if (variant === 4) {
    // dots grid
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < 6; j++) {
        const rr = 6 + ((i * j) % 5) * 5;
        body += `<circle cx="${(w / 6) * i + w / 12}" cy="${(h / 6) * j + h / 12}" r="${rr}" fill="${(i + j) % 3 === 0 ? a : (i + j) % 3 === 1 ? b : c}" opacity="0.9"/>`;
      }
  } else {
    // paper strips
    for (let i = 0; i < 7; i++) {
      body += `<rect x="${-40 + i * (w / 6)}" y="0" width="${w / 9}" height="${h}" fill="${i % 3 === 0 ? a : i % 3 === 1 ? b : c}" transform="skewX(-12)" opacity="${0.85 + (i % 2) * 0.15}"/>`;
    }
    body += `<circle cx="${w * 0.3}" cy="${h * 0.65}" r="56" fill="${bg}" stroke="${a}" stroke-width="6"/>`;
  }
  const clip = shape === "circle" ? `<clipPath id="k"><circle cx="200" cy="200" r="200"/></clipPath>` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${clip}<g ${shape === "circle" ? 'clip-path="url(#k)"' : ""}><rect width="${w}" height="${h}" fill="${bg}"/>${body}<rect width="${w}" height="${h}" fill="url(#g)" opacity="0.08"/></g><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient></defs></svg>`;
  const uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  cache.set(key, uri);
  return uri;
}

export function paletteAccent(palette: number): string {
  return PALETTES[Math.abs(palette) % PALETTES.length][1];
}
