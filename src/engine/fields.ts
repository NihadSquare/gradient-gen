// The "t" field of every gradient type: one number per pixel (0..1) that the color ramp turns into color.
// Ported from the desktop version. Pattern sizes are defined for a 450 px wide reference image and scale
// with the image width, so an export looks like the preview at any resolution.
import { Rng } from "./rng";
import type { CenterPosition, GradientType } from "./types";

export interface FieldInput {
  width: number;
  height: number;
  type: GradientType;
  angle: number; // degrees
  position: CenterPosition;
  customX: number;
  customY: number;
  seed: number;
  /** stop positions after Reverse, sorted (used by Dither) */
  positions: number[];
}

export interface Field {
  t: Float32Array;
  /** only "Stained glass": amount of dark lead line per pixel (0..1) */
  lead?: Float32Array;
}

const JULIA_C: [number, number][] = [
  [-0.8, 0.156], [-0.4, 0.6], [0.285, 0.01], [-0.70176, -0.3842],
  [-0.835, -0.2321], [-0.1, 0.651], [0.355, 0.355], [-0.74543, 0.11301],
];
const PERLIN_GAIN = 1.4;
const TAU = Math.PI * 2;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mod1 = (v: number) => v - Math.floor(v);

export function getCenter(w: number, h: number, pos: CenterPosition, cxPct = 50, cyPct = 50): [number, number] {
  switch (pos) {
    case "Top-left": return [w * 0.1, h * 0.1];
    case "Top-right": return [w * 0.9, h * 0.1];
    case "Bottom-left": return [w * 0.1, h * 0.9];
    case "Bottom-right": return [w * 0.9, h * 0.9];
    case "Top-center": return [w / 2, h * 0.1];
    case "Bottom-center": return [w / 2, h * 0.9];
    case "Left-center": return [w * 0.1, h / 2];
    case "Right-center": return [w * 0.9, h / 2];
    case "Custom": {
      const x = Math.trunc((cxPct * w) / 100), y = Math.trunc((cyPct * h) / 100);
      return [Math.max(0, Math.min(w - 1, x)), Math.max(0, Math.min(h - 1, y))];
    }
    default: return [w / 2, h / 2];
  }
}

/** bilinear upscale of a smooth field (pixel centers aligned) */
export function upscale(src: Float32Array, sw: number, sh: number, w: number, h: number): Float32Array {
  if (sw === w && sh === h) return src;
  const out = new Float32Array(w * h);
  const xs = new Int32Array(w), xf = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    const sx = Math.min(sw - 1, Math.max(0, ((x + 0.5) * sw) / w - 0.5));
    xs[x] = Math.min(sw - 2 < 0 ? 0 : sw - 2, Math.floor(sx));
    xf[x] = sw > 1 ? sx - xs[x] : 0;
  }
  for (let y = 0; y < h; y++) {
    const sy = Math.min(sh - 1, Math.max(0, ((y + 0.5) * sh) / h - 0.5));
    const y0 = Math.min(sh - 2 < 0 ? 0 : sh - 2, Math.floor(sy));
    const fy = sh > 1 ? sy - y0 : 0;
    const y1 = Math.min(sh - 1, y0 + 1);
    const r0 = y0 * sw, r1 = y1 * sw;
    for (let x = 0; x < w; x++) {
      const x0 = xs[x], x1 = Math.min(sw - 1, x0 + 1), fx = xf[x];
      const a = src[r0 + x0] + (src[r0 + x1] - src[r0 + x0]) * fx;
      const b = src[r1 + x0] + (src[r1 + x1] - src[r1 + x0]) * fx;
      out[y * w + x] = a + (b - a) * fy;
    }
  }
  return out;
}

/** compute a smooth field at a reduced width, then scale it up */
function smoothField(w: number, h: number, maxW: number, fn: (cw: number, ch: number) => Float32Array): Float32Array {
  const cw = Math.min(w, maxW);
  const ch = Math.max(1, Math.round((h * cw) / w));
  const small = fn(cw, ch);
  return cw === w && ch === h ? small : upscale(small, cw, ch, w, h);
}

