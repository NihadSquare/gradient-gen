// Golden pictures made by the real desktop engine (BG_Gen v3.99, Python / NumPy / Pillow) at 64 x 36 px.
// The web engine must give the same pixels, so the same seed makes the same picture in both apps.
import { describe, expect, it } from "vitest";
import { renderGradient } from "../src/engine/render";
import { defaultSettings, type EffectName, type GradientSettings, type GradientType } from "../src/engine/types";
import gold from "./desktop.fixtures.json";

type Case = { type: string; dir: number; seed: number; pos: string; eff: string; inten: number; rgb: string };

describe("web engine equals the desktop engine", () => {
  for (const c of gold.cases as Case[]) {
    const name = c.eff === "None" ? c.type : `${c.type} + ${c.eff}`;
    it(name, () => {
      const s: GradientSettings = {
        ...defaultSettings(),
        stops: gold.colors.map((color: string, i: number) => ({ color, pos: gold.positions[i], opacity: 1, trans: "Smooth" as const })),
        type: c.type as GradientType, direction: c.dir, position: c.pos as GradientSettings["position"], seed: c.seed,
        effect: c.eff as EffectName, intensity: c.inten, effect2: "None", reverse: false,
      };
      const px = renderGradient(s, gold.W, gold.H);
      const want = Uint8Array.from(atob(c.rgb), (ch) => ch.charCodeAt(0));
      let sum = 0, max = 0;
      for (let i = 0, k = 0; i < px.data.length; i += 4, k += 3) for (let ch = 0; ch < 3; ch++) {
        const d = Math.abs(px.data[i + ch] - want[k + ch]);
        sum += d;
        if (d > max) max = d;
      }
      const mean = sum / (gold.W * gold.H * 3);
      expect(mean).toBeLessThan(0.25);
      expect(max).toBeLessThanOrEqual(6);
    });
  }
});
