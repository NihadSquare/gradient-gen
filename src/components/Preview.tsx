// The picture area: fitted to the card (14 px padding), wheel = zoom, drag = pan, guides on top.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { compose } from "../lib/compose";
import { logoState } from "../lib/logo";
import { drawPaletteCanvas } from "../lib/palettePicture";
import { Superseded, previewSlot } from "../lib/renderClient";
import { lookOf, toSettings, useStore } from "../store/useStore";

const PAD = 14;

function Guides({ mode, w, h }: { mode: string; w: number; h: number }) {
  const m = mode.toLowerCase();
  if (m === "off") return null;
  const lines: [number, number, number, number][] = [];
  const rects: [number, number, number, number][] = [];
  let label: { x: number; y: number; t: string } | null = null;
  if (m === "thirds" || m === "golden ratio") {
    for (const k of m === "thirds" ? [1 / 3, 2 / 3] : [0.382, 0.618]) { lines.push([w * k, 0, w * k, h], [0, h * k, w, h * k]); }
  } else if (m === "centre cross") lines.push([w / 2, 0, w / 2, h], [0, h / 2, w, h / 2]);
  else if (m.startsWith("safe")) rects.push([w * 0.05, h * 0.05, w * 0.95, h * 0.95]);
  else if (m.startsWith("crop")) {
    const [a, b] = mode.split(" ")[1].split(":").map(Number), ratio = a / b;
    const [cw, ch] = w / h > ratio ? [h * ratio, h] : [w, w / ratio];
    const x0 = (w - cw) / 2, y0 = (h - ch) / 2;
    rects.push([x0, y0, x0 + cw, y0 + ch]); label = { x: x0 + 8, y: y0 + 6, t: mode.split(" ")[1] };
  }
  return (
    <svg width={w} height={h} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }} aria-hidden="true">
      {lines.map((l, i) => <g key={"l" + i}><line x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} stroke="#000" strokeOpacity=".5" strokeWidth="3" /><line x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} stroke="#fff" strokeWidth="1" strokeDasharray="5 4" /></g>)}
      {rects.map((r, i) => <g key={"r" + i}><rect x={r[0]} y={r[1]} width={r[2] - r[0]} height={r[3] - r[1]} fill="none" stroke="#000" strokeOpacity=".5" strokeWidth="3" /><rect x={r[0]} y={r[1]} width={r[2] - r[0]} height={r[3] - r[1]} fill="none" stroke="#fff" strokeWidth="1" strokeDasharray="5 4" /></g>)}
      {label && <g fontSize="13.333"><text x={label.x + 1} y={label.y + 13} fill="#000">{label.t}</text><text x={label.x} y={label.y + 12} fill="#fff">{label.t}</text></g>}
    </svg>
  );
}

