import { useEffect } from "react";
import { copyCode, copyImageAction, runBatchGeneration, saveImage } from "./lib/actions";
import { applyTheme } from "./lib/themes";
import { GUIDE_OPTS } from "./data/desktop";
import { useStore } from "./store/useStore";
import { DialogHost, Fullscreen } from "./components/DialogHost";
import { ColorsCard as _c, Footer, Header, PreviewCard, Sidebar } from "./components/Main";
void _c;

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState(); const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && !["range", "checkbox"].includes((el as HTMLInputElement).type)) || el.isContentEditable);
      const combo = el?.getAttribute?.("role") === "combobox" || el?.classList?.contains("g-combo");
      const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
      if (s.fullscreen) { if (e.key === "Escape" || k === "f") { e.preventDefault(); s.set({ fullscreen: false }); } else if (e.code === "Space") { e.preventDefault(); s.randomize(false); s.historyPush(); } return; }
      if (s.dialog || s.msg || s.progress) return;
      if (mod && k === "s") { e.preventDefault(); saveImage(); }
      else if (mod && k === "z" && !e.shiftKey) { if (typing) return; e.preventDefault(); s.historyUndo(); }
      else if (mod && (k === "y" || (k === "z" && e.shiftKey))) { if (typing) return; e.preventDefault(); s.historyRedo(); }
      else if (mod && k === "c") { if (typing || window.getSelection()?.toString()) return; e.preventDefault(); copyImageAction(); }
      else if (mod && k === "k") { e.preventDefault(); copyCode("css"); }
      else if (!mod && !e.altKey && !typing) {
        if (e.code === "Space") { if (combo || el?.tagName === "BUTTON") return; e.preventDefault(); if (s.generateRandom()) runBatchGeneration(); }
        else if (k === "g") { const i = GUIDE_OPTS.indexOf(s.guides as (typeof GUIDE_OPTS)[number]); s.set({ guides: GUIDE_OPTS[(i + 1) % GUIDE_OPTS.length] }); }
        else if (k === "f") s.set({ fullscreen: true });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

export default function App() {
  const prefs = useStore((s) => s.prefs);
  useShortcuts();
  useEffect(() => applyTheme(prefs.theme, prefs.accent), [prefs.theme, prefs.accent]);
  useEffect(() => {
    // every edit can be undone: remember a state once the edits pause
    useStore.getState().historyPush();
    let t: number | undefined;
    const unsub = useStore.subscribe((s, prev) => {
      if (s.colors === prev.colors && s.positions === prev.positions && s.opacities === prev.opacities && s.trans === prev.trans && s.num === prev.num && s.blend === prev.blend && s.reverse === prev.reverse && s.gradientType === prev.gradientType && s.direction === prev.direction && s.position === prev.position && s.customX === prev.customX && s.customY === prev.customY && s.effect === prev.effect && s.effect2 === prev.effect2 && s.intensity === prev.intensity && s.intensity2 === prev.intensity2 && s.seed === prev.seed) return;
      window.clearTimeout(t); t = window.setTimeout(() => useStore.getState().historyPush(), 700);
    });
    return () => { unsub(); window.clearTimeout(t); };
  }, []);
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { const s = useStore.getState(); if (s.batchRunning || (s.prefs.confirm_close && s.dirty)) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);
  return (
    <div className="g-shell" style={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <Header />
      <div className="g-main" style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <Sidebar />
        <PreviewCard />
      </div>
      <Footer />
      <Fullscreen />
      <DialogHost />
    </div>
  );
}