function normalize01(a: Float32Array, eps = 1e-6): void {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < a.length; i++) {
    const v = a[i];
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const span = Math.max(hi - lo, eps);
  for (let i = 0; i < a.length; i++) a[i] = clamp01((a[i] - lo) / span);
}

/** min / max of x_norm*dx + y_norm*dy over the picture (taken at the corners) */
function linRange(w: number, h: number, dx: number, dy: number): [number, number] {
  const xs = [0, w > 1 ? 1 : 0], ys = [0, h > 1 ? 1 : 0];
  let lo = Infinity, hi = -Infinity;
  for (const a of xs) for (const b of ys) {
    const v = a * dx + b * dy;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return [lo, hi];
}

// ── Perlin ─────────────────────────────────────────────────────────────
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

export function perlinNoise(width: number, height: number, seed: number, cells = 5, octaves = 4, seedOff = 0): Float32Array {
  return smoothField(width, height, 1200, (cw, ch) => {
    const rng = new Rng((seed + seedOff) % 2 ** 31);
    const p = rng.permutation(256);
    const perm = new Int32Array(512);
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    const gx = new Float32Array(256), gy = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const a = rng.random() * TAU;
      gx[i] = Math.cos(a);
      gy[i] = Math.sin(a);
    }
    const total = new Float32Array(cw * ch);
    let amp = 1, freq = cells, norm = 0;
    for (let o = 0; o < octaves; o++) {
      const ox = o * 5.17, oy = o * 3.31;
      for (let j = 0; j < ch; j++) {
        const y = (j / cw) * freq + oy;
        const y0 = Math.floor(y), yf = y - y0, yi = y0 & 255, v = fade(yf);
        for (let i = 0; i < cw; i++) {
          const x = (i / cw) * freq + ox;
          const x0 = Math.floor(x), xf = x - x0, xi = x0 & 255, u = fade(xf);
          const h00 = perm[perm[xi] + yi], h10 = perm[perm[xi + 1] + yi];
          const h01 = perm[perm[xi] + yi + 1], h11 = perm[perm[xi + 1] + yi + 1];
          const n00 = gx[h00] * xf + gy[h00] * yf;
          const n10 = gx[h10] * (xf - 1) + gy[h10] * yf;
          const n01 = gx[h01] * xf + gy[h01] * (yf - 1);
          const n11 = gx[h11] * (xf - 1) + gy[h11] * (yf - 1);
          const a = n00 + u * (n10 - n00), b = n01 + u * (n11 - n01);
          total[j * cw + i] += amp * (a + v * (b - a));
        }
      }
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    for (let i = 0; i < total.length; i++) total[i] = clamp01(0.5 + (total[i] / norm) * PERLIN_GAIN);
    return total;
  });
}

function julia(width: number, height: number, angleDeg: number, maxIter = 64): Float32Array {
  return smoothField(width, height, 1000, (cw, ch) => {
    const pos = (((angleDeg % 360) + 360) % 360) / 45;
    const i0 = Math.floor(pos) % 8, frac = pos - Math.floor(pos);
    const c0 = JULIA_C[i0], c1 = JULIA_C[(i0 + 1) % 8];
    const cr = c0[0] * (1 - frac) + c1[0] * frac, ci = c0[1] * (1 - frac) + c1[1] * frac;
    const out = new Float32Array(cw * ch);
    const ln2 = Math.log(2);
    for (let j = 0; j < ch; j++) {
      const im = (j / cw - ch / cw / 2) * 3;
      for (let i = 0; i < cw; i++) {
        let zr = (i / cw - 0.5) * 3, zi = im;
        let n = maxIter;
        for (let k = 0; k < maxIter; k++) {
          const t = zr * zr - zi * zi + cr;
          zi = 2 * zr * zi + ci;
          zr = t;
          const mag2 = zr * zr + zi * zi;
          if (mag2 > 256) {
            n = k + 1 - Math.log(Math.log(Math.sqrt(mag2))) / ln2;
            break;
          }
        }
        out[j * cw + i] = Math.sqrt(clamp01(n / maxIter));
      }
    }
    return out;
  });
}

// ── Generators ─────────────────────────────────────────────────────────
type Gen = (c: Ctx) => Field;
interface Ctx extends FieldInput {
  dx: number;
  dy: number;
  scale: number;
  ref: number;
  cx: number;
  cy: number;
}

/** run `fn(x, y)` for every pixel */
function each(c: Ctx, fn: (x: number, y: number) => number): Float32Array {
  const { width: w, height: h } = c;
  const t = new Float32Array(w * h);
  let k = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) t[k++] = fn(x, y);
  return t;
}

