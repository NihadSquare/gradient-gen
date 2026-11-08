// Post effects, working on RGBA pixel data (Uint8ClampedArray). Ported from the desktop version.
import { Rng } from "./rng";
import { lutAt, hexToRgb } from "./color";
import { upscale } from "./fields";
import type { EffectName } from "./types";

export interface EffectCtx {
  w: number;
  h: number;
  scale: number; // reference units per pixel (450 / width)
  ref: number; // pixels per reference unit (width / 450)
  dx: number;
  dy: number;
  cx: number;
  cy: number;
  seed: number;
  lut: Uint8ClampedArray;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const TAU = Math.PI * 2;

// ── Gaussian blur (3 box passes), edge pixels are repeated ─────────────
function boxSizes(sigma: number, n = 3): number[] {
  const wIdeal = Math.sqrt((12 * sigma * sigma) / n + 1);
  let wl = Math.floor(wIdeal);
  if (wl % 2 === 0) wl--;
  const wu = wl + 2;
  const mIdeal = (12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4);
  const m = Math.round(mIdeal);
  return Array.from({ length: n }, (_, i) => (i < m ? wl : wu));
}

function boxPass(src: Uint8ClampedArray, dst: Uint8ClampedArray, w: number, h: number, r: number, horizontal: boolean) {
  const lines = horizontal ? h : w;
  const len = horizontal ? w : h;
  const stride = horizontal ? 4 : w * 4;
  const lineStride = horizontal ? w * 4 : 4;
  const inv = 1 / (2 * r + 1);
  for (let l = 0; l < lines; l++) {
    const start = l * lineStride;
    for (let c = 0; c < 4; c++) {
      const b = start + c;
      const fv = src[b];
      let val = (r + 1) * fv;
      for (let j = 0; j < r; j++) val += src[b + Math.min(j, len - 1) * stride];
      for (let i = 0; i < len; i++) {
        val += src[b + Math.min(i + r, len - 1) * stride] - src[b + Math.max(i - r - 1, 0) * stride];
        dst[b + i * stride] = val * inv;
      }
    }
  }
}

export function gaussianBlur(data: Uint8ClampedArray, w: number, h: number, sigma: number): Uint8ClampedArray {
  if (sigma < 0.5) return new Uint8ClampedArray(data);
  let a = new Uint8ClampedArray(data);
  let b = new Uint8ClampedArray(data.length);
  for (const size of boxSizes(sigma)) {
    const r = (size - 1) / 2;
    if (r < 1) continue;
    boxPass(a, b, w, h, r, true);
    boxPass(b, a, w, h, r, false);
  }
  return a;
}

function blend(a: Uint8ClampedArray, b: Uint8ClampedArray, t: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] * (1 - t) + b[i] * t;
  return out;
}

/** out = source pixels moved by a per-pixel offset (nearest) */
function warp(data: Uint8ClampedArray, w: number, h: number, ox: (x: number, y: number) => number, oy: (x: number, y: number) => number) {
  const out = new Uint8ClampedArray(data.length);
  let k = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++, k += 4) {
    const sx = clamp(Math.trunc(x + ox(x, y)), 0, w - 1);
    const sy = clamp(Math.trunc(y + oy(x, y)), 0, h - 1);
    const s = (sy * w + sx) * 4;
    out[k] = data[s]; out[k + 1] = data[s + 1]; out[k + 2] = data[s + 2]; out[k + 3] = data[s + 3];
  }
  return out;
}

/** add an integer offset to RGB */
function addOffset(data: Uint8ClampedArray, w: number, h: number, f: (x: number, y: number) => number) {
  let k = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++, k += 4) {
    const o = Math.trunc(f(x, y));
    data[k] += o; data[k + 1] += o; data[k + 2] += o;
  }
}

const luma = (r: number, g: number, b: number) => r * 0.299 + g * 0.587 + b * 0.114;

