// Gradient Gen - Copyright (c) 2026 AK Nihad (Nihad Square). All rights reserved.
// Source-available, not open source: see LICENSE. Copying or reuse is not permitted without written permission.
// The desktop's "Color Contrast" window: Pair / Palette / On Picture
import { useEffect, useMemo, useRef, useState } from "react";
import { contrastRatio, fixContrast, luminance, normHex } from "../engine/color";
import { renderGradient } from "../engine/render";
import { lookOf, toSettings, useStore } from "../store/useStore";
import { blend } from "../lib/colorutil";
import { ColorSwatch, Dialog, Label, RoundButton, RoundCombo, RoundEntry, Segmented } from "./widgets";

const TABS = ["Pair", "Palette", "On Picture"] as const;
type Tab = (typeof TABS)[number];
const LEVELS: [string, number][] = [["Normal text  AA", 4.5], ["Normal text  AAA", 7], ["Large text  AA", 3], ["Large text  AAA", 4.5], ["UI components  AA", 3]];
const PAL_LEVELS: Record<string, number> = { "Large Text AA  (3:1)": 3, "Normal Text AA  (4.5:1)": 4.5, "Normal Text AAA  (7:1)": 7 };
const PIC_LEVELS: Record<string, number> = { "Normal Text  (4.5:1)": 4.5, "Large Text  (3:1)": 3 };
const ratioText = (r: number) => (Math.floor(r * 100) / 100).toFixed(2);
const css = (n: string) => `rgb(var(--${n}))`;
const themeVar = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(`--${n}`).trim().split(/\s+/).map(Number);
const themeHex = (n: string) => "#" + themeVar(n).map((v) => v.toString(16).padStart(2, "0")).join("");

function NativeColor({ value, onPick, width = 34 }: { value: string; onPick: (hex: string) => void; width?: number }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <ColorSwatch color={normHex(value) ?? "#FFFFFF"} label="" width={width} height={30} tip="Choose a color" onClick={() => ref.current?.click()} />
      <input ref={ref} type="color" value={(normHex(value) ?? "#FFFFFF").toLowerCase()} onChange={(e) => onPick(e.target.value.toUpperCase())} style={{ position: "absolute", left: 0, bottom: 0, width: 0, height: 0, opacity: 0, pointerEvents: "none" }} tabIndex={-1} aria-hidden="true" />
    </span>
  );
}

function Chips({ palette, value, onPick }: { palette: string[]; value: string; onPick: (c: string) => void }) {
  const cur = normHex(value);
  const edgeOff = blend(themeHex("ink"), themeHex("surface"), 0.3);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 22px)", gap: 4, marginTop: 8 }}>
      {palette.map((c, i) => {
        const sel = cur === c;
        return <button key={c + i} aria-label={c} onClick={() => onPick(c)} style={{ width: 22, height: 22, borderRadius: 7, background: c, border: `${sel ? 3 : 1}px solid ${sel ? css("accent") : edgeOff}`, padding: 0, cursor: "pointer", boxSizing: "border-box" }} />;
      })}
    </div>
  );
}

