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

export const OV_POSITIONS = [
  "Top-left", "Top-center", "Top-right", "Center", "Bottom-left", "Bottom-center", "Bottom-right",
] as const;
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

export const SIZE_PRESETS: { label: string; w: number | null; h: number | null }[] = [
  { label: "Custom size", w: null, h: null },
  { label: "Full HD  1920 × 1080", w: 1920, h: 1080 },
  { label: "2K  2560 × 1440", w: 2560, h: 1440 },
  { label: "4K UHD  3840 × 2160", w: 3840, h: 2160 },
  { label: "Ultrawide  3440 × 1440", w: 3440, h: 1440 },
  { label: "Phone wallpaper  1080 × 1920", w: 1080, h: 1920 },
  { label: "Phone tall  1170 × 2532", w: 1170, h: 2532 },
  { label: "Tablet  2048 × 2732", w: 2048, h: 2732 },
  { label: "Instagram post  1080 × 1080", w: 1080, h: 1080 },
  { label: "Instagram story  1080 × 1920", w: 1080, h: 1920 },
  { label: "YouTube banner  2560 × 1440", w: 2560, h: 1440 },
  { label: "Facebook cover  820 × 312", w: 820, h: 312 },
  { label: "X / Twitter header  1500 × 500", w: 1500, h: 500 },
  { label: "LinkedIn banner  1584 × 396", w: 1584, h: 396 },
];

export const BUILTIN_PALETTES: { name: string; colors: string[] }[] = [
  { name: "Sunset Sky", colors: ["#2B1055", "#7597DE", "#F9748F", "#FEB47B"] },
  { name: "Ocean Depths", colors: ["#001F3F", "#0074D9", "#39CCCC", "#B8F2E6"] },
  { name: "Forest Canopy", colors: ["#0B3D2E", "#2E7D32", "#8BC34A", "#E6EE9C"] },
  { name: "Candy Pop", colors: ["#FF6EC7", "#FFB3E6", "#B28DFF", "#6EC6FF"] },
  { name: "Midnight Velvet", colors: ["#0F0C29", "#302B63", "#24243E"] },
  { name: "Peach Blush", colors: ["#FF9A9E", "#FAD0C4", "#FFECD2"] },
  { name: "Neon Pulse", colors: ["#120078", "#9D0191", "#FD3A69", "#FECD1A"] },
  { name: "Mono Scale", colors: ["#0D0D0D", "#555555", "#BBBBBB", "#F5F5F5"] },
  { name: "Aurora Borealis", colors: ["#0B1026", "#1B4965", "#2EC4B6", "#9EF01A"] },
  { name: "Lavender Dream", colors: ["#E6E6FA", "#C9B6F2", "#A78BFA", "#6D5BD0"] },
  { name: "Retro Sunset", colors: ["#2D1E5F", "#B83B5E", "#F08A5D", "#F9ED69"] },
  { name: "Cyber City", colors: ["#0D0221", "#261447", "#F706CF", "#00F0FF"] },
  { name: "Autumn Leaves", colors: ["#3E2723", "#8D4B1F", "#D9822B", "#F2C14E"] },
  { name: "Mint Fresh", colors: ["#E0FBFC", "#B8F2E6", "#7ED6C1", "#3AAFA9"] },
  { name: "Berry Punch", colors: ["#2B0A3D", "#7B1E7A", "#D6336C", "#FF8FA3"] },
  { name: "Desert Dune", colors: ["#5E3023", "#C08552", "#DEB887", "#F3E9DC"] },
  { name: "Arctic Ice", colors: ["#03045E", "#0077B6", "#90E0EF", "#CAF0F8"] },
  { name: "Cotton Candy", colors: ["#FFC8DD", "#FFAFCC", "#BDE0FE", "#A2D2FF"] },
  { name: "Volcano Glow", colors: ["#1A0000", "#7A0C0C", "#E4572E", "#FFC857"] },
  { name: "Emerald Tide", colors: ["#022B3A", "#1F7A8C", "#52B788", "#D8F3DC"] },
  { name: "Golden Hour", colors: ["#3D2C8D", "#916BBF", "#F7A072", "#FFD166"] },
  { name: "Rose Gold", colors: ["#6D3B47", "#B76E79", "#E8B4B8", "#FCE4E4"] },
  { name: "Slate Stone", colors: ["#1F2933", "#3E4C59", "#7B8794", "#CBD2D9"] },
  { name: "Tropical Breeze", colors: ["#00A896", "#02C39A", "#F0F3BD", "#FF6F59"] },
  { name: "Twilight Dusk", colors: ["#10002B", "#3C096C", "#7B2CBF", "#C77DFF"] },
  { name: "Citrus Splash", colors: ["#FF9F1C", "#FFBF69", "#FFFFFF", "#2EC4B6"] },
  { name: "Lagoon Waters", colors: ["#012A4A", "#2A6F97", "#61A5C2", "#A9D6E5"] },
  { name: "Blush Garden", colors: ["#F8EDEB", "#F9DCC4", "#FEC89A", "#D8E2DC"] },
];
