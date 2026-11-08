import { useRef, useState } from "react";
import { APP_NAME, APP_VERSION, BASE, REPO_URL } from "../config";
import { downloadText } from "../lib/files";
import { THEMES, THEME_ORDER } from "../lib/themes";
import { useStore } from "../store/useStore";
import { Icon, Modal, Row, Select, Toggle } from "./ui";

export function PresetsDialog() {
  const { presets, savePreset, loadPreset, deletePreset, renamePreset, importPresets, set, notify } = useStore();
  const [name, setName] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const close = () => set({ dialog: null });
  return (
    <Modal title="Presets" onClose={close}>
      <p className="mb-3 text-sm text-dim">A preset keeps the colors, gradient, effects, overlays and output size. Presets are saved in this browser.</p>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); savePreset(name); setName(""); notify("Preset saved"); }}>
        <input className="field !h-9" placeholder="Name this look" aria-label="Preset name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        <button className="btn-primary" type="submit"><Icon name="save" size={15} />Save current</button>
      </form>
      <ul className="mt-4 space-y-1.5">
        {presets.length === 0 && <li className="rounded-lg bg-bg/60 p-4 text-center text-sm text-dim">No presets yet. Save the current look to find it again later.</li>}
        {presets.map((p) => {
          const cols = p.data.settings.stops.map((s) => s.color);
          return (
            <li key={p.id} className="flex items-center gap-2 rounded-lg bg-bg/60 p-2">
              <div className="h-10 w-16 shrink-0 rounded-md border border-line" style={{ background: `linear-gradient(90deg, ${cols.join(",")})` }} />
              <div className="min-w-0 flex-1"><div className="truncate font-semibold">{p.name}</div><div className="text-xs text-dim">{p.data.settings.type} · {p.data.width} × {p.data.height}</div></div>
              <button className="btn-soft !h-8" onClick={() => { loadPreset(p.id); close(); notify(`Loaded “${p.name}”`); }}>Load</button>
              <button className="icon-btn !h-8 !w-8" aria-label={`Rename ${p.name}`} onClick={() => { const n = window.prompt("New name", p.name); if (n) renamePreset(p.id, n); }}>✎</button>
              <button className="icon-btn !h-8 !w-8" aria-label={`Delete ${p.name}`} onClick={() => deletePreset(p.id)}><Icon name="trash" size={15} /></button>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <input ref={file} hidden type="file" accept="application/json,.json" onChange={async (e) => {
          const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
          try { const n = importPresets(JSON.parse(await f.text())); notify(n ? `Imported ${n} preset${n === 1 ? "" : "s"}` : "No presets found in that file", n ? "ok" : "warn"); } catch { notify("That file is not valid JSON", "bad"); }
        }} />
        <button className="btn-soft" onClick={() => file.current?.click()}><Icon name="upload" size={15} />Import…</button>
        <button className="btn-soft" disabled={!presets.length} onClick={() => downloadText(JSON.stringify(presets, null, 2), "gradient-gen-presets.json")}><Icon name="download" size={15} />Export all</button>
      </div>
    </Modal>
  );
}

export function SettingsDialog() {
  const { prefs, setPrefs, set, resetAll, notify } = useStore();
  return (
    <Modal title="Settings" onClose={() => set({ dialog: null })}>
      <button className="btn-soft mb-4 sm:hidden" onClick={() => set({ dialog: "presets" })}><Icon name="save" size={15} />Presets</button>
      <h3 className="mb-2 font-semibold">Theme</h3>
      <div className="grid grid-cols-4 gap-2">
        {THEME_ORDER.map((k) => { const t = THEMES[k]; return (
          <button key={k} onClick={() => setPrefs({ theme: k })} aria-pressed={prefs.theme === k} className={`overflow-hidden rounded-lg border-2 text-[12px] font-semibold ${prefs.theme === k ? "border-accent" : "border-line"}`}>
            <div className="flex h-9" style={{ background: t.bg }}><div className="m-1.5 flex-1 rounded" style={{ background: t.surface2 }} /><div className="my-1.5 mr-1.5 w-4 rounded" style={{ background: t.accent }} /></div>
            <div className="py-1" style={{ background: t.surface, color: t.ink }}>{t.label}</div>
          </button>); })}
      </div>
      <div className="mt-4 space-y-3">
        <Row label="Accent">
          <div className="flex items-center gap-2"><div className="h-8 w-10 overflow-hidden rounded-md border border-line"><input type="color" aria-label="Accent color" value={(prefs.accent || THEMES[prefs.theme].accent).toLowerCase()} onChange={(e) => setPrefs({ accent: e.target.value.toUpperCase() })} /></div>
            <button className="btn-ghost !h-8" disabled={!prefs.accent} onClick={() => setPrefs({ accent: "" })}>Use theme accent</button></div>
        </Row>
        <Row label="New file"><Select label="Default format" value={prefs.defaultFormat} options={["PNG", "JPEG", "WebP"] as const} onChange={(v) => { setPrefs({ defaultFormat: v }); set({ format: v }); }} /></Row>
        <Row label="Background"><Select label="Default background" value={prefs.defaultBackground} options={["Transparent", "White", "Black"] as const} onChange={(v) => { setPrefs({ defaultBackground: v }); useStore.getState().patchOverlay({ background: v }); }} /></Row>
        <Row label="Large sizes"><div className="flex items-center gap-2 text-dim"><Toggle label="Ask before large exports" on={prefs.confirmLarge} onChange={(v) => setPrefs({ confirmLarge: v })} />Ask before big exports</div></Row>
      </div>
      <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
        <button className="btn-soft" onClick={() => { if (window.confirm("Reset the gradient, effects, overlays and size to the defaults? Your presets stay.")) { resetAll(); notify("Reset to defaults"); } }}><Icon name="reset" size={15} />Reset current design</button>
        <button className="btn-ghost text-bad" onClick={() => { if (window.confirm("Delete all presets, palettes and settings saved in this browser?")) { ["gg.session", "gg.prefs", "gg.presets", "gg.palettes"].forEach((k) => localStorage.removeItem(k)); location.reload(); } }}>Delete saved data</button>
      </div>
    </Modal>
  );
}

const KEYS: [string, string][] = [
  ["Space", "Auto Generate (or start the batch)"], ["Ctrl + S", "Save the image"], ["Ctrl + Z", "Undo"], ["Ctrl + Y  /  Ctrl + Shift + Z", "Redo"],
  ["Ctrl + C", "Copy the picture"], ["Ctrl + K", "Copy as CSS"], ["G", "Cycle the guides"], ["F", "Full screen preview"], ["Esc", "Close a window"],
];
export function ShortcutsDialog() {
  const { set } = useStore();
  return (
    <Modal title="Keyboard shortcuts" onClose={() => set({ dialog: null })} width={460}>
      <dl className="space-y-2">{KEYS.map(([k, d]) => <div key={k} className="flex items-center justify-between gap-4"><dt><kbd className="rounded-md border border-line bg-bg px-2 py-0.5 text-[12px]">{k}</kbd></dt><dd className="text-right text-dim">{d}</dd></div>)}</dl>
      <p className="mt-4 text-xs text-dim">On a Mac, use ⌘ instead of Ctrl. Single-letter shortcuts are off while you type in a box.</p>
    </Modal>
  );
}

export function AboutDialog() {
  const { set } = useStore();
  return (
    <Modal title={`About ${APP_NAME}`} onClose={() => set({ dialog: null })} width={460}>
      <div className="flex flex-col items-center gap-3 text-center">
        <img src={`${BASE}assets/GG.png`} alt={APP_NAME} className="h-12" />
        <p className="text-dim">Version {APP_VERSION} for the web. 28 gradient types, 25 effects, palette tools and exports up to 4096 px.</p>
        <p className="text-sm">Everything is drawn in your browser. Your images, logos and palettes never leave this device.</p>
        <div className="mt-1 flex items-center gap-2 text-sm text-dim"><img src={`${BASE}assets/NS.png`} alt="" className="h-8 w-8" />Developed by Nihad Square</div>
        <a className="btn-soft" href={REPO_URL} target="_blank" rel="noreferrer">Source code on GitHub</a>
        <p className="text-xs text-dim">Released under the MIT licence.</p>
      </div>
    </Modal>
  );
}