/** largest distance from (cx, cy) to any pixel (corners of the pixel grid) */
function maxDist(c: Ctx, cx = c.cx, cy = c.cy): number {
  const fx = Math.max(Math.abs(cx), Math.abs(c.width - 1 - cx));
  const fy = Math.max(Math.abs(cy), Math.abs(c.height - 1 - cy));
  return Math.sqrt(fx * fx + fy * fy);
}

const hexDistance = (u: number, v: number, hs: number) => {
  const rowH = (hs * Math.sqrt(3)) / 2;
  const r0 = Math.round(v / rowH);
  let best = Infinity;
  for (let dr = -1; dr <= 1; dr++) {
    const r = r0 + dr;
    const cy = r * rowH;
    const off = (((r % 2) + 2) % 2) * (hs / 2);
    const cx = Math.round((u - off) / hs) * hs + off;
    const d = Math.sqrt((u - cx) ** 2 + (v - cy) ** 2);
    if (d < best) best = d;
  }
  return best;
};

const BAYER = (() => {
  let b = [[0, 2], [3, 1]];
  for (let it = 0; it < 2; it++) {
    const n = b.length, nb: number[][] = Array.from({ length: n * 2 }, () => new Array(n * 2).fill(0));
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const v = b[y][x];
      nb[y][x] = 4 * v;
      nb[y][x + n] = 4 * v + 2;
      nb[y + n][x] = 4 * v + 3;
      nb[y + n][x + n] = 4 * v + 1;
    }
    b = nb;
  }
  return b;
})();

