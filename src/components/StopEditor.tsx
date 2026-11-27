// Gradient Gen - Copyright (c) 2026 AK Nihad (Nihad Square). All rights reserved.
// Source-available, not open source: see LICENSE. Copying or reuse is not permitted without written permission.
import { useEffect, useRef, useState } from "react";
import { rgbToHex, BLEND_MODES, TRANSITIONS, type BlendMode, type Transition } from "../engine/color";
import { rampLut } from "../engine/render";
import { contrastTextOn } from "../lib/colorutil";
import { lookOf, toSettings, useStore } from "../store/useStore";
import { Label, PillSlider, RoundButton, RoundCombo, ColorSwatch } from "./widgets";

const BAR_Y = 6, BAR_H = 18, PAD = 12, H = 46;

/** Gradient strip with numbered dots (the desktop's StopBar). */
export function StopBar() {
  const s = useStore();
  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const [w, setW] = useState(0);
  const drag = useRef<number | null>(null);
  useEffect(() => { const el = wrap.current!; const ro = new ResizeObserver(() => setW(el.clientWidth)); ro.observe(el); setW(el.clientWidth); return () => ro.disconnect(); }, []);
  const x = (p: number) => PAD + p * Math.max(1, w - 2 * PAD);
  const pOf = (px: number) => Math.min(1, Math.max(0, (px - PAD) / Math.max(1, w - 2 * PAD)));
  const lookKey = JSON.stringify([s.colors.slice(0, s.num), s.positions.slice(0, s.num), s.opacities.slice(0, s.num), s.trans.slice(0, s.num), s.blend, s.reverse]);
  useEffect(() => {
    const c = cv.current; if (!c || w < 60) return;
    const bw = w - 2 * PAD; c.width = bw; c.height = BAR_H;
    const lut = rampLut({ ...toSettings(lookOf(useStore.getState())), reverse: false });
    const img = new ImageData(bw, BAR_H);
    for (let i = 0; i < bw; i++) {
      const li = Math.round((i / Math.max(1, bw - 1)) * (lut.length / 4 - 1)) * 4, a = lut[li + 3] / 255;
      for (let j = 0; j < BAR_H; j++) {
        const ch = (((i / 6) | 0) + ((j / 6) | 0)) % 2 ? 255 : 204, o = (j * bw + i) * 4;
        img.data[o] = lut[li] * a + ch * (1 - a); img.data[o + 1] = lut[li + 1] * a + ch * (1 - a); img.data[o + 2] = lut[li + 2] * a + ch * (1 - a); img.data[o + 3] = 255;
      }
    }
    c.getContext("2d")!.putImageData(img, 0, 0);
  }, [w, lookKey]);
  const hy = BAR_Y + BAR_H + 11;
  const hit = (px: number, py: number) => {
    let best: number | null = null, dist = 11;
    for (let i = 0; i < s.num; i++) { const d = Math.hypot(px - x(s.positions[i]), py - hy); if (d <= dist) { best = i; dist = d; } }
    if (best === null && py >= BAR_Y && py <= BAR_Y + BAR_H) for (let i = 0; i < s.num; i++) if (Math.abs(px - x(s.positions[i])) <= 6) best = i;
    return best;
  };
  const local = (e: { clientX: number; clientY: number }) => { const r = wrap.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const; };
  return (
    <div ref={wrap} style={{ position: "relative", height: H, cursor: "pointer", touchAction: "none" }}
      onPointerDown={(e) => { if (e.button !== 0) return; const [px, py] = local(e); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); const i = hit(px, py); if (i !== null) { drag.current = i; s.selectStop(i); } else if (py >= BAR_Y && py <= BAR_Y + BAR_H + 2) s.addStop(Math.round(pOf(px) * 1000) / 1000); }}
      onPointerMove={(e) => { if (drag.current !== null && e.buttons & 1) s.setPos(drag.current, Math.round(pOf(local(e)[0]) * 1000) / 1000); }}
      onPointerUp={() => { drag.current = null; }}
      onDoubleClick={(e) => { const [px, py] = local(e); const i = hit(px, py); if (i !== null) { drag.current = null; s.set({ colorIndex: i, dialog: "color" }); } }}
      onContextMenu={(e) => { e.preventDefault(); const [px, py] = local(e); const i = hit(px, py); if (i !== null) s.removeStop(i); }}>
      <canvas ref={cv} style={{ position: "absolute", left: PAD, top: BAR_Y, width: Math.max(0, w - 2 * PAD), height: BAR_H, borderRadius: 6 }} />
      {w >= 60 && Array.from({ length: s.num }, (_, i) => i).sort((a, b) => Number(a === s.sel) - Number(b === s.sel)).map((i) => {
        const sel = i === s.sel, col = s.colors[i].toUpperCase(), px = x(s.positions[i]), rc = sel ? "rgb(var(--accent))" : "rgb(var(--ink))";
        return (
          <div key={i}>
            <div style={{ position: "absolute", left: px, top: BAR_Y + BAR_H, width: 1, height: hy - 6 - (BAR_Y + BAR_H), background: "rgb(var(--dim))" }} />
            <div role="button" aria-label={`Color ${i + 1}, ${col}`} style={{ position: "absolute", left: px - 11, top: hy - 11, width: 22, height: 22, borderRadius: "50%", background: col, boxShadow: `0 0 0 ${sel ? 3 : 2}px ${rc} inset`, color: contrastTextOn(col), fontSize: 10.667, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</div>
          </div>
        );
      })}
    </div>
  );
}

export function Chips() {
  const s = useStore();
  const ref = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(330);
  useEffect(() => { const el = ref.current!; const ro = new ResizeObserver(() => setW(el.clientWidth || 330)); ro.observe(el); setW(el.clientWidth || 330); return () => ro.disconnect(); }, []);
  const n = Math.max(1, s.num), gap = n > 8 ? 4 : 5, cw = Math.max(16, Math.min(46, Math.floor((W - 4 - (n - 1) * gap) / n))), ch = 22;
  return (
    <div ref={ref} style={{ position: "relative", height: 28, marginBottom: 8, cursor: "pointer" }}>
      {Array.from({ length: s.num }, (_, i) => {
        const sel = i === s.sel;
        return <div key={i} role="button" aria-label={`Select color ${i + 1}`} onClick={() => s.selectStop(i)} style={{ position: "absolute", left: 2 + i * (cw + gap), top: 3, width: cw, height: ch, borderRadius: 7, background: s.colors[i].toUpperCase(), border: `${sel ? 3 : 1}px solid ${sel ? "rgb(var(--accent))" : "color-mix(in srgb, rgb(var(--ink)) 30%, rgb(var(--surface)))"}` }} />;
      })}
    </div>
  );
}

/** the editor of the selected color + the three buttons */
export function StopEditor() {
  const s = useStore();
  const i = Math.min(s.sel, s.num - 1);
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "auto auto 1fr auto auto", alignItems: "center" }}>
        <span style={{ gridColumn: 1, marginRight: 10 }}><Label bold>Stop {i + 1}</Label></span>
        <span style={{ gridColumn: 2 }}><ColorSwatch color={s.colors[i]} width={104} height={30} tip="Click to change this color" onClick={() => s.set({ colorIndex: i, dialog: "color" })} /></span>
        <span style={{ gridColumn: 4, marginLeft: 8 }}><Label dim>Opacity</Label></span>
        <span style={{ gridColumn: 5 }}><RoundCombo value={String(Math.round(s.opacities[i] * 100))} values={Array.from({ length: 11 }, (_, k) => String(k * 10))} width={4} center height={28} tip="Opacity of this color (%)" onChange={(v) => s.setOpacity(i, Number(v) / 100)} /></span>
        <span style={{ gridRow: 2, gridColumn: 1, marginTop: 8 }}><Label dim>Position</Label></span>
        <span style={{ gridRow: 2, gridColumn: "2 / 5", marginTop: 8, paddingLeft: 4 }}><PillSlider value={Math.round(s.positions[i] * 1000) / 10} min={0} max={100} onChange={(v) => s.setPos(i, v / 100)} tip="Where this color sits on the bar" label="Position" /></span>
        <span style={{ gridRow: 2, gridColumn: 5, marginTop: 8, textAlign: "right", width: 38, justifySelf: "end" }}><Label dim size={9}>{Math.round(s.positions[i] * 100)}%</Label></span>
        <span style={{ gridRow: 3, gridColumn: 1, marginTop: 8 }}><Label dim>Blend in</Label></span>
        <span style={{ gridRow: 3, gridColumn: 2, marginTop: 8 }}><RoundCombo value={s.blend} values={BLEND_MODES} width={7} center tip="Color used to mix with other colors." onChange={(v) => s.set({ blend: v as BlendMode, dirty: true })} /></span>
        <span style={{ gridRow: 3, gridColumn: 4, margin: "8px 4px 0 8px" }}><Label dim>To next</Label></span>
        <span style={{ gridRow: 3, gridColumn: 5, marginTop: 8 }}><RoundCombo value={s.trans[i]} values={TRANSITIONS} width={6} center tip="How two colors blend." onChange={(v) => s.setTrans(i, v as Transition)} /></span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4, marginTop: 8 }}>
        <RoundButton text="+ Add Color" height={30} fill size={9} onClick={s.addColorGap} />
        <RoundButton text="Spread Evenly" height={30} fill size={9} onClick={s.spreadStops} />
        <RoundButton text="Delete Stop" height={30} fill size={9} onClick={() => s.removeStop(i)} />
      </div>
    </>
  );
}
export { rgbToHex };
