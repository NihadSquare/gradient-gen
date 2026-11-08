import { BLEND_MODES, TRANSITIONS, normHex } from "../engine/color";
import { MAX_COLORS, MIN_COLORS } from "../engine/types";
import { useStore } from "../store/useStore";
import { StopBar } from "./StopBar";
import { Icon, Lock, NumberInput, Row, Section, Select, Slider, Toggle } from "./ui";

export function ColorsSection() {
  const { settings, selected, locks, setStop, setCount, removeStop, patch, setLock, set } = useStore();
  const i = Math.min(selected, settings.stops.length - 1);
  const stop = settings.stops[i];
  return (
    <Section title="Colors" action={<button className="btn-ghost !h-8 !px-2" onClick={() => set({ dialog: "palette" })}><Icon name="palette" size={16} />Palettes</button>}>
      <StopBar />
      <div className="rounded-lg bg-bg/60 p-3">
        <div className="mb-2.5 flex items-center gap-2">
          <span className="font-semibold">Color {i + 1}</span>
          <span className="flex-1" />
          <button className="btn-ghost !h-7 !px-2 text-bad" disabled={settings.stops.length <= MIN_COLORS} onClick={() => removeStop(i)} title="Remove this color (Delete)"><Icon name="trash" size={15} />Remove</button>
        </div>
        <div className="grid grid-cols-[84px_1fr] items-center gap-x-2 gap-y-2">
          <span className="label">Color</span>
          <div className="flex items-center gap-2">
            <div className="h-8 w-10 shrink-0 overflow-hidden rounded-md border border-line"><input type="color" aria-label="Pick color" value={stop.color.toLowerCase()} onChange={(e) => setStop(i, { color: e.target.value.toUpperCase() })} /></div>
            <HexField value={stop.color} onCommit={(c) => setStop(i, { color: c })} />
          </div>
          <span className="label">Position</span>
          <div className="flex items-center gap-2">
            <div className="flex-1"><Slider label="Position" value={Math.round(stop.pos * 100)} min={0} max={100} onChange={(v) => setStop(i, { pos: v / 100 })} /></div>
            <NumberInput className="!w-14 text-right" label="Position percent" value={Math.round(stop.pos * 100)} min={0} max={100} onCommit={(v) => setStop(i, { pos: v / 100 })} />
          </div>
          <span className="label">Opacity</span>
          <div className="flex items-center gap-2">
            <Lock on={locks.opacities} onChange={(v) => setLock("opacities", v)} label="the opacities" />
            <div className="flex-1"><Slider label="Opacity" value={Math.round(stop.opacity * 100)} min={0} max={100} onChange={(v) => setStop(i, { opacity: v / 100 })} /></div>
            <NumberInput className="!w-14 text-right" label="Opacity percent" value={Math.round(stop.opacity * 100)} min={0} max={100} onCommit={(v) => setStop(i, { opacity: v / 100 })} />
          </div>
          <span className="label">To next</span>
          <Select label="Transition to next color" value={stop.trans} options={TRANSITIONS} onChange={(v) => setStop(i, { trans: v })} />
        </div>
      </div>
      <Row label="Number" lock={<Lock on={locks.numColors} onChange={(v) => setLock("numColors", v)} label="the number of colors" />}>
        <div className="flex items-center gap-2">
          <button className="btn-soft !h-8 !w-8 !px-0" aria-label="Fewer colors" disabled={settings.stops.length <= MIN_COLORS} onClick={() => setCount(settings.stops.length - 1)}>−</button>
          <span className="w-6 text-center font-semibold tabular-nums">{settings.stops.length}</span>
          <button className="btn-soft !h-8 !w-8 !px-0" aria-label="More colors" disabled={settings.stops.length >= MAX_COLORS} onClick={() => setCount(settings.stops.length + 1)}>+</button>
        </div>
      </Row>
      <Row label="Colors" lock={<Lock on={locks.colors} onChange={(v) => setLock("colors", v)} label="the colors" />}>
        <div className="flex items-center gap-2 text-dim"><Toggle label="Reverse colors" on={settings.reverse} onChange={(v) => patch({ reverse: v })} />Reverse</div>
      </Row>
      <Row label="Blend in">
        <Select label="Blend mode" value={settings.blend} options={BLEND_MODES} onChange={(v) => patch({ blend: v })} />
      </Row>
    </Section>
  );
}

export function HexField({ value, onCommit, className = "" }: { value: string; onCommit: (hex: string) => void; className?: string }) {
  return (
    <input key={value} className={`field uppercase tabular-nums ${className}`} aria-label="Hex color" defaultValue={value} maxLength={7} spellCheck={false}
      onBlur={(e) => { const n = normHex(e.target.value); if (n) onCommit(n); else e.target.value = value; }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
  );
}
