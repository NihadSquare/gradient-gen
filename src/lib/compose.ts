// Background, logo and text on top of the rendered gradient. Runs on the main thread (needs canvas text).
import type { Pixels } from "../engine/render";
import type { OverlayPosition, OverlaySettings } from "../engine/types";

const FONT = '"Hanken Grotesk Variable", "Hanken Grotesk", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

function xy(W: number, H: number, w: number, h: number, pos: OverlayPosition, m: number): [number, number] {
  const x = pos.includes("left") ? m : pos.includes("right") ? W - w - m : Math.floor((W - w) / 2);
  const y = pos.startsWith("Top") ? m : pos.startsWith("Bottom") ? H - h - m : Math.floor((H - h) / 2);
  return [Math.floor(x), Math.floor(y)];
}

export function pixelsToCanvas(px: Pixels): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = px.width;
  c.height = px.height;
  const ctx = c.getContext("2d")!;
  ctx.putImageData(new ImageData(px.data as Uint8ClampedArray<ArrayBuffer>, px.width, px.height), 0, 0);
  return c;
}

export function compose(px: Pixels, ov: OverlaySettings, logo: HTMLImageElement | null): HTMLCanvasElement {
  const src = pixelsToCanvas(px);
  const txt = ov.textOn ? ov.text.trim() : "";
  const solid = ov.background === "White" ? "#FFFFFF" : ov.background === "Black" ? "#000000" : null;
  if (!txt && !logo && !solid) return src;

  const W = px.width, H = px.height;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  if (solid) {
    ctx.fillStyle = solid;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.drawImage(src, 0, 0);
  src.width = src.height = 0; // free the temporary canvas

  const margin = Math.round(W * 0.035);
  const op = Math.min(1, Math.max(0.05, ov.opacity / 100));

  if (logo && logo.naturalWidth) {
    const lw = Math.max(4, Math.round((W * ov.logoSize) / 100));
    const lh = Math.max(1, Math.round((logo.naturalHeight * lw) / logo.naturalWidth));
    const [x, y] = xy(W, H, lw, lh, ov.logoPos, margin);
    ctx.save();
    ctx.globalAlpha = op;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(logo, x, y, lw, lh);
    ctx.restore();
  }

  if (txt) {
    const size = Math.max(8, Math.round((W * ov.textSize) / 100));
    ctx.font = `700 ${size}px ${FONT}`;
    ctx.textBaseline = "top";
    ctx.textAlign = "center";
    const lines = txt.split(/\r?\n/);
    const lineH = Math.round(size * 1.2);
    const tw = Math.ceil(Math.max(...lines.map((l) => ctx.measureText(l).width)));
    const th = lineH * lines.length;
    const [x, y] = xy(W, H, tw, th, ov.textPos, margin);
    let col: string;
    if (ov.textColor === "White") col = "255,255,255";
    else if (ov.textColor === "Black") col = "20,20,26";
    else {
      // Auto: dark text on light areas, white on dark areas
      const bx = Math.max(0, x), by = Math.max(0, y), bw = Math.min(W - bx, tw), bh = Math.min(H - by, th);
      let lum = 0;
      if (bw > 0 && bh > 0) {
        const d = ctx.getImageData(bx, by, Math.min(bw, 96), Math.min(bh, 96)).data;
        let r = 0, g = 0, b = 0;
        const n = d.length / 4;
        for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
        lum = (r * 0.299 + g * 0.587 + b * 0.114) / n;
      }
      col = lum > 150 ? "20,20,26" : "255,255,255";
    }
    ctx.fillStyle = `rgba(${col},${op})`;
    lines.forEach((l, i) => ctx.fillText(l, x + tw / 2, y + i * lineH));
  }
  return canvas;
}
