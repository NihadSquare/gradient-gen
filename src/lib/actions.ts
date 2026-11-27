// Gradient Gen - Copyright (c) 2026 AK Nihad (Nihad Square). All rights reserved.
// Source-available, not open source: see LICENSE. Copying or reuse is not permitted without written permission.
// What the buttons do. Messages and checks follow the desktop program.
import { gradientCode, paletteText, type PaletteTextKind } from "../engine/code";
import { LARGE_PIXELS, MAX_DIM } from "../engine/types";
import { lookOf, toSettings, useStore } from "../store/useStore";
import { compose } from "./compose";
import { EXT, canvasToBlob, copyImage, copyText, downloadBlob, zipStore } from "./files";
import { logoState } from "./logo";
import { drawPaletteCanvas } from "./palettePicture";
import { exportSlot } from "./renderClient";

const st = () => useStore.getState();
const PROGRESS_PIXELS = 4_000_000;
export const currentSettings = () => toSettings(lookOf(st()));

/** Validated (width, height), or null after telling the user why */
export async function getExportSize(): Promise<[number, number] | null> {
  const s = st(); const w = parseInt(s.width, 10), h = parseInt(s.height, 10);
  if (!Number.isFinite(w) || !Number.isFinite(h)) { await s.showMsg("Error", "Please enter a valid width and height.", "error"); return null; }
  if (w < 1 || h < 1) { await s.showMsg("Error", "Width and height must be at least 1 px.", "error"); return null; }
  if (w > MAX_DIM || h > MAX_DIM) { await s.showMsg("Size too large", `The maximum size is ${MAX_DIM} x ${MAX_DIM} px.\nYou entered ${w} x ${h}.`, "warn"); return null; }
  if (w * h > LARGE_PIXELS && !(await s.askYesNo("Large image", `${w} x ${h} px (${((w * h) / 1e6).toFixed(0)} MP) can take a while and use several GB of RAM.\n\nContinue?`))) return null;
  return [w, h];
}

async function renderCanvas(w: number, h: number, report?: (f: number, label: string) => void): Promise<HTMLCanvasElement> {
  const px = await exportSlot.render(currentSettings(), w, h, report);
  return compose(px, st().overlay, logoState.image);
}
const friendly = (e: unknown) => (e instanceof Error ? e.message : String(e));
const isCancel = (e: unknown) => friendly(e) === "cancelled";
const isMemory = (e: unknown) => /memory|allocation|array buffer/i.test(friendly(e));

function openProgress(title: string, text: string) { st().set({ progress: { title, text, frac: 0, cancel: false } }); }
function closeProgress() { st().set({ progress: null }); }

export async function saveImage() {
  const s = st();
  if (s.batchRunning) return;
  if (s.mode === "Batch") { s.say("Switch to Single mode to save one image", 3000); return; }
  try {
    if (s.showPalette) {
      const c = drawPaletteCanvas(1200, 500);
      const blob = await canvasToBlob(c, "PNG", 95);
      downloadBlob(blob, "Palette.png");
      s.say("Palette saved to Palette.png", 5000); return;
    }
    const size = await getExportSize(); if (!size) return;
    const [w, h] = size;
    const fmt = s.prefs.default_format;
    const safe = s.gradientType.replace(/[^A-Za-z0-9_-]+/g, "");
    s.say(`Rendering ${w} x ${h} ...`);
    const big = w * h >= PROGRESS_PIXELS;
    if (big) openProgress("Saving image", `${w} x ${h} px`);
    try {
      const canvas = await renderCanvas(w, h, (f, label) => { if (big) st().set({ progress: { title: "Saving image", text: label || `${w} x ${h} px`, frac: f * 0.97, cancel: false } }); });
      if (big) st().set({ progress: { title: "Saving image", text: "Writing the file", frac: 0.97, cancel: false } });
      const blob = await canvasToBlob(canvas, fmt, s.quality);
      canvas.width = canvas.height = 0;
      const name = `Gradient_${safe}_${w}x${h}.${EXT[fmt]}`;
      downloadBlob(blob, name);
      st().set({ dirty: false });
      st().say(`Image saved to ${name}`, 6000);
    } finally { closeProgress(); }
  } catch (e) {
    if (isCancel(e)) st().say("Save canceled", 3000);
    else if (isMemory(e)) { st().say("Error", 3000); await st().showMsg("Out of memory", "This size needs more memory than is available. Try a smaller size.", "error"); }
    else { st().say("Error", 3000); await st().showMsg("Error", `Failed to save image: ${friendly(e)}`, "error"); }
  }
}

