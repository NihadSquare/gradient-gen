import { BASE } from "../config";
import { runBatch, saveImage } from "../lib/actions";
import { useStore } from "../store/useStore";
import { Icon } from "./ui";

export function Header() {
  const { mode, hist, busy, undo, redo, autoGenerate, set, batchSize } = useStore();
  const canUndo = hist.idx > 0, canRedo = hist.idx < hist.list.length - 1;
  const gen = () => (mode === "Batch" ? runBatch() : autoGenerate());
  return (
    <header className="flex h-14 shrink-0 items-center gap-1 border-b border-line/70 bg-surface px-3 sm:px-4">
      <img src={`${BASE}assets/GG.png`} alt="Gradient Gen" className="mr-1 h-6 sm:mr-2 sm:h-8" />
      <button className="icon-btn" disabled={!canUndo} onClick={undo} aria-label="Undo (Ctrl+Z)" title="Undo (Ctrl+Z)"><Icon name="undo" /></button>
      <button className="icon-btn" disabled={!canRedo} onClick={redo} aria-label="Redo (Ctrl+Y)" title="Redo (Ctrl+Y)"><Icon name="redo" /></button>
      <span className="flex-1" />
      <button className="icon-btn hidden sm:inline-flex" onClick={() => set({ dialog: "palette" })} aria-label="Palettes" title="Palettes"><Icon name="palette" /></button>
      <button className="icon-btn hidden sm:inline-flex" onClick={() => set({ dialog: "contrast" })} aria-label="Color contrast" title="Color contrast"><Icon name="contrast" /></button>
      <button className="icon-btn hidden sm:inline-flex" onClick={() => set({ dialog: "presets" })} aria-label="Presets" title="Presets"><Icon name="save" /></button>
      <button className="icon-btn hidden sm:inline-flex" onClick={() => set({ dialog: "shortcuts" })} aria-label="Keyboard shortcuts" title="Keyboard shortcuts"><Icon name="keyboard" /></button>
      <button className="icon-btn" onClick={() => set({ dialog: "settings" })} aria-label="Settings" title="Settings"><Icon name="settings" /></button>
      <button className="icon-btn hidden sm:inline-flex" onClick={() => set({ dialog: "about" })} aria-label="About" title="About"><Icon name="info" /></button>
      <button className="btn-soft ml-1" onClick={() => saveImage()} disabled={!!busy} title="Save the image (Ctrl+S)"><Icon name="download" size={16} /><span className="hidden sm:inline">Save</span></button>
      <button className="btn-primary ml-1 !px-2.5 sm:!px-3" onClick={gen} disabled={!!busy} title="Auto Generate (Space)"><Icon name="wand" size={16} />{mode === "Batch" ? <>Batch<span className="hidden sm:inline"> of {batchSize}</span></> : <><span className="hidden sm:inline">Auto Generate</span><span className="sm:hidden">Auto</span></>}</button>
    </header>
  );
}