export function applyEffect(name: EffectName, i: number, data: Uint8ClampedArray, c: EffectCtx): Uint8ClampedArray {
  const { w, h, scale, ref, dx, dy, cx, cy, seed } = c;
  const n = w * h;
  switch (name) {
    case "None":
      return data;

    case "Edge_detect": {
      if (h < 2) return data;
      const g = new Float32Array(n);
      for (let k = 0; k < n; k++) g[k] = (19595 * data[k * 4] + 38470 * data[k * 4 + 1] + 7471 * data[k * 4 + 2] + 0x8000) >> 16;
      const e = new Float32Array(n);
      let mx = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const v = y === 0 ? g[w + x] - g[x] : y === h - 1 ? g[y * w + x] - g[(y - 1) * w + x] : (g[(y + 1) * w + x] - g[(y - 1) * w + x]) / 2;
        e[y * w + x] = Math.abs(v);
        if (e[y * w + x] > mx) mx = e[y * w + x];
      }
      const edge = new Uint8ClampedArray(n * 4);
      for (let k = 0; k < n; k++) {
        const v = Math.floor((e[k] / (mx || 1)) * 255 * i);
        edge[k * 4] = edge[k * 4 + 1] = edge[k * 4 + 2] = v;
        edge[k * 4 + 3] = 255;
      }
      return blend(data, edge, i);
    }
    case "Color_invers": {
      for (let k = 0; k < data.length; k += 4) { data[k] = 255 - data[k]; data[k + 1] = 255 - data[k + 1]; data[k + 2] = 255 - data[k + 2]; }
      return data;
    }
    case "Noise": {
      const rng = new Rng(seed + 31);
      for (let k = 0; k < data.length; k += 4) {
        if (rng.random() < i) {
          data[k] += (rng.random() * 110 - 50) * i;
          data[k + 1] += (rng.random() * 110 - 50) * i;
          data[k + 2] += (rng.random() * 110 - 50) * i;
        }
      }
      return data;
    }
    case "Grain": {
      const rng = new Rng(seed + 37);
      for (let k = 0; k < data.length; k += 4) {
        const v = (rng.random() * 70 - 30) * i;
        data[k] += v; data[k + 1] += v; data[k + 2] += v;
      }
      return data;
    }
    case "Wave":
      addOffset(data, w, h, (x, y) => Math.sin(x * 0.05 * scale + y * 0.05 * scale) * 30 * i);
      return data;
    case "Ripples":
      addOffset(data, w, h, (x, y) => Math.sin(Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) * 0.1 * scale) * 30 * i);
      return data;
    case "Blur":
      return gaussianBlur(data, w, h, i * 25 * ref);
    case "Glow":
      return blend(data, gaussianBlur(data, w, h, i * 40 * ref), i);
    case "Liquidify":
      return warp(data, w, h, (_x, y) => Math.sin(y * 0.05 * scale) * 20 * i * ref, (x) => Math.cos(x * 0.05 * scale) * 15 * i * ref);
    case "Distort":
      return warp(data, w, h, (_x, y) => Math.sin(y * 0.1 * scale) * 20 * i * ref, (x) => Math.cos(x * 0.1 * scale) * 20 * i * ref);
    case "Posterize": {
      const levels = Math.max(1, Math.trunc(8 * (1 - i * 1.8)));
      for (let k = 0; k < data.length; k += 4) for (let ch = 0; ch < 3; ch++) data[k + ch] = Math.round((data[k + ch] / 255) * levels) * (255 / levels);
      return data;
    }
    case "Vignette": {
      const maxR = Math.max(Math.sqrt((w - 1) ** 2 + (h - 1) ** 2), 1e-6);
      let k = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++, k += 4) {
        const f = 1 - (Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / maxR) * i;
        data[k] = Math.floor(data[k] * f); data[k + 1] = Math.floor(data[k + 1] * f); data[k + 2] = Math.floor(data[k + 2] * f);
      }
      return data;
    }
    case "Sepia": {
      for (let k = 0; k < data.length; k += 4) {
        const r = data[k], g = data[k + 1], b = data[k + 2];
        data[k] = 0.393 * r + 0.769 * g + 0.189 * b;
        data[k + 1] = 0.349 * r + 0.686 * g + 0.168 * b;
        data[k + 2] = 0.272 * r + 0.534 * g + 0.131 * b;
      }
      return data;
    }
    case "Solarize": {
      const thr = 128 * (1 - i);
      for (let k = 0; k < data.length; k += 4) for (let ch = 0; ch < 3; ch++) if (data[k + ch] > thr) data[k + ch] = 255 - data[k + ch];
      return data;
    }
    case "Bloom": {
      const soft = gaussianBlur(data, w, h, i * 20 * ref);
      for (let k = 0; k < data.length; k += 4) {
        if ((data[k] + data[k + 1] + data[k + 2]) / 3 > 128) { data[k] = soft[k]; data[k + 1] = soft[k + 1]; data[k + 2] = soft[k + 2]; data[k + 3] = soft[k + 3]; }
      }
      return data;
    }
    case "Mosaic": {
      const block = Math.max(2, Math.round((2 + i * 30) * ref));
      const bw = Math.max(1, Math.floor(w / block)), bh = Math.max(1, Math.floor(h / block));
      const out = new Uint8ClampedArray(data.length);
      const sxs = new Int32Array(w);
      for (let x = 0; x < w; x++) sxs[x] = Math.min(w - 1, Math.floor((Math.floor(((x + 0.5) * bw) / w) + 0.5) * (w / bw)));
      let k = 0;
      for (let y = 0; y < h; y++) {
        const sy = Math.min(h - 1, Math.floor((Math.floor(((y + 0.5) * bh) / h) + 0.5) * (h / bh)));
        for (let x = 0; x < w; x++, k += 4) {
          const s = (sy * w + sxs[x]) * 4;
          out[k] = data[s]; out[k + 1] = data[s + 1]; out[k + 2] = data[s + 2]; out[k + 3] = data[s + 3];
        }
      }
      return out;
    }
    case "Emboss": {
      const out = new Uint8ClampedArray(data);
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const k = (y * w + x) * 4, p = ((y - 1) * w + (x - 1)) * 4;
        for (let ch = 0; ch < 3; ch++) out[k + ch] = data[k + ch] - data[p + ch] + 128;
      }
      return blend(data, out, i);
    }
    case "Sharpen": {
      const f = 1 + i * 10;
      const out = new Uint8ClampedArray(data);
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const k = (y * w + x) * 4;
        for (let ch = 0; ch < 3; ch++) {
          const o = k + ch;
          const sum = data[o - w * 4 - 4] + data[o - w * 4] + data[o - w * 4 + 4] + data[o - 4] + 5 * data[o] + data[o + 4] + data[o + w * 4 - 4] + data[o + w * 4] + data[o + w * 4 + 4];
          const deg = sum / 13;
          out[o] = deg + f * (data[o] - deg);
        }
      }
      return out;
    }
    case "Chromatic": {
      const sh = i * 60 * ref;
      const hw = w / 2, hh = h / 2, hm = Math.max(Math.sqrt(hw * hw + hh * hh), 1e-6);
      const out = new Uint8ClampedArray(data);
      let k = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++, k += 4) {
        const kk = 0.3 + 0.7 * (Math.sqrt((x - hw) ** 2 + (y - hh) ** 2) / hm);
        const ox = Math.round(dx * sh * kk), oy = Math.round(dy * sh * kk);
        out[k] = data[(clamp(y + oy, 0, h - 1) * w + clamp(x + ox, 0, w - 1)) * 4];
        out[k + 2] = data[(clamp(y - oy, 0, h - 1) * w + clamp(x - ox, 0, w - 1)) * 4 + 2];
      }
      return out;
    }
    case "Pixel_sort": {
      const run = Math.max(2, Math.min(w, Math.round((10 + i * 300) * ref)));
      const nRun = Math.floor(w / run);
      if (nRun < 1) return data;
      const rng = new Rng(seed + 5);
      const bandH = Math.max(1, Math.round(3 * ref));
      const nBand = Math.ceil(h / bandH);
      const pick = new Uint8Array(nBand * nRun);
      for (let k = 0; k < pick.length; k++) pick[k] = rng.random() < 0.6 ? 1 : 0;
      const idx = new Uint32Array(run), lum = new Float32Array(run), tmp = new Uint8ClampedArray(run * 4);
      for (let y = 0; y < h; y++) {
        const band = Math.floor(y / bandH);
        for (let r = 0; r < nRun; r++) {
          if (!pick[band * nRun + r]) continue;
          const base = (y * w + r * run) * 4;
          for (let q = 0; q < run; q++) { idx[q] = q; lum[q] = luma(data[base + q * 4], data[base + q * 4 + 1], data[base + q * 4 + 2]); }
          const order = Array.from(idx).sort((a, b) => lum[a] - lum[b] || a - b);
          for (let q = 0; q < run; q++) { const s = base + order[q] * 4; tmp.set(data.subarray(s, s + 4), q * 4); }
          data.set(tmp, base);
        }
      }
      return data;
    }
    case "Frosted": {
      const rng = new Rng(seed + 3);
      const soft = gaussianBlur(data, w, h, i * 18 * ref);
      const rr = Math.max(1, Math.round((1 + i * 14) * ref));
      const mix = 0.05 + i * 0.35;
      let k = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++, k += 4) {
        const ox = rng.int(-rr, rr + 1), oy = rng.int(-rr, rr + 1);
        const s = (clamp(y + oy, 0, h - 1) * w + clamp(x + ox, 0, w - 1)) * 4;
        data[k] = soft[s] * (1 - mix) + 255 * mix;
        data[k + 1] = soft[s + 1] * (1 - mix) + 255 * mix;
        data[k + 2] = soft[s + 2] * (1 - mix) + 255 * mix;
        data[k + 3] = soft[s + 3];
      }
      return data;
    }
    case "Glitch": {
      const out = new Uint8ClampedArray(data);
      const rng = new Rng(seed + 13);
      const rows = Math.max(3, Math.trunc(3 + i * 24));
      for (let q = 0; q < rows; q++) {
        const y0 = rng.int(0, h);
        const bh = Math.trunc(rng.uniform(0.01, 0.08) * h) + 1;
        const shift = Math.trunc(rng.uniform(-1, 1) * i * 0.4 * w);
        for (let y = y0; y < Math.min(h, y0 + bh); y++) for (let x = 0; x < w; x++) {
          const d = (y * w + ((((x + shift) % w) + w) % w)) * 4, s = (y * w + x) * 4;
          out[d] = data[s]; out[d + 1] = data[s + 1]; out[d + 2] = data[s + 2]; out[d + 3] = data[s + 3];
        }
      }
      const split = Math.max(1, Math.trunc(i * 0.04 * w));
      const rolled = new Uint8ClampedArray(out);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const k = (y * w + x) * 4;
        rolled[(y * w + ((x + split) % w)) * 4] = out[k];
        rolled[(y * w + ((((x - split) % w) + w) % w)) * 4 + 2] = out[k + 2];
      }
      const half = Math.max(1, Math.round(1.5 * ref));
      const f = 1 - (0.1 + i * 0.6);
      for (let y = 0; y < h; y++) {
        if (Math.floor(y / half) % 2 !== 0) continue;
        for (let x = 0; x < w; x++) {
          const k = (y * w + x) * 4;
          rolled[k] = Math.floor(rolled[k] * f); rolled[k + 1] = Math.floor(rolled[k + 1] * f); rolled[k + 2] = Math.floor(rolled[k + 2] * f);
        }
      }
      return rolled;
    }
    case "Gradient_map": {
      const lum = new Float32Array(n);
      let lo = Infinity, hi = -Infinity;
      for (let k = 0; k < n; k++) {
        const v = luma(data[k * 4], data[k * 4 + 1], data[k * 4 + 2]) / 255;
        lum[k] = v;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      const span = Math.max(hi - lo, 1e-6), mix = Math.min(1, i * 2);
      for (let k = 0; k < n; k++) {
        const m = lutAt(c.lut, (lum[k] - lo) / span);
        for (let ch = 0; ch < 3; ch++) data[k * 4 + ch] = data[k * 4 + ch] * (1 - mix) + m[ch] * mix;
      }
      return data;
    }
    case "Light_leak": {
      const cw = Math.min(w, 900), ch = Math.max(1, Math.round((h * cw) / w));
      const rng = new Rng(seed + 17);
      const ar = h / w;
      const warm = [[255, 140, 60], [255, 90, 110], [255, 200, 90], [255, 120, 190]];
      const leak = [new Float32Array(cw * ch), new Float32Array(cw * ch), new Float32Array(cw * ch)];
      for (let q = 0; q < 3; q++) {
        const lx = rng.uniform(-0.1, 1.1), ly = rng.uniform(-0.1, 1.1) * ar;
        const ang = rng.uniform(0, Math.PI), wid = rng.uniform(0.07, 0.18);
        const col = warm[rng.int(warm.length)];
        const sa = Math.sin(ang), ca = Math.cos(ang);
        for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
          const gx = (x + 0.5) / cw, gy = (y + 0.5) / cw;
          const d = Math.abs((gx - lx) * sa - (gy - ly) * ca);
          const al = (gx - lx) * ca + (gy - ly) * sa;
          const v = Math.exp(-((d / wid) ** 2)) * Math.exp(-((al / 0.55) ** 2));
          const k = y * cw + x;
          leak[0][k] += v * col[0]; leak[1][k] += v * col[1]; leak[2][k] += v * col[2];
        }
      }
      for (let q = 0; q < 2; q++) {
        const lx = rng.uniform(0.1, 0.9), ly = rng.uniform(0.1, 0.9) * ar, rad = rng.uniform(0.03, 0.08);
        for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
          const gx = (x + 0.5) / cw, gy = (y + 0.5) / cw;
          const g = clamp(1 - Math.sqrt((gx - lx) ** 2 + (gy - ly) ** 2) / rad, 0, 1) ** 2 * 0.5;
          const k = y * cw + x;
          leak[0][k] += g * 255; leak[1][k] += g * 235; leak[2][k] += g * 210;
        }
      }
      const full = leak.map((a) => {
        for (let k = 0; k < a.length; k++) a[k] = clamp(a[k] / 255, 0, 1);
        return upscale(a, cw, ch, w, h);
      });
      const amt = Math.min(1, i * 2);
      for (let k = 0; k < n; k++) for (let q = 0; q < 3; q++) {
        const base = data[k * 4 + q] / 255;
        data[k * 4 + q] = (1 - (1 - base) * (1 - clamp(full[q][k], 0, 1) * amt)) * 255;
      }
      return data;
    }
    case "Anti_band": {
      const rng = new Rng(seed + 19);
      const amp = 0.8 + i * 8;
      for (let k = 0; k < data.length; k += 4) {
        const nz = (rng.random() + rng.random() - 1) * amp;
        data[k] += nz; data[k + 1] += nz; data[k + 2] += nz;
      }
      return data;
    }
    default:
      return data;
  }
}

export { hexToRgb, TAU };