export function PreviewArea({ fullscreen = false }: { fullscreen?: boolean }) {
  const keyStr = useStore((s) => JSON.stringify([toSettings(lookOf(s)), s.overlay, s.showPalette, s.logoStamp, s.reverse, s.colors.slice(0, s.num), s.opacities.slice(0, s.num)]));
  const zoomRaw = useStore((s) => s.zoom), offX = useStore((s) => s.offX), offY = useStore((s) => s.offY);
  const wTxt = useStore((s) => s.width), hTxt = useStore((s) => s.height), guides = useStore((s) => s.guides);
  const set = useStore((s) => s.set);
  const box = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hasAlpha, setHasAlpha] = useState(false);
  const cache = useRef<{ key: string; img: HTMLCanvasElement; alpha: boolean } | null>(null);
  const zoom = fullscreen ? 1 : Math.max(1, zoomRaw);

  useLayoutEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const ow = Math.max(1, parseInt(wTxt, 10) || 16), oh = Math.max(1, parseInt(hTxt, 10) || 9);
  const pad = fullscreen ? 0 : PAD;
  const cw = Math.max(size.w - 2 * pad, 60), ch = Math.max(size.h - 2 * pad, 60), aspect = ow / oh;
  const [dw, dh] = cw / ch <= aspect ? [cw, Math.max(1, Math.round(cw / aspect))] : [Math.max(1, Math.round(ch * aspect)), ch];
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  useEffect(() => {
    if (!size.w || !box.current) return;
    let pw = Math.max(1, Math.round(dw * dpr)), ph = Math.max(1, Math.round(dh * dpr));
    const long = Math.max(pw, ph); if (long > 1600) { pw = Math.max(1, Math.round((pw * 1600) / long)); ph = Math.max(1, Math.round((ph * 1600) / long)); }
    let rw = Math.round(pw * zoom), rh = Math.round(ph * zoom);
    if (rw * rh > 6_000_000) { const f = Math.sqrt(6_000_000 / (rw * rh)); rw = Math.round(rw * f); rh = Math.round(rh * f); }
    const key = `${keyStr}|${rw}x${rh}`;
    let alive = true;
    const draw = (full: HTMLCanvasElement, alpha: boolean) => {
      const c = cv.current; if (!c || !alive) return;
      const k = rw / (pw * zoom), mx = (dw * (zoom - 1)) / 2 / zoom, my = (dh * (zoom - 1)) / 2 / zoom;
      const ox = Math.max(-mx, Math.min(mx, offX)), oy = Math.max(-my, Math.min(my, offY));
      const vw = pw * k, vh = ph * k;
      const left = Math.max(0, Math.min(rw - vw, (rw - vw) / 2 - ox * zoom * (pw / dw) * k)), top = Math.max(0, Math.min(rh - vh, (rh - vh) / 2 - oy * zoom * (ph / dh) * k));
      c.width = pw; c.height = ph;
      const g = c.getContext("2d")!; g.imageSmoothingQuality = "high"; g.clearRect(0, 0, pw, ph);
      g.drawImage(full, left, top, vw, vh, 0, 0, pw, ph);
      setHasAlpha(alpha);
    };
    if (cache.current?.key === key) { draw(cache.current.img, cache.current.alpha); return () => { alive = false; }; }
    const st = useStore.getState();
    st.say("Generating...");
    const timer = window.setTimeout(async () => {
      try {
        let full: HTMLCanvasElement, alpha = false;
        if (st.showPalette) { full = drawPaletteCanvas(rw, rh); }
        else {
          const px = await previewSlot.render(toSettings(lookOf(useStore.getState())), rw, rh);
          for (let i = 3; i < px.data.length; i += 4 * 7) if (px.data[i] < 255) { alpha = true; break; }
          full = compose(px, useStore.getState().overlay, logoState.image);
          if (useStore.getState().overlay.background !== "Transparent") alpha = false;
        }
        if (!alive) return;
        cache.current = { key, img: full, alpha };
        draw(full, alpha); useStore.getState().say("Ready");
      } catch (e) { if (e instanceof Superseded || !alive) return; useStore.getState().say(`Error: ${(e as Error).message}`); }
    }, 25);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [keyStr, dw, dh, zoom, offX, offY, size.w, dpr]);

  // wheel = zoom (0.1 steps), drag = pan
  useEffect(() => {
    const el = box.current; if (!el || fullscreen) return;
    const wheel = (e: WheelEvent) => { e.preventDefault(); const z = useStore.getState().zoom; set({ zoom: Math.round(Math.min(4, Math.max(1, z + (e.deltaY < 0 ? 0.1 : -0.1))) * 10) / 10 }); };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [fullscreen, set]);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const left = (size.w - dw) / 2, top = (size.h - dh) / 2;
  const showTransparency = hasAlpha;
  return (
    <div ref={box} style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", cursor: zoom > 1 && !fullscreen ? "grab" : "default", touchAction: "none" }}
      onPointerDown={(e) => { if (fullscreen) return; drag.current = { x: e.clientX, y: e.clientY }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
      onPointerMove={(e) => { const d = drag.current, z = useStore.getState().zoom; if (!d || z <= 1) return; set({ offX: useStore.getState().offX + (e.clientX - d.x) / z, offY: useStore.getState().offY + (e.clientY - d.y) / z }); drag.current = { x: e.clientX, y: e.clientY }; }}
      onPointerUp={() => { drag.current = null; }}>
      <div className={showTransparency ? "checker" : ""} style={{ position: "absolute", left, top, width: dw, height: dh, borderRadius: fullscreen ? 0 : 10, overflow: "hidden" }}>
        <canvas ref={cv} style={{ display: "block", width: "100%", height: "100%" }} role="img" aria-label="Gradient preview" />
      </div>
      {!fullscreen && zoom <= 1.001 && guides !== "Off" && <div style={{ position: "absolute", left, top, width: dw, height: dh }}><Guides mode={guides} w={dw} h={dh} /></div>}
    </div>
  );
}
