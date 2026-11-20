import type { BlendMode, Transition } from "./color";

export const MAX_COLORS = 12;
export const MIN_COLORS = 2;
/** Largest width or height the web version exports (browser memory limit). */
export const MAX_DIM = 4096;
export const LARGE_PIXELS = 16_800_000;

export const GRADIENT_TYPES = [
  "Linear", "Radial", "Conical", "Diamond", "Spiral", "Swirl", "Plasma", "Voronoi", "Cylindrical",
  "Pixelated", "Abstract", "Parametric", "Perlin", "Wave", "Starburst", "Kaleidoscope", "Tiled",
  "Hexagonal", "Bilinear", "Fractal", "Mesh", "Aurora", "Marble", "Contour", "Halftone", "Dither",
  "Silk", "Stained glass",
] as const;
export type GradientType = (typeof GRADIENT_TYPES)[number];

export const EFFECTS = [
  "None", "Noise", "Grain", "Blur", "Glow", "Wave", "Ripples", "Liquidify", "Posterize",
  "Vignette", "Edge_detect", "Color_invers", "Sepia", "Solarize", "Distort", "Bloom", "Mosaic",
  "Emboss", "Sharpen", "Chromatic", "Pixel_sort", "Frosted", "Glitch", "Gradient_map", "Light_leak",
  "Anti_band",
] as const;
export type EffectName = (typeof EFFECTS)[number];

export const POSITIONS = [
  "Center", "Top-left", "Top-right", "Bottom-left", "Bottom-right", "Top-center", "Bottom-center",
  "Left-center", "Right-center", "Custom",
] as const;
export type CenterPosition = (typeof POSITIONS)[number];

export { OV_POSITIONS, SIZE_PRESETS, BUILTIN_PALETTES } from "../data/desktop";
import { OV_POSITIONS } from "../data/desktop";
export type OverlayPosition = (typeof OV_POSITIONS)[number];

export interface Stop {
  color: string; // #RRGGBB
  pos: number; // 0..1
  opacity: number; // 0..1
  trans: Transition; // how this stop moves on to the next one
}

/** Everything the renderer reads. Plain data, so it can be sent to a worker and saved as a preset. */
export interface GradientSettings {
  stops: Stop[];
  reverse: boolean;
  blend: BlendMode;
  type: GradientType;
  direction: number; // degrees 0..360
  position: CenterPosition;
  customX: number; // percent
  customY: number;
  effect: EffectName;
  effect2: EffectName;
  intensity: number; // 0..0.5
  intensity2: number;
  seed: number;
}

export type Background = "Transparent" | "White" | "Black";
export type TextColor = "Auto" | "White" | "Black";

export interface OverlaySettings {
  textOn: boolean;
  text: string;
  textPos: OverlayPosition;
  textSize: number; // % of width
  textColor: TextColor;
  logoPos: OverlayPosition;
  logoSize: number; // % of width
  opacity: number; // 10..100
  background: Background;
}

export type ExportFormat = "PNG" | "JPEG" | "WebP";

export const DEFAULT_STOPS: Stop[] = [
  { color: "#5240FF", pos: 0, opacity: 1, trans: "Smooth" },
  { color: "#130935", pos: 1, opacity: 1, trans: "Smooth" },
];

export const defaultSettings = (): GradientSettings => ({
  stops: DEFAULT_STOPS.map((s) => ({ ...s })),
  reverse: false,
  blend: "RGB",
  type: "Linear",
  direction: 0,
  position: "Center",
  customX: 50,
  customY: 50,
  effect: "None",
  effect2: "None",
  intensity: 0.1,
  intensity2: 0.1,
  seed: Math.floor(Math.random() * 2 ** 31),
});

export const defaultOverlay = (): OverlaySettings => ({
  textOn: false,
  text: "Your text",
  textPos: "Bottom-right",
  textSize: 5,
  textColor: "Auto",
  logoPos: "Top-left",
  logoSize: 18,
  opacity: 90,
  background: "Transparent",
});


