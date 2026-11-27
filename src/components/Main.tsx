// Gradient Gen - Copyright (c) 2026 AK Nihad (Nihad Square). All rights reserved.
// Source-available, not open source: see LICENSE. Copying or reuse is not permitted without written permission.
import { useEffect, useRef, useState } from "react";
import { BASE } from "../config";
import { APP_NAME, APP_VERSION, GUIDE_OPTS, OV_POSITIONS, SIZE_PRESETS } from "../data/desktop";
import { HARMONIES, TEMPERATURES } from "../engine/palette";
import { EFFECTS, GRADIENT_TYPES, POSITIONS } from "../engine/types";
import { cancelBatch, copyCode, copyImageAction, runBatchGeneration, saveImage } from "../lib/actions";
import { clearLogo, loadLogo, logoState } from "../lib/logo";
import { useStore } from "../store/useStore";
import { Icon } from "./Icon";
import { PreviewArea } from "./Preview";
import { Chips, StopBar, StopEditor } from "./StopEditor";
import { Card, Label, LockToggle, PillSlider, RoundButton, RoundCombo, RoundEntry, Segmented, Sep, Toggle } from "./widgets";

/** rows share their columns (label | control | lock), 4 px above and below each row, like the desktop's grid */
const FormGrid = ({ children, locks }: { children: React.ReactNode; locks?: boolean }) => (
  <div style={{ display: "grid", gridTemplateColumns: locks ? "auto minmax(0,1fr) auto" : "auto minmax(0,1fr)", alignItems: "center" }}>{children}</div>
);
const FormRow = ({ label, children, lock, last }: { label: string; children: React.ReactNode; lock?: React.ReactNode; last?: boolean }) => (
  <>
    <div style={{ padding: "4px 10px 4px 0" }}><Label dim>{label}</Label></div>
    <div style={{ padding: "4px 0", minWidth: 0 }}>{children}</div>
    {lock !== undefined && <div style={{ padding: "4px 0 4px 8px" }}>{lock}</div>}
  </>
);

export function Header() {
  const s = useStore();
  const items: [string, string, () => void][] = [["View", "expand", () => s.set({ fullscreen: true })], ["Settings", "gear", () => s.set({ dialog: "settings" })], ["Presets", "bookmark", () => s.set({ dialog: "presets" })], ["Reset", "reset", () => doReset()], ["About", "info", () => s.set({ dialog: "about" })]];
  const doReset = async () => { if (await s.askYesNo("Reset", "Reset all settings to the defaults?")) { s.resetSettings(); s.say("Settings reset to defaults", 4000); } };
  return (
    <div className="g-header" style={{ display: "flex", alignItems: "center", padding: "14px 20px 6px 20px" }}>
      <img src={`${BASE}assets/GG.png`} alt={APP_NAME} style={{ width: 280, height: "auto", maxWidth: "52vw" }} />
      <div style={{ flex: 1 }} />
      <div style={{ display: "flex", gap: 4 }}>
        {items.map(([t, ic, fn]) => <RoundButton key={t} text={t} icon={ic} style="ghost" height={34} compact onClick={fn} />)}
      </div>
    </div>
  );
}

export function ColorsCard() {
  const s = useStore();
  const L = s.locks;
  const opts = s.colors.slice(0, s.num).map((c) => c.toUpperCase());
  return (
    <Card title="Colors" icon="palette">
      <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
        <Label style={{ marginRight: 8 }}>Colors</Label>
        <RoundCombo value={String(s.num)} values={Array.from({ length: 11 }, (_, i) => String(i + 2))} width={3} center label="Number of colors" onChange={(v) => s.setNum(Number(v))} />
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 6 }}>
          <LockToggle on={L.numColors} text="Number" onChange={(v) => s.setLock("numColors", v)} tip="Lock the number of colors: Auto Generate leaves it unchanged" />
          <LockToggle on={L.colors} text="Colors" onChange={(v) => s.setLock("colors", v)} tip="Lock the colors: Auto Generate keeps these colors" />
          <LockToggle on={L.opacities} text="Opacity" onChange={(v) => s.setLock("opacities", v)} tip="Lock the opacity values: Auto Generate keeps them" />
        </div>
      </div>
      <StopBar />
      <div style={{ height: 2 }} />
      <Chips />
      <StopEditor />
      <Sep m="14px 0 0" />
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr", alignItems: "center", marginTop: 14 }}>
        <Label dim style={{ marginRight: 8 }}>Palette</Label>
        <RoundCombo value={s.scheme} values={HARMONIES} width={8} label="Palette scheme" onChange={(v) => s.set({ scheme: v })} />
        <div style={{ marginLeft: 6 }}><RoundCombo value={s.temp} values={TEMPERATURES} width={8} label="Palette temperature" onChange={(v) => s.set({ temp: v })} /></div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 8 }}>
        <RoundButton text="Palette Tools" icon="bookmark" height={32} width={135} onClick={() => s.set({ dialog: "palette" })} />
        <RoundButton text="Generate Palette" icon="sparkle" height={32} width={160} accentText onClick={() => generatePalette()} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "auto auto auto auto 1fr", alignItems: "center", marginTop: 8 }}>
        <Label dim style={{ marginRight: 8 }}>Contrast</Label>
        <RoundCombo value={s.contrast1} values={opts} width={8} center label="First contrast color" onChange={(v) => s.set({ contrast1: v })} />
        <Label dim style={{ margin: "0 6px" }}>↔</Label>
        <RoundCombo value={s.contrast2} values={opts} width={8} center label="Second contrast color" onChange={(v) => s.set({ contrast2: v })} />
        <div style={{ justifySelf: "end" }}><RoundButton text="Test" height={30} width={80} accentText onClick={() => s.set({ dialog: "contrast" })} /></div>
      </div>
    </Card>
  );
}