export function ContrastDialog() {
  const s = useStore();
  const num = s.num;
  const palette = useMemo(() => s.colors.slice(0, num).map((c) => c.toUpperCase()), [s.colors, num]);
  const [tab, setTab] = useState<Tab>("Pair");
  const [v1, setV1] = useState(normHex(s.contrast1) ?? palette[0]);
  const [v2, setV2] = useState(normHex(s.contrast2) ?? palette[palette.length - 1]);
  const [note, setNote] = useState("");
  const [txt, setTxt] = useState("The quick brown fox");
  const [size, setSize] = useState<"Normal" | "Large" | "Bold">("Normal");
  const a = normHex(v1), b = normHex(v2);
  const close = () => s.set({ dialog: null });
  const setPalette = (cols: string[]) => { s.applyPaletteColors([...cols, ...s.colors.slice(cols.length, num)].slice(0, Math.max(num, cols.length))); };

  // ── Pair
  const r = a && b ? contrastRatio(a, b) : 0;
  const applyFix = (which: 1 | 2, nw: string) => {
    const old = which === 1 ? v1 : v2;
    which === 1 ? setV1(nw) : setV2(nw);
    const i = palette.indexOf((normHex(old) ?? old).toUpperCase());
    if (i >= 0) { setPalette(palette.map((c, k) => (k === i ? nw : c))); setNote(`Color ${i + 1} in the palette is now ${nw}.`); } else setNote("Changed in this window only (that color is not in the palette).");
  };
  const fixes: { which: 1 | 2; sug: string; name: string; other: string }[] = [];
  if (a && b) for (const [tgt, name] of [[4.5, "AA"], [7, "AAA"]] as [number, string][]) {
    if (r >= tgt) continue;
    for (const [which, chg, oth] of [[1, a, b], [2, b, a]] as [1 | 2, string, string][]) { const sug = fixContrast(chg, oth, tgt); if (sug) fixes.push({ which, sug, name, other: oth }); }
  }
  const [fs, bold] = size === "Large" ? [24, false] : size === "Bold" ? [14.67, true] : [14.67, false];

  // ── Palette
  const txtModes = ["Best of Black / White", "White", "Black", ...Array.from(new Set(palette))];
  const [tm, setTm] = useState(txtModes[0]);
  const [lvl, setLvl] = useState("Normal Text AA  (4.5:1)");
  const fixHist = useRef<string[][]>([]);
  const tmv = txtModes.includes(tm) ? tm : txtModes[0];
  const textFor = (c: string) => tmv === "White" ? "#FFFFFF" : tmv === "Black" ? "#000000" : tmv.startsWith("#") ? (normHex(tmv) ?? "#FFFFFF") : contrastRatio(c, "#FFFFFF") >= contrastRatio(c, "#000000") ? "#FFFFFF" : "#000000";
  const needP = PAL_LEVELS[lvl] ?? 4.5;
  const tiles = palette.map((c) => { const tx = textFor(c), rr = contrastRatio(c, tx); return { c, tx, rr, ok: rr >= needP }; });
  const bad = tiles.filter((t) => !t.ok).length;
  const fixPalette = () => {
    let changed = 0; const nw = [...palette];
    tiles.forEach((t, i) => { if (t.c === t.tx || t.ok) return; const f = fixContrast(t.c, t.tx, needP); if (f && f.toUpperCase() !== t.c) { nw[i] = f.toUpperCase(); changed++; } });
    if (!changed) { setNote("Nothing to fix: every color already passes."); return; }
    fixHist.current.push([...palette]); setPalette(nw);
    setNote(`Adjusted ${changed} color${changed !== 1 ? "s" : ""} in the Colors card. Undo fix goes back.`);
  };
  const undoFix = () => { const h = fixHist.current.pop(); if (!h) { setNote("Nothing to undo."); return; } setPalette(h); setNote("Went back to the colors before the last fix."); };

  // ── On picture
  const ptModes = [...Array.from(new Set(palette)), "White", "Black"];
  const [pt, setPt] = useState(palette[0]);
  const [plv, setPlv] = useState("Normal Text  (4.5:1)");
  const ptv = ptModes.includes(pt) ? pt : ptModes[0];
  const cvs = useRef<HTMLCanvasElement>(null);
  const [rows, setRows] = useState<{ nm: string; worst: number; typ: number; ok: boolean }[]>([]);
  const look = JSON.stringify([lookOf(s), s.overlay.background, s.width, s.height]);
  useEffect(() => {
    if (tab !== "On Picture") return;
    try {
      const ow = Math.max(1, parseInt(s.width, 10) || 1920), oh = Math.max(1, parseInt(s.height, 10) || 1080);
      const k = Math.min(360 / ow, 200 / oh), w = Math.max(40, Math.floor(ow * k)), h = Math.max(40, Math.floor(oh * k));
      const px = renderGradient(toSettings(lookOf(s)), w, h);
      const bg = s.overlay.background === "Black" ? 0 : 255;
      const L = new Float32Array(w * h);
      const lin = (v: number) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      const flat = new Uint8ClampedArray(px.data.length);
      for (let i = 0; i < w * h; i++) {
        const al = px.data[i * 4 + 3] / 255, c = [0, 1, 2].map((q) => px.data[i * 4 + q] * al + bg * (1 - al));
        flat[i * 4] = c[0]; flat[i * 4 + 1] = c[1]; flat[i * 4 + 2] = c[2]; flat[i * 4 + 3] = 255;
        L[i] = 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
      }
      const hexc = normHex(ptv) ?? (ptv === "Black" ? "#000000" : "#FFFFFF"), lt = luminance(hexc), need = PIC_LEVELS[plv] ?? 4.5;
      const bw = Math.floor(w * 0.36), bh = Math.floor(h * 0.16), m = Math.floor(w * 0.04);
      const spots: [string, number, number][] = [["Top-left", m, m], ["Top-right", w - m - bw, m], ["Center", Math.floor((w - bw) / 2), Math.floor((h - bh) / 2)], ["Bottom-left", m, h - m - bh], ["Bottom-right", w - m - bw, h - m - bh]];
      const c = cvs.current!; c.width = w; c.height = h;
      const g = c.getContext("2d")!; g.putImageData(new ImageData(flat, w, h), 0, 0);
      const out: typeof rows = [];
      for (const [nm, x0, y0] of spots) {
        const vals: number[] = [];
        for (let y = y0; y < y0 + bh; y++) for (let x = x0; x < x0 + bw; x++) { const l = L[y * w + x]; vals.push((Math.max(l, lt) + 0.05) / (Math.min(l, lt) + 0.05)); }
        vals.sort((p, q) => p - q);
        const worst = vals[0], typ = vals.length % 2 ? vals[(vals.length - 1) / 2] : (vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2, ok = worst >= need;
        out.push({ nm, worst, typ, ok });
        g.lineWidth = 2; g.strokeStyle = themeHex(ok ? "ok" : "bad"); g.strokeRect(x0 + 1, y0 + 1, bw - 2, bh - 2);
        g.fillStyle = hexc; g.font = "700 16px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("Aa", x0 + bw / 2, y0 + bh / 2);
      }
      setRows(out);
      const worstAll = Math.min(...out.map((o) => o.worst));
      setNote(worstAll >= need ? "Readable everywhere we tested." : `Hard to read in some places (worst ${worstAll.toFixed(1)}:1). Try another text color or a text box.`);
    } catch (e) { setNote(`Could not render the picture: ${(e as Error).message}`); }
  }, [tab, ptv, plv, look]);
  useEffect(() => { if (tab !== "On Picture") return; }, [tab]);
  useEffect(() => { s.set({ contrast1: v1, contrast2: v2 }); }, [v1, v2]);

  return (
    <Dialog title="Color Contrast" width={470} onClose={close}>
      <Label size={13} bold>Color contrast</Label>
      <div style={{ marginTop: 10 }}><Segmented value={tab} options={TABS} segWidth={110} onChange={(t) => { setTab(t); setNote(""); }} /></div>
      <div style={{ marginTop: 12, minHeight: 440 }}>
        {tab === "Pair" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "start" }}>
              {[[v1, setV1, "Color 1"], [null], [v2, setV2, "Color 2"]].map((cfg, i) => i === 1 ? (
                <div key="sw" style={{ padding: "20px 10px 0" }}><RoundButton text="↔" height={30} width={40} onClick={() => { setV1(v2); setV2(v1); }} label="Swap colors" /></div>
              ) : (
                <div key={i}>
                  <div style={{ marginBottom: 4 }}><Label dim size={9}>{cfg[2] as string}</Label></div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <NativeColor value={cfg[0] as string} onPick={cfg[1] as (v: string) => void} />
                    <div style={{ flex: 1 }}><RoundEntry value={cfg[0] as string} width={8} center={false} label={cfg[2] as string} onChange={(v) => (cfg[1] as (v: string) => void)(v.toUpperCase())} style={{ width: "100%" }} /></div>
                  </div>
                  <Chips palette={palette} value={cfg[0] as string} onPick={cfg[1] as (v: string) => void} />
                </div>
              ))}
            </div>
            <div style={{ margin: "14px 0 4px", fontSize: 34.667, fontWeight: 700, lineHeight: 1.2 }}>{a && b ? `${ratioText(r)}:1` : "—"}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto" }}>
              {LEVELS.map(([nm, need]) => (<><Label key={nm} dim size={9}>{`${nm}  (≥ ${need}:1)`}</Label><span key={nm + "r"} style={{ fontWeight: 700, fontSize: 12, textAlign: "right", color: a && b ? css(r >= need ? "ok" : "bad") : css("dim") }}>{a && b ? (r >= need ? "Pass" : "Fail") : ""}</span></>))}
            </div>
            <div style={{ margin: "14px 0 6px" }}><Label dim size={8} bold>PREVIEW</Label></div>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}><RoundEntry value={txt} width={16} center={false} label="Preview text" onChange={setTxt} style={{ width: "100%" }} /></div>
              <Segmented value={size} options={["Normal", "Large", "Bold"] as const} segWidth={62} height={32} onChange={setSize} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
              {[[a, b], [b, a]].map(([bgc, fgc], k) => <div key={k} style={{ background: bgc ?? css("surface2"), color: fgc ?? css("ink"), padding: "14px 6px", textAlign: "center", fontSize: fs, fontWeight: bold ? 700 : 400, wordBreak: "break-word", whiteSpace: "pre-wrap" }}>{txt || " "}</div>)}
            </div>
            <div style={{ margin: "14px 0 6px" }}><Label dim size={8} bold>FIX SUGGESTIONS</Label></div>
            {!a || !b ? <Label dim size={9}>Type two valid hex colors (like #1A2B3C).</Label> : fixes.length === 0 ? <Label size={9} style={{ color: css("ok") }}>Normal text already passes AAA. Nothing to fix.</Label> : (
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", rowGap: 4 }}>
                {fixes.map((f, i) => (<>
                  <span key={"a" + i} style={{ marginRight: 10 }}><ColorSwatch color={f.sug} label={f.sug} width={84} height={30} /></span>
                  <Label key={"b" + i} size={9}>{`Color ${f.which} for ${f.name}  (${contrastRatio(f.sug, f.other).toFixed(2)}:1)`}</Label>
                  <RoundButton key={"c" + i} text="Apply" height={28} width={70} size={9} onClick={() => applyFix(f.which, f.sug)} />
                </>))}
              </div>
            )}
          </div>
        )}
        {tab === "Palette" && (
          <div>
            <Label dim size={9}>Check text color on each color from your palette. Red outline = fails the level.</Label>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", rowGap: 8, marginTop: 10, alignItems: "center" }}>
              <Label dim style={{ marginRight: 10 }}>Text Color</Label><div><RoundCombo value={tmv} values={txtModes} width={19} swatches label="Text color" onChange={setTm} /></div>
              <Label dim style={{ marginRight: 10 }}>Level</Label><div><RoundCombo value={lvl} values={Object.keys(PAL_LEVELS)} width={22} label="Level" onChange={setLvl} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 66px)", gap: 6, marginTop: 14 }}>
              {tiles.map((t, i) => (
                <div key={i} style={{ position: "relative", width: 66, height: 48, borderRadius: 10, background: t.c, boxSizing: "border-box", border: `${t.ok ? 1 : 3}px solid ${t.ok ? blend(themeHex("ink"), themeHex("surface"), 0.25) : css("bad")}`, color: t.tx, textAlign: "center" }}>
                  <div style={{ position: "absolute", left: 0, right: 0, top: 6, fontWeight: 700, fontSize: 17.333 }}>Aa</div>
                  <div style={{ position: "absolute", left: 0, right: 0, bottom: 3, fontWeight: 700, fontSize: 10.667 }}>{t.rr.toFixed(1)}:1</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, fontWeight: 700 }}>{bad === 0 ? "Every color passes." : `${palette.length - bad} of ${palette.length} pass, ${bad} fail.`}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
              <RoundButton text="Fix Palette" icon="sparkle" style="primary" height={34} fill onClick={fixPalette} />
              <RoundButton text="Undo Fix" height={34} fill onClick={undoFix} />
            </div>
            <div style={{ marginTop: 8 }}><Label dim size={9}>Fix palette changes only the lightness of the colors that fail (hue and saturation stay), for the text color and level above.</Label></div>
          </div>
        )}
        {tab === "On Picture" && (
          <div>
            <Label dim size={9}>Tests a text box at five places on your current picture and reports the worst contrast found under it.</Label>
            <div style={{ display: "grid", gridTemplateColumns: "auto auto 1fr", rowGap: 8, marginTop: 10, alignItems: "center" }}>
              <Label dim style={{ marginRight: 10 }}>Text Color</Label><RoundCombo value={ptv} values={ptModes} width={11} swatches label="Text color" onChange={setPt} />
              <span style={{ marginLeft: 8 }}><ColorSwatch color={normHex(ptv) ?? (ptv === "Black" ? "#000000" : "#FFFFFF")} label="" width={34} height={30} /></span>
              <Label dim style={{ marginRight: 10 }}>Needs</Label><div style={{ gridColumn: "2 / 4" }}><RoundCombo value={plv} values={Object.keys(PIC_LEVELS)} width={18} label="Needs" onChange={setPlv} /></div>
            </div>
            <canvas ref={cvs} style={{ display: "block", marginTop: 12, maxWidth: "100%" }} aria-label="The picture with five text boxes" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", marginTop: 10, alignItems: "center" }}>
              {rows.map((o) => (<><Label key={o.nm} dim size={9}>{o.nm}</Label><span key={o.nm + "a"} style={{ fontSize: 12, textAlign: "right", margin: "0 12px 0 0" }}>{`worst ${o.worst.toFixed(1)}:1    typical ${o.typ.toFixed(1)}:1`}</span><span key={o.nm + "b"} style={{ fontSize: 12, fontWeight: 700, width: 44, textAlign: "right", color: css(o.ok ? "ok" : "bad") }}>{o.ok ? "Pass" : "Fail"}</span></>))}
            </div>
          </div>
        )}
      </div>
      <div style={{ minHeight: 18, marginTop: 8 }}><Label dim size={9}>{note}</Label></div>
      <div style={{ marginTop: 10 }}><RoundButton text="Close" style="primary" height={36} fill onClick={close} /></div>
    </Dialog>
  );
}
