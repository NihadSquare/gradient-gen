// "Auto Generate": randomises everything that is not locked (single images and batches share this).
import { Rng } from "./rng";
import { isHex } from "./color";
import { MAX_COLORS, MIN_COLORS, type EffectName, type GradientSettings, type GradientType, type Stop } from "./types";

export interface Locks {
  colors: boolean;
  numColors: boolean;
  opacities: boolean;
  type: boolean;
  direction: boolean;
  position: boolean;
  effect: boolean;
  effect2: boolean;
  intensity: boolean;
  intensity2: boolean;
  seed: boolean;
}

export const defaultLocks = (): Locks => ({
  colors: true, numColors: true, opacities: false, type: false, direction: false, position: false,
  effect: false, effect2: false, intensity: false, intensity2: false, seed: false,
});

const TYPES_BATCH: GradientType[] = ["Linear", "Radial", "Conical", "Diamond", "Spiral", "Kaleidoscope", "Swirl", "Cylindrical", "Pixelated", "Perlin", "Starburst", "Mesh", "Aurora", "Marble", "Contour", "Silk"];
const TYPES_SINGLE: GradientType[] = ["Linear", "Radial", "Conical", "Diamond", "Spiral", "Plasma", "Kaleidoscope", "Tiled", "Swirl", "Cylindrical", "Pixelated", "Abstract", "Perlin", "Wave", "Starburst", "Mesh", "Aurora", "Marble", "Contour", "Halftone", "Dither", "Silk", "Stained glass"];
const FX_BATCH: EffectName[] = ["None", "Noise", "Grain", "Blur", "Wave", "Ripples", "Liquidify", "Vignette", "Bloom", "Mosaic", "Distort"];
const FX_BATCH2: EffectName[] = ["None", "Noise", "Grain", "Blur", "Glow", "Wave", "Ripples", "Liquidify", "Vignette", "Bloom", "Mosaic", "Distort"];
const FX_SINGLE: EffectName[] = ["None", "Noise", "Grain", "Blur", "Glow", "Wave", "Ripples", "Liquidify", "Posterize", "Vignette", "Bloom", "Mosaic", "Distort", "Chromatic", "Frosted", "Pixel_sort", "Glitch", "Gradient_map", "Light_leak", "Anti_band"];

export const evenPositions = (n: number) => Array.from({ length: n }, (_, i) => (n === 1 ? 0 : i / (n - 1)));

export function randomize(s: GradientSettings, locks: Locks, batch = false, rng: Rng = new Rng(Math.floor(Math.random() * 2 ** 31))): GradientSettings {
  const out: GradientSettings = { ...s, stops: s.stops.map((x) => ({ ...x })) };
  if (!locks.seed) out.seed = rng.int(0, 2 ** 31 - 1);
  if (!locks.numColors) {
    const n = rng.int(MIN_COLORS, MAX_COLORS + 1);
    const pos = evenPositions(n);
    const stops: Stop[] = [];
    for (let i = 0; i < n; i++) stops.push(out.stops[i] ? { ...out.stops[i], pos: pos[i] } : { color: "#CCCCCC", pos: pos[i], opacity: 1, trans: "Smooth" });
    out.stops = stops;
  }
  if (!locks.colors) {
    out.stops = out.stops.map((st) => {
      const next = { ...st, color: "#" + rng.int(0, 0x1000000).toString(16).padStart(6, "0").toUpperCase() };
      if (!locks.opacities) next.opacity = rng.pick(batch ? [0.2, 0.4, 0.6, 0.8, 1.0] : [0.6, 0.8, 1.0]);
      return next;
    });
  }
  if (!locks.type) out.type = rng.pick(batch ? TYPES_BATCH : TYPES_SINGLE);
  if (!locks.direction) out.direction = rng.int(0, 72) * 5;
  if (!locks.position) out.position = rng.pick(batch ? ["Center", "Right-center"] : ["Center", "Top-left", "Top-right", "Bottom-left", "Bottom-right", "Right-center"]) as GradientSettings["position"];
  if (!locks.effect) out.effect = rng.pick(batch ? FX_BATCH : FX_SINGLE);
  if (!locks.effect2) out.effect2 = rng.pick(batch ? FX_BATCH2 : FX_SINGLE);
  const lo = batch ? 0 : 0.1;
  if (!locks.intensity) out.intensity = rng.uniform(lo, 0.5);
  if (!locks.intensity2) out.intensity2 = rng.uniform(lo, 0.5);
  out.stops.forEach((st) => { if (!isHex(st.color)) st.color = "#CCCCCC"; });
  return out;
}

/** Stops with a new count: keeps the existing ones, fills new ones with the color the ramp already has there. */
export function resizeStops(stops: Stop[], n: number, colorAt: (p: number) => string): Stop[] {
  n = Math.min(MAX_COLORS, Math.max(MIN_COLORS, n));
  if (n === stops.length) return stops;
  const pos = evenPositions(n);
  if (n < stops.length) return stops.slice(0, n).map((s, i) => ({ ...s, pos: pos[i] }));
  const out = stops.map((s) => ({ ...s }));
  for (let i = stops.length; i < n; i++) out.push({ color: colorAt(pos[i]), pos: pos[i], opacity: 1, trans: "Smooth" });
  return out.map((s, i) => ({ ...s, pos: pos[i] }));
}