export function cancelExport() { exportSlot.cancel(); }

export async function copyImageAction() {
  const s = st();
  if (s.batchRunning) return;
  try {
    const w0 = parseInt(s.width, 10) || 1920, h0 = parseInt(s.height, 10) || 1080;
    const w = Math.min(w0, 2560), h = Math.max(1, Math.round((h0 * w) / w0));
    s.say(`Rendering ${w} x ${h} ...`);
    const canvas = s.showPalette ? drawPaletteCanvas(Math.min(w0, 1200), Math.round((Math.min(w0, 1200) * 5) / 12)) : await renderCanvas(w, h);
    await copyImage(canvas);
    st().say("Picture copied to the clipboard" + (w < w0 && !s.showPalette ? ` (reduced to ${w} x ${h} px)` : ""), 5000);
  } catch (e) {
    if (isCancel(e)) st().say("Copy canceled", 3000);
    else { st().say("Error", 3000); await st().showMsg("Copy", `Could not copy the picture: ${friendly(e)}`, "error"); }
  }
}

export async function copyCode(kind: "css" | "svg") {
  const s = st();
  try {
    const { text, note } = gradientCode(currentSettings(), parseInt(s.width, 10) || 1920, parseInt(s.height, 10) || 1080, kind, s.overlay.background);
    await copyText(text);
    const msg = `Copied as ${kind.toUpperCase()}` + (note ? `  (${note})` : "");
    s.say(msg, 5000);
  } catch (e) { await s.showMsg("Copy", friendly(e), "error"); }
}

export async function copyPalette(kind: PaletteTextKind): Promise<boolean> {
  try { await copyText(paletteText(currentSettings(), kind)); return true; } catch { return false; }
}

/** Largest batch that fits in browser memory (every file is kept until the ZIP is built). */
export function maxBatch(w: number, h: number): number { return Math.max(2, Math.min(100, Math.floor(1.2e9 / (Math.max(1, w * h) * 1.5)))); }

export async function runBatchGeneration() {
  const s = st();
  if (s.batchRunning) return;
  const n = parseInt(s.batchSize, 10);
  if (!(n >= 2 && n <= 100)) { await s.showMsg("Error", "Please enter a valid batch size (2–100).", "error"); s.say("Error"); window.setTimeout(() => st().say("Ready"), 3000); return; }
  const size = await getExportSize(); if (!size) return;
  const [w, h] = size;
  if (n > maxBatch(w, h)) { await s.showMsg("Batch too large", `At ${w} x ${h} px up to ${maxBatch(w, h)} images fit in the browser's memory. Lower the batch size or the picture size.`, "warn"); return; }
  if (s.locks.colors && !(await s.askYesNo("Colors are locked", "'🔒 Colors' is ON, so every image will use the same colors.\n\nContinue anyway?"))) return;
  st().set({ batchRunning: true }); st().say(`Preparing to generate ${n} images...`);
  const files: { name: string; data: Uint8Array }[] = []; const errors: string[] = []; let ok = 0; let cancelled = false;
  (window as unknown as { __ggCancel?: () => void }).__ggCancel = () => { cancelled = true; exportSlot.cancel(); };
  st().set({ progress: null });
  const ext = EXT[st().format];
  for (let i = 0; i < n && !cancelled; i++) {
    st().say(`Generating image ${i + 1} of ${n}`); st().set({ batchProgress: i / n } as never);
    try {
      st().randomize(true);
      const canvas = await renderCanvas(w, h, (f) => st().set({ batchProgress: (i + f) / n } as never));
      const blob = await canvasToBlob(canvas, st().format, st().quality); canvas.width = canvas.height = 0;
      files.push({ name: `Gradient_${String(files.length + 1).padStart(3, "0")}.${ext}`, data: new Uint8Array(await blob.arrayBuffer()) }); ok++;
    } catch (e) { if (cancelled) break; errors.push(`Image ${i + 1}: ${friendly(e)}`); }
  }
  if (errors.length) files.push({ name: "batch_errors.log", data: new TextEncoder().encode(`Batch Generation Errors (${new Date().toLocaleString()}):\n${errors.join("\n")}\n`) });
  if (ok > 0) downloadBlob(zipStore(files), `Gradient_batch_${ok}.zip`);
  st().set({ batchRunning: false, batchProgress: null } as never);
  st().say(cancelled ? "Batch generation canceled" : `Completed ${ok}/${n} images, ${errors.length} failed`, 3000);
}
export function cancelBatch() { (window as unknown as { __ggCancel?: () => void }).__ggCancel?.(); }
