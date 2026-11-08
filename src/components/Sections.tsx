import { useRef } from "react";
import { EFFECTS, GRADIENT_TYPES, OV_POSITIONS, POSITIONS, SIZE_PRESETS, MAX_DIM } from "../engine/types";
import { copyCode, copyImageAction, maxBatch } from "../lib/actions";
import { clearLogo, loadLogo, logoState } from "../lib/logo";
import { ASPECTS, GUIDES, useStore } from "../store/useStore";
import { Icon, Lock, NumberInput, Row, Section, Segmented, Select, Slider, Toggle } from "./ui";

export function GradientSection() {
  const { settings, locks, patch, setLock, newSeed } = useStore();
  const custom = settings.position === "Custom";
  return (
    <Section title="Gradient">
      <Row label="Type" lock={<Lock on={locks.type} onChange={(v) => setLock("type", v)} label="the type" />}>
        <Select label="Gradient type" value={settings.type} options={GRADIENT_TYPES} onChange={(v) => patch({ type: v })} />
      </Row>
      <Row label="Direction" lock={<Lock on={locks.direction} onChange={(v) => setLock("direction", v)} label="the direction" />}>
        <div className="flex items-center gap-2">
          <Slider label="Direction in degrees" value={settings.direction} min={0} max={360} onChange={(v) => patch({ direction: v })} />
          <NumberInput className="!w-14 text-right" label="Direction degrees" value={settings.direction} min={0} max={360} onCommit={(v) => patch({ direction: v })} />
        </div>
      </Row>
      <Row label="Position" lock={<Lock on={locks.position} onChange={(v) => setLock("position", v)} label="the position" />}>
        <Select label="Center position" value={settings.position} options={POSITIONS} onChange={(v) => patch({ position: v })} />
      </Row>
      {custom && (
        <Row label="Custom X / Y">
          <div className="flex items-center gap-2">
            <NumberInput label="Custom X percent" value={settings.customX} min={0} max={100} onCommit={(v) => patch({ customX: v })} />
            <span className="text-dim">%</span>
            <NumberInput label="Custom Y percent" value={settings.customY} min={0} max={100} onCommit={(v) => patch({ customY: v })} />
            <span className="text-dim">%</span>
          </div>
        </Row>
      )}
      <Row label="Seed" lock={<Lock on={locks.seed} onChange={(v) => setLock("seed", v)} label="the seed" />}>
        <div className="flex items-center gap-2">
          <NumberInput label="Seed" className="text-left" value={settings.seed} min={0} max={2 ** 31 - 1} onCommit={(v) => patch({ seed: Math.floor(v) })} />
          <button className="btn-soft !w-9 !px-0" onClick={newSeed} title="New random pattern (same colors)" aria-label="New random seed"><Icon name="dice" size={16} /></button>
        </div>
      </Row>
    </Section>
  );
}

export function EffectsSection() {
  const { settings, locks, patch, setLock } = useStore();
  const spec = [
    { n: 1, key: "effect" as const, ik: "intensity" as const, lk: "effect" as const, lik: "intensity" as const },
    { n: 2, key: "effect2" as const, ik: "intensity2" as const, lk: "effect2" as const, lik: "intensity2" as const },
  ];
  return (
    <Section title="Effects" defaultOpen={true}>
      {spec.map((e) => (
        <div key={e.n} className="space-y-2.5">
          <Row label={`Effect ${e.n}`} lock={<Lock on={locks[e.lk]} onChange={(v) => setLock(e.lk, v)} label={`effect ${e.n}`} />}>
            <Select label={`Effect ${e.n}`} value={settings[e.key]} options={EFFECTS} onChange={(v) => patch({ [e.key]: v })} />
          </Row>
          <Row label={`Strength ${e.n}`} lock={<Lock on={locks[e.lik]} onChange={(v) => setLock(e.lik, v)} label={`strength ${e.n}`} />}>
            <Slider label={`Strength ${e.n}`} value={settings[e.ik]} min={0} max={0.5} step={0.01} onChange={(v) => patch({ [e.ik]: v })} format={(v) => v.toFixed(2)} />
          </Row>
        </div>
      ))}
    </Section>
  );
}

