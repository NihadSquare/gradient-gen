import { create } from "zustand";
import { Rng } from "../engine/rng";
import { lutAt, rgbToHex } from "../engine/color";
import { rampLut } from "../engine/render";
import { clampDim, sanitizeOverlay, sanitizeSettings } from "../engine/sanitize";
import { evenPositions, defaultLocks, randomize, resizeStops, type Locks } from "../engine/random";
import {
  MAX_COLORS, MAX_DIM, MIN_COLORS, SIZE_PRESETS, defaultOverlay, defaultSettings,
  type Background, type ExportFormat, type GradientSettings, type OverlaySettings, type Stop,
} from "../engine/types";
import { load, save } from "../lib/storage";

export interface Prefs {
  theme: string;
  accent: string;
  defaultFormat: ExportFormat;
  defaultBackground: Background;
  confirmLarge: boolean;
}
export interface PresetData { settings: GradientSettings; overlay: OverlaySettings; width: number; height: number; format: ExportFormat; quality: number }
export interface Preset { id: string; name: string; created: number; data: PresetData }
export interface SavedPalette { id: string; name: string; colors: string[] }
export type DialogName = "palette" | "contrast" | "presets" | "settings" | "about" | "shortcuts" | null;
export interface Toast { id: number; text: string; kind: "ok" | "warn" | "bad" }
export interface Busy { label: string; progress: number; cancel?: () => void }

export const ASPECTS = ["16:9", "4:3", "5:4", "1:1", "Custom"] as const;
export const GUIDES = ["Off", "Thirds", "Golden ratio", "Centre cross", "Safe area (90%)", "Crop 1:1", "Crop 4:5", "Crop 9:16", "Crop 16:9"] as const;

const DEFAULT_PREFS: Prefs = { theme: "midnight", accent: "", defaultFormat: "PNG", defaultBackground: "Transparent", confirmLarge: true };

interface Session { settings: unknown; overlay: unknown; width: number; height: number; format: ExportFormat; quality: number; locks: Locks; aspect: string; sizePreset: string }

export interface AppState {
  settings: GradientSettings;
  overlay: OverlaySettings;
  width: number;
  height: number;
  aspect: string;
  sizePreset: string;
  format: ExportFormat;
  quality: number;
  locks: Locks;
  selected: number;
  mode: "Single" | "Batch";
  batchSize: number;
  guides: string;
  zoom: number;
  prefs: Prefs;
  dialog: DialogName;
  fullscreen: boolean;
  toast: Toast | null;
  busy: Busy | null;
  logoStamp: number;
  presets: Preset[];
  palettes: SavedPalette[];
  hist: { list: string[]; idx: number };

  patch: (p: Partial<GradientSettings>) => void;
  patchOverlay: (p: Partial<OverlaySettings>) => void;
  setStop: (i: number, p: Partial<Stop>) => void;
  addStop: (pos: number) => number | null;
  removeStop: (i: number) => void;
  setCount: (n: number) => void;
  select: (i: number) => void;
  applyColors: (colors: string[]) => void;
  setWidth: (w: number) => void;
  setHeight: (h: number) => void;
  setAspect: (a: string) => void;
  setSizePreset: (label: string) => void;
  setLock: (k: keyof Locks, v: boolean) => void;
  set: (p: Partial<AppState>) => void;
  setPrefs: (p: Partial<Prefs>) => void;
  notify: (text: string, kind?: Toast["kind"]) => void;
  newSeed: () => void;
  autoGenerate: () => void;
  commitHistory: () => void;
  undo: () => void;
  redo: () => void;
  resetAll: () => void;
  savePreset: (name: string) => void;
  loadPreset: (id: string) => void;
  deletePreset: (id: string) => void;
  renamePreset: (id: string, name: string) => void;
  importPresets: (list: unknown) => number;
  savePalette: (name: string, colors: string[]) => void;
  deletePalette: (id: string) => void;
  bumpLogo: () => void;
}

const session = load<Partial<Session>>("gg.session", {});
const prefs0: Prefs = { ...DEFAULT_PREFS, ...load<Partial<Prefs>>("gg.prefs", {}) };
const snapshot = (s: AppState) => JSON.stringify({ s: s.settings, o: s.overlay, w: s.width, h: s.height });
let toastId = 1;
const uid = () => Math.random().toString(36).slice(2, 10);

function aspectOf(a: string): number | null {
  const m = a.match(/^(\d+):(\d+)$/);
  return m ? +m[1] / +m[2] : null;
}
function aspectFor(w: number, h: number): string {
  const r = w / h;
  for (const a of ASPECTS) {
    const v = aspectOf(a);
    if (v && Math.abs(v - r) < 0.004) return a;
  }
  return "Custom";
}

const initW = clampDim(session.width, 1920);
const initH = clampDim(session.height, 1080);

