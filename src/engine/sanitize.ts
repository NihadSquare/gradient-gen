// Turns anything (an old preset, an imported file, hand-edited JSON) into valid settings.
import { BLEND_MODES, TRANSITIONS, isHex, type BlendMode, type Transition } from "./color";
import {
  EFFECTS, GRADIENT_TYPES, MAX_COLORS, MAX_DIM, MIN_COLORS, OV_POSITIONS, POSITIONS, defaultOverlay, defaultSettings,
  type EffectName, type GradientSettings, type GradientType, type OverlaySettings, type Stop,
} from "./types";

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
export const clampNum = (v: unknown, lo: number, hi: number, d: number) => {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};
const oneOf = <T extends string>(v: unknown, list: readonly T[], d: T): T => (list.includes(v as T) ? (v as T) : d);

export function sanitizeSettings(raw: unknown): GradientSettings {
  const base = defaultSettings();
  if (!isObj(raw)) return base;
  let stops: Stop[] = base.stops;
  if (Array.isArray(raw.stops)) {
    stops = raw.stops.slice(0, MAX_COLORS).filter(isObj).map((s, i, arr) => ({
      color: isHex(s.color) ? (s.color as string).toUpperCase() : "#CCCCCC",
      pos: clampNum(s.pos, 0, 1, arr.length > 1 ? i / (arr.length - 1) : 0),
      opacity: clampNum(s.opacity, 0, 1, 1),
      trans: oneOf<Transition>(s.trans, TRANSITIONS, "Smooth"),
    }));
    if (stops.length < MIN_COLORS) stops = base.stops;
  }
  return {
    stops,
    reverse: !!raw.reverse,
    blend: oneOf<BlendMode>(raw.blend, BLEND_MODES, "RGB"),
    type: oneOf<GradientType>(raw.type, GRADIENT_TYPES, "Linear"),
    direction: clampNum(raw.direction, 0, 360, 0),
    position: oneOf(raw.position as string, POSITIONS, "Center"),
    customX: clampNum(raw.customX, 0, 100, 50),
    customY: clampNum(raw.customY, 0, 100, 50),
    effect: oneOf<EffectName>(raw.effect, EFFECTS, "None"),
    effect2: oneOf<EffectName>(raw.effect2, EFFECTS, "None"),
    intensity: clampNum(raw.intensity, 0, 0.5, 0.1),
    intensity2: clampNum(raw.intensity2, 0, 0.5, 0.1),
    seed: Math.floor(clampNum(raw.seed, 0, 2 ** 31 - 1, base.seed)),
  };
}

export function sanitizeOverlay(raw: unknown): OverlaySettings {
  const d = defaultOverlay();
  if (!isObj(raw)) return d;
  return {
    textOn: !!raw.textOn,
    text: typeof raw.text === "string" ? raw.text.slice(0, 200) : d.text,
    textPos: oneOf(raw.textPos as string, OV_POSITIONS, d.textPos),
    textSize: clampNum(raw.textSize, 1.5, 20, d.textSize),
    textColor: oneOf(raw.textColor as string, ["Auto", "White", "Black"] as const, "Auto"),
    logoPos: oneOf(raw.logoPos as string, OV_POSITIONS, d.logoPos),
    logoSize: clampNum(raw.logoSize, 4, 60, d.logoSize),
    opacity: clampNum(raw.opacity, 10, 100, d.opacity),
    background: oneOf(raw.background as string, ["Transparent", "White", "Black"] as const, "Transparent"),
  };
}

export const clampDim = (v: unknown, d: number) => Math.round(clampNum(v, 1, MAX_DIM, d));
