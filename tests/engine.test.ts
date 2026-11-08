import { describe, expect, it } from "vitest";
import { buildStopLut, contrastRatio, fixContrast, hexToRgb, normHex, rgbToHex } from "../src/engine/color";
import { renderGradient } from "../src/engine/render";
import { GRADIENT_TYPES, EFFECTS, defaultSettings, type GradientSettings } from "../src/engine/types";
import { harmonyPalette, parsePaletteText } from "../src/engine/palette";
import { gradientCode } from "../src/engine/code";
import { sanitizeSettings } from "../src/engine/sanitize";
import { defaultLocks, randomize } from "../src/engine/random";
import { crc32, zipStore } from "../src/lib/files";
import { Rng } from "../src/engine/rng";

const base = (): GradientSettings => ({ ...defaultSettings(), seed: 1234 });

describe("color", () => {
  it("parses and formats hex", () => {
    expect(hexToRgb("#5240FF")).toEqual([82, 64, 255]);
    expect(rgbToHex(82, 64, 255)).toBe("#5240FF");
    expect(normHex("abc")).toBe("#AABBCC");
    expect(normHex("nope")).toBeNull();
  });
  it("builds a ramp that hits the end colors", () => {
    const lut = buildStopLut([{ pos: 0, rgb: [255, 0, 0], alpha: 255 }, { pos: 1, rgb: [0, 0, 255], alpha: 255 }]);
    expect([...lut.slice(0, 4)]).toEqual([255, 0, 0, 255]);
    expect([...lut.slice(-4)]).toEqual([0, 0, 255, 255]);
  });
  it("computes WCAG contrast", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    const fixed = fixContrast("#777777", "#FFFFFF", 4.5)!;
    expect(contrastRatio(fixed, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });
});

describe("rendering", () => {
  it("renders every gradient type without NaN holes", () => {
    for (const type of GRADIENT_TYPES) {
      const px = renderGradient({ ...base(), type }, 96, 54);
      expect(px.data.length).toBe(96 * 54 * 4);
      expect(px.data.some((v) => v !== 0)).toBe(true);
    }
  });
  it("renders every effect", () => {
    for (const effect of EFFECTS) {
      const px = renderGradient({ ...base(), type: "Radial", effect, intensity: 0.3 }, 80, 45);
      expect(px.data.length).toBe(80 * 45 * 4);
    }
  });
  it("is deterministic for the same seed", () => {
    const s = { ...base(), type: "Marble" as const, effect: "Glitch" as const };
    expect(renderGradient(s, 64, 36).data).toEqual(renderGradient(s, 64, 36).data);
  });
  it("looks the same at any size (pattern scale follows width)", () => {
    const s = { ...base(), type: "Hexagonal" as const };
    const small = renderGradient(s, 225, 126), big = renderGradient(s, 450, 252);
    const mean = (d: Uint8ClampedArray) => d.reduce((a, v, i) => a + (i % 4 === 0 ? v : 0), 0) / (d.length / 4);
    expect(Math.abs(mean(small.data) - mean(big.data))).toBeLessThan(6);
  });
  it("starts and ends with the first and last color for Linear", () => {
    const px = renderGradient(base(), 100, 10);
    expect([...px.data.slice(0, 3)]).toEqual([82, 64, 255]);
    expect([...px.data.slice((100 * 10 - 1) * 4, (100 * 10 - 1) * 4 + 3)]).toEqual([19, 9, 53]);
  });
});

describe("palette", () => {
  it("makes the requested number of distinct colors", () => {
    for (const h of ["Complementary", "Triadic", "Analogous", "Monochromatic", "Hexadic"] as const) {
      const p = harmonyPalette("#5240FF", h, 5, "Neutral", new Rng(1));
      expect(p).toHaveLength(5);
      expect(new Set(p).size).toBe(5);
    }
  });
  it("reads hex lists, Coolors links and GIMP lines", () => {
    expect(parsePaletteText("#264653 2a9d8f #E9C")).toEqual(["#264653", "#2A9D8F", "#EE99CC"]);
    expect(parsePaletteText("coolors.co/264653-2a9d8f-e9c46a")).toHaveLength(3);
    expect(parsePaletteText("255 0 0 Red\n0 0 255 Blue")).toEqual(["#FF0000", "#0000FF"]);
  });
});

describe("code export", () => {
  it("writes CSS for a linear gradient", () => {
    const { text, note } = gradientCode(base(), 1920, 1080, "css", "Transparent");
    expect(text).toMatch(/^background: linear-gradient\(/);
    expect(text).toContain("#5240FF 0%");
    expect(note).toBe("");
  });
  it("explains when a type has no CSS form", () => {
    const { note } = gradientCode({ ...base(), type: "Plasma" }, 800, 600, "svg", "White");
    expect(note).toContain("no SVG form");
  });
});

describe("settings", () => {
  it("repairs broken data", () => {
    const s = sanitizeSettings({ stops: [{ color: "red" }], type: "Nope", direction: 9999, intensity: "x" });
    expect(s.stops.length).toBeGreaterThanOrEqual(2);
    expect(s.type).toBe("Linear");
    expect(s.direction).toBe(360);
  });
  it("auto generate respects locks", () => {
    const s = base();
    const out = randomize(s, { ...defaultLocks(), type: true, seed: true }, false, new Rng(5));
    expect(out.type).toBe(s.type);
    expect(out.seed).toBe(s.seed);
    expect(out.stops.map((x) => x.color)).toEqual(s.stops.map((x) => x.color)); // colors locked by default
  });
});

describe("zip", () => {
  it("has the right CRC and a readable archive", async () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    const blob = zipStore([{ name: "a.txt", data: new TextEncoder().encode("hello") }]);
    const buf = new Uint8Array(await blob.arrayBuffer());
    expect(String.fromCharCode(...buf.slice(0, 2))).toBe("PK");
    expect(blob.size).toBe(30 + 5 + 5 + 46 + 5 + 22);
  });
});
