// Turns GradientSettings into pixels: color ramp + gradient field + effects.
import { buildStopLut, hexToRgb, type RampStop } from "./color";
import { applyEffect, type EffectCtx } from "./effects";
import { computeField, getCenter } from "./fields";
import type { GradientSettings } from "./types";

export interface Pixels {
  width: number;
  height: number;
  data: Uint8ClampedArray; // RGBA, not premultiplied
}

/** The ramp as a lookup table, exactly as rendered (Reverse applied). */
export function rampLut(s: GradientSettings): Uint8ClampedArray {
  const stops = s.stops.map((st, k) => ({ st, k })).sort((a, b) => a.st.pos - b.st.pos || a.k - b.k);
  const ramp: RampStop[] = stops.map(({ st }) => ({
    pos: st.pos,
    rgb: hexToRgb(st.color),
    alpha: Math.round(st.opacity * 255),
    trans: st.trans,
  }));
  const lut = buildStopLut(ramp, s.blend);
  if (!s.reverse) return lut;
  const out = new Uint8ClampedArray(lut.length);
  const n = lut.length / 4;
  for (let k = 0; k < n; k++) out.set(lut.subarray((n - 1 - k) * 4, (n - k) * 4), k * 4);
  return out;
}

export function sortedPositions(s: GradientSettings): number[] {
  const pos = s.stops.map((st) => st.pos);
  const p = s.reverse ? pos.map((v) => 1 - v) : pos;
  return p.slice().sort((a, b) => a - b);
}

export function renderGradient(s: GradientSettings, width: number, height: number, onProgress?: (f: number, label: string) => void): Pixels {
  width = Math.max(1, Math.floor(width));
  height = Math.max(1, Math.floor(height));
  const progress = onProgress ?? (() => {});
  progress(0.05, "Preparing");
  const lut = rampLut(s);

  const field = computeField({
    width, height, type: s.type, angle: s.direction, position: s.position,
    customX: s.customX, customY: s.customY, seed: s.seed, positions: sortedPositions(s),
  });
  progress(0.45, "Coloring");

  const data = new Uint8ClampedArray(width * height * 4);
  const top = lut.length / 4 - 1;
  const t = field.t;
  for (let k = 0; k < t.length; k++) {
    let v = t[k];
    if (!(v > 0)) v = 0; // also catches NaN
    else if (v > 1) v = 1;
    const li = Math.round(v * top) * 4;
    const o = k * 4;
    data[o] = lut[li]; data[o + 1] = lut[li + 1]; data[o + 2] = lut[li + 2]; data[o + 3] = lut[li + 3];
  }
  if (field.lead) {
    for (let k = 0; k < t.length; k++) {
      const f = 1 - 0.88 * field.lead[k];
      data[k * 4] = Math.round(data[k * 4] * f); data[k * 4 + 1] = Math.round(data[k * 4 + 1] * f); data[k * 4 + 2] = Math.round(data[k * 4 + 2] * f);
    }
  }

  const rad = (s.direction * Math.PI) / 180;
  const [cx, cy] = getCenter(width, height, s.position, s.customX, s.customY);
  const ctx: EffectCtx = {
    w: width, h: height, scale: 450 / width, ref: width / 450,
    dx: Math.cos(rad), dy: Math.sin(rad), cx, cy, seed: s.seed, lut,
  };
  let out: Uint8ClampedArray = data;
  const effects: [typeof s.effect, number][] = [[s.effect, s.intensity], [s.effect2, s.intensity2]];
  effects.forEach(([name, amount], idx) => {
    if (name === "None") return;
    progress(0.6 + 0.15 * idx, `Effect: ${name.replace("_", " ")}`);
    out = applyEffect(name, amount, out, ctx);
  });
  progress(0.9, "Finishing");
  return { width, height, data: out };
}
