// Color maths: hex parsing, HSL (colorsys-style HLS), OKLab, WCAG contrast and the color ramp table.

export type Rgb = [number, number, number];
export type BlendMode = "RGB" | "HSL" | "OKLab";
export type Transition = "Smooth" | "Ease" | "Step" | "Hold";
export const BLEND_MODES: BlendMode[] = ["RGB", "HSL", "OKLab"];
export const TRANSITIONS: Transition[] = ["Smooth", "Ease", "Step", "Hold"];
export const LUT_SIZE = 4096;

export const isHex = (s: unknown): s is string => typeof s === "string" && /^#[0-9A-Fa-f]{6}$/.test(s);

/** 'abc', '#aabbcc' -> '#AABBCC'; null when it is not a color. */
export function normHex(text: string): string | null {
  let s = String(text).trim().replace(/^#/, "");
  if (/^[0-9A-Fa-f]{3}$/.test(s)) s = s.split("").map((c) => c + c).join("");
  return /^[0-9A-Fa-f]{6}$/.test(s) ? "#" + s.toUpperCase() : null;
}

export function hexToRgb(hex: string): Rgb {
  const h = isHex(hex) ? hex : "#CCCCCC";
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

const clamp255 = (v: number) => Math.min(255, Math.max(0, Math.round(v)));

export function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((v) => clamp255(v).toString(16).padStart(2, "0")).join("").toUpperCase();
}

/** r,g,b in 0..1 -> [h, l, s] in 0..1 (same as Python's colorsys.rgb_to_hls) */
export function rgbToHls(r: number, g: number, b: number): [number, number, number] {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mn + mx) / 2;
  if (mx === mn) return [0, l, 0];
  const d = mx - mn;
  const s = l <= 0.5 ? d / (mx + mn) : d / (2 - mx - mn);
  const rc = (mx - r) / d;
  const gc = (mx - g) / d;
  const bc = (mx - b) / d;
  let h: number;
  if (r === mx) h = bc - gc;
  else if (g === mx) h = 2 + rc - bc;
  else h = 4 + gc - rc;
  return [(h / 6) % 1 < 0 ? ((h / 6) % 1) + 1 : (h / 6) % 1, l, s];
}

function hlsV(m1: number, m2: number, hue: number): number {
  hue = ((hue % 1) + 1) % 1;
  if (hue < 1 / 6) return m1 + (m2 - m1) * hue * 6;
  if (hue < 0.5) return m2;
  if (hue < 2 / 3) return m1 + (m2 - m1) * (2 / 3 - hue) * 6;
  return m1;
}

/** h,l,s in 0..1 -> [r,g,b] in 0..1 */
export function hlsToRgb(h: number, l: number, s: number): Rgb {
  if (s === 0) return [l, l, l];
  const m2 = l <= 0.5 ? l * (1 + s) : l + s - l * s;
  const m1 = 2 * l - m2;
  return [hlsV(m1, m2, h + 1 / 3), hlsV(m1, m2, h), hlsV(m1, m2, h - 1 / 3)];
}

export function hlsToHex(h: number, l: number, s: number): string {
  const [r, g, b] = hlsToRgb(h, l, s);
  return rgbToHex(r * 255, g * 255, b * 255);
}

export function hexToHls(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHls(r / 255, g / 255, b / 255);
}

