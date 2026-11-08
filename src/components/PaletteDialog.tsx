import { useRef, useState } from "react";
import { hexToRgb, normHex } from "../engine/color";
import { HARMONIES, PICK_MODES, TEMPERATURES, extractColors, harmonyPalette, parsePaletteText, type Harmony, type PickMode, type Temperature } from "../engine/palette";
import { BUILTIN_PALETTES, MAX_COLORS } from "../engine/types";
import { copyPalette } from "../lib/actions";
import { downloadBlob } from "../lib/files";
import { useStore } from "../store/useStore";
import { HexField } from "./ColorsSection";
import { Icon, Modal, NumberInput, Select, Swatch } from "./ui";

const TABS = ["Library", "Generate", "From image", "Paste & copy"] as const;
type Tab = (typeof TABS)[number];

function Strip({ colors }: { colors: string[] }) {
  return <div className="flex h-7 overflow-hidden rounded-md border border-line">{colors.map((c, i) => <div key={i} className="flex-1" style={{ background: c }} />)}</div>;
}

function Preview({ colors, onApply }: { colors: string[]; onApply: () => void }) {
  const { savePalette } = useStore();
  const [name, setName] = useState("");
  if (!colors.length) return null;
  return (
    <div className="mt-3 space-y-2 rounded-lg bg-bg/60 p-3">
      <div className="flex gap-1.5">{colors.map((c, i) => <div key={i} className="flex-1 text-center"><Swatch color={c} size={32} /><div className="mt-1 text-[10px] text-dim">{c}</div></div>)}</div>
      <div className="flex gap-2">
        <button className="btn-primary flex-1" onClick={onApply}>Use these colors</button>
        <input className="field !w-28" placeholder="Name" aria-label="Palette name" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-soft" onClick={() => { savePalette(name || "My palette", colors); setName(""); }}>Save</button>
      </div>
    </div>
  );
}

