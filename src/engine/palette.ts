// Palette helpers: harmonies, colors from an image, parsing pasted palettes.
import { Rng } from "./rng";
import { hexToHls, hexToRgb, hlsToHex, normHex, rgbToHls, rgbToOklab, type Rgb } from "./color";

export const HARMONIES = ["Complementary", "Analogous", "Monochromatic", "Triadic", "Tetradic", "Square", "Shades", "Compound", "Pentadic", "Hexadic", "Split-Complementary"] as const;
export type Harmony = (typeof HARMONIES)[number];
export const TEMPERATURES = ["Neutral", "Warm", "Cool", "New Scheme"] as const;
export type Temperature = (typeof TEMPERATURES)[number];

/** The colors "Generate palette" would use. Nothing is applied. */
export function harmonyPalette(base: string, harmony: Harmony, num: number, temp: Temperature = "Neutral", rng: Rng = new Rng(Date.now())): string[] {
  const [h, l, s] = hexToHls(base);
  const at = (ang: number, nl = l) => hlsToHex((((h + ang) % 1) + 1) % 1, nl, s);
  const light = (nl: number) => hlsToHex(h, nl, s);
  let p: string[] = [base];
  switch (harmony) {
    case "Complementary":
      p.push(at(0.5));
      if (num > 2) p.push(...Array(num - 2).fill(base));
      break;
    case "Analogous": {
      const a = [-0.083, 0.083];
      if (num > 3) a.push(...[-0.166, 0.166, -0.25, 0.25].slice(0, num - 3));
      p.push(...a.map((x) => at(x)));
      break;
    }
    case "Monochromatic": {
      const st = [Math.max(0.1, l - 0.2), Math.min(0.9, l + 0.2)];
      if (num > 3) st.push(...[Math.max(0.1, l - 0.3), Math.min(0.9, l + 0.3), Math.max(0.1, l - 0.15), Math.min(0.9, l + 0.15)].slice(0, num - 3));
      p.push(...st.map(light));
      break;
    }
    case "Triadic": {
      const a = [0.333, 0.667];
      if (num > 3) a.push(...[0, 0.333, 0.667].slice(0, num - 3));
      p.push(...a.map((x) => at(x)));
      break;
    }
    case "Tetradic":
    case "Square": {
      const [b, e] = harmony === "Tetradic" ? [[0.1667, 0.5, 0.6667], [0.3333, 0.8333]] : [[0.25, 0.5, 0.75], [0.125, 0.875]];
      p.push(...[...b, ...e.slice(0, Math.max(0, num - 4))].map((x) => at(x)));
      break;
    }
    case "Split-Complementary": {
      const a = [0.4167, 0.5833];
      if (num > 3) a.push(...[0, 0.4167, 0.5833].slice(0, num - 3));
      p.push(...a.map((x) => at(x)));
      break;
    }
    case "Shades": {
      const st = [Math.max(0.1, l - 0.3), Math.max(0.1, l - 0.15), Math.min(0.9, l + 0.15), Math.min(0.9, l + 0.3)];
      if (num > 5) st.push(...[Math.max(0.1, l - 0.45), Math.min(0.9, l + 0.45)].slice(0, num - 5));
      p.push(...st.slice(0, num - 1).map(light));
      break;
    }
    case "Compound": {
      const a = [0.5, 0.4167, 0.5833];
      if (num > 4) a.push(...[0.333, 0.667].slice(0, num - 4));
      p.push(...a.map((x) => at(x)));
      break;
    }
    case "Pentadic":
      p.push(...[0.2, 0.4, 0.6, 0.8].slice(0, num - 1).map((x) => at(x)));
      break;
    case "Hexadic":
      p.push(...[0.1667, 0.3333, 0.5, 0.6667, 0.8333].slice(0, num - 1).map((x) => at(x)));
      break;
  }
  p = p.slice(0, num);
  while (p.length < num) p.push(base);
  // never hand back two identical colors: shift lightness (and a little hue) of repeats
  const seen = new Set<string>();
  p.forEach((col, i) => {
    let key = col.toUpperCase();
    if (seen.has(key)) {
      const [hh, ll, ss] = hexToHls(col);
      for (let step = 1; step < 40; step++) {
        const delta = 0.12 * ((((Math.trunc((step + 1) / 2) - 1) % 5) + 5) % 5 + 1) * (step % 2 ? 1 : -1);
        const dh = 0.02 * Math.trunc((step - 1) / 10) * (step % 4 < 2 ? 1 : -1);
        const cand = hlsToHex((((hh + dh) % 1) + 1) % 1, Math.min(0.92, Math.max(0.08, ll + delta)), ss);
        if (!seen.has(cand) && !p.includes(cand)) {
          p[i] = cand;
          key = cand;
          break;
        }
      }
    }
    seen.add(key);
  });
  if (temp === "New Scheme") {
    p = p.map((c) => {
      const [hh, ll, ss] = hexToHls(c);
      return hlsToHex((((hh + rng.uniform(-0.1, 0.1)) % 1) + 1) % 1, ll, Math.min(1, ss * 1.2));
    });
  } else if (temp !== "Neutral") {
    p = p.map((c, i) => {
      if (i === 0) return c;
      const [hh, ll, ss] = hexToHls(c);
      const target = temp === "Warm" ? 0.08 : 0.6;
      const diff = ((((target - hh + 0.5) % 1) + 1) % 1) - 0.5;
      return hlsToHex((((hh + Math.max(-0.06, Math.min(0.06, diff))) % 1) + 1) % 1, ll, ss);
    });
  }
  return p;
}

