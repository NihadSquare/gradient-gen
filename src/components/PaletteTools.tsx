// Gradient Gen - Copyright (c) 2026 AK Nihad (Nihad Square). All rights reserved.
// Source-available, not open source: see LICENSE. Copying or reuse is not permitted without written permission.
import { useMemo, useRef, useState } from "react";
import { hexToHls, hexToRgb, hlsToHex, hlsToRgb, normHex, rgbToHls } from "../engine/color";
import { BUILTIN_PALETTES, PICK_MODES } from "../data/desktop";
import { paletteText, type PaletteTextKind } from "../engine/code";
import { extractColors, harmonyPalette, parsePaletteText, HARMONIES, type Harmony, type PickMode, type Temperature } from "../engine/palette";
import { MAX_COLORS } from "../engine/types";
import { copyText } from "../lib/files";
import { contrastTextOn } from "../lib/colorutil";
import { currentSettings } from "../lib/actions";
import { useStore } from "../store/useStore";
import { Dialog, Label, RoundButton, RoundCombo, RoundEntry, ColorSwatch, Segmented } from "./widgets";

const SELECT_ITEMS = [`First ${MAX_COLORS}`, "First 8", "First 6", "First 4", "Every 2nd", "Most Vivid", "Lightest", "Darkest", "Most Varied", "Warm Only", "Cool Only", `Random ${MAX_COLORS}`, "None"];
const ORDER_ITEMS = ["Dark to Light", "Light to Dark", "As Found", "By Hue", "Warm to Cool", "As Clicked", "Random"];
const cap = (t: string, first = false) => <div style={{ margin: first ? "0 0 6px" : "14px 0 6px" }}><Label dim size={8} bold>{t}</Label></div>;
const bright = (c: string) => { const [r, g, b] = hexToRgb(c); return 0.299 * r + 0.587 * g + 0.114 * b; };
const hls = (c: string) => rgbToHls(...(hexToRgb(c).map((v) => v / 255) as [number, number, number]));
const chroma = (c: string) => { const [, l, s] = hls(c); return s * (1 - Math.abs(2 * l - 1)); };
const warmth = (c: string) => { const d = Math.abs(hls(c)[0] - 0.08); return Math.min(d, 1 - d); };
const shuffle = <T,>(a: T[]) => { const o = [...a]; for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; };
const edge = (sel: boolean) => (sel ? "rgb(var(--accent))" : "color-mix(in srgb, rgb(var(--ink)) 30%, rgb(var(--surface)))");
const Strip = ({ cols, h = 22 }: { cols: string[]; h?: number }) => <div style={{ display: "flex", height: h }}>{cols.map((c, i) => <div key={i} style={{ flex: 1, background: c }} />)}</div>;

