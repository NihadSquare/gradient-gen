// "Show Palette": the colors as swatches with their codes (the desktop's generate_palette)
import { hexToRgb } from "../engine/color";
import { useStore } from "../store/useStore";

export function drawPaletteCanvas(width: number, height: number): HTMLCanvasElement {
  const s = useStore.getState();
  let colors = s.colors.slice(0, s.num).map((c) => c.toUpperCase());
  let ops = s.opacities.slice(0, s.num);
  if (s.reverse) { colors = colors.reverse(); ops = ops.reverse(); }
  const c = document.createElement("canvas"); c.width = width; c.height = height;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff"; g.fillRect(0, 0, width, height);
  const num = colors.length, colsN = num <= 6 ? num : Math.ceil(num / 2), rowsN = Math.ceil(num / colsN);
  const gap = Math.max(4, Math.floor(width / (colsN * 10))), sw = Math.max(8, Math.floor((width - gap * (colsN + 1)) / colsN));
  const top = Math.max(6, Math.floor(height / 25)), rowh = rowsN === 1 ? height : Math.floor((height - top) / rowsN), sh = Math.floor(rowh * 0.6);
  const fs = Math.max(8, Math.min(Math.floor(sw / 8.5), Math.floor(rowh / 14)));
  colors.forEach((col, i) => {
    const x0 = gap + (i % colsN) * (sw + gap), y0 = top + Math.floor(i / colsN) * rowh;
    g.fillStyle = col; g.fillRect(x0, y0, sw, sh);
    const ty = y0 + sh + Math.max(4, Math.floor(fs / 2)), [r, gg, b] = hexToRgb(col);
    g.textBaseline = "top"; g.font = `${fs}px "Segoe UI", Inter, Arial, sans-serif`; g.fillStyle = "#000"; g.fillText(col, x0, ty);
    const small = Math.max(7, Math.floor(fs * 0.85)); g.font = `${small}px "Segoe UI", Inter, Arial, sans-serif`; g.fillStyle = "#282828";
    g.fillText(`RGB ${r},${gg},${b}`, x0, ty + Math.floor(fs * 1.5)); g.fillText(`Opacity ${Math.round(ops[i] * 100)}%`, x0, ty + Math.floor(fs * 2.7));
  });
  return c;
}
