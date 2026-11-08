// "Copy as" CSS / SVG / palette text. Linear, Radial and Conical (CSS only) are exact; the other
// types have no CSS or SVG form, so a linear version of the same colors is given.
import { hexToRgb, lutAt, rgbToHex } from "./color";
import { getCenter } from "./fields";
import { rampLut } from "./render";
import type { Background, GradientSettings } from "./types";

export type Pair = [number, string, number]; // position 0..1, '#HEX', opacity 0..1

const rgba = (c: string, o: number) => {
  if (o >= 0.995) return c;
  const [r, g, b] = hexToRgb(c);
  return `rgba(${r}, ${g}, ${b}, ${o.toFixed(2)})`;
};
const num = (v: number, d: number) => String(parseFloat(v.toFixed(d)));

/** stops exactly as rendered (Reverse applied), sorted by position */
export function palettePairs(s: GradientSettings): Pair[] {
  const pairs: Pair[] = s.stops.map((st) => [s.reverse ? 1 - st.pos : st.pos, st.color.toUpperCase(), Math.round(st.opacity * 255) / 255]);
  return pairs.sort((a, b) => a[0] - b[0]);
}

/** With the plain RGB blend and Smooth transitions these are the real stops; otherwise the ramp is sampled. */
export function codePairs(s: GradientSettings): Pair[] {
  if (s.blend === "RGB" && s.stops.every((st) => st.trans === "Smooth")) return palettePairs(s);
  const lut = rampLut(s);
  const xs = new Set<number>();
  for (let k = 0; k <= 32; k++) xs.add(Math.round((k / 32) * 1e4) / 1e4);
  for (const st of s.stops) {
    const p = s.reverse ? 1 - st.pos : st.pos;
    for (const d of [-0.0005, 0, 0.0005]) xs.add(Math.round(Math.min(Math.max(p + d, 0), 1) * 1e4) / 1e4);
  }
  return [...xs].sort((a, b) => a - b).map((x) => {
    const [r, g, b, a] = lutAt(lut, x);
    return [x, rgbToHex(r, g, b), a / 255] as Pair;
  });
}

export function gradientCode(s: GradientSettings, W: number, H: number, kind: "css" | "svg", bg: Background): { text: string; note: string } {
  W = Math.max(1, Math.floor(W));
  H = Math.max(1, Math.floor(H));
  const pairs = codePairs(s);
  const deg = s.direction;
  const exact = s.type === "Linear" || s.type === "Radial" || (s.type === "Conical" && kind === "css");
  const shape = exact ? s.type : "Linear";
  const solid = bg === "White" ? "#FFFFFF" : bg === "Black" ? "#000000" : null;
  // the app's linear gradient runs along (cos, sin) in picture-relative coordinates, so in pixels the
  // direction is (cos / W, sin / H); CSS then spans corner to corner exactly like the app does
  const vx = Math.cos((deg * Math.PI) / 180) / W, vy = Math.sin((deg * Math.PI) / 180) / H;
  const cssAngle = ((((Math.atan2(vx, -vy) * 180) / Math.PI) % 360) + 360) % 360;
  const [cx, cy] = getCenter(W, H, s.position, s.customX, s.customY);
  let text: string;
  if (kind === "css") {
    const stops = pairs.map(([p, c, o]) => `${rgba(c, o)} ${num(p * 100, 2)}%`).join(", ");
    let grad: string;
    if (shape === "Radial") grad = `radial-gradient(circle farthest-corner at ${((cx / W) * 100).toFixed(1)}% ${((cy / H) * 100).toFixed(1)}%, ${stops})`;
    else if (shape === "Conical") grad = `conic-gradient(from ${((((270 - deg) % 360) + 360) % 360).toFixed(1)}deg at ${((cx / W) * 100).toFixed(1)}% ${((cy / H) * 100).toFixed(1)}%, ${stops})`;
    else grad = `linear-gradient(${cssAngle.toFixed(1)}deg, ${stops})`;
    text = `background: ${grad}${solid ? ", " + solid : ""};`;
  } else {
    let head: string, tail: string;
    if (shape === "Radial") {
      const r = Math.sqrt(Math.max(cx, W - cx) ** 2 + Math.max(cy, H - cy) ** 2);
      head = `<radialGradient id="g" gradientUnits="userSpaceOnUse" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}">`;
      tail = "</radialGradient>";
    } else {
      const ux = Math.sin((cssAngle * Math.PI) / 180), uy = -Math.cos((cssAngle * Math.PI) / 180);
      const half = (W * Math.abs(ux) + H * Math.abs(uy)) / 2;
      head = `<linearGradient id="g" gradientUnits="userSpaceOnUse" x1="${(W / 2 - ux * half).toFixed(1)}" y1="${(H / 2 - uy * half).toFixed(1)}" x2="${(W / 2 + ux * half).toFixed(1)}" y2="${(H / 2 + uy * half).toFixed(1)}">`;
      tail = "</linearGradient>";
    }
    const stopLines = pairs.map(([p, c, o]) => `      <stop offset="${p.toFixed(4)}" stop-color="${c}"${o >= 0.995 ? "" : ` stop-opacity="${o.toFixed(2)}"`}/>\n`).join("");
    text =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">\n  <defs>\n    ${head}\n${stopLines}    ${tail}\n  </defs>\n` +
      (solid ? `  <rect width="${W}" height="${H}" fill="${solid}"/>\n` : "") +
      `  <rect width="${W}" height="${H}" fill="url(#g)"/>\n</svg>`;
  }
  let note = "";
  if (!exact) note = `${s.type} has no ${kind.toUpperCase()} form: copied a linear version of the same colors`;
  else if (s.effect !== "None" || s.effect2 !== "None") note = "effects and overlays are not part of the code";
  return { text, note };
}

export type PaletteTextKind = "hex" | "json" | "css_vars" | "css";
export function paletteText(s: GradientSettings, kind: PaletteTextKind): string {
  const pairs = palettePairs(s);
  if (kind === "hex") return pairs.map((p) => p[1]).join("\n");
  if (kind === "json")
    return JSON.stringify({ colors: pairs.map((p) => p[1]), positions: pairs.map((p) => Math.round(p[0] * 1000) / 1000), opacity: pairs.map((p) => Math.round(p[2] * 100) / 100) }, null, 2);
  if (kind === "css_vars") return ":root {\n" + pairs.map((p, i) => `  --gradient-${i + 1}: ${p[1]};\n`).join("") + "}";
  const stops = codePairs(s).map(([p, c, o]) => `${rgba(c, o)} ${num(p * 100, 1)}%`).join(", ");
  return `background: linear-gradient(${num((s.direction + 90) % 360, 4)}deg, ${stops});`;
}