export function PaletteToolsDialog() {
  const s = useStore();
  const [tab, setTab] = useState<"Library" | "Edit" | "Harmony" | "Import">("Library");
  const [note, setNote] = useState("");
  const hist = useRef<string[][]>([]);
  const cur = () => s.colors.slice(0, s.num).map((c) => c.toUpperCase());
  const curNow = () => { const st = useStore.getState(); return st.colors.slice(0, st.num).map((c) => c.toUpperCase()); };
  const applyCols = (cols: string[], msg: string) => { const old = curNow(); cols = cols.map((c) => c.toUpperCase()).slice(0, MAX_COLORS); if (cols.length < 2 || JSON.stringify(cols) === JSON.stringify(old)) { setNote("No change."); return; } hist.current.push(old); useStore.getState().applyPaletteColors(cols); setNote(msg); };
  const go = (t: typeof tab) => { setTab(t); setNote(""); };

  // ── Library ──
  const items = [...BUILTIN_PALETTES.map((p) => ({ ...p, builtin: true })), ...s.palettes.map((p) => ({ ...p, builtin: false }))];
  const [lsel, setLsel] = useState<number | null>(null); const [pname, setPname] = useState("");
  const [chooser, setChooser] = useState(false);
  const [ex, setEx] = useState<{ cols: string[]; sel: string[]; order: string; file: string }>({ cols: [], sel: [], order: "Dark to Light", file: "" });
  const [cnt, setCnt] = useState("12"); const [mode, setMode] = useState<PickMode>("Dominant"); const [selPick, setSelPick] = useState("Select...");
  const img = useRef<ImageData | null>(null); const file = useRef<HTMLInputElement>(null);
  const ordered = (sel: string[], order = ex.order, cols = ex.cols) => {
    switch (order) {
      case "Light to Dark": return [...sel].sort((a, b) => bright(b) - bright(a));
      case "As Found": return [...sel].sort((a, b) => cols.indexOf(a) - cols.indexOf(b));
      case "By Hue": return [...sel].sort((a, b) => Math.round(hls(a)[0] * 1000) - Math.round(hls(b)[0] * 1000) || bright(a) - bright(b));
      case "Warm to Cool": return [...sel].sort((a, b) => warmth(a) - warmth(b));
      case "As Clicked": return [...sel];
      case "Random": return shuffle([...sel].sort());
      default: return [...sel].sort((a, b) => bright(a) - bright(b));
    }
  };
  const runExtract = (n: string, m: PickMode, name?: string) => {
    if (!img.current) return;
    try { const cols = extractColors(img.current.data, Number(n), m); setEx((e) => ({ ...e, cols, sel: cols.slice(0, Math.min(MAX_COLORS, cur().length)), file: name ?? e.file })); setNote(""); return true; } catch (x) { setNote(`Could not read colors from this image: ${(x as Error).message}`); return false; }
  };
  const readImage = async (f: File) => {
    try {
      const bmp = await createImageBitmap(f); const k = Math.min(1, 240 / Math.max(bmp.width, bmp.height)); const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
      const g = c.getContext("2d", { willReadFrequently: true })!; g.drawImage(bmp, 0, 0, c.width, c.height); img.current = g.getImageData(0, 0, c.width, c.height);
      if (runExtract(cnt, mode, f.name)) setChooser(true);
    } catch { setNote("Could not read colors from this image: not an image the browser can read."); }
  };
  const choose = (label: string) => {
    const cols = ex.cols; const N = MAX_COLORS; let got: string[] = [];
    if (label === `First ${N}`) got = cols.slice(0, N); else if (label.startsWith("First ")) got = cols.slice(0, Number(label.split(" ")[1])); else if (label === "Every 2nd") got = cols.filter((_, i) => i % 2 === 0).slice(0, N);
    else if (label === "Most Vivid") got = [...cols].sort((a, b) => chroma(b) - chroma(a)).slice(0, N); else if (label === "Lightest") got = [...cols].sort((a, b) => bright(b) - bright(a)).slice(0, N); else if (label === "Darkest") got = [...cols].sort((a, b) => bright(a) - bright(b)).slice(0, N);
    else if (label === "Most Varied") { got = cols.length ? [cols[0]] : []; const rest = cols.slice(1); const d = (a: string, b: string) => hexToRgb(a).reduce((t, v, i) => t + (v - hexToRgb(b)[i]) ** 2, 0); while (rest.length && got.length < N) { let bi = 0, bv = -1; rest.forEach((c, i) => { const m = Math.min(...got.map((g) => d(c, g))); if (m > bv) { bv = m; bi = i; } }); got.push(rest.splice(bi, 1)[0]); } }
    else if (label === "Warm Only") got = cols.filter((c) => chroma(c) > 0.05 && (hls(c)[0] <= 1 / 6 || hls(c)[0] >= 11 / 12)).slice(0, N); else if (label === "Cool Only") got = cols.filter((c) => chroma(c) > 0.05 && hls(c)[0] >= 0.33 && hls(c)[0] <= 0.75).slice(0, N);
    else if (label.startsWith("Random")) got = shuffle(cols).slice(0, N); else if (label === "None") got = [];
    if (!got.length && label !== "None") { setNote("No colors in this image match that choice."); return; }
    setEx({ ...ex, sel: label.startsWith("Random") ? got : cols.filter((c) => got.includes(c)) });
  };
  const saveCurrent = () => { const n = pname.trim().slice(0, 40); if (!n) { setNote("Type a name first."); return; } const cols = cur(); const mine = s.palettes.filter((p) => p.name.toLowerCase() !== n.toLowerCase()); mine.push({ name: n, colors: cols }); if (s.saveUserPalettes(mine)) { setPname(""); setLsel(BUILTIN_PALETTES.length + mine.length - 1); setNote(`Saved ${n}.`); } };
  const copy = async (kind: PaletteTextKind, label: string) => { try { await copyText(paletteText(currentSettings(), kind)); setNote(`Copied as ${label}.`); } catch { setNote("Could not reach the clipboard."); } };
  const lp = lsel !== null ? items[lsel] : null;

  // ── Harmony ──
  const [base, setBase] = useState(s.colors[0].toUpperCase()); const [scheme, setScheme] = useState(s.scheme); const [hn, setHn] = useState(String(s.num));
  const nb = normHex(base);
  const preview = useMemo(() => (nb ? harmonyPalette(nb, scheme as Harmony, Number(hn), s.temp as Temperature) : []), [nb, scheme, hn, s.temp]); // eslint-disable-line
  // ── Import ──
  const [txt, setTxt] = useState(""); const found = parsePaletteText(txt).slice(0, MAX_COLORS); const ifile = useRef<HTMLInputElement>(null);

  const edit = (title: string, first: boolean, btns: [string, (c: string[]) => string[], string][]) => (<>
    <div style={{ gridColumn: "1 / 3" }}>{cap(title, first)}</div>
    {btns.map(([t, fn, m]) => <div key={t} style={{ padding: "0 4px 6px 0" }}><RoundButton text={t} height={34} fill onClick={() => applyCols(fn(cur()), m)} /></div>)}
  </>);
  const shifted = (dl: number, ds: number) => (cols: string[]) => cols.map((c) => { const [h, l, sat] = hexToHls(c); return hlsToHex(h, Math.min(0.97, Math.max(0.03, l + dl)), Math.min(1, Math.max(0, sat + ds))); });
  void hlsToRgb;

  return (
    <Dialog title="Palette Tools" width={470} onClose={() => s.set({ dialog: null })}>
      <div style={{ fontSize: 17.333, fontWeight: 700 }}>Palette Tools</div>
      <div style={{ margin: "2px 0 10px" }}><Label dim size={9}>These work on the colors in the Colors card.</Label></div>
      <Segmented value={tab} options={["Library", "Edit", "Harmony", "Import"] as const} segWidth={100} height={34} onChange={go} />
      <div style={{ marginTop: 12 }}>
        {tab === "Library" && (chooser ? (
          <div>
            <div style={{ display: "flex", alignItems: "center" }}><div style={{ flex: 1, fontSize: 14.667, fontWeight: 700 }}>Colors from the image</div><RoundButton icon="image" height={30} width={36} tip="Choose another image" onClick={() => file.current?.click()} /></div>
            <div style={{ margin: "0 0 8px" }}><Label dim size={9}>{ex.file}</Label></div>
            <div style={{ display: "flex", alignItems: "center" }}>
              <Label dim style={{ marginRight: 6 }}>Colors to find:</Label><RoundCombo value={cnt} values={["4", "6", "8", "10", "12", "16", "20"]} width={5} center label="Colors to find" onChange={(v) => { setCnt(v); runExtract(v, mode); }} />
              <Label dim style={{ margin: "0 6px 0 24px" }}>Pick:</Label><RoundCombo value={mode} values={PICK_MODES} width={14} label="Pick mode" onChange={(v) => { setMode(v as PickMode); runExtract(cnt, v as PickMode); }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 98px)", gap: 6, marginTop: 12 }}>
              {ex.cols.map((c) => { const sel = ex.sel.includes(c); const k = ordered(ex.sel).indexOf(c) + 1; return (
                <div key={c} role="button" aria-label={c} onClick={() => { if (sel) setEx({ ...ex, sel: ex.sel.filter((x) => x !== c) }); else if (ex.sel.length >= MAX_COLORS) setNote(`A palette holds up to ${MAX_COLORS} colors.`); else setEx({ ...ex, sel: [...ex.sel, c] }); }}
                  style={{ position: "relative", width: 98, height: 40, borderRadius: 10, background: c, border: `${sel ? 3 : 1}px solid ${edge(sel)}`, color: contrastTextOn(c), fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", paddingRight: sel ? 12 : 0 }}>
                  {c}{sel && <span style={{ position: "absolute", right: 0, top: 0, width: 20, height: 20, borderRadius: "50%", background: "rgb(var(--accent))", boxShadow: "0 0 0 2px rgb(var(--accent-ink)) inset", color: "rgb(var(--accent-ink))", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>{k}</span>}
                </div>); })}
            </div>
            <div style={{ margin: "10px 0 8px" }}><Label dim size={9}>{`Selected ${ex.sel.length} of ${MAX_COLORS}   Order: ${ex.order}`}</Label></div>
            <div style={{ display: "flex", gap: 4 }}>
              <div style={{ flex: 1 }}><RoundCombo value={selPick} values={SELECT_ITEMS} width={7} height={34} label="Select" onChange={(v) => { setSelPick(v); choose(v); }} /></div>
              <div style={{ flex: 1 }}><RoundCombo value={ex.order} values={ORDER_ITEMS} width={11} height={34} label="Order" onChange={(v) => setEx({ ...ex, order: v })} /></div>
              <RoundButton icon="reset" height={34} width={36} size={9} tip="Clear Selection" onClick={() => setEx({ ...ex, sel: [] })} />
              <RoundButton icon="back" height={34} width={36} size={9} tip="Back" onClick={() => { setChooser(false); setNote(""); }} />
              <RoundButton text="Use Selected" style="primary" height={34} width={94} size={9} onClick={() => { const cols = ordered(ex.sel); if (cols.length < 2) { setNote("Select at least two colors."); return; } applyCols(cols, `Imported ${cols.length} colors from ${ex.file}.`); setChooser(false); }} />
            </div>
          </div>
        ) : (
          <div>
            <RoundButton text="Extract colors from an image..." icon="sparkle" height={34} fill onClick={() => file.current?.click()} />
            {cap("COPY AS")}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 8px" }}>
              {([["CSS Gradient", "css"], ["CSS Variables", "css_vars"], ["JSON", "json"], ["HEX List", "hex"]] as [string, PaletteTextKind][]).map(([t, k]) => <div key={k} style={{ paddingBottom: 6 }}><RoundButton text={t} height={32} fill onClick={() => copy(k, t)} /></div>)}
            </div>
            {cap("PALETTES")}
            <div className="g-listbox" style={{ height: 7 * 22 + 2, fontSize: 13.333 }}>
              {items.map((p, i) => <div key={i} className={i === lsel ? "sel" : ""} onClick={() => setLsel(i)} onDoubleClick={() => applyCols(p.colors, `Loaded ${p.name}.`)}>{`   ${String(i + 1).padStart(2, "0")}   ${p.name}${p.builtin ? "" : "   (yours)"}`}</div>)}
            </div>
            <div style={{ marginTop: 6, height: 22 }}>{lp && <Strip cols={lp.colors} />}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
              <RoundButton text="Use Selected" style="primary" height={32} fill onClick={() => lp && applyCols(lp.colors, `Loaded ${lp.name}.`)} />
              <RoundButton text="Delete" height={32} fill onClick={() => { if (!lp || lp.builtin) { setNote("Built-in palettes cannot be deleted."); return; } s.saveUserPalettes(s.palettes.filter((p) => p.name !== lp.name)); setLsel(null); setNote(`Deleted ${lp.name}.`); }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}><Label dim>Name</Label><div style={{ flex: 1 }}><RoundEntry value={pname} width={14} center={false} label="Palette name" style={{ width: "100%" }} onChange={setPname} /></div><RoundButton text="Save Current" height={30} width={110} onClick={saveCurrent} /></div>
          </div>
        ))}
        {tab === "Edit" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
            {edit("SORT", true, [["By Hue", (c) => [...c].sort((a, b) => hls(a)[0] - hls(b)[0]), "Sorted by hue."], ["By Brightness", (c) => [...c].sort((a, b) => bright(a) - bright(b)), "Sorted dark to light."], ["Reverse Order", (c) => [...c].reverse(), "Order reversed."], ["Shuffle", shuffle, "Shuffled."]])}
            {edit("ADJUST ALL COLORS", false, [["Lighter", shifted(0.08, 0), "All colors lighter."], ["Darker", shifted(-0.08, 0), "All colors darker."], ["More Saturated", shifted(0, 0.12), "More saturated."], ["Less Saturated", shifted(0, -0.12), "Less saturated."]])}
            <div style={{ gridColumn: "1 / 3", marginTop: 6 }}><Label dim size={9}>Stops are spread evenly after an edit. Undo restores the previous colors.</Label></div>
          </div>
        )}
        {tab === "Harmony" && (
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", rowGap: 8, alignItems: "center" }}>
            <Label dim style={{ marginRight: 10 }}>Base Color</Label>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <label style={{ position: "relative", width: 34, height: 30, flex: "none" }}><ColorSwatch color={nb ?? "#CCCCCC"} label="" width={34} height={30} /><input type="color" aria-label="Base color" value={(nb ?? "#CCCCCC").toLowerCase()} onChange={(e) => { setBase(e.target.value.toUpperCase()); setNote(""); }} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} /></label>
              <RoundCombo value={nb ?? base} values={[...new Set(cur())]} width={12} swatches label="Base color list" onChange={(v) => { setBase(v); setNote(""); }} />
              <RoundEntry value={base} width={9} label="Base hex" onChange={(v) => { setBase(v.toUpperCase()); setNote(""); }} />
            </div>
            <Label dim style={{ marginRight: 10 }}>Harmony</Label><div><RoundCombo value={scheme} values={HARMONIES} width={19} label="Harmony" onChange={(v) => { setScheme(v); setNote(""); }} /></div>
            <Label dim style={{ marginRight: 10 }}>Colors</Label><div><RoundCombo value={hn} values={Array.from({ length: 11 }, (_, i) => String(i + 2))} width={6} center label="Colors" onChange={(v) => { setHn(v); setNote(""); }} /></div>
            <div style={{ gridColumn: "1 / 3", marginTop: 4 }}>
              {nb ? (
                <div>{[0, 1].slice(0, preview.length > 6 ? 2 : 1).map((r) => { const row = preview.length > 6 ? preview.slice(r * 6, r * 6 + 6) : preview; return <div key={r} style={{ display: "flex", height: 44, marginBottom: 4 }}>{row.map((c, i) => { const first = r === 0 && i === 0; return <div key={c + i} style={{ flex: 1, background: c, color: contrastTextOn(c), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontSize: 10.667, fontWeight: 700, lineHeight: 1.2 }}>{c.toUpperCase()}{first && <span style={{ fontSize: 9.333, fontWeight: 400 }}>BASE</span>}</div>; })}</div>; })}</div>
              ) : <div style={{ height: 44, display: "flex", alignItems: "center" }}><Label dim size={9}>Type a valid base color (like #1A2B3C).</Label></div>}
            </div>
            <div style={{ gridColumn: "1 / 3", margin: "4px 0 6px", maxWidth: 400 }}><Label dim size={9}>The color palette preview updates as you change the options.</Label></div>
            <div style={{ gridColumn: "1 / 3" }}><RoundButton text="Use this Palette" icon="sparkle" style="primary" height={36} fill onClick={() => { if (!nb || preview.length < 2) { setNote("Type a valid base color first (like #1A2B3C)."); return; } hist.current.push(cur()); useStore.getState().applyPaletteColors(preview); setNote(`${scheme} palette made from ${nb}.`); }} /></div>
          </div>
        )}
        {tab === "Import" && (
          <div>
            <div style={{ marginBottom: 6, maxWidth: 400 }}><Label dim size={9}>Paste hex codes, a Coolors link, or JSON / GPL text. Up to 12 colors are used.</Label></div>
            <div className="g-entry" style={{ height: 7 * 20 + 14, borderRadius: 0 }}><textarea aria-label="Palette text" value={txt} spellCheck={false} onChange={(e) => { setTxt(e.target.value); const f = parsePaletteText(e.target.value).slice(0, MAX_COLORS); setNote(e.target.value.trim() ? (f.length ? `Found ${f.length} color${f.length !== 1 ? "s" : ""}.` : "No colors found in this text.") : ""); }} style={{ height: "100%" }} /></div>
            <div style={{ marginTop: 8, height: 26 }}>{found.length > 0 && <Strip cols={found.map((c) => normHex(c)!)} h={26} />}</div>
            <input ref={ifile} hidden type="file" accept=".gpl,.json,.txt,.css,.scss,.hex,text/*" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; const d = (await f.text()).slice(0, 200000); setTxt(d); const fd = parsePaletteText(d).slice(0, MAX_COLORS); setNote(d.trim() ? (fd.length ? `Found ${fd.length} color${fd.length !== 1 ? "s" : ""}.` : "No colors found in this text.") : ""); }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
              <RoundButton text="Open file..." height={34} fill onClick={() => ifile.current?.click()} />
              <RoundButton text="Use These Colors" style="primary" height={34} fill onClick={() => { if (found.length < 2) { setNote("Need at least two colors."); return; } hist.current.push(cur()); useStore.getState().applyPaletteColors(found.map((c) => normHex(c)!)); setNote(`Imported ${found.length} colors.`); }} />
            </div>
          </div>
        )}
      </div>
      <input ref={file} hidden type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) readImage(f); }} />
      <div style={{ marginTop: 8, minHeight: 16 }}><Label dim size={9}>{note}</Label></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
        <RoundButton text="Undo" height={34} fill onClick={() => { const p = hist.current.pop(); if (!p) { setNote("Nothing to undo."); return; } useStore.getState().applyPaletteColors(p); setNote("Undone."); }} />
        <RoundButton text="Close" height={34} fill onClick={() => s.set({ dialog: null })} />
      </div>
    </Dialog>
  );
}