/** Pull colors out of pasted text: hex codes (#RRGGBB, RRGGBB, #RGB), a Coolors link, or GIMP .gpl lines. */
export function parsePaletteText(text: string): string[] {
  const out: string[] = [];
  const add = (h: string) => {
    const n = normHex(h);
    if (n && !out.includes(n)) out.push(n);
  };
  const re = /(?<![0-9A-Za-z])(#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3}|(?=[0-9A-Fa-f]*[0-9])[0-9A-Fa-f]{6})(?![0-9A-Za-z])/g;
  for (const m of text.matchAll(re)) add(m[1]);
  if (!out.length) {
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})(\s|$)/);
      if (m && [m[1], m[2], m[3]].every((v) => +v <= 255)) add([m[1], m[2], m[3]].map((v) => (+v).toString(16).padStart(2, "0")).join(""));
    }
  }
  return out;
}

// ── Colors from an image ───────────────────────────────────────────────
export const PICK_MODES = ["Dominant", "Vivid", "Muted / pastel", "Most different", "Light to dark", "Warm only", "Cool only"] as const;
export type PickMode = (typeof PICK_MODES)[number];

interface Box { px: number[]; } // flat list of packed rgb ints

function medianCut(pixels: Uint32Array, k: number): { rgb: Rgb; count: number }[] {
  let boxes: Uint32Array[] = [pixels];
  const range = (b: Uint32Array) => {
    let r0 = 255, r1 = 0, g0 = 255, g1 = 0, b0 = 255, b1 = 0;
    for (let i = 0; i < b.length; i++) {
      const v = b[i], r = (v >> 16) & 255, g = (v >> 8) & 255, bl = v & 255;
      if (r < r0) r0 = r; if (r > r1) r1 = r; if (g < g0) g0 = g; if (g > g1) g1 = g; if (bl < b0) b0 = bl; if (bl > b1) b1 = bl;
    }
    const dr = r1 - r0, dg = g1 - g0, db = b1 - b0;
    return dr >= dg && dr >= db ? { ch: 16, span: dr } : dg >= db ? { ch: 8, span: dg } : { ch: 0, span: db };
  };
  while (boxes.length < k) {
    let bi = -1, best = -1, bch = 0;
    boxes.forEach((b, i) => {
      if (b.length < 2) return;
      const r = range(b);
      const score = r.span * Math.sqrt(b.length);
      if (r.span > 0 && score > best) { best = score; bi = i; bch = r.ch; }
    });
    if (bi < 0) break;
    const b = boxes[bi];
    const sorted = Uint32Array.from(b).sort((x, y) => ((x >> bch) & 255) - ((y >> bch) & 255));
    const mid = sorted.length >> 1;
    boxes.splice(bi, 1, sorted.subarray(0, mid), sorted.subarray(mid));
  }
  return boxes.filter((b) => b.length).map((b) => {
    let r = 0, g = 0, bl = 0;
    for (let i = 0; i < b.length; i++) { r += (b[i] >> 16) & 255; g += (b[i] >> 8) & 255; bl += b[i] & 255; }
    return { rgb: [Math.round(r / b.length), Math.round(g / b.length), Math.round(bl / b.length)] as Rgb, count: b.length };
  }).sort((a, b) => b.count - a.count);
}

