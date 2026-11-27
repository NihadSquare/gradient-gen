// Gradient Gen - Copyright (c) 2026 AK Nihad (Nihad Square). All rights reserved.
// Source-available, not open source: see LICENSE. Copying or reuse is not permitted without written permission.
import { hexToRgb } from "../engine/color";
/** #14141A on light colors, white on dark ones (the desktop's _contrast_text) */
export function contrastTextOn(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  return r * 0.299 + g * 0.587 + b * 0.114 > 150 ? "#14141A" : "#FFFFFF";
}
export const blend = (c1: string, c2: string, f: number) => {
  const a = hexToRgb(c1), b = hexToRgb(c2);
  return "#" + [0, 1, 2].map((i) => Math.round(a[i] * f + b[i] * (1 - f)).toString(16).padStart(2, "0")).join("");
};

export function hexToHsv(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h /= 6; if (h < 0) h += 1; }
  return [h, mx === 0 ? 0 : d / mx, mx];
}
export function hsvToHex(h: number, s: number, v: number): string {
  const f = (n: number) => { const k = (n + h * 6) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return "#" + [f(5), f(3), f(1)].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
}