import { harmonyPalette, type Harmony, type Temperature } from "../engine/palette";
export function generatePalette() {
  const s = useStore.getState();
  const pal = harmonyPalette(s.colors[0], s.scheme as Harmony, s.num, s.temp as Temperature);
  const colors = [...s.colors]; pal.forEach((c, i) => { if (i < s.num) colors[i] = c.toUpperCase(); });
  useStore.setState({ colors, dirty: true });
  s.say(`Generated a ${s.scheme} palette (${s.temp})`, 4000);
}

export function OutputCard() {
  const s = useStore();
  const batch = s.mode === "Batch";
  return (
    <Card title="Output" icon="download">
      <FormGrid>
      <FormRow label="Size (px)">
        <div style={{ display: "flex", alignItems: "center" }}>
          <RoundEntry value={s.width} numeric width={5} label="Width in pixels" onChange={s.setWidth} />
          <Label dim style={{ margin: "0 6px" }}>×</Label>
          <RoundEntry value={s.height} numeric width={5} label="Height in pixels" onChange={s.setHeight} />
          <div style={{ marginLeft: 10 }}><RoundCombo value={s.aspect} values={["16:9", "4:3", "5:4", "1:1", "Custom"]} width={7} label="Aspect ratio" onChange={s.setAspect} /></div>
        </div>
      </FormRow>
      <FormRow label="Preset"><RoundCombo value={s.sizePreset} values={SIZE_PRESETS.map((p) => p[0])} width={16} label="Size preset" onChange={s.setSizePreset} /></FormRow>
      <FormRow label="Mode"><Segmented value={s.mode} options={["Single", "Batch"] as const} onChange={(v) => s.set({ mode: v })} /></FormRow>
      <FormRow label="Batch">
        <div style={{ display: "flex", alignItems: "center" }}>
          <RoundEntry value={s.batchSize} numeric width={5} disabled={!batch} label="Batch size" onChange={(v) => s.set({ batchSize: v })} />
          <Label dim style={{ margin: "0 8px" }}>images as</Label>
          <RoundCombo value={s.format} values={["PNG", "JPEG", "WebP"]} width={6} disabled={!batch} label="Batch file format" onChange={(v) => s.set({ format: v as "PNG" })} />
        </div>
      </FormRow>
      <FormRow label="Quality">
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ flex: 1 }}><PillSlider value={s.quality} min={50} max={100} onChange={(v) => s.set({ quality: Math.round(v) })} tip="JPEG and WebP quality (100 = lossless WebP)" label="Quality" /></div>
          <span style={{ width: 34, textAlign: "right", marginLeft: 8 }}><Label dim>{Math.round(s.quality)}</Label></span>
        </div>
      </FormRow>
      <FormRow label="Background">
        <div style={{ display: "grid", gridTemplateColumns: "6fr auto 4fr", alignItems: "center" }}>
          <RoundCombo value={s.overlay.background} values={["White", "Black", "Transparent"]} width={8} label="Background" onChange={(v) => s.patchOverlay({ background: v as "White" })} />
          <Label dim style={{ margin: "0 6px 0 8px" }}>Guides</Label>
          <RoundCombo value={s.guides} values={GUIDE_OPTS} width={8} label="Guides" onChange={(v) => s.set({ guides: v })} />
        </div>
      </FormRow>
      <FormRow label="Copy as">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
          <RoundButton text="CSS" icon="copy" height={30} fill tip="Copy this gradient as CSS  (Ctrl+K)" onClick={() => copyCode("css")} />
          <RoundButton text="SVG" icon="copy" height={30} fill tip="Copy this gradient as an SVG image" onClick={() => copyCode("svg")} />
          <RoundButton text="Image" icon="copy" height={30} fill tip="Copy the picture to the clipboard  (Ctrl+C)" onClick={() => copyImageAction()} />
        </div>
      </FormRow>
      </FormGrid>
      {s.batchProgress !== null && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <div className="g-progress" style={{ flex: 1 }}><i style={{ width: `${Math.round(s.batchProgress * 100)}%` }} /></div>
          <RoundButton text="Cancel" height={26} compact style="ghost" size={9} onClick={cancelBatch} />
        </div>
      )}
    </Card>
  );
}

