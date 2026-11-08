import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { compose } from "../lib/compose";
import { logoState } from "../lib/logo";
import { Superseded, previewSlot } from "../lib/renderClient";
import { useStore } from "../store/useStore";
import { Icon } from "./ui";

function Guides({ mode }: { mode: string }) {
  if (mode === "Off") return null;
  const line = (x1: number, y1: number, x2: number, y2: number, k: string) => <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} vectorEffect="non-scaling-stroke" />;
  const items: JSX.Element[] = [];
  if (mode === "Thirds" || mode === "Golden ratio") {
    const f = mode === "Thirds" ? [100 / 3, 200 / 3] : [38.2, 61.8];
    f.forEach((v, i) => items.push(line(v, 0, v, 100, "v" + i), line(0, v, 100, v, "h" + i)));
  } else if (mode === "Centre cross") items.push(line(50, 0, 50, 100, "v"), line(0, 50, 100, 50, "h"));
  else if (mode.startsWith("Safe")) items.push(<rect key="r" x="5" y="5" width="90" height="90" fill="none" vectorEffect="non-scaling-stroke" />);
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" stroke="white" strokeWidth="1.2" strokeOpacity=".85" style={{ filter: "drop-shadow(0 0 1px rgba(0,0,0,.9))" }}>
      {items}
    </svg>
  );
}

function CropGuide({ mode, w, h }: { mode: string; w: number; h: number }) {
  const m = mode.match(/^Crop (\d+):(\d+)$/);
  if (!m) return null;
  const ratio = +m[1] / +m[2];
  const cw = w / h > ratio ? (h * ratio) / w : 1, ch = w / h > ratio ? 1 : w / ratio / h;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="border-2 border-white/90" style={{ width: `${cw * 100}%`, height: `${ch * 100}%`, boxShadow: "0 0 0 9999px rgba(0,0,0,.45)" }} />
    </div>
  );
}

export function Preview({ fullscreen = false }: { fullscreen?: boolean }) {
  const { settings, overlay, width, height, guides, zoom, logoStamp, set, busy } = useStore();
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [avail, setAvail] = useState({ w: 0, h: 0 });
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState("");
  const z = fullscreen ? 1 : zoom;

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAvail({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setAvail({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const pad = fullscreen ? 0 : 24;
  const aw = Math.max(80, avail.w - pad * 2), ah = Math.max(80, avail.h - pad * 2);
  const fit = Math.min(aw / width, ah / height);
  const dw = Math.max(1, Math.floor(width * fit * z)), dh = Math.max(1, Math.floor(height * fit * z));

  useEffect(() => {
    if (!avail.w) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let rw = Math.round(dw * dpr), rh = Math.round(dh * dpr);
    const longest = Math.max(rw, rh), cap = 2200;
    if (longest > cap) { rw = Math.round((rw * cap) / longest); rh = Math.round((rh * cap) / longest); }
    rw = Math.max(1, Math.min(rw, width)); rh = Math.max(1, Math.round((rw * height) / width));
    let alive = true;
    const id = requestAnimationFrame(() => {
      setRendering(true);
      previewSlot.render(settings, rw, rh).then((px) => {
        if (!alive) return;
        const out = compose(px, overlay, logoState.image);
        const c = canvas.current;
        if (c) {
          c.width = out.width; c.height = out.height;
          c.getContext("2d")!.drawImage(out, 0, 0);
        }
        if (out.width) out.width = out.height = 0;
        setError(""); setRendering(false);
      }).catch((e) => {
        if (e instanceof Superseded || !alive) return;
        setError(e instanceof Error ? e.message : "Could not draw the preview"); setRendering(false);
      });
    });
    return () => { alive = false; cancelAnimationFrame(id); };
  }, [settings, overlay, width, height, dw, dh, logoStamp, avail.w]);

  const transparent = overlay.background === "Transparent";
  return (
    <div ref={box} className={`scroll-thin relative h-full w-full ${z > 1 ? "overflow-auto" : "overflow-hidden"}`} onDoubleClick={() => fullscreen && set({ fullscreen: false })}>
      <div className="flex min-h-full min-w-full items-center justify-center" style={{ padding: pad }}>
        <div className={`relative shrink-0 overflow-hidden ${fullscreen ? "" : "rounded-md shadow-[0_20px_60px_-15px_rgba(0,0,0,.6)]"} ${transparent ? "checker" : ""}`} style={{ width: dw, height: dh }}>
          <canvas ref={canvas} className="block h-full w-full" aria-label={`Gradient preview, ${settings.type}`} role="img" />
          {!fullscreen && z <= 1.001 && (<><Guides mode={guides} /><CropGuide mode={guides} w={width} h={height} /></>)}
          {(rendering || busy) && <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-black/20"><div className="sweep h-full w-1/3 bg-accent" /></div>}
        </div>
      </div>
      {error && <div className="absolute inset-x-4 bottom-4 rounded-lg bg-bad/20 px-3 py-2 text-sm text-bad" role="alert">{error}</div>}
    </div>
  );
}

export function PreviewBar() {
  const { width, height, settings, zoom, set } = useStore();
  const zoomTo = (z: number) => set({ zoom: Math.min(4, Math.max(1, Math.round(z * 4) / 4)) });
  return (
    <div className="flex items-center gap-2 border-t border-line/70 px-4 py-2 text-[13px] text-dim">
      <span className="tabular-nums">{width} × {height} px</span>
      <span className="hidden sm:inline">· {settings.type} · seed {settings.seed}</span>
      <span className="flex-1" />
      <button className="icon-btn !h-8 !w-8" aria-label="Zoom out" disabled={zoom <= 1} onClick={() => zoomTo(zoom - 0.5)}>−</button>
      <button className="w-12 rounded-md text-center tabular-nums hover:text-ink" title="Back to fit" onClick={() => zoomTo(1)}>{zoom === 1 ? "Fit" : `${Math.round(zoom * 100)}%`}</button>
      <button className="icon-btn !h-8 !w-8" aria-label="Zoom in" disabled={zoom >= 4} onClick={() => zoomTo(zoom + 0.5)}>+</button>
      <button className="icon-btn !h-8 !w-8" aria-label="Full screen preview (F)" title="Full screen (F)" onClick={() => set({ fullscreen: true })}><Icon name="expand" size={16} /></button>
    </div>
  );
}
