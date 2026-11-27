// Gradient Gen - Copyright (c) 2026 AK Nihad (Nihad Square). All rights reserved.
// Source-available, not open source: see LICENSE. Copying or reuse is not permitted without written permission.
import { create } from "zustand";
import { lutAt, rgbToHex, BLEND_MODES, TRANSITIONS, isHex, type BlendMode, type Transition } from "../engine/color";
import { Rng } from "../engine/rng";
import { rampLut } from "../engine/render";
import { clampNum } from "../engine/sanitize";
import { EFFECTS, GRADIENT_TYPES, MAX_COLORS, MAX_DIM, POSITIONS, defaultOverlay, type CenterPosition, type EffectName, type ExportFormat, type GradientSettings, type GradientType, type OverlaySettings } from "../engine/types";
import { SIZE_PRESETS } from "../data/desktop";
import { load, save } from "../lib/storage";

export const DEFAULT_COLORS = ["#5240FF", "#130935", ...Array(MAX_COLORS - 2).fill("#CCCCCC")] as string[];
export const DEFAULT_POSITIONS = [0.0, 1.0, 0.2, 0.4, 0.6, 0.8, 0.1, 0.3, 0.5, 0.7, 0.9, 0.15];
export const HIST_MAX = 80;   // every committed edit can be undone (the desktop app keeps only its last 5 pictures)

export interface Prefs { theme: string; accent: string; default_format: ExportFormat; confirm_close: boolean; tooltips: boolean; default_background: "Transparent" | "White" | "Black" }
export const DEFAULT_PREFS: Prefs = { theme: "midnight", accent: "", default_format: "PNG", confirm_close: true, tooltips: true, default_background: "Transparent" };

/** everything Auto Generate / undo keeps (the desktop's history snapshot) */
export interface Look {
  colors: string[]; positions: number[]; opacities: number[]; trans: Transition[]; num: number; blend: BlendMode; reverse: boolean;
  gradientType: GradientType; direction: number; position: CenterPosition; customX: number; customY: number;
  effect: EffectName; effect2: EffectName; intensity: number; intensity2: number; seed: number;
}
export interface Locks { colors: boolean; numColors: boolean; opacities: boolean; type: boolean; direction: boolean; position: boolean; effect: boolean; effect2: boolean; intensity: boolean; intensity2: boolean; seed: boolean }
export const defaultLocks = (): Locks => ({ colors: true, numColors: true, opacities: false, type: false, direction: false, position: false, effect: false, effect2: false, intensity: false, intensity2: false, seed: false });

export interface Preset { name: string; favorite?: boolean; [k: string]: unknown }
export interface UserPalette { name: string; colors: string[] }
export type DialogName = null | "settings" | "theme" | "accent" | "about" | "tutorial" | "presets" | "palette" | "contrast" | "color";
export interface MsgBox { title: string; text: string; kind: "info" | "error" | "warn" | "yesno"; resolve: (v: boolean) => void }
export interface Progress { title: string; text: string; frac: number; cancel: boolean }