export function OverlayCard() {
  const s = useStore(); const o = s.overlay;
  const file = useRef<HTMLInputElement>(null);
  return (
    <Card title="Overlays" icon="layers">
      <FormGrid>
      <FormRow label="Text"><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Toggle on={o.textOn} onChange={(v) => s.patchOverlay({ textOn: v })} tip="Add this text on top of the picture" /><div style={{ flex: 1 }}><RoundEntry value={o.text} width={14} center={false} style={{ width: "100%" }} maxLength={200} label="Overlay text" onChange={(v) => s.patchOverlay({ text: v })} /></div></div></FormRow>
      <FormRow label="Text style"><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}><RoundCombo value={o.textPos} values={OV_POSITIONS} width={8} label="Text position" onChange={(v) => s.patchOverlay({ textPos: v as typeof o.textPos })} /><RoundCombo value={o.textColor} values={["Auto", "White", "Black"]} width={6} label="Text color" onChange={(v) => s.patchOverlay({ textColor: v as typeof o.textColor })} /></div></FormRow>
      <FormRow label="Text size"><PillSlider value={o.textSize} min={1.5} max={20} onChange={(v) => s.patchOverlay({ textSize: Math.round(v * 10) / 10 })} tip="Text size (% of the picture width)" label="Text size" /></FormRow>
      <FormRow label="Logo">
        <div style={{ display: "flex", alignItems: "center" }}>
          <input ref={file} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; try { await loadLogo(f); const n = logoState.name; s.set({ logoStamp: s.logoStamp + 1, logoName: n.length <= 24 ? n : n.slice(0, 21) + "..." }); } catch { await s.showMsg("Logo", "Could not open this image.", "error"); } }} />
          <RoundButton text="Choose..." height={30} width={84} onClick={() => file.current?.click()} />
          <div style={{ marginLeft: 6 }}><RoundButton text="Clear" height={30} width={64} onClick={() => { clearLogo(); s.set({ logoStamp: s.logoStamp + 1, logoName: "No logo chosen" }); }} /></div>
          <span style={{ marginLeft: 8, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><Label dim size={9}>{s.logoName}</Label></span>
        </div>
      </FormRow>
      <FormRow label="Logo place"><RoundCombo value={o.logoPos} values={OV_POSITIONS} width={16} label="Logo position" onChange={(v) => s.patchOverlay({ logoPos: v as typeof o.logoPos })} /></FormRow>
      <FormRow label="Logo size"><PillSlider value={o.logoSize} min={4} max={60} onChange={(v) => s.patchOverlay({ logoSize: Math.round(v * 10) / 10 })} tip="Logo size (% of the picture width)" label="Logo size" /></FormRow>
      <FormRow label="Opacity"><PillSlider value={o.opacity} min={10} max={100} onChange={(v) => s.patchOverlay({ opacity: Math.round(v) })} tip="Opacity of the text and logo" label="Overlay opacity" /></FormRow>
      </FormGrid>
    </Card>
  );
}