export function PaletteDialog() {
  const { set, applyColors, settings, palettes, deletePalette, notify, savePalette } = useStore();
  const [tab, setTab] = useState<Tab>("Library");
  const close = () => set({ dialog: null });
  const use = (cols: string[]) => { applyColors(cols); notify(`Applied ${Math.min(cols.length, MAX_COLORS)} colors`); };

  // generate
  const [base, setBase] = useState(settings.stops[0].color);
  const [harmony, setHarmony] = useState<Harmony>("Complementary");
  const [temp, setTemp] = useState<Temperature>("Neutral");
  const [count, setCount] = useState(Math.min(5, MAX_COLORS));
  const [gen, setGen] = useState<string[]>([]);
  // image
  const [mode, setMode] = useState<PickMode>("Dominant");
  const [imgCount, setImgCount] = useState(5);
  const [img, setImg] = useState<string[]>([]);
  const [imgErr, setImgErr] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const picked = useRef<ImageData | null>(null);
  const [fileName, setFileName] = useState("");
  // paste
  const [text, setText] = useState("");
  const parsed = parsePaletteText(text);

  const readImage = async (f: File) => {
    setImgErr(""); setFileName(f.name);
    try {
      const bmp = await createImageBitmap(f);
      const k = Math.min(1, 240 / Math.max(bmp.width, bmp.height));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
      const ctx = c.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(bmp, 0, 0, c.width, c.height);
      picked.current = ctx.getImageData(0, 0, c.width, c.height);
      runExtract(mode, imgCount);
    } catch { setImgErr("This file is not an image the browser can read."); picked.current = null; setImg([]); }
  };
  const runExtract = (m: PickMode, n: number) => {
    if (!picked.current) return;
    try { setImg(extractColors(picked.current.data, n, m)); setImgErr(""); } catch (e) { setImg([]); setImgErr((e as Error).message); }
  };

  const exportPng = () => {
    const cols = settings.stops.map((s) => s.color);
    const W = 600, rows = cols.length > 6 ? 2 : 1, per = rows === 1 ? cols.length : Math.ceil(cols.length / 2), H = rows === 1 ? 250 : 360;
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d")!; g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
    const gap = Math.max(4, Math.floor(W / (per * 10))), sw = Math.floor((W - gap * (per + 1)) / per), rh = H / rows;
    cols.forEach((col, i) => {
      const x = gap + (i % per) * (sw + gap), y = 8 + Math.floor(i / per) * rh, [r, gg, b] = hexToRgb(col);
      g.fillStyle = col; g.fillRect(x, y, sw, rh * 0.6);
      g.fillStyle = "#000"; g.font = "600 14px system-ui, sans-serif"; g.fillText(col, x, y + rh * 0.6 + 20);
      g.fillStyle = "#444"; g.font = "12px system-ui, sans-serif"; g.fillText(`RGB ${r},${gg},${b}`, x, y + rh * 0.6 + 38);
    });
    c.toBlob((b) => b && downloadBlob(b, "Palette.png"));
  };

  return (
    <Modal title="Palettes" onClose={close} width={600}>
      <div className="mb-4 flex flex-wrap gap-1 rounded-lg bg-bg p-0.5" role="tablist">
        {TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`h-8 flex-1 rounded-md px-3 text-[13px] font-semibold ${tab === t ? "bg-accent text-accent-ink" : "text-dim hover:text-ink"}`}>{t}</button>)}
      </div>

      {tab === "Library" && (
        <div className="space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between"><h3 className="font-semibold">Current gradient</h3>
              <button className="btn-soft !h-8" onClick={() => { const n = window.prompt("Name for this palette", "My palette"); if (n !== null) { savePalette(n, settings.stops.map((s) => s.color)); notify("Palette saved"); } }}><Icon name="save" size={15} />Save</button></div>
            <Strip colors={settings.stops.map((s) => s.color)} />
          </div>
          {palettes.length > 0 && (
            <div><h3 className="mb-2 font-semibold">Saved on this device</h3>
              <ul className="space-y-1.5">{palettes.map((p) => (
                <li key={p.id} className="flex items-center gap-2"><button className="flex-1 rounded-lg p-1.5 text-left hover:bg-surface2" onClick={() => { use(p.colors); }}><div className="mb-1 text-[13px]">{p.name}</div><Strip colors={p.colors} /></button>
                  <button className="icon-btn" aria-label={`Delete ${p.name}`} onClick={() => deletePalette(p.id)}><Icon name="trash" size={16} /></button></li>))}</ul></div>
          )}
          <div><h3 className="mb-2 font-semibold">Built in</h3>
            <ul className="grid gap-1.5 sm:grid-cols-2">{BUILTIN_PALETTES.map((p) => (
              <li key={p.name}><button className="w-full rounded-lg p-1.5 text-left hover:bg-surface2" onClick={() => use(p.colors)}><div className="mb-1 text-[13px]">{p.name}</div><Strip colors={p.colors} /></button></li>))}</ul></div>
        </div>
      )}

      {tab === "Generate" && (
        <div>
          <div className="grid grid-cols-[110px_1fr] items-center gap-x-3 gap-y-2.5">
            <span className="label">Base color</span>
            <div className="flex items-center gap-2"><div className="h-8 w-10 overflow-hidden rounded-md border border-line"><input type="color" aria-label="Base color" value={base.toLowerCase()} onChange={(e) => setBase(e.target.value.toUpperCase())} /></div><HexField value={base} onCommit={setBase} /></div>
            <span className="label">Scheme</span><Select label="Scheme" value={harmony} options={HARMONIES} onChange={setHarmony} />
            <span className="label">Feel</span><Select label="Temperature" value={temp} options={TEMPERATURES} onChange={setTemp} />
            <span className="label">Colors</span><NumberInput label="Number of colors" className="!w-16" value={count} min={2} max={MAX_COLORS} onCommit={(v) => setCount(Math.round(v))} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => setGen(harmonyPalette(base, harmony, count, temp))}><Icon name="wand" size={16} />Generate palette</button>
            <button className="btn-soft" onClick={() => setBase(settings.stops[0].color)}>Use color 1</button>
          </div>
          <Preview colors={gen} onApply={() => use(gen)} />
        </div>
      )}

      {tab === "From image" && (
        <div>
          <input ref={file} hidden type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) readImage(f); }} />
          <div className="grid grid-cols-[110px_1fr] items-center gap-x-3 gap-y-2.5">
            <span className="label">Image</span>
            <div className="flex items-center gap-2"><button className="btn-soft" onClick={() => file.current?.click()}><Icon name="image" size={16} />Choose image…</button><span className="truncate text-xs text-dim">{fileName || "Stays on this device"}</span></div>
            <span className="label">Pick</span><Select label="Pick mode" value={mode} options={PICK_MODES} onChange={(v) => { setMode(v); runExtract(v, imgCount); }} />
            <span className="label">Colors</span><NumberInput label="Number of colors" className="!w-16" value={imgCount} min={2} max={MAX_COLORS} onCommit={(v) => { setImgCount(Math.round(v)); runExtract(mode, Math.round(v)); }} />
          </div>
          {imgErr && <p className="mt-3 text-sm text-bad" role="alert">{imgErr}</p>}
          <Preview colors={img} onApply={() => use(img)} />
        </div>
      )}

      {tab === "Paste & copy" && (
        <div className="space-y-5">
          <div>
            <h3 className="mb-1 font-semibold">Paste colors</h3>
            <p className="mb-2 text-xs text-dim">Hex codes, a Coolors link, or GIMP .gpl lines.</p>
            <textarea className="field !h-24 py-2 font-mono text-xs" aria-label="Paste palette text" value={text} onChange={(e) => setText(e.target.value)} placeholder="#264653 #2A9D8F #E9C46A  or  coolors.co/264653-2a9d8f-e9c46a" />
            {text && (parsed.length >= 2 ? <Preview colors={parsed.slice(0, MAX_COLORS).map((c) => normHex(c)!)} onApply={() => use(parsed)} /> : <p className="mt-2 text-sm text-warn">Found {parsed.length} color{parsed.length === 1 ? "" : "s"}; at least 2 are needed.</p>)}
          </div>
          <div>
            <h3 className="mb-2 font-semibold">Copy the current colors</h3>
            <div className="flex flex-wrap gap-2">
              <button className="btn-soft" onClick={() => copyPalette("hex")}>HEX list</button>
              <button className="btn-soft" onClick={() => copyPalette("json")}>JSON</button>
              <button className="btn-soft" onClick={() => copyPalette("css_vars")}>CSS variables</button>
              <button className="btn-soft" onClick={() => copyPalette("css")}>CSS gradient</button>
              <button className="btn-soft" onClick={exportPng}><Icon name="download" size={15} />Palette PNG</button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