export interface AppState extends Look {
  sel: number; keepPositions: boolean;
  zoom: number; offX: number; offY: number; showPalette: boolean;
  width: string; height: string; aspect: string; sizePreset: string; mode: "Single" | "Batch"; batchSize: string; format: ExportFormat; quality: number;
  overlay: OverlaySettings; guides: string; scheme: string; temp: string; contrast1: string; contrast2: string;
  locks: Locks; prefs: Prefs; status: string; hist: Look[]; histIdx: number; dirty: boolean; batchRunning: boolean; batchProgress: number | null;
  presets: Preset[]; palettes: UserPalette[];
  dialog: DialogName; colorIndex: number; fullscreen: boolean; msg: MsgBox | null; progress: Progress | null; logoStamp: number; logoName: string;
  /** set several fields at once */
  set: (p: Partial<AppState>) => void;
  say: (text: string, resetAfter?: number) => void;
  setNum: (n: number) => void; selectStop: (i: number) => void; setColor: (i: number, hex: string) => void; setPos: (i: number, p: number) => void; setOpacity: (i: number, o: number) => void; setTrans: (i: number, t: Transition) => void;
  addStop: (p: number) => number | null; removeStop: (i: number) => void; spreadStops: () => void; addColorGap: () => void; rampAt: (p: number) => [number, number, number, number];
  newSeed: () => void; setSeedText: (t: string) => void;
  setWidth: (t: string) => void; setHeight: (t: string) => void; setAspect: (a: string) => void; setSizePreset: (label: string) => void;
  patchOverlay: (p: Partial<OverlaySettings>) => void; setLock: (k: keyof Locks, v: boolean) => void; setPrefs: (p: Partial<Prefs>) => void;
  randomize: (batch?: boolean) => void; generateRandom: () => boolean; historyPush: () => void; historyUndo: () => void; historyRedo: () => void; historyDirty: () => boolean; canUndo: () => boolean; canRedo: () => boolean;
  presetOf: () => Preset; applyPreset: (p: Preset) => void; applyPaletteColors: (cols: string[]) => void; resetSettings: () => void;
  savePresets: (list: Preset[]) => void; saveUserPalettes: (list: UserPalette[]) => boolean;
  askYesNo: (title: string, text: string) => Promise<boolean>; showMsg: (title: string, text: string, kind?: "info" | "error" | "warn") => Promise<void>;
}

const prefs0: Prefs = { ...DEFAULT_PREFS, ...load<Partial<Prefs>>("gg.prefs", {}) };
const upper = (c: string) => c.toUpperCase();
const asHex = (c: unknown) => (typeof c === "string" && isHex(c.toUpperCase()) ? c.toUpperCase() : "#CCCCCC");
let statusTimer: number | undefined;

const freshSeed = () => new Rng(Math.floor(Math.random() * 2 ** 31)).int(0, 2 ** 31 - 1);
export const lookOf = (s: AppState): Look => ({
  colors: [...s.colors], positions: [...s.positions], opacities: [...s.opacities], trans: [...s.trans], num: s.num, blend: s.blend, reverse: s.reverse,
  gradientType: s.gradientType, direction: s.direction, position: s.position, customX: s.customX, customY: s.customY,
  effect: s.effect, effect2: s.effect2, intensity: s.intensity, intensity2: s.intensity2, seed: s.seed,
});
/** the engine's settings for a Look (first `num` stops) */
export function toSettings(l: Look): GradientSettings {
  return {
    stops: Array.from({ length: l.num }, (_, i) => ({ color: l.colors[i], pos: l.positions[i], opacity: l.opacities[i], trans: l.trans[i] })),
    reverse: l.reverse, blend: l.blend, type: l.gradientType, direction: l.direction, position: l.position, customX: l.customX, customY: l.customY,
    effect: l.effect, effect2: l.effect2, intensity: l.intensity, intensity2: l.intensity2, seed: l.seed,
  };
}
export const sigOf = (l: Look) => JSON.stringify(l);

