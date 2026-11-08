// Things the buttons do: save, copy, batch. They read the store and report through toasts / the busy bar.
import { Rng } from "../engine/rng";
import { randomize } from "../engine/random";
import { gradientCode, paletteText, type PaletteTextKind } from "../engine/code";
import { LARGE_PIXELS, type GradientSettings } from "../engine/types";
import { useStore } from "../store/useStore";
import { compose } from "./compose";
import { EXT, canvasToBlob, copyImage, copyText, downloadBlob, zipStore } from "./files";
import { logoState } from "./logo";
import { exportSlot } from "./renderClient";

const st = () => useStore.getState();

async function renderFinal(settings: GradientSettings, w: number, h: number, label: string): Promise<HTMLCanvasElement> {
  const { overlay } = st();
  const px = await exportSlot.render(settings, w, h, (f, l) => st().set({ busy: { label: `${label}${l ? " · " + l : ""}`, progress: f, cancel: () => exportSlot.cancel() } }));
  return compose(px, overlay, logoState.image);
}

const friendly = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e);
  if (m === "cancelled") return "Cancelled";
  if (/memory|allocation|array buffer/i.test(m)) return "Not enough memory for this size. Try a smaller size.";
  return m;
};

export function checkSize(): boolean {
  const { width, height, prefs } = st();
  if (width * height > LARGE_PIXELS * 0.7 && prefs.confirmLarge) {
    return window.confirm(`${width} × ${height} px (${((width * height) / 1e6).toFixed(0)} MP) can take a few seconds and use about ${Math.round((width * height * 28) / 1e6)} MB of memory.\n\nContinue?`);
  }
  return true;
}

export async function saveImage() {
  const s = st();
  if (s.busy) return;
  if (!checkSize()) return;
  try {
    const canvas = await renderFinal(s.settings, s.width, s.height, "Rendering");
    const blob = await canvasToBlob(canvas, s.format, s.quality);
    canvas.width = canvas.height = 0;
    downloadBlob(blob, `Gradient_${s.settings.type.replace(/\s+/g, "-")}_${s.width}x${s.height}.${EXT[s.format]}`);
    st().notify(`Saved ${(blob.size / 1024 / 1024).toFixed(1)} MB ${s.format}`);
  } catch (e) {
    const m = friendly(e);
    st().notify(m, m === "Cancelled" ? "warn" : "bad");
  } finally {
    st().set({ busy: null });
  }
}

export async function copyImageAction() {
  const s = st();
  if (s.busy) return;
  const w = Math.min(s.width, 2560), h = Math.max(1, Math.round((s.height * w) / s.width));
  try {
    const canvas = await renderFinal(s.settings, w, h, "Rendering");
    await copyImage(canvas);
    st().notify(w < s.width ? `Copied the picture (reduced to ${w} × ${h} px)` : "Copied the picture");
  } catch (e) {
    const m = friendly(e);
    st().notify(m, m === "Cancelled" ? "warn" : "bad");
  } finally {
    st().set({ busy: null });
  }
}

export async function copyCode(kind: "css" | "svg") {
  const s = st();
  try {
    const { text, note } = gradientCode(s.settings, s.width, s.height, kind, s.overlay.background);
    await copyText(text);
    st().notify(`Copied as ${kind.toUpperCase()}${note ? ` (${note})` : ""}`, note.includes("no ") ? "warn" : "ok");
  } catch (e) {
    st().notify(friendly(e), "bad");
  }
}

export async function copyPalette(kind: PaletteTextKind) {
  try {
    await copyText(paletteText(st().settings, kind));
    st().notify("Palette copied");
  } catch (e) {
    st().notify(friendly(e), "bad");
  }
}

/** Largest batch that fits in browser memory (all files are kept until the ZIP is built). */
export function maxBatch(w: number, h: number): number {
  return Math.max(2, Math.min(100, Math.floor(1.2e9 / (w * h * 1.5))));
}

export async function runBatch() {
  const s = st();
  if (s.busy) return;
  const count = Math.round(s.batchSize);
  const cap = maxBatch(s.width, s.height);
  if (!(count >= 2 && count <= 100)) return st().notify("Batch size must be between 2 and 100", "bad");
  if (count > cap) return st().notify(`At ${s.width} × ${s.height} px up to ${cap} images fit in browser memory`, "warn");
  if (s.locks.colors && !window.confirm("“Colors” is locked, so every image will use the same colors.\n\nContinue anyway?")) return;
  const files: { name: string; data: Uint8Array }[] = [];
  const errors: string[] = [];
  const rng = new Rng(Math.floor(Math.random() * 2 ** 31));
  let cancelled = false;
  const cancel = () => { cancelled = true; exportSlot.cancel(); };
  try {
    for (let i = 0; i < count && !cancelled; i++) {
      const base = (i / count);
      st().set({ busy: { label: `Generating image ${i + 1} of ${count}`, progress: base, cancel } });
      try {
        const next = randomize(s.settings, s.locks, true, rng);
        const px = await exportSlot.render(next, s.width, s.height, (f) => st().set({ busy: { label: `Generating image ${i + 1} of ${count}`, progress: base + f / count, cancel } }));
        const canvas = compose(px, st().overlay, logoState.image);
        const blob = await canvasToBlob(canvas, s.format, s.quality);
        canvas.width = canvas.height = 0;
        files.push({ name: `Gradient_${String(i + 1).padStart(3, "0")}.${EXT[s.format]}`, data: new Uint8Array(await blob.arrayBuffer()) });
      } catch (e) {
        if (cancelled) break;
        errors.push(`Image ${i + 1}: ${friendly(e)}`);
      }
    }
    if (errors.length) files.push({ name: "batch_errors.log", data: new TextEncoder().encode(`Batch errors (${new Date().toISOString()}):\n${errors.join("\n")}\n`) });
    if (files.length && !(cancelled && !files.some((f) => !f.name.endsWith(".log")))) {
      downloadBlob(zipStore(files), `Gradient_batch_${count}.zip`);
      st().notify(`Saved ${files.length - (errors.length ? 1 : 0)} of ${count} images as a ZIP${cancelled ? " (stopped early)" : ""}`, errors.length ? "warn" : "ok");
    } else st().notify("Batch cancelled", "warn");
  } finally {
    st().set({ busy: null });
  }
}
