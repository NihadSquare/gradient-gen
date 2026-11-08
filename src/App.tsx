import { useEffect } from "react";
import { applyTheme } from "./lib/themes";
import { GUIDES, useStore } from "./store/useStore";
import { copyCode, copyImageAction, runBatch, saveImage } from "./lib/actions";
import { BusyBar, Toasts } from "./components/BusyBar";
import { ColorsSection } from "./components/ColorsSection";
import { ContrastDialog } from "./components/ContrastDialog";
import { AboutDialog, PresetsDialog, SettingsDialog, ShortcutsDialog } from "./components/Dialogs";
import { Header } from "./components/Header";
import { PaletteDialog } from "./components/PaletteDialog";
import { Preview, PreviewBar } from "./components/Preview";
import { EffectsSection, GradientSection, OutputSection, OverlaySection } from "./components/Sections";

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState();
      const el = e.target as HTMLElement;
      const typing = el && (el.tagName === "INPUT" && !["range", "checkbox", "color"].includes((el as HTMLInputElement).type) || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (s.fullscreen) { if (e.key === "Escape" || k === "f") { e.preventDefault(); s.set({ fullscreen: false }); } return; }
      if (s.dialog) return;
      if (mod && k === "s") { e.preventDefault(); saveImage(); }
      else if (mod && k === "z" && !e.shiftKey) { if (typing) return; e.preventDefault(); s.undo(); }
      else if (mod && (k === "y" || (k === "z" && e.shiftKey))) { if (typing) return; e.preventDefault(); s.redo(); }
      else if (mod && k === "c") { if (typing || window.getSelection()?.toString()) return; e.preventDefault(); copyImageAction(); }
      else if (mod && k === "k") { e.preventDefault(); copyCode("css"); }
      else if (!mod && !e.altKey && !typing && el.tagName !== "BUTTON") {
        if (e.code === "Space") { e.preventDefault(); s.mode === "Batch" ? runBatch() : s.autoGenerate(); }
        else if (k === "g") { const i = GUIDES.indexOf(s.guides as (typeof GUIDES)[number]); const next = GUIDES[(i + 1) % GUIDES.length]; s.set({ guides: next }); s.notify(`Guides: ${next}`); }
        else if (k === "f") s.set({ fullscreen: true });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

export default function App() {
  const { prefs, dialog, fullscreen, set, settings, overlay, width, height } = useStore();
  useShortcuts();
  useEffect(() => applyTheme(prefs.theme, prefs.accent), [prefs.theme, prefs.accent]);
  // history: remember a state once edits pause
  useEffect(() => {
    const t = setTimeout(() => useStore.getState().commitHistory(), 700);
    return () => clearTimeout(t);
  }, [settings, overlay, width, height]);

  return (
    <div className="flex h-full flex-col">
      <Header />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="flex h-[42vh] shrink-0 flex-col bg-stage md:order-2 md:h-auto md:min-w-0 md:flex-1">
          <div className="min-h-0 flex-1"><Preview /></div>
          <PreviewBar />
        </div>
        <aside className="scroll-thin min-h-0 flex-1 overflow-y-auto bg-surface md:order-1 md:w-[400px] md:flex-none md:border-r md:border-line/70" aria-label="Controls">
          <ColorsSection />
          <GradientSection />
          <EffectsSection />
          <OutputSection />
          <OverlaySection />
          <p className="px-4 py-5 text-center text-xs text-dim">Runs in your browser. Nothing is uploaded.</p>
        </aside>
      </div>
      {dialog === "palette" && <PaletteDialog />}
      {dialog === "contrast" && <ContrastDialog />}
      {dialog === "presets" && <PresetsDialog />}
      {dialog === "settings" && <SettingsDialog />}
      {dialog === "shortcuts" && <ShortcutsDialog />}
      {dialog === "about" && <AboutDialog />}
      {fullscreen && (
        <div className="fixed inset-0 z-50 bg-black" role="dialog" aria-label="Full screen preview">
          <Preview fullscreen />
          <button className="icon-btn absolute right-3 top-3 bg-black/50 !text-white" onClick={() => set({ fullscreen: false })} aria-label="Close full screen (Esc)">✕</button>
        </div>
      )}
      <BusyBar />
      <Toasts />
    </div>
  );
}