/** Sidebar: scrolling cards with the desktop's thin scrollbar and a fixed action bar underneath */
export function Sidebar() {
  const s = useStore();
  const sc = useRef<HTMLDivElement>(null);
  const [m, setM] = useState({ top: 0, h: 0, total: 0, view: 0 });
  const [drag, setDrag] = useState(false);
  const upd = () => { const el = sc.current; if (el) setM({ top: el.scrollTop, h: el.clientHeight, total: el.scrollHeight, view: el.clientHeight }); };
  useEffect(() => { upd(); const el = sc.current!; const ro = new ResizeObserver(upd); ro.observe(el); Array.from(el.children).forEach((c) => ro.observe(c)); return () => ro.disconnect(); }, []);
  const barH = Math.max(28, (m.view / Math.max(1, m.total)) * (m.view - 8)), barY = m.total > m.view ? 4 + (m.top / (m.total - m.view)) * (m.view - 8 - barH) : 0;
  const more = m.total > m.view + 2 && m.top < m.total - m.view - 2;
  const batch = s.mode === "Batch";
  return (
    <div className="g-side" style={{ display: "flex", flexDirection: "column", width: 426, flex: "none", padding: "4px 6px 0 20px", minHeight: 0 }}>
      <div className="g-scrollwrap" style={{ position: "relative", flex: 1, minHeight: 0 }}>
        <div ref={sc} className="g-scroll" onScroll={upd} style={{ height: "100%", width: 400 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingBottom: 10 }}>
            <ColorsCard /><OutputCard /><OverlayCard />
          </div>
        </div>
        {m.total > m.view + 1 && (
          <div className={`g-sbar ${drag ? "drag" : ""}`} style={{ top: barY, height: barH }}
            onPointerDown={(e) => { e.preventDefault(); setDrag(true); const y0 = e.clientY, t0 = sc.current!.scrollTop; const mv = (ev: PointerEvent) => { const el = sc.current!; el.scrollTop = t0 + ((ev.clientY - y0) / Math.max(1, m.view - 8 - barH)) * (el.scrollHeight - el.clientHeight); }; const up = () => { setDrag(false); window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); }; window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up); }} />
        )}
        {more && <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 16, pointerEvents: "none", background: "linear-gradient(to bottom, transparent, rgb(var(--bg)))" }} />}
      </div>
      <div className="g-actions" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
        <RoundButton text={batch ? "Generate Batch" : "Auto Generate"} icon="sparkle" height={42} fill tip="Generate image  (Space)" disabled={s.batchRunning} onClick={() => { if (s.generateRandom()) runBatchGeneration(); }} />
        <RoundButton text="Save Image" icon="download" style="primary" height={42} fill tip="Save the image  (Ctrl+S)" disabled={s.batchRunning || batch} onClick={() => saveImage()} />
      </div>
    </div>
  );
}

export function PreviewCard() {
  const s = useStore();
  const [seedDraft, setSeedDraft] = useState<string | null>(null);
  return (
    <div className="g-prev" style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1, padding: "4px 20px 0 6px", minHeight: 0 }}>
      <Card radius={16} className="g-prevcard" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ flex: 1, minHeight: 0 }}><PreviewArea /></div>
        <div className="g-toolbar" style={{ display: "flex", alignItems: "center", marginTop: 10, flexWrap: "wrap", rowGap: 6 }}>
          <Label dim style={{ marginRight: 8 }}>Zoom</Label>
          <PillSlider value={s.zoom} min={1} max={4} step={0.1} width={100} tip="Zoom into the pattern" label="Zoom" onChange={(v) => s.set({ zoom: Math.round(v * 10) / 10 })} />
          <span style={{ marginLeft: 8, width: 34 }}><Label dim size={9}>{s.zoom.toFixed(1)}x</Label></span>
          <div style={{ flex: 1 }} />
          <RoundButton icon="undo" height={30} radius={9} tip="Undo  (Ctrl+Z)" disabled={!s.canUndo()} onClick={s.historyUndo} />
          <div style={{ width: 4 }} />
          <RoundButton icon="redo" height={30} radius={9} tip="Redo  (Ctrl+Y)" disabled={!s.canRedo()} onClick={s.historyRedo} />
          <div style={{ width: 14 }} />
          <Label dim style={{ marginRight: 5 }}>Show Palette</Label>
          <Toggle on={s.showPalette} onChange={(v) => s.set({ showPalette: v })} tip="Show the color palette instead of the gradient" />
          <Label dim style={{ margin: "0 5px 0 18px" }}>Reverse</Label>
          <Toggle on={s.reverse} onChange={(v) => s.set({ reverse: v, dirty: true })} tip="Reverse the order of the colors" />
          <div style={{ display: "flex", alignItems: "center", marginLeft: 18 }}>
            <Label dim style={{ marginRight: 6 }}>Seed:</Label>
            <RoundEntry value={seedDraft ?? String(s.seed)} numeric width={10} tip="Seed: Reproduce a pattern" label="Seed" onChange={(v) => { setSeedDraft(v); s.setSeedText(v); }} onCommit={() => setSeedDraft(null)} />
            <div style={{ marginLeft: 6 }}><RoundButton icon="dice" height={30} radius={9} tip="New random seed" onClick={() => { setSeedDraft(null); s.newSeed(); }} /></div>
            <div style={{ marginLeft: 6 }}><LockToggle on={s.locks.seed} tip="Lock seed" onChange={(v) => s.setLock("seed", v)} /></div>
          </div>
        </div>
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
        <GradientCard /><EffectsCard />
      </div>
    </div>
  );
}