const GENERATORS: Record<GradientType, Gen> = {
  Linear(c) {
    const { width: w, height: h, dx, dy } = c;
    const [lo, hi] = linRange(w, h, dx, dy);
    const span = hi - lo !== 0 ? hi - lo : 1;
    const mx = Math.max(w - 1, 1), my = Math.max(h - 1, 1);
    return { t: each(c, (x, y) => clamp01(((x / mx) * dx + (y / my) * dy - lo) / span)) };
  },
  Radial(c) {
    const { cx, cy, width: w, height: h } = c;
    const m = Math.sqrt(Math.max(cx, w - cx) ** 2 + Math.max(cy, h - cy) ** 2);
    return { t: each(c, (x, y) => Math.min(Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / m, 1)) };
  },
  Conical(c) {
    const { cx, cy, angle } = c;
    return { t: each(c, (x, y) => mod1(Math.atan2(y - cy, x - cx) / TAU + 0.5 + angle / 360)) };
  },
  Diamond(c) {
    const { cx, cy, width: w, height: h } = c;
    const m = Math.max(Math.abs(cx), Math.abs(w - cx)) + Math.max(Math.abs(cy), Math.abs(h - cy));
    return { t: each(c, (x, y) => Math.min((Math.abs(x - cx) + Math.abs(y - cy)) / m, 1)) };
  },
  Spiral(c) {
    const { cx, cy, width: w, height: h, angle } = c;
    const m = Math.sqrt(Math.max(cx, w - cx) ** 2 + Math.max(cy, h - cy) ** 2);
    return {
      t: each(c, (x, y) => {
        const r = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        return mod1(r / m + (Math.atan2(y - cy, x - cx) / TAU + angle / 360));
      }),
    };
  },
  Swirl(c) {
    const { cx, cy } = c;
    const m = Math.max(maxDist(c), 1e-6);
    return { t: each(c, (x, y) => mod1(Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / m + (Math.atan2(y - cy, x - cx) / TAU) * 2)) };
  },
  Plasma(c) {
    const { scale, dx, dy } = c;
    return { t: each(c, (x, y) => (Math.sin(x * 0.05 * scale + dx) + Math.cos(y * 0.05 * scale + dy) + 2) / 4) };
  },
  Voronoi(c) {
    const { width: w, height: h } = c;
    const rv = new Rng(c.seed + 11);
    const pts: [number, number][] = Array.from({ length: 10 }, () => [rv.random() * w, rv.random() * h]);
    const m = Math.max(w, h) / 4;
    return {
      t: each(c, (x, y) => {
        let d = Infinity;
        for (let i = 0; i < 10; i++) {
          const q = (x - pts[i][0]) ** 2 + (y - pts[i][1]) ** 2;
          if (q < d) d = q;
        }
        return Math.min(Math.sqrt(d) / m, 1);
      }),
    };
  },
  Cylindrical(c) {
    const { cx, cy, dx, dy, width: w } = c;
    const m = Math.max(Math.abs(cx), Math.abs(w - cx), 1);
    return { t: each(c, (x, y) => Math.min(Math.abs((x - cx) * dx + (y - cy) * dy) / m, 1)) };
  },
  Pixelated(c) {
    const { width: w, height: h, dx, dy, ref } = c;
    const block = Math.max(1, 13 * ref);
    return {
      t: each(c, (x, y) => {
        const xr = (x - w / 2) * dx + (y - h / 2) * dy + w / 1.7;
        return ((Math.floor(xr / block) * block) / w + (Math.floor(y / block) * block) / h) / 1.7;
      }),
    };
  },
  Abstract(c) {
    const { scale, dx, dy } = c;
    return { t: each(c, (x, y) => (Math.sin((x * dx + y * dy) * 0.05 * scale + Math.cos(y * 0.05 * scale)) + 1) / 2) };
  },
  Parametric(c) {
    const { scale, cx, cy, width: w, height: h } = c;
    return { t: each(c, (x, y) => (Math.sin(x * 0.02 * scale + cx / w) * Math.cos(y * 0.02 * scale + cy / h) + 1) / 2) };
  },
  Hexagonal(c) {
    const { scale } = c;
    return { t: each(c, (x, y) => Math.min(hexDistance(x * scale, y * scale, 20) / 56.25, 1)) };
  },
  Perlin(c) {
    return { t: perlinNoise(c.width, c.height, c.seed) };
  },
  Wave(c) {
    const { scale, dx, dy } = c;
    return { t: each(c, (x, y) => (Math.sin(x * 0.05 * scale * dx + y * 0.05 * scale * dy) + 1) / 2) };
  },
  Starburst(c) {
    const { cx, cy } = c;
    return { t: each(c, (x, y) => clamp01((Math.sin(Math.atan2(y - cy, x - cx) * 8) + 1) / 2)) };
  },
  Kaleidoscope(c) {
    const { width: w, height: h } = c;
    const cx = w / 2, cy = h / 2, m = Math.max(maxDist(c, cx, cy), 1e-6);
    return {
      t: each(c, (x, y) => {
        const r = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        return clamp01(((Math.sin(Math.atan2(y - cy, x - cx) * 6) + 1) / 2) * (r / m));
      }),
    };
  },
  Tiled(c) {
    const ts = Math.max(1, 50 * c.ref);
    return {
      t: each(c, (x, y) => {
        const xi = Math.floor(x / ts), yi = Math.floor(y / ts);
        return clamp01((((xi + yi) % 2) + 2) % 2 / 2 + (x - xi * ts) / ts / 2);
      }),
    };
  },
  Bilinear(c) {
    const mx = Math.max(c.width - 1, 1), my = Math.max(c.height - 1, 1);
    return { t: each(c, (x, y) => clamp01((x / mx + y / my) / 2)) };
  },
  Fractal(c) {
    return { t: julia(c.width, c.height, c.angle) };
  },
  Mesh(c) {
    const { width: w, height: h, dx, dy, seed } = c;
    const rng = new Rng(seed);
    const nb = 9;
    const pts: [number, number][] = [];
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) pts.push([(i + 0.5) / 3, (j + 0.5) / 3]);
    for (const p of pts) {
      p[0] += (rng.random() - 0.5) * (0.7 / 3);
      p[1] += (rng.random() - 0.5) * (0.7 / 3);
    }
    const vals = rng.permutation(nb).map((v) => v / (nb - 1));
    const ar = h / w;
    const ccx = 0.5, ccy = 0.5 * ar;
    const rx: number[] = [], ry: number[] = [];
    for (const [px0, py0] of pts) {
      const px = px0, py = py0 * ar;
      rx.push(clamp01(ccx + (px - ccx) * dx - (py - ccy) * dy));
      ry.push(Math.min(ar, Math.max(0, ccy + (px - ccx) * dy + (py - ccy) * dx)));
    }
    const inv = 1 / (2 * 0.19 ** 2);
    const t = smoothField(w, h, 900, (cw, ch) => {
      const out = new Float32Array(cw * ch);
      for (let j = 0; j < ch; j++) {
        const yn = j / cw;
        for (let i = 0; i < cw; i++) {
          const xn = i / cw;
          let num = 0, den = 0;
          for (let k = 0; k < nb; k++) {
            const wk = Math.exp(-((xn - rx[k]) ** 2 + (yn - ry[k]) ** 2) * inv);
            num += wk * vals[k];
            den += wk;
          }
          out[j * cw + i] = num / Math.max(den, 1e-12);
        }
      }
      normalize01(out);
      return out;
    });
    return { t };
  },
  Aurora(c) {
    const { width: w, height: h, dx, dy, seed } = c;
    const rng = new Rng(seed + 7);
    const ph = [0, 1, 2, 3].map(() => rng.random() * TAU);
    const ccx = 0.5, ccy = (0.5 * h) / w;
    const t = smoothField(w, h, 1200, (cw, ch) => {
      const out = new Float32Array(cw * ch);
      for (let j = 0; j < ch; j++) {
        const yn = j / cw - ccy;
        for (let i = 0; i < cw; i++) {
          const xn = i / cw - ccx;
          const u = xn * dx + yn * dy, v = -xn * dy + yn * dx;
          const wv = v + 0.1 * Math.sin(TAU * 1.3 * u + ph[0]) + 0.06 * Math.sin(TAU * 2.7 * u + ph[1] + 2 * v) + 0.04 * Math.sin(TAU * 0.6 * u + ph[2]);
          const band = 0.5 + 0.5 * Math.sin(TAU * 1.6 * wv + ph[3]);
          const ramp = clamp01(wv * 0.9 + 0.5);
          out[j * cw + i] = clamp01(0.55 * band + 0.45 * ramp);
        }
      }
      return out;
    });
    return { t };
  },
  Marble(c) {
    const { width: w, height: h, dx, dy, seed } = c;
    const n1 = perlinNoise(w, h, seed, 2.4, 3, 101);
    const n2 = perlinNoise(w, h, seed, 5.0, 2, 202);
    const ccx = 0.5, ccy = (0.5 * h) / w;
    const t = new Float32Array(w * h);
    let k = 0;
    for (let y = 0; y < h; y++) {
      const yn = y / w - ccy;
      for (let x = 0; x < w; x++, k++) {
        const xn = x / w - ccx;
        const u = xn * dx + yn * dy;
        const s = u * 2.2 + (n1[k] - 0.5) * 3.2 + (n2[k] - 0.5) * 0.9;
        const veins = Math.pow(0.5 + 0.5 * Math.sin(s * TAU), 1.6);
        const body = clamp01(0.5 + (n1[k] - 0.5) * 1.1 + u * 0.35);
        t[k] = clamp01(0.62 * body + 0.38 * veins);
      }
    }
    return { t };
  },
  Contour(c) {
    const { width: w, height: h, dx, dy, seed, ref } = c;
    const n = perlinNoise(w, h, seed, 2.2, 3, 303);
    normalize01(n, 1e-6);
    const mx = Math.max(w - 1, 1), my = Math.max(h - 1, 1);
    const [lo, hi] = linRange(w, h, dx, dy);
    const span = Math.max(hi - lo, 1e-9);
    const levels = 9;
    const fs = new Float32Array(w * h);
    let k = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++, k++) {
      const lin = clamp01(((x / mx) * dx + (y / my) * dy - lo) / span);
      fs[k] = (0.8 * n[k] + 0.2 * lin) * levels;
    }
    const t = new Float32Array(w * h);
    for (let i = 0; i < t.length; i++) t[i] = Math.min(Math.floor(fs[i]), levels - 1) / (levels - 1);
    if (h > 1 && w > 1) {
      const thr = Math.max(0.8, 1.3 * ref);
      for (let y = 0; y < h; y++) {
        const ya = y === 0 ? 0 : y - 1, yb = y === h - 1 ? h - 1 : y + 1, dyd = ya === yb ? 1 : yb - ya;
        for (let x = 0; x < w; x++) {
          const xa = x === 0 ? 0 : x - 1, xb = x === w - 1 ? w - 1 : x + 1, dxd = xa === xb ? 1 : xb - xa;
          const i = y * w + x;
          const gx = (fs[y * w + xb] - fs[y * w + xa]) / dxd;
          const gy = (fs[yb * w + x] - fs[ya * w + x]) / dyd;
          const fr = fs[i] - Math.floor(fs[i]);
          const edge = Math.min(fr, 1 - fr) / Math.max(Math.sqrt(gx * gx + gy * gy), 1e-6);
          if (edge < thr) t[i] = clamp01(t[i] + (t[i] < 0.5 ? 0.28 : -0.28));
        }
      }
    }
    return { t };
  },
  Halftone(c) {
    const { width: w, height: h, dx, dy, ref } = c;
    const [lo, hi] = linRange(w, h, dx, dy);
    const span = hi - lo > 1e-9 ? hi - lo : 1;
    const pitch = Math.max(4, 14 * ref);
    const c45 = Math.sqrt(0.5), s45 = c45;
    const mx = Math.max(w - 1, 1), my = Math.max(h - 1, 1);
    return {
      t: each(c, (x, y) => {
        const gu = (x * c45 + y * s45) / pitch, gv = (-x * s45 + y * c45) / pitch;
        const iu = Math.floor(gu), iv = Math.floor(gv);
        const dist = Math.sqrt((gu - iu - 0.5) ** 2 + (gv - iv - 0.5) ** 2);
        const cu = (iu + 0.5) * pitch, cv = (iv + 0.5) * pitch;
        const xc = cu * c45 - cv * s45, yc = cu * s45 + cv * c45;
        const lc = clamp01((clamp01(xc / mx) * dx + clamp01(yc / my) * dy - lo) / span);
        const rad = 0.7071 * Math.sqrt(1 - lc);
        const cov = clamp01((rad - dist) * pitch + 0.5);
        return 1 - cov + cov * (0.5 * lc);
      }),
    };
  },
  Dither(c) {
    const { width: w, height: h, dx, dy, ref, positions } = c;
    const [lo, hi] = linRange(w, h, dx, dy);
    const span = hi - lo > 1e-9 ? hi - lo : 1;
    const mx = Math.max(w - 1, 1), my = Math.max(h - 1, 1);
    const cell = Math.max(1, Math.round(2 * ref));
    const nlev = positions.length;
    return {
      t: each(c, (x, y) => {
        const r = clamp01(((x / mx) * dx + (y / my) * dy - lo) / span);
        const thr = (BAYER[Math.floor(y / cell) % 8][Math.floor(x / cell) % 8] + 0.5) / 64;
        const s = r * (nlev - 1);
        const base = Math.min(Math.floor(s), nlev - 2);
        return positions[base + (s - base > thr ? 1 : 0)];
      }),
    };
  },
  Silk(c) {
    const { width: w, height: h, dx, dy, seed } = c;
    const n = perlinNoise(w, h, seed, 1.6, 2, 404);
    const rng = new Rng(seed + 29);
    const ph = [rng.random() * TAU, rng.random() * TAU, rng.random() * TAU];
    const ccx = 0.5, ccy = (0.5 * h) / w;
    const t = new Float32Array(w * h);
    let k = 0;
    for (let y = 0; y < h; y++) {
      const yn = y / w - ccy;
      for (let x = 0; x < w; x++, k++) {
        const xn = x / w - ccx;
        const u = xn * dx + yn * dy, v = -xn * dy + yn * dx;
        const fold = v * 2.4 + 0.55 * Math.sin(TAU * 0.55 * u + ph[0]) + 0.28 * Math.sin(TAU * 1.15 * u + ph[1] + 1.7 * v) + (n[k] - 0.5) * 1.1;
        const sheen = 0.5 + 0.5 * Math.sin(TAU * fold);
        const shade = sheen * sheen * (3 - 2 * sheen);
        t[k] = clamp01(0.7 * shade + 0.3 * clamp01(0.5 + fold * 0.18));
      }
    }
    return { t };
  },
  "Stained glass"(c) {
    const { width: w, height: h, dx, dy, seed, ref } = c;
    const rng = new Rng(seed + 23);
    const cs = Math.max(8, w / 7);
    const gxn = Math.ceil(w / cs), gyn = Math.ceil(h / cs);
    const rowW = gxn + 2, cellsN = rowW * (gyn + 2);
    const px = new Float32Array(cellsN), py = new Float32Array(cellsN), val = new Float32Array(cellsN);
    for (let j = 0; j < gyn + 2; j++) for (let i = 0; i < rowW; i++) {
      const k = j * rowW + i;
      px[k] = (i - 1 + (rng.random() * 0.8 + 0.1)) * cs;
      py[k] = (j - 1 + (rng.random() * 0.8 + 0.1)) * cs;
    }
    for (let k = 0; k < cellsN; k++) val[k] = rng.random();
    const offs: number[] = [];
    for (const oy of [-1, 0, 1]) for (const ox of [-1, 0, 1]) offs.push(oy * rowW + ox);
    const [lo, hi] = linRange(w, h, dx, dy);
    const span = Math.max(hi - lo, 1e-9);
    const mx = Math.max(w - 1, 1), my = Math.max(h - 1, 1);
    const half = Math.max(1, 1.2 * ref), soft = Math.max(1, ref);
    const t = new Float32Array(w * h), lead = new Float32Array(w * h);
    let k = 0;
    for (let y = 0; y < h; y++) {
      const gy = Math.min(Math.floor(y / cs), gyn - 1) + 1;
      for (let x = 0; x < w; x++, k++) {
        const base = gy * rowW + Math.min(Math.floor(x / cs), gxn - 1) + 1;
        let d1 = 1e9, n1 = 0;
        for (let o = 0; o < 9; o++) {
          const idx = base + offs[o];
          const dd = Math.sqrt((x - px[idx]) ** 2 + (y - py[idx]) ** 2);
          if (dd < d1) { d1 = dd; n1 = idx; }
        }
        const p1x = px[n1], p1y = py[n1];
        let edge = 1e9;
        for (let o = 0; o < 9; o++) {
          const idx = base + offs[o];
          if (idx === n1) continue;
          const dq2 = (x - px[idx]) ** 2 + (y - py[idx]) ** 2;
          const sep = Math.max(Math.sqrt((px[idx] - p1x) ** 2 + (py[idx] - p1y) ** 2), 1e-6);
          const e = (dq2 - d1 * d1) / (2 * sep);
          if (e < edge) edge = e;
        }
        const lin = clamp01(((x / mx) * dx + (y / my) * dy - lo) / span);
        t[k] = clamp01(0.72 * val[n1] + 0.28 * lin + 0.1 * clamp01(1 - d1 / (0.75 * cs)));
        lead[k] = clamp01((half + 0.5 * soft - edge) / soft);
      }
    }
    return { t, lead };
  },
};

export function computeField(input: FieldInput): Field {
  const rad = (input.angle * Math.PI) / 180;
  const [cx, cy] = getCenter(input.width, input.height, input.position, input.customX, input.customY);
  const ctx: Ctx = {
    ...input,
    dx: Math.cos(rad),
    dy: Math.sin(rad),
    scale: 450 / input.width,
    ref: input.width / 450,
    cx,
    cy,
  };
  const gen = GENERATORS[input.type] ?? GENERATORS.Linear;
  return gen(ctx);
}
