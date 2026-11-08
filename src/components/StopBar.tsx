import { useRef } from "react";
import { rampLut } from "../engine/render";
import { MAX_COLORS } from "../engine/types";
import { useStore } from "../store/useStore";

/** Gradient strip with draggable color stops. Click the strip to add a stop, drag to move, Delete to remove. */
export function StopBar() {
  const { settings, selected, select, setStop, addStop, removeStop } = useStore();
  const bar = useRef<HTMLDivElement>(null);
  const lut = rampLut({ ...settings, reverse: false });
  const css = (() => {
    const parts: string[] = [];
    for (let k = 0; k <= 40; k++) {
      const i = Math.round((k / 40) * (lut.length / 4 - 1)) * 4;
      parts.push(`rgba(${lut[i]},${lut[i + 1]},${lut[i + 2]},${(lut[i + 3] / 255).toFixed(3)}) ${(k * 2.5).toFixed(1)}%`);
    }
    return `linear-gradient(90deg, ${parts.join(",")})`;
  })();
  const posOf = (clientX: number) => {
    const r = bar.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  };
  const drag = (e: React.PointerEvent, i: number) => {
    e.stopPropagation();
    select(i);
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => setStop(i, { pos: Math.round(posOf(ev.clientX) * 1000) / 1000 });
    const up = () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };
  return (
    <div className="pb-5 pt-1">
      <div ref={bar} className="relative h-9 rounded-lg" onPointerDown={(e) => { if (settings.stops.length < MAX_COLORS) addStop(Math.round(posOf(e.clientX) * 1000) / 1000); }} title="Click to add a color">
        <div className="checker absolute inset-0 rounded-lg" />
        <div className="absolute inset-0 rounded-lg ring-1 ring-white/10" style={{ background: css }} />
        {settings.stops.map((s, i) => (
          <button key={i} aria-label={`Color stop ${i + 1}, ${s.color}, at ${Math.round(s.pos * 100)} percent`}
            onPointerDown={(e) => drag(e, i)}
            onKeyDown={(e) => {
              if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeStop(i); }
              if (e.key === "ArrowLeft") setStop(i, { pos: Math.max(0, s.pos - 0.01) });
              if (e.key === "ArrowRight") setStop(i, { pos: Math.min(1, s.pos + 0.01) });
            }}
            style={{ left: `${s.pos * 100}%`, background: s.color }}
            className={`absolute -bottom-3 h-6 w-4 -translate-x-1/2 cursor-grab touch-none rounded-[5px] border-2 shadow-md active:cursor-grabbing ${i === selected ? "z-10 border-white ring-2 ring-accent" : "border-white/70"}`} />
        ))}
      </div>
    </div>
  );
}