export function OutputSection() {
  const s = useStore();
  const cap = maxBatch(s.width, s.height);
  return (
    <Section title="Output">
      <Row label="Size (px)">
        <div className="flex items-center gap-1.5">
          <NumberInput label="Width in pixels" value={s.width} min={1} max={MAX_DIM} onCommit={s.setWidth} />
          <span className="text-dim">×</span>
          <NumberInput label="Height in pixels" value={s.height} min={1} max={MAX_DIM} onCommit={s.setHeight} />
          <select className="field !w-[92px] shrink-0" aria-label="Aspect ratio" value={s.aspect} onChange={(e) => s.setAspect(e.target.value)}>
            {ASPECTS.map((a) => <option key={a}>{a}</option>)}
          </select>
        </div>
      </Row>
      <Row label="Preset"><Select label="Size preset" value={s.sizePreset} options={SIZE_PRESETS.map((p) => ({ value: p.label, label: p.label }))} onChange={s.setSizePreset} /></Row>
      <p className="pl-[92px] text-xs text-dim">Up to {MAX_DIM} × {MAX_DIM} px in the browser.</p>
      <Row label="Mode"><Segmented value={s.mode} options={["Single", "Batch"] as const} onChange={(v) => s.set({ mode: v })} /></Row>
      <Row label="Format">
        <div className="flex items-center gap-2">
          <Select label="File format" value={s.format} options={["PNG", "JPEG", "WebP"] as const} onChange={(v) => s.set({ format: v })} />
          {s.mode === "Batch" && (
            <>
              <NumberInput label="Number of images" className="!w-14 text-right" value={s.batchSize} min={2} max={Math.min(100, cap)} onCommit={(v) => s.set({ batchSize: Math.round(v) })} />
              <span className="whitespace-nowrap text-dim">images</span>
            </>
          )}
        </div>
      </Row>
      {s.mode === "Batch" && <p className="pl-[92px] text-xs text-dim">Auto Generate then saves a ZIP of {s.batchSize} images (up to {cap} at this size).</p>}
      <Row label="Quality">
        <Slider label="Export quality" value={s.quality} min={50} max={100} onChange={(v) => s.set({ quality: v })} format={(v) => String(v)} />
      </Row>
      <Row label="Background"><Select label="Background" value={s.overlay.background} options={["Transparent", "White", "Black"] as const} onChange={(v) => s.patchOverlay({ background: v })} /></Row>
      <Row label="Guides"><Select label="Guides" value={s.guides as (typeof GUIDES)[number]} options={GUIDES} onChange={(v) => s.set({ guides: v })} /></Row>
      <Row label="Copy as">
        <div className="grid grid-cols-3 gap-1.5">
          <button className="btn-soft !px-2" onClick={() => copyCode("css")} title="Copy as CSS (Ctrl+K)"><Icon name="copy" size={14} />CSS</button>
          <button className="btn-soft !px-2" onClick={() => copyCode("svg")} title="Copy as SVG"><Icon name="copy" size={14} />SVG</button>
          <button className="btn-soft !px-2" onClick={() => copyImageAction()} title="Copy the picture (Ctrl+C)"><Icon name="copy" size={14} />Image</button>
        </div>
      </Row>
    </Section>
  );
}

export function OverlaySection() {
  const { overlay, patchOverlay, bumpLogo, notify, logoStamp } = useStore();
  const file = useRef<HTMLInputElement>(null);
  return (
    <Section title="Overlays" defaultOpen={false}>
      <Row label="Text">
        <div className="flex items-center gap-2">
          <Toggle label="Show text" on={overlay.textOn} onChange={(v) => patchOverlay({ textOn: v })} />
          <input className="field" aria-label="Overlay text" value={overlay.text} maxLength={200} onChange={(e) => patchOverlay({ text: e.target.value })} />
        </div>
      </Row>
      <Row label="Text style">
        <div className="grid grid-cols-2 gap-2">
          <Select label="Text position" value={overlay.textPos} options={OV_POSITIONS} onChange={(v) => patchOverlay({ textPos: v })} />
          <Select label="Text color" value={overlay.textColor} options={["Auto", "White", "Black"] as const} onChange={(v) => patchOverlay({ textColor: v })} />
        </div>
      </Row>
      <Row label="Text size"><Slider label="Text size" value={overlay.textSize} min={1.5} max={20} step={0.5} onChange={(v) => patchOverlay({ textSize: v })} format={(v) => `${v}%`} /></Row>
      <Row label="Logo">
        <div className="flex items-center gap-2">
          <input ref={file} type="file" accept="image/*" hidden onChange={async (e) => {
            const f = e.target.files?.[0]; e.target.value = "";
            if (!f) return;
            try { await loadLogo(f); bumpLogo(); } catch (err) { notify((err as Error).message, "bad"); }
          }} />
          <button className="btn-soft" onClick={() => file.current?.click()}><Icon name="upload" size={15} />Choose…</button>
          <button className="btn-ghost" disabled={!logoState.image} onClick={() => { clearLogo(); bumpLogo(); }}>Clear</button>
          <span className="min-w-0 truncate text-xs text-dim" data-stamp={logoStamp}>{logoState.name || "No logo chosen"}</span>
        </div>
      </Row>
      <Row label="Logo place"><Select label="Logo position" value={overlay.logoPos} options={OV_POSITIONS} onChange={(v) => patchOverlay({ logoPos: v })} /></Row>
      <Row label="Logo size"><Slider label="Logo size" value={overlay.logoSize} min={4} max={60} step={0.5} onChange={(v) => patchOverlay({ logoSize: v })} format={(v) => `${v}%`} /></Row>
      <Row label="Opacity"><Slider label="Overlay opacity" value={overlay.opacity} min={10} max={100} onChange={(v) => patchOverlay({ opacity: v })} format={(v) => `${v}%`} /></Row>
      <p className="pl-[92px] text-xs text-dim">Your logo never leaves this device.</p>
    </Section>
  );
}