export const useStore = create<AppState>((set, get) => ({
  settings: session.settings ? sanitizeSettings(session.settings) : defaultSettings(),
  overlay: session.overlay ? sanitizeOverlay(session.overlay) : { ...defaultOverlay(), background: prefs0.defaultBackground },
  width: initW,
  height: initH,
  aspect: typeof session.aspect === "string" ? session.aspect : "16:9",
  sizePreset: typeof session.sizePreset === "string" ? session.sizePreset : "Custom size",
  format: session.format && ["PNG", "JPEG", "WebP"].includes(session.format) ? session.format : prefs0.defaultFormat,
  quality: typeof session.quality === "number" ? Math.min(100, Math.max(50, session.quality)) : 95,
  locks: { ...defaultLocks(), ...(session.locks ?? {}) },
  selected: 0,
  mode: "Single",
  batchSize: 10,
  guides: "Off",
  zoom: 1,
  prefs: prefs0,
  dialog: null,
  fullscreen: false,
  toast: null,
  busy: null,
  logoStamp: 0,
  presets: load<Preset[]>("gg.presets", []),
  palettes: load<SavedPalette[]>("gg.palettes", []),
  hist: { list: [], idx: -1 },

  set: (p) => set(p),
  patch: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
  patchOverlay: (p) => set((s) => ({ overlay: { ...s.overlay, ...p } })),
  setStop: (i, p) =>
    set((s) => ({ settings: { ...s.settings, stops: s.settings.stops.map((st, k) => (k === i ? { ...st, ...p } : st)) } })),
  select: (i) => set({ selected: i }),

  addStop: (pos) => {
    const s = get().settings;
    if (s.stops.length >= MAX_COLORS) {
      get().notify(`Up to ${MAX_COLORS} colors are possible`, "warn");
      return null;
    }
    const [r, g, b, a] = lutAt(rampLut({ ...s, reverse: false }), pos);
    const stop: Stop = { color: rgbToHex(r, g, b), pos, opacity: a / 255, trans: "Smooth" };
    set({ settings: { ...s, stops: [...s.stops, stop] }, selected: s.stops.length });
    return s.stops.length;
  },
  removeStop: (i) => {
    const s = get().settings;
    if (s.stops.length <= MIN_COLORS) {
      get().notify("At least 2 colors are needed", "warn");
      return;
    }
    set({ settings: { ...s, stops: s.stops.filter((_, k) => k !== i) }, selected: Math.min(get().selected, s.stops.length - 2) });
  },
  setCount: (n) => {
    const s = get().settings;
    const colorAt = (p: number) => {
      const [r, g, b] = lutAt(rampLut({ ...s, reverse: false }), p);
      return rgbToHex(r, g, b);
    };
    const stops = resizeStops(s.stops, n, colorAt);
    set({ settings: { ...s, stops }, selected: Math.min(get().selected, stops.length - 1) });
  },
  applyColors: (colors) => {
    const cols = colors.slice(0, MAX_COLORS);
    if (cols.length < MIN_COLORS) return;
    const pos = evenPositions(cols.length);
    const old = get().settings.stops;
    set((s) => ({
      settings: { ...s.settings, stops: cols.map((c, i) => ({ color: c.toUpperCase(), pos: pos[i], opacity: old[i]?.opacity ?? 1, trans: old[i]?.trans ?? "Smooth" })) },
      selected: 0,
    }));
  },

  setWidth: (w) => {
    const s = get();
    const W = clampDim(w, s.width);
    const a = aspectOf(s.aspect);
    set({ width: W, height: a ? clampDim(Math.round(W / a), s.height) : s.height, sizePreset: "Custom size" });
  },
  setHeight: (h) => {
    const s = get();
    const H = clampDim(h, s.height);
    const a = aspectOf(s.aspect);
    set({ height: H, width: a ? clampDim(Math.round(H * a), s.width) : s.width, sizePreset: "Custom size" });
  },
  setAspect: (aspect) => {
    const s = get();
    const a = aspectOf(aspect);
    set({ aspect, height: a ? clampDim(Math.round(s.width / a), s.height) : s.height, sizePreset: "Custom size" });
  },
  setSizePreset: (label) => {
    const p = SIZE_PRESETS.find((x) => x.label === label);
    if (!p || !p.w || !p.h) return set({ sizePreset: label });
    set({ sizePreset: label, width: Math.min(MAX_DIM, p.w), height: Math.min(MAX_DIM, p.h), aspect: aspectFor(p.w, p.h) });
  },
  setLock: (k, v) => set((s) => ({ locks: { ...s.locks, [k]: v } })),
  setPrefs: (p) => {
    const prefs = { ...get().prefs, ...p };
    save("gg.prefs", prefs);
    set({ prefs });
  },
  notify: (text, kind = "ok") => set({ toast: { id: toastId++, text, kind } }),
  newSeed: () => set((s) => ({ settings: { ...s.settings, seed: new Rng(Math.floor(Math.random() * 2 ** 31)).int(0, 2 ** 31 - 1) } })),

  autoGenerate: () => {
    get().commitHistory();
    const s = get();
    const next = randomize(s.settings, s.locks, false);
    set({ settings: next, selected: Math.min(s.selected, next.stops.length - 1) });
    get().commitHistory();
  },

  commitHistory: () => {
    const s = get();
    const sig = snapshot(s);
    const { list, idx } = s.hist;
    if (list[idx] === sig) return;
    const nl = [...list.slice(0, idx + 1), sig].slice(-80);
    set({ hist: { list: nl, idx: nl.length - 1 } });
  },
  undo: () => {
    get().commitHistory();
    const { list, idx } = get().hist;
    if (idx <= 0) return;
    const snap = JSON.parse(list[idx - 1]);
    set({ settings: sanitizeSettings(snap.s), overlay: sanitizeOverlay(snap.o), width: clampDim(snap.w, 1920), height: clampDim(snap.h, 1080), hist: { list, idx: idx - 1 } });
  },
  redo: () => {
    const { list, idx } = get().hist;
    if (idx >= list.length - 1) return;
    const snap = JSON.parse(list[idx + 1]);
    set({ settings: sanitizeSettings(snap.s), overlay: sanitizeOverlay(snap.o), width: clampDim(snap.w, 1920), height: clampDim(snap.h, 1080), hist: { list, idx: idx + 1 } });
  },
  resetAll: () => {
    get().commitHistory();
    set((s) => ({
      settings: defaultSettings(), overlay: { ...defaultOverlay(), background: s.prefs.defaultBackground },
      width: 1920, height: 1080, aspect: "16:9", sizePreset: "Custom size", selected: 0, locks: defaultLocks(), quality: 95, zoom: 1, guides: "Off",
    }));
    get().commitHistory();
  },

  savePreset: (name) => {
    const s = get();
    const data: PresetData = JSON.parse(JSON.stringify({ settings: s.settings, overlay: s.overlay, width: s.width, height: s.height, format: s.format, quality: s.quality }));
    const presets = [{ id: uid(), name: name.trim() || "Untitled", created: Date.now(), data }, ...s.presets];
    save("gg.presets", presets);
    set({ presets });
  },
  loadPreset: (id) => {
    const p = get().presets.find((x) => x.id === id);
    if (!p) return;
    get().commitHistory();
    const d = p.data;
    set({
      settings: sanitizeSettings(d.settings), overlay: sanitizeOverlay(d.overlay),
      width: clampDim(d.width, 1920), height: clampDim(d.height, 1080), aspect: aspectFor(clampDim(d.width, 1920), clampDim(d.height, 1080)),
      format: ["PNG", "JPEG", "WebP"].includes(d.format) ? d.format : "PNG", quality: Math.min(100, Math.max(50, d.quality || 95)), selected: 0,
    });
    get().commitHistory();
  },
  deletePreset: (id) => {
    const presets = get().presets.filter((p) => p.id !== id);
    save("gg.presets", presets);
    set({ presets });
  },
  renamePreset: (id, name) => {
    const presets = get().presets.map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p));
    save("gg.presets", presets);
    set({ presets });
  },
  importPresets: (list) => {
    const arr = Array.isArray(list) ? list : [];
    const add: Preset[] = [];
    for (const raw of arr) {
      if (!raw || typeof raw !== "object" || !("data" in raw)) continue;
      const r = raw as { name?: unknown; data: Partial<PresetData> };
      add.push({
        id: uid(), name: typeof r.name === "string" ? r.name.slice(0, 80) : "Imported", created: Date.now(),
        data: {
          settings: sanitizeSettings(r.data.settings), overlay: sanitizeOverlay(r.data.overlay),
          width: clampDim(r.data.width, 1920), height: clampDim(r.data.height, 1080),
          format: (["PNG", "JPEG", "WebP"] as const).find((f) => f === r.data.format) ?? "PNG", quality: Math.min(100, Math.max(50, Number(r.data.quality) || 95)),
        },
      });
    }
    if (add.length) {
      const presets = [...add, ...get().presets];
      save("gg.presets", presets);
      set({ presets });
    }
    return add.length;
  },
  savePalette: (name, colors) => {
    const palettes = [{ id: uid(), name: name.trim() || "My palette", colors: [...colors] }, ...get().palettes];
    save("gg.palettes", palettes);
    set({ palettes });
  },
  deletePalette: (id) => {
    const palettes = get().palettes.filter((p) => p.id !== id);
    save("gg.palettes", palettes);
    set({ palettes });
  },
  bumpLogo: () => set((s) => ({ logoStamp: s.logoStamp + 1 })),
}));

// remember the working state between visits (debounced)
let timer: ReturnType<typeof setTimeout> | undefined;
useStore.subscribe((s, prev) => {
  if (s.settings === prev.settings && s.overlay === prev.overlay && s.width === prev.width && s.height === prev.height && s.format === prev.format && s.quality === prev.quality && s.locks === prev.locks && s.aspect === prev.aspect && s.sizePreset === prev.sizePreset) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    const st = useStore.getState();
    save("gg.session", { settings: st.settings, overlay: st.overlay, width: st.width, height: st.height, format: st.format, quality: st.quality, locks: st.locks, aspect: st.aspect, sizePreset: st.sizePreset } satisfies Session);
  }, 400);
});