// ── sRGB <-> linear <-> OKLab ──────────────────────────────────────────
const srgbToLin = (c: number) => {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
const linToSrgb = (c: number) => {
  c = Math.min(1, Math.max(0, c));
  return 255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
};

export function rgbToOklab([R, G, B]: Rgb): Rgb {
  const r = srgbToLin(R), g = srgbToLin(G), b = srgbToLin(B);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function oklabToRgb([L, a, b]: Rgb): Rgb {
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  return [
    linToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    linToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    linToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

function mixColors(c0: Rgb, c1: Rgb, u: number, mode: BlendMode, ctx: { a?: Rgb; b?: Rgb; h?: [number, number, number, number, number, number] }): Rgb {
  if (mode === "OKLab") {
    const a = (ctx.a ??= rgbToOklab(c0));
    const b = (ctx.b ??= rgbToOklab(c1));
    return oklabToRgb([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]);
  }
  if (mode === "HSL") {
    if (!ctx.h) {
      let [h0, l0, s0] = rgbToHls(c0[0] / 255, c0[1] / 255, c0[2] / 255);
      let [h1, l1, s1] = rgbToHls(c1[0] / 255, c1[1] / 255, c1[2] / 255);
      if (s0 < 0.02) h0 = h1; // a grey has no hue: take the other color's
      if (s1 < 0.02) h1 = h0;
      const dh = ((((h1 - h0 + 0.5) % 1) + 1) % 1) - 0.5; // the short way round the wheel
      ctx.h = [h0, dh, l0, l1 - l0, s0, s1 - s0];
    }
    const [h0, dh, l0, dl, s0, ds] = ctx.h;
    const rgb = hlsToRgb((((h0 + dh * u) % 1) + 1) % 1, l0 + dl * u, s0 + ds * u);
    return [rgb[0] * 255, rgb[1] * 255, rgb[2] * 255];
  }
  return [c0[0] + (c1[0] - c0[0]) * u, c0[1] + (c1[1] - c0[1]) * u, c0[2] + (c1[2] - c0[2]) * u];
}

function shapeStep(u: number, trans: Transition): number {
  switch (trans) {
    case "Ease":
      return u * u * (3 - 2 * u);
    case "Step":
      return 0; // the first color stays until the next stop, then it jumps
    case "Hold": {
      const k = Math.min(1, Math.max(0, (u - 0.5) * 2)); // stays for half the way, then blends smoothly
      return k * k * (3 - 2 * k);
    }
    default:
      return u;
  }
}

export interface RampStop {
  pos: number; // 0..1
  rgb: Rgb;
  alpha: number; // 0..255
  trans?: Transition; // transition from this stop to the next one
}

/** The color ramp as an RGBA lookup table (size x 4). Stops must be sorted by position. */
export function buildStopLut(stops: RampStop[], mode: BlendMode = "RGB", size = LUT_SIZE): Uint8ClampedArray {
  const out = new Uint8ClampedArray(size * 4);
  const n = stops.length;
  const first = stops[0];
  for (let k = 0; k < size; k++) {
    out[k * 4] = first.rgb[0];
    out[k * 4 + 1] = first.rgb[1];
    out[k * 4 + 2] = first.rgb[2];
    out[k * 4 + 3] = first.alpha;
  }
  for (let i = 0; i < n - 1; i++) {
    const p0 = stops[i].pos, p1 = stops[i + 1].pos;
    if (p1 - p0 < 1e-9) continue; // two stops at the same place = a hard edge
    const ctx = {};
    const tr = stops[i].trans ?? "Smooth";
    const kStart = Math.ceil(p0 * (size - 1) - 1e-9);
    for (let k = Math.max(0, kStart); k < size; k++) {
      const x = k / (size - 1);
      if (x < p0) continue;
      if (x >= p1) break;
      const u = shapeStep((x - p0) / (p1 - p0), tr);
      const c = mixColors(stops[i].rgb, stops[i + 1].rgb, u, mode, ctx);
      out[k * 4] = c[0];
      out[k * 4 + 1] = c[1];
      out[k * 4 + 2] = c[2];
      out[k * 4 + 3] = stops[i].alpha + (stops[i + 1].alpha - stops[i].alpha) * u;
    }
  }
  const last = stops[n - 1];
  for (let k = 0; k < size; k++) {
    if (k / (size - 1) >= last.pos) {
      out[k * 4] = last.rgb[0];
      out[k * 4 + 1] = last.rgb[1];
      out[k * 4 + 2] = last.rgb[2];
      out[k * 4 + 3] = last.alpha;
    }
  }
  return out;
}

export function lutAt(lut: Uint8ClampedArray, p: number): [number, number, number, number] {
  const size = lut.length / 4;
  const k = Math.round(Math.min(1, Math.max(0, p)) * (size - 1)) * 4;
  return [lut[k], lut[k + 1], lut[k + 2], lut[k + 3]];
}

// ── WCAG ──────────────────────────────────────────────────────────────
function lin(c: number) {
  c /= 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
/** Exact WCAG ratio (not rounded, so 4.496 never passes as 4.5). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
/** Closest lightness change of `change` (same hue and saturation) that reaches `target` against `other`. */
export function fixContrast(change: string, other: string, target: number): string | null {
  const [h, l, s] = hexToHls(change);
  for (let k = 0; k <= 200; k++) {
    for (const sign of [1, -1]) {
      const nl = l + sign * k * 0.005;
      if (nl < 0 || nl > 1) continue;
      const cand = hlsToHex(h, nl, s);
      if (contrastRatio(cand, other) >= target) return cand;
    }
  }
  for (const cand of ["#000000", "#FFFFFF"]) if (contrastRatio(cand, other) >= target) return cand;
  return null;
}
export function readableOn(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  return (r * 0.299 + g * 0.587 + b * 0.114) / 255 < 0.5 ? "#EEEEEE" : "#222222";
}