function GradientCard() {
  const s = useStore(); const L = s.locks;
  return (
    <Card title="Gradient" icon="gradient">
      <FormGrid locks>
        <FormRow label="Type" lock={<LockToggle on={L.type} onChange={(v) => s.setLock("type", v)} tip="Lock the gradient type: Auto Generate leaves it unchanged" />}>
          <RoundCombo value={s.gradientType} values={GRADIENT_TYPES} width={16} label="Gradient type" onChange={(v) => s.set({ gradientType: v as typeof s.gradientType, dirty: true })} />
        </FormRow>
        <FormRow label="Direction" lock={<LockToggle on={L.direction} onChange={(v) => s.setLock("direction", v)} tip="Lock the direction: Auto Generate leaves it unchanged" />}>
          <div style={{ display: "flex", alignItems: "center" }}><div style={{ flex: 1 }}><PillSlider value={s.direction} min={0} max={360} onChange={(v) => s.set({ direction: Math.round(v), dirty: true })} tip="Direction of the gradient in degrees (mouse wheel adjusts)" label="Direction" /></div><span style={{ width: 42, textAlign: "right", marginLeft: 8 }}><Label>{Math.round(s.direction)}°</Label></span></div>
        </FormRow>
        <FormRow label="Position" lock={<LockToggle on={L.position} onChange={(v) => s.setLock("position", v)} tip="Lock the position: Auto Generate leaves it unchanged" />}>
          <RoundCombo value={s.position} values={POSITIONS} width={16} label="Center position" onChange={(v) => s.set({ position: v as typeof s.position, dirty: true })} />
        </FormRow>
        <FormRow label="Custom X / Y" lock={<span />}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <RoundEntry value={String(s.customX)} numeric width={5} disabled={s.position !== "Custom"} label="Custom X percent" onChange={(v) => s.set({ customX: Math.min(100, Number(v) || 0), dirty: true })} />
            <Label dim style={{ margin: "0 10px 0 3px" }}>%</Label>
            <RoundEntry value={String(s.customY)} numeric width={5} disabled={s.position !== "Custom"} label="Custom Y percent" onChange={(v) => s.set({ customY: Math.min(100, Number(v) || 0), dirty: true })} />
            <Label dim style={{ marginLeft: 3 }}>%</Label>
          </div>
        </FormRow>
      </FormGrid>
    </Card>
  );
}

function EffectsCard() {
  const s = useStore(); const L = s.locks;
  const spec = [["Effect 1", "effect"], ["Effect 2", "effect2"]] as const;
  const str = [["Strength 1", "intensity"], ["Strength 2", "intensity2"]] as const;
  return (
    <Card title="Effects" icon="sparkle">
      <FormGrid locks>
        {[0, 1].flatMap((k) => [
          <FormRow key={`e${k}`} label={spec[k][0]} lock={<LockToggle on={L[spec[k][1]]} onChange={(v) => s.setLock(spec[k][1], v)} tip={`Lock ${spec[k][0]}: Auto Generate leaves it unchanged`} />}>
            <RoundCombo value={s[spec[k][1]]} values={EFFECTS} width={16} label={spec[k][0]} onChange={(v) => s.set({ [spec[k][1]]: v, dirty: true } as never)} />
          </FormRow>,
          <FormRow key={`s${k}`} label={str[k][0]} lock={<LockToggle on={L[str[k][1]]} onChange={(v) => s.setLock(str[k][1], v)} tip={`Lock ${str[k][0]}: Auto Generate leaves it unchanged`} />}>
            <PillSlider value={s[str[k][1]]} min={0} max={0.5} step={0.01} label={str[k][0]} tip={`${str[k][0]}: how strong the effect is`} onChange={(v) => s.set({ [str[k][1]]: Math.round(v * 100) / 100, dirty: true } as never)} />
          </FormRow>,
        ])}
      </FormGrid>
    </Card>
  );
}

export function Footer() {
  const status = useStore((s) => s.status);
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "8px 22px 10px" }}>
      <span style={{ flex: 1 }}><Label dim size={9}>{status}</Label></span>
      <Label dim size={8}>Developed by Nihad Square  |  {APP_NAME} v{APP_VERSION}</Label>
    </div>
  );
}
export { Icon };