export const useStore = create<AppState>((set, get) => ({
  colors: [...DEFAULT_COLORS], positions: [...DEFAULT_POSITIONS], opacities: Array(MAX_COLORS).fill(1), trans: Array(MAX_COLORS).fill("Smooth") as Transition[], num: 2, blend: "RGB", reverse: false,
  gradientType: "Linear", direction: 0, position: "Center", customX: 50, customY: 50, effect: "None", effect2: "None", intensity: 0.1, intensity2: 0.1, seed: freshSeed(),
  sel: 0, keepPositions: false, zoom: 1, offX: 0, offY: 0, showPalette: false,
  width: "1920", height: "1080", aspect: "16:9", sizePreset: "Custom Size", mode: "Single", batchSize: "10", format: prefs0.default_format, quality: 95,
  overlay: { ...defaultOverlay(), background: prefs0.default_background }, guides: "Off", scheme: "Complementary", temp: "Neutral", contrast1: DEFAULT_COLORS[0], contrast2: DEFAULT_COLORS[1],
  locks: defaultLocks(), prefs: prefs0, status: "Ready", hist: [], histIdx: -1, dirty: false, batchRunning: false, batchProgress: null,
  presets: load<Preset[]>("gg.presets", []).filter((p) => p && typeof p === "object"), palettes: load<UserPalette[]>("gg.palettes", []),
  dialog: null, colorIndex: 0, fullscreen: false, msg: null, progress: null, logoStamp: 0, logoName: "No logo chosen",

  set: (p) => set(p),
  say: (text, resetAfter) => { set({ status: text }); window.clearTimeout(statusTimer); if (resetAfter) statusTimer = window.setTimeout(() => set({ status: "Ready" }), resetAfter); },

  setNum: (n0) => {
    const s = get(); const n = Math.min(MAX_COLORS, Math.max(2, n0)); const old = s.num;
    const colors = [...s.colors], positions = [...s.positions];
    if (n > old && !s.keepPositions) {          // new grey placeholders take the color the gradient already has there
      const order = Array.from({ length: old }, (_, k) => k).sort((a, b) => positions[a] - positions[b]);
      const xs = order.map((k) => positions[k]); const rgb = order.map((k) => [1, 3, 5].map((j) => parseInt(colors[k].slice(j, j + 2), 16)));
      for (let k = old; k < n; k++) {
        if (colors[k].toUpperCase() !== "#CCCCCC") continue;
        const x = k / (n - 1);
        const ch = [0, 1, 2].map((c) => { let i = 0; while (i < xs.length - 1 && xs[i + 1] < x) i++; if (x <= xs[0]) return rgb[0][c]; if (x >= xs[xs.length - 1]) return rgb[xs.length - 1][c]; const f = (x - xs[i]) / (xs[i + 1] - xs[i] || 1); return rgb[i][c] + (rgb[i + 1][c] - rgb[i][c]) * f; });
        colors[k] = rgbToHex(ch[0], ch[1], ch[2]);
      }
    }
    if (!s.keepPositions) for (let i = 0; i < n; i++) positions[i] = i / (n - 1);
    set({ num: n, colors, positions, sel: Math.min(s.sel, n - 1), contrast1: colors.slice(0, n).map(upper).includes(s.contrast1) ? s.contrast1 : colors[0].toUpperCase(), contrast2: colors.slice(0, n).map(upper).includes(s.contrast2) ? s.contrast2 : (colors[1] ?? colors[0]).toUpperCase(), dirty: true });
  },
  selectStop: (i) => set((s) => ({ sel: Math.max(0, Math.min(s.num - 1, Math.floor(i))) })),
  setColor: (i, hex) => set((s) => { const colors = [...s.colors]; colors[i] = hex.toUpperCase(); const ops = colors.slice(0, s.num); return { colors, dirty: true, contrast1: ops.includes(s.contrast1) || s.colors[i].toUpperCase() !== s.contrast1 ? s.contrast1 : colors[i].toUpperCase(), contrast2: ops.includes(s.contrast2) || s.colors[i].toUpperCase() !== s.contrast2 ? s.contrast2 : colors[i].toUpperCase() }; }),
  setPos: (i, p) => set((s) => { const positions = [...s.positions]; positions[i] = Math.min(1, Math.max(0, p)); return { positions, dirty: true }; }),
  setOpacity: (i, o) => set((s) => { const opacities = [...s.opacities]; opacities[i] = Math.min(1, Math.max(0, o)); return { opacities, dirty: true }; }),
  setTrans: (i, t) => set((s) => { const trans = [...s.trans]; trans[i] = t; return { trans, dirty: true }; }),
  rampAt: (p) => { const s = get(); const lut = rampLut(toSettings({ ...lookOf(s), reverse: false })); const c = lutAt(lut, p); return [c[0], c[1], c[2], c[3] / 255]; },
  addStop: (p) => {
    const s = get(); const n = s.num;
    if (n >= MAX_COLORS) { s.say(`Up to ${MAX_COLORS} colors are possible`); return null; }
    const [r, g, b, a] = s.rampAt(p);
    const colors = [...s.colors], positions = [...s.positions], opacities = [...s.opacities], trans = [...s.trans];
    colors[n] = rgbToHex(r, g, b); opacities[n] = a; positions[n] = p; trans[n] = "Smooth";
    set({ colors, positions, opacities, trans, keepPositions: true }); get().setNum(n + 1); set({ keepPositions: false }); get().selectStop(n);
    return n;
  },
  removeStop: (index) => {
    const s = get(); const n = s.num;
    if (n <= 2) { s.say("At least 2 colors are needed"); return; }
    const colors = [...s.colors], positions = [...s.positions], opacities = [...s.opacities], trans = [...s.trans];
    for (let k = index; k < MAX_COLORS - 1; k++) { colors[k] = colors[k + 1]; opacities[k] = opacities[k + 1]; positions[k] = positions[k + 1]; trans[k] = trans[k + 1]; }
    trans[MAX_COLORS - 1] = "Smooth";
    set({ colors, positions, opacities, trans, keepPositions: true }); get().setNum(n - 1); set({ keepPositions: false }); get().selectStop(Math.min(index, n - 2));
  },
  spreadStops: () => set((s) => { const order = Array.from({ length: s.num }, (_, k) => k).sort((a, b) => s.positions[a] - s.positions[b]); const positions = [...s.positions]; order.forEach((k, rank) => { positions[k] = rank / (s.num - 1); }); return { positions, dirty: true }; }),
  addColorGap: () => { const s = get(); const pos = [0, 1, ...s.positions.slice(0, s.num)].sort((a, b) => a - b); let best = 0, p = 0.5; for (let i = 0; i < pos.length - 1; i++) { if (pos[i + 1] - pos[i] > best) { best = pos[i + 1] - pos[i]; p = (pos[i] + pos[i + 1]) / 2; } } s.addStop(p); },

  newSeed: () => set({ seed: freshSeed(), dirty: true }),
  setSeedText: (t) => { const v = parseInt(t, 10); if (Number.isFinite(v)) set({ seed: ((v % 2 ** 31) + 2 ** 31) % 2 ** 31, dirty: true }); },
  setWidth: (t) => { const s = get(); const [a, b] = s.aspect.split(":").map(Number); const w = parseInt(t, 10); const o: Partial<AppState> = { width: t, sizePreset: "Custom Size", dirty: true }; if (s.aspect !== "Custom" && w > 0) o.height = String(Math.max(1, Math.round((w * b) / a))); set(o); },
  setHeight: (t) => set({ height: t, sizePreset: "Custom Size", aspect: "Custom", dirty: true }),
  setAspect: (a) => { const s = get(); const w = parseInt(s.width, 10); const o: Partial<AppState> = { aspect: a, sizePreset: "Custom Size" }; if (a !== "Custom" && w > 0) { const [x, y] = a.split(":").map(Number); o.height = String(Math.max(1, Math.round((w * y) / x))); } set(o); },
  setSizePreset: (label) => {
    const p = SIZE_PRESETS.find((x) => x[0] === label);
    if (!p || !p[1] || !p[2]) { set({ sizePreset: label }); return; }
    let [, w, h] = p; let note = "";
    if (w > MAX_DIM || h > MAX_DIM) { const k = MAX_DIM / Math.max(w, h); w = Math.round(w * k); h = Math.round(h * k); note = `The web version saves up to ${MAX_DIM} px, so ${p[1]} x ${p[2]} was reduced to ${w} x ${h}`; }
    let aspect = "Custom"; for (const [n, a, b] of [["16:9", 16, 9], ["4:3", 4, 3], ["5:4", 5, 4], ["1:1", 1, 1]] as [string, number, number][]) if (w * b === h * a) aspect = n;
    set({ sizePreset: label, width: String(w), height: String(h), aspect, dirty: true }); if (note) get().say(note, 6000);
  },
  patchOverlay: (p) => set((s) => ({ overlay: { ...s.overlay, ...p }, dirty: true })),
  setLock: (k, v) => set((s) => ({ locks: { ...s.locks, [k]: v } })),
  setPrefs: (p) => { const prefs = { ...get().prefs, ...p }; save("gg.prefs", prefs); set({ prefs }); },

  randomize: (batch = false) => {
    const s = get(), L = s.locks, rng = new Rng(Math.floor(Math.random() * 2 ** 31));
    const o: Partial<AppState> = { dirty: true };
    if (!L.seed) o.seed = rng.int(0, 2 ** 31 - 1);
    let num = s.num; const colors = [...s.colors], opacities = [...s.opacities];
    if (!L.numColors) num = rng.int(2, MAX_COLORS + 1);
    if (!L.colors) for (let i = 0; i < num; i++) { colors[i] = "#" + rng.int(0, 0x1000000).toString(16).padStart(6, "0").toUpperCase(); if (!L.opacities) opacities[i] = rng.pick(batch ? [0.2, 0.4, 0.6, 0.8, 1.0] : [0.6, 0.8, 1.0]); }
    Object.assign(o, { colors, opacities });
    if (!L.type) o.gradientType = rng.pick((batch ? ["Linear", "Radial", "Conical", "Diamond", "Spiral", "Kaleidoscope", "Swirl", "Cylindrical", "Pixelated", "Perlin", "Starburst", "Mesh", "Aurora", "Marble", "Contour", "Silk"] : ["Linear", "Radial", "Conical", "Diamond", "Spiral", "Plasma", "Kaleidoscope", "Tiled", "Swirl", "Cylindrical", "Pixelated", "Abstract", "Perlin", "Wave", "Starburst", "Mesh", "Aurora", "Marble", "Contour", "Halftone", "Dither", "Silk", "Stained glass"]) as GradientType[]);
    if (!L.direction) o.direction = rng.int(0, 72) * 5;
    if (!L.position) o.position = rng.pick((batch ? ["Center", "Right-center"] : ["Center", "Top-left", "Top-right", "Bottom-left", "Bottom-right", "Right-center"]) as CenterPosition[]);
    const fx = (batch ? ["None", "Noise", "Grain", "Blur", "Wave", "Ripples", "Liquidify", "Vignette", "Bloom", "Mosaic", "Distort"] : ["None", "Noise", "Grain", "Blur", "Glow", "Wave", "Ripples", "Liquidify", "Posterize", "Vignette", "Bloom", "Mosaic", "Distort", "Chromatic", "Frosted", "Pixel_sort", "Glitch", "Gradient_map", "Light_leak", "Anti_band"]) as EffectName[];
    const fx2 = (batch ? ["None", "Noise", "Grain", "Blur", "Glow", "Wave", "Ripples", "Liquidify", "Vignette", "Bloom", "Mosaic", "Distort"] : fx) as EffectName[];
    if (!L.effect) o.effect = rng.pick(fx);
    if (!L.effect2) o.effect2 = rng.pick(fx2);
    const lo = batch ? 0 : 0.1;
    if (!L.intensity) o.intensity = rng.uniform(lo, 0.5);
    if (!L.intensity2) o.intensity2 = rng.uniform(lo, 0.5);
    set(o);
    if (num !== s.num) get().setNum(num);
  },
  historyDirty: () => { const s = get(); if (s.histIdx < 0 || s.histIdx >= s.hist.length) return false; return sigOf(lookOf(s)) !== sigOf(s.hist[s.histIdx]); },
  canUndo: () => { const s = get(); return s.histIdx > 0 || (s.histIdx >= 0 && s.historyDirty()); },
  canRedo: () => { const s = get(); return s.histIdx + 1 < s.hist.length; },
  historyPush: () => set((s) => { const cur = lookOf(s); if (s.histIdx >= 0 && s.histIdx < s.hist.length && sigOf(cur) === sigOf(s.hist[s.histIdx])) return {}; const hist = [...s.hist.slice(0, s.histIdx + 1), cur].slice(-HIST_MAX); return { hist, histIdx: hist.length - 1 }; }),
  generateRandom: () => { const s = get(); if (s.batchRunning) return false; if (s.mode === "Single") { s.randomize(false); get().historyPush(); return false; } return true; },
  historyUndo: () => { if (get().batchRunning) return; get().historyPush(); const s = get(); if (s.histIdx <= 0) return; const i = s.histIdx - 1, l = s.hist[i]; set({ ...l, colors: [...l.colors], positions: [...l.positions], opacities: [...l.opacities], trans: [...l.trans], histIdx: i, offX: 0, offY: 0 }); },
  historyRedo: () => { const s = get(); if (s.batchRunning) return; if (s.histIdx + 1 < s.hist.length) { const l = s.hist[s.histIdx + 1]; set({ ...l, colors: [...l.colors], positions: [...l.positions], opacities: [...l.opacities], trans: [...l.trans], histIdx: s.histIdx + 1 }); } },

  presetOf: () => { const s = get(); return { name: "Preset", gradient_type: s.gradientType, direction: `${Math.round(s.direction)}°`, other_direction: s.position, custom_x: s.customX, custom_y: s.customY, effect: s.effect, secondary_effect: s.effect2, intensity: s.intensity, secondary_intensity: s.intensity2, num_colors: String(s.num), colors: s.colors.map(upper), color_opacities: [...s.opacities], color_positions: [...s.positions], reverse_colors: s.reverse, blend_mode: s.blend, stop_trans: [...s.trans], lock_intensity: s.locks.intensity, lock_secondary_intensity: s.locks.intensity2, lock_opacities: s.locks.opacities, zoom_level: s.zoom, temperature: s.temp, width: parseInt(s.width, 10) || 1920, height: parseInt(s.height, 10) || 1080, aspect_ratio: s.aspect, noise_seed: s.seed }; },
  applyPreset: (p) => {
    const f = (v: unknown, d: number, lo: number, hi: number) => clampNum(v, lo, hi, d);
    let n = String(p.num_colors ?? "2"); if (!/^([2-9]|1[0-2])$/.test(n)) n = "2";
    const cols = (Array.isArray(p.colors) ? p.colors : []).slice(0, MAX_COLORS).map(asHex);
    const colors = cols.length ? [...cols, ...DEFAULT_COLORS.slice(cols.length)] : [...DEFAULT_COLORS];
    const ops = (Array.isArray(p.color_opacities) ? p.color_opacities : []).slice(0, MAX_COLORS).map((o) => f(o, 1, 0, 1)); const opacities = [...ops, ...Array(MAX_COLORS - ops.length).fill(1)];
    const num = parseInt(n, 10); let positions: number[];
    if (Array.isArray(p.color_positions) && p.color_positions.length >= num) { const pos = p.color_positions.slice(0, MAX_COLORS).map((v) => f(v, 0, 0, 1)); positions = [...pos, ...DEFAULT_POSITIONS.slice(pos.length)]; } else { positions = [...get().positions]; for (let i = 0; i < num; i++) positions[i] = i / (num - 1); }
    const tr = (Array.isArray(p.stop_trans) ? p.stop_trans : []).slice(0, MAX_COLORS).map((t) => ((TRANSITIONS as readonly string[]).includes(t as string) ? t : "Smooth") as Transition); const trans = [...tr, ...Array(MAX_COLORS - tr.length).fill("Smooth")] as Transition[];
    const gt = (GRADIENT_TYPES as readonly string[]).includes(p.gradient_type as string) ? (p.gradient_type as GradientType) : "Linear";
    const o: Partial<AppState> = {
      gradientType: gt, direction: f(parseFloat(String(p.direction ?? "0").replace("°", "")), 0, 0, 360), position: ((POSITIONS as readonly string[]).includes(p.other_direction as string) ? p.other_direction : "Center") as CenterPosition,
      effect: ((EFFECTS as readonly string[]).includes(p.effect as string) ? p.effect : "None") as EffectName, effect2: ((EFFECTS as readonly string[]).includes(p.secondary_effect as string) ? p.secondary_effect : "None") as EffectName,
      intensity: f(p.intensity ?? 0.1, 0.1, 0, 0.5), intensity2: f(p.secondary_intensity ?? 0.1, 0.1, 0, 0.5), num, colors, opacities, positions, trans,
      blend: ((BLEND_MODES as readonly string[]).includes(p.blend_mode as string) ? p.blend_mode : "RGB") as BlendMode, customX: f(p.custom_x ?? 50, 50, 0, 100), customY: f(p.custom_y ?? 50, 50, 0, 100), reverse: !!p.reverse_colors,
      zoom: f(p.zoom_level ?? 1, 1, 1, 4), temp: typeof p.temperature === "string" ? p.temperature : "Neutral", sel: Math.min(get().sel, num - 1), dirty: true,
      locks: { ...get().locks, intensity: !!p.lock_intensity, intensity2: !!p.lock_secondary_intensity, opacities: !!p.lock_opacities },
    };
    if (p.noise_seed !== undefined && Number.isFinite(Number(p.noise_seed))) o.seed = ((Math.floor(Number(p.noise_seed)) % 2 ** 31) + 2 ** 31) % 2 ** 31;
    const w = Math.round(Number(p.width)), h = Math.round(Number(p.height));
    if (w >= 1 && w <= MAX_DIM && h >= 1 && h <= MAX_DIM) { if (String(w) !== get().width || String(h) !== get().height) o.sizePreset = "Custom Size"; o.width = String(w); o.height = String(h); o.aspect = typeof p.aspect_ratio === "string" ? p.aspect_ratio : "Custom"; }
    const c = colors.slice(0, num).map(upper); o.contrast1 = c.includes(get().contrast1) ? get().contrast1 : c[0]; o.contrast2 = c.includes(get().contrast2) ? get().contrast2 : (c[1] ?? c[0]);
    set(o);
  },
  applyPaletteColors: (colors) => { const cols = colors.map(upper).filter((c) => isHex(c)).slice(0, MAX_COLORS); if (cols.length < 2) return; const p = get().presetOf(); p.num_colors = String(cols.length); p.colors = [...cols, ...get().colors.slice(cols.length)]; delete p.color_positions; get().applyPreset(p); },
  resetSettings: () => {
    const s = get();
    set({ num: 2, position: "Center", customX: 50, customY: 50, locks: defaultLocks(), gradientType: "Linear", direction: 0, effect: "None", effect2: "None", intensity: 0, intensity2: 0, colors: [...DEFAULT_COLORS], opacities: Array(MAX_COLORS).fill(1), positions: [...DEFAULT_POSITIONS], sel: 0, trans: Array(MAX_COLORS).fill("Smooth") as Transition[], blend: "RGB", reverse: false, showPalette: false, zoom: 1, offX: 0, offY: 0, temp: "Neutral", scheme: "Complementary", mode: "Single", batchSize: "10", format: s.prefs.default_format, sizePreset: "Custom Size", quality: 95, guides: "Off", logoName: "No logo chosen", logoStamp: s.logoStamp + 1, overlay: { ...s.overlay, textOn: false, background: s.prefs.default_background }, contrast1: DEFAULT_COLORS[0], contrast2: DEFAULT_COLORS[1] });
  },
  savePresets: (list) => { save("gg.presets", list); set({ presets: list }); },
  saveUserPalettes: (list) => { const ok = save("gg.palettes", list); if (ok) set({ palettes: list }); return ok; },
  askYesNo: (title, text) => new Promise<boolean>((resolve) => set({ msg: { title, text, kind: "yesno", resolve } })),
  showMsg: (title, text, kind = "info") => new Promise<void>((resolve) => set({ msg: { title, text, kind, resolve: () => resolve() } })),
}));