const toHex = ([r, g, b]: Rgb) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();

/** About `n` colors of an image (RGBA pixel data, already shrunk to about 240 px), chosen by `mode`. */
export function extractColors(data: Uint8ClampedArray, n: number, mode: PickMode = "Dominant"): string[] {
  const px: number[] = [];
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 8) px.push((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
  const pixels = Uint32Array.from(px);
  if (!pixels.length) throw new Error("this image has no visible pixels");
  if (mode === "Dominant") {
    const cols: string[] = [];
    for (const c of medianCut(pixels, n)) { const h = toHex(c.rgb); if (!cols.includes(h)) cols.push(h); }
    if (cols.length < 2) throw new Error("this image has fewer than two different colors");
    return cols;
  }
  const found = medianCut(pixels, 64);
  const total = found.reduce((a, c) => a + c.count, 0) || 1;
  const cand = found.map((c) => {
    const [h, , sat] = rgbToHls(c.rgb[0] / 255, c.rgb[1] / 255, c.rgb[2] / 255);
    const lab = rgbToOklab(c.rgb);
    return { hex: toHex(c.rgb), pop: c.count / total, hue: h * 360, sat, lab, L: lab[0], chroma: Math.hypot(lab[1], lab[2]) };
  });
  type Cand = (typeof cand)[number];
  const dist = (a: Cand, b: Cand) => Math.hypot(a.lab[0] - b.lab[0], a.lab[1] - b.lab[1], a.lab[2] - b.lab[2]);
  const pick = (order: Cand[], limit: number): Cand[] => {
    const chosen: Cand[] = [];
    for (const gap of [0.07, 0.04, 0.02, 0]) for (const c of order) {
      if (chosen.length >= limit) return chosen;
      if (!chosen.includes(c) && chosen.every((k) => dist(c, k) >= gap)) chosen.push(c);
    }
    return chosen;
  };
  let chosen: Cand[];
  if (mode === "Vivid") {
    const pool = cand.filter((c) => c.pop >= 0.0015).sort((a, b) => b.chroma - a.chroma);
    chosen = pick(pool.length ? pool : cand, n);
  } else if (mode === "Muted / pastel") {
    chosen = pick([...cand].sort((a, b) => b.L - 2.5 * Math.abs(b.chroma - 0.07) - (a.L - 2.5 * Math.abs(a.chroma - 0.07))), n);
  } else if (mode === "Most different") {
    chosen = [cand[0]];
    while (chosen.length < Math.min(n, cand.length)) {
      let far: Cand | null = null, fd = -1;
      for (const c of cand) if (!chosen.includes(c)) { const d = Math.min(...chosen.map((k) => dist(c, k))); if (d > fd) { fd = d; far = c; } }
      if (!far || fd < 0.02) break;
      chosen.push(far);
    }
  } else if (mode === "Light to dark") {
    const ordered = [...cand].sort((a, b) => a.L - b.L), m = ordered.length;
    const idx = Array.from({ length: Math.min(n, m) }, (_, k) => Math.round((k * (m - 1)) / Math.max(1, n - 1)));
    chosen = pick(idx.map((i) => ordered[i]), n);
    if (!chosen.length) chosen = ordered.slice(0, n);
    chosen.sort((a, b) => a.L - b.L);
  } else {
    const ok = (c: Cand) => c.sat >= 0.12 && (mode === "Warm only" ? c.hue <= 75 || c.hue >= 320 : c.hue >= 150 && c.hue <= 285);
    chosen = pick(cand.filter(ok), n);
  }
  const cols: string[] = [];
  for (const c of chosen) if (!cols.includes(c.hex)) cols.push(c.hex);
  if (cols.length < 2) throw new Error("this image has too few colors of that kind. Try another mode");
  return cols;
}

export { hexToRgb };
export type { Box };
