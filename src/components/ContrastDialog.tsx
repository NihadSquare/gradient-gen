import { useState } from "react";
import { contrastRatio, fixContrast } from "../engine/color";
import { useStore } from "../store/useStore";
import { HexField } from "./ColorsSection";
import { Icon, Modal } from "./ui";

const LEVELS: { label: string; need: number }[] = [
  { label: "AA normal text", need: 4.5 }, { label: "AA large text", need: 3 }, { label: "AAA normal text", need: 7 }, { label: "AAA large text", need: 4.5 },
];

export function ContrastDialog() {
  const { settings, set, notify } = useStore();
  const stops = settings.stops.map((s) => s.color);
  const [a, setA] = useState(stops[0]);
  const [b, setB] = useState(stops[stops.length - 1] === stops[0] ? "#FFFFFF" : stops[stops.length - 1]);
  const ratio = contrastRatio(a, b);
  const Picker = ({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) => (
    <div className="space-y-2">
      <div className="label">{label}</div>
      <div className="flex items-center gap-2"><div className="h-8 w-10 shrink-0 overflow-hidden rounded-md border border-line"><input type="color" aria-label={label} value={value.toLowerCase()} onChange={(e) => onChange(e.target.value.toUpperCase())} /></div><HexField value={value} onCommit={onChange} /></div>
      <div className="flex flex-wrap gap-1">{[...new Set([...stops, "#FFFFFF", "#000000"])].map((c) => <button key={c} aria-label={c} title={c} onClick={() => onChange(c)} style={{ background: c }} className="h-5 w-5 rounded border border-white/25" />)}</div>
    </div>
  );
  const fix = (which: "a" | "b", target: number) => {
    const out = which === "a" ? fixContrast(a, b, target) : fixContrast(b, a, target);
    if (!out) return notify("No color of this hue reaches that ratio", "warn");
    which === "a" ? setA(out) : setB(out);
  };
  return (
    <Modal title="Color contrast" onClose={() => set({ dialog: null })} width={560}>
      <div className="grid gap-5 sm:grid-cols-2"><Picker label="Text color" value={a} onChange={setA} /><Picker label="Background" value={b} onChange={setB} /></div>
      <div className="mt-4 flex items-center gap-2"><button className="btn-soft !h-8" onClick={() => { setA(b); setB(a); }}><Icon name="swap" size={15} />Swap</button></div>
      <div className="mt-4 rounded-xl p-5" style={{ background: b, color: a }}>
        <div className="font-display text-2xl font-extrabold">Sample heading</div>
        <p className="mt-1 text-sm">Body text shows how readable this pair is on your background.</p>
      </div>
      <div className="mt-4 flex items-baseline gap-2"><span className="font-display text-3xl font-extrabold tabular-nums">{ratio.toFixed(2)}</span><span className="text-dim">: 1 contrast ratio</span></div>
      <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {LEVELS.map((l) => { const ok = ratio >= l.need; return <li key={l.label} className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] ${ok ? "bg-ok/15 text-ok" : "bg-bad/15 text-bad"}`}><Icon name={ok ? "check" : "close"} size={15} />{l.label} <span className="ml-auto opacity-70">{l.need}:1</span></li>; })}
      </ul>
      {ratio < 4.5 && (
        <div className="mt-4"><div className="label mb-1.5">Fix it (keeps hue and saturation, changes lightness)</div>
          <div className="flex flex-wrap gap-2"><button className="btn-soft !h-8" onClick={() => fix("a", 4.5)}>Adjust text for AA</button><button className="btn-soft !h-8" onClick={() => fix("b", 4.5)}>Adjust background for AA</button><button className="btn-soft !h-8" onClick={() => fix("a", 7)}>Text for AAA</button></div></div>
      )}
    </Modal>
  );
}
