import { useRef, useState } from "react";
import { APP_BUILD, APP_NAME, APP_VERSION } from "../data/desktop";
import { BASE, REPO_URL, WEB_VERSION } from "../config";
import { isHex } from "../engine/color";
import { hexToHsv, hsvToHex } from "../lib/colorutil";
import { THEMES, THEME_ORDER } from "../lib/themes";
import { DEFAULT_PREFS, useStore } from "../store/useStore";
import { Icon } from "./Icon";
import { ColorSwatch, Dialog, Label, RoundButton, RoundCombo, RoundEntry, Sep, Toggle } from "./widgets";

const H1 = ({ children }: { children: React.ReactNode }) => <div style={{ fontSize: 17.333, fontWeight: 700 }}>{children}</div>;

/** Saturation/value square with a hue bar underneath (the desktop's ColorPlane) */
export function ColorPlane({ color, onChange, width = 336, height = 168 }: { color: string; onChange: (hex: string) => void; width?: number; height?: number }) {
  const [hsv, setHsv] = useState<[number, number, number]>(() => { const x = hexToHsv(color); return x; });
  const last = useRef(color.toUpperCase());
  if (color.toUpperCase() !== last.current && color.toUpperCase() !== hsvToHex(...hsv)) { const n = hexToHsv(color); last.current = color.toUpperCase(); setHsv([n[1] > 0.001 && n[2] > 0.001 ? n[0] : hsv[0], n[1], n[2]]); }
  const [h, s, v] = hsv; const GAP = 12, BAR = 16;
  const ring = (x: number, y: number, inner: string) => (
    <div style={{ position: "absolute", left: x - 11, top: y - 11, width: 22, height: 22, borderRadius: "50%", background: "rgb(0 0 0 / .35)", pointerEvents: "none" }}>
      <div style={{ position: "absolute", inset: 2, borderRadius: "50%", background: "#fff" }} /><div style={{ position: "absolute", inset: 4, borderRadius: "50%", background: inner }} />
    </div>
  );
  const emit = (n: [number, number, number]) => { setHsv(n); const hx = hsvToHex(...n); last.current = hx; onChange(hx); };
  const drag = (kind: "sv" | "hue", e: React.PointerEvent) => {
    const el = e.currentTarget as HTMLElement; const r = el.getBoundingClientRect(); const cl = (x: number) => Math.min(1, Math.max(0, x));
    const move = (ev: { clientX: number; clientY: number }) => { if (kind === "sv") emit([h, cl((ev.clientX - r.left) / width), 1 - cl((ev.clientY - r.top) / height)]); else emit([Math.min(0.9999, cl((ev.clientX - r.left) / width)), s, v]); };
    el.setPointerCapture(e.pointerId); move(e);
    const mv = (ev: PointerEvent) => move(ev); const up = () => { el.removeEventListener("pointermove", mv); el.removeEventListener("pointerup", up); };
    el.addEventListener("pointermove", mv); el.addEventListener("pointerup", up);
  };
  const hueHex = hsvToHex(h, 1, 1);
  return (
    <div style={{ position: "relative", width, height: height + GAP + BAR, touchAction: "none", cursor: "crosshair" }}>
      <div onPointerDown={(e) => drag("sv", e)} style={{ position: "absolute", left: 0, top: 0, width, height, borderRadius: 10, background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueHex})` }} />
      {ring(s * width, (1 - v) * height, hsvToHex(h, s, v))}
      <div onPointerDown={(e) => drag("hue", e)} style={{ position: "absolute", left: 0, top: height + GAP, width, height: BAR, borderRadius: BAR / 2, background: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)" }} />
      {ring(Math.max(8, Math.min(width - 8, h * width)), height + GAP + BAR / 2, hueHex)}
    </div>
  );
}

export function ColorPickerDialog() {
  const s = useStore(); const i = s.colorIndex; const cur = s.colors[i].toUpperCase();
  const [val, setVal] = useState(cur);
  const ok = isHex(val.toUpperCase());
  const close = () => s.set({ dialog: null });
  const confirm = async () => { if (isHex(val.toUpperCase())) { s.setColor(i, val); close(); } else await s.showMsg("Error", "Invalid hex color code. Use format #RRGGBB (e.g., #FFFFFF).", "error"); };
  return (
    <Dialog title={`Choose Color ${i + 1}`} width={380} onClose={close}>
      <H1>Color {i + 1}</H1>
      <div style={{ margin: "12px 0" }}><ColorPlane color={ok ? val : cur} onChange={(h) => setVal(h)} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 10, alignItems: "center" }}>
        <ColorSwatch color={cur} label="Current" width={96} height={34} />
        <RoundEntry value={val} width={10} height={30} color={ok ? undefined : "rgb(var(--bad))"} label="Hex color" onChange={(v) => setVal(v.toUpperCase())} onEnter={confirm} style={{ width: "100%" }} />
        <ColorSwatch color={ok ? val.toUpperCase() : cur} label="New" width={96} height={34} />
      </div>
      <div style={{ display: "flex", gap: 5, marginTop: 14 }}>
        {["#FF5C5C", "#FF9F43", "#FFD166", "#4ADE80", "#2DD4BF", "#3B9CFF", "#7C5CFF", "#C471ED", "#FF5C9A", "#FFFFFF", "#8A8FA3", "#111118"].map((h) => <ColorSwatch key={h} color={h} label="" width={24} height={24} tip={h} onClick={() => setVal(h)} />)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 18 }}>
        <RoundButton text="Cancel" height={36} fill onClick={close} />
        <RoundButton text="OK" style="primary" height={36} fill disabled={!ok} onClick={confirm} />
      </div>
    </Dialog>
  );
}

export function ThemePickerDialog() {
  const s = useStore(); const close = () => s.set({ dialog: "settings" });
  return (
    <Dialog title="Choose a theme" width={690} onClose={close}>
      <H1>Choose a theme</H1>
      <div style={{ marginTop: 2, marginBottom: 14 }}><Label dim size={9}>Saved automatically and used the next time you open Gradient Gen.</Label></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 150px)", gap: 12 }}>
        {THEME_ORDER.map((k) => {
          const t = THEMES[k]; const sel = k === s.prefs.theme;
          return (
            <button key={k} aria-pressed={sel} onClick={() => { s.setPrefs({ theme: k }); s.set({ dialog: null }); }} style={{ position: "relative", width: 150, height: 84, borderRadius: 14, background: t.bg, border: `${sel ? 2 : 1}px solid ${sel ? t.accent : t.line}`, padding: 0, textAlign: "left" }}>
              <div style={{ position: "absolute", left: 12 - (sel ? 2 : 1), top: 12 - (sel ? 2 : 1), width: 126, height: 30, borderRadius: 8, background: t.surface, border: `1px solid ${t.line}` }} />
              {[t.accent, t.ink, t.dim].map((c, n) => <span key={n} style={{ position: "absolute", left: 24 + n * 22 - 6 - (sel ? 2 : 1), top: 27 - 6 - (sel ? 2 : 1), width: 12, height: 12, borderRadius: "50%", background: c }} />)}
              <span style={{ position: "absolute", left: 14 - (sel ? 2 : 1), top: 62 - 8 - (sel ? 2 : 1), fontSize: 13.333, fontWeight: 700, color: t.ink }}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </Dialog>
  );
}

export function AccentDialog() {
  const s = useStore(); const cur = (s.prefs.accent || THEMES[s.prefs.theme].accent).toUpperCase();
  const [val, setVal] = useState(cur);
  const apply = async () => { let h = val.trim().toUpperCase(); if (!h.startsWith("#")) h = "#" + h; if (!isHex(h)) { await s.showMsg("Accent color", "Please enter a color like #5240FF.", "error"); return; } s.setPrefs({ accent: h }); s.set({ dialog: "settings" }); };
  return (
    <Dialog title="Accent color" width={380} onClose={() => s.set({ dialog: "settings" })}>
      <H1>Accent color</H1>
      <div style={{ margin: "12px 0" }}><ColorPlane color={isHex(val.toUpperCase()) ? val : cur} onChange={setVal} /></div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}><RoundEntry value={val} width={10} label="Accent hex" onChange={(v) => setVal(v.toUpperCase())} onEnter={apply} style={{ width: "100%" }} /></div>
        <RoundButton text="Use this color" style="primary" height={34} onClick={apply} />
      </div>
    </Dialog>
  );
}

export function SettingsDialog() {
  const s = useStore(); const p = s.prefs; const close = () => s.set({ dialog: null });
  const lab = (t: string) => <div style={{ padding: "8px 16px 8px 0" }}><Label>{t}</Label></div>;
  const resetPrefs = async () => {
    if (!(await s.askYesNo("Reset Preferences", "Reset the theme, accent color, default format, default background, tooltips and the closing question to their original values?\n\nYour presets and palettes are not touched."))) return;
    s.setPrefs({ ...DEFAULT_PREFS }); s.set({ format: "PNG" }); s.patchOverlay({ background: "Transparent" }); s.say("Preferences reset"); close();
  };
  return (
    <Dialog title="Settings" width={520} onClose={close}>
      <H1>Settings</H1>
      <div style={{ marginTop: 2, marginBottom: 12 }}><Label dim size={9}>Saved automatically and used the next time you open Gradient Gen.</Label></div>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center" }}>
        {lab("Theme")}<div><RoundButton text="Choose Theme" icon="theme" height={32} size={9} onClick={() => s.set({ dialog: "theme" })} /></div><span />
        {lab("Accent Color")}<div><ColorSwatch color={(p.accent || THEMES[p.theme].accent).toUpperCase()} width={104} height={30} tip="Use your own accent color with any theme" onClick={() => s.set({ dialog: "accent" })} /></div><div><RoundButton text="Theme Default" height={30} size={9} onClick={() => s.setPrefs({ accent: "" })} /></div>
        {lab("Default Format")}<div style={{ justifySelf: "start" }}><RoundCombo value={p.default_format} values={["PNG", "JPEG", "WebP"]} width={6} center label="Default format" onChange={(v) => { s.setPrefs({ default_format: v as "PNG" }); s.set({ format: v as "PNG" }); }} /></div><span />
        {lab("Default Background")}<div style={{ justifySelf: "start" }}><RoundCombo value={p.default_background} values={["Transparent", "White", "Black"]} width={8} center label="Default background" onChange={(v) => { s.setPrefs({ default_background: v as "White" }); s.patchOverlay({ background: v as "White" }); }} /></div><span />
        {lab("Tooltips")}<div style={{ display: "flex", alignItems: "center", gap: 12 }}><Toggle on={p.tooltips} onChange={(v) => s.setPrefs({ tooltips: v })} tip="Show or hide the small hints" /><Label dim size={9}>Hints when you point at a control</Label></div><span />
        {lab("Ask Before Closing")}<div style={{ display: "flex", alignItems: "center", gap: 12 }}><Toggle on={p.confirm_close} onChange={(v) => s.setPrefs({ confirm_close: v })} tip="Ask first when the latest picture has not been saved" /><Label dim size={9}>When the latest picture is not saved</Label></div><span />
      </div>
      <Sep m="14px 0 12px" />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <RoundButton text="Tutorial" icon="help" height={32} onClick={() => s.set({ dialog: "tutorial" })} />
        <RoundButton text="Reset Preferences" height={32} onClick={resetPrefs} />
        <div style={{ flex: 1 }} />
        <RoundButton text="Done" style="primary" height={32} width={110} onClick={close} />
      </div>
    </Dialog>
  );
}

export function AboutDialog() {
  const s = useStore();
  return (
    <Dialog title="About" width={430} onClose={() => s.set({ dialog: null })} pad="20px 26px">
      <div style={{ textAlign: "center" }}><img src={`${BASE}assets/GG.png`} alt={APP_NAME} style={{ width: 330, maxWidth: "100%" }} /></div>
      <div style={{ textAlign: "center", marginTop: 4 }}><Label dim>Version {APP_VERSION}</Label></div>
      <Sep m="14px 0" />
      <div style={{ maxWidth: 370, lineHeight: 1.3 }}><Label>A powerful gradient generation tool with multiple gradient types and effects.</Label></div>
      <div style={{ marginTop: 4 }}>
        {["Multiple Gradient Types", "Color & Opacity Controls", "Effects & Intensities", "Preset Management", "Batch Mode", "8 Color Themes", "Real-time Preview"].map((t) => (
          <div key={t} style={{ display: "flex", alignItems: "center", padding: "1px 0 1px 10px" }}><span style={{ color: "rgb(var(--accent))", fontSize: 8, marginRight: 9 }}>●</span><Label>{t}</Label></div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", margin: "18px 0 6px" }}>
        <img src={`${BASE}assets/NS.png`} alt="" width={70} height={70} style={{ marginRight: 14 }} />
        <div><div><Label dim size={8}>Developed by</Label></div><div><Label size={12} bold style={{ color: "rgb(var(--accent))" }}>Nihad Square</Label></div></div>
      </div>
      {["Product: Premium", `Build: ${APP_BUILD}`, `Version: ${APP_VERSION}`, `Web version: ${WEB_VERSION}`].map((t) => <div key={t}><Label dim size={8}>{t}</Label></div>)}
      <Sep m="12px 0" />
      <div style={{ textAlign: "center" }}><Label dim size={9}>© 2025-2026 Nihad Square. All rights reserved.</Label></div>
      <div style={{ textAlign: "center", marginTop: 8 }}><a href={REPO_URL} target="_blank" rel="noreferrer" style={{ color: "rgb(var(--accent))", textDecoration: "underline", fontSize: 13.333 }}>GitHub</a></div>
    </Dialog>
  );
}

const STEPS = [
  "Gradient: pick a type, then set Direction and Position.",
  "Colors: up to 12. Click a dot or a chip to pick one, then set its color, position and opacity. On the bar: click to add, drag to move, double-click to change, right-click to delete.",
  "Blend In (RGB, HSL or OKLab) sets how colors mix; To Next sets how each color moves on (Smooth, Ease, Step, Hold).",
  "Generate Palette makes matching colors. Palette Tools holds Library, Edit, Harmony and Import.",
  "Library: Extract Colors from an image, choose how many to find and how to Pick them. Use the Select and Order lists to pick groups (First 12, Most Vivid, Warm Only ...) or set the number order, then Use Selected.",
  "Effects: add up to two and set their strength.",
  "Auto Generate picks 2 to 12 colors at random. Lock icons keep a setting fixed; Seed keeps a pattern, the dice makes a new one.",
  "Undo / Redo steps back and forth through your changes. Presets save your looks; star favorites or try Random.",
  "Output: size presets, PNG / JPEG / WebP, quality and Background. Overlays add text or a logo. Big exports show a progress bar with Cancel.",
  "Copy as: Image (Ctrl+C), CSS (Ctrl+K), SVG. Guides (G) show thirds, safe area and crop frames on the preview only.",
  "Settings (header): theme, accent color, default format, background, Tooltips and the closing question.",
  "Shortcuts: Ctrl+S save, Ctrl+Z / Ctrl+Y undo / redo, Space auto generate, F full screen, G guides.",
];
export function TutorialDialog() {
  const s = useStore(); const close = () => s.set({ dialog: "settings" });
  return (
    <Dialog title="Tutorial" width={470} onClose={close} pad="20px 24px">
      <H1>Quick start</H1>
      <div style={{ height: 12 }} />
      {STEPS.map((t, i) => (
        <div key={i} style={{ display: "flex", alignItems: "flex-start", padding: "4px 0", gap: 12 }}>
          <span style={{ background: "rgb(var(--accent))", color: "rgb(var(--accent-ink))", fontSize: 12, fontWeight: 700, minWidth: 24, height: 22, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>{i + 1}</span>
          <span style={{ lineHeight: 1.3, maxWidth: 380 }}><Label>{t}</Label></span>
        </div>
      ))}
      <div style={{ marginTop: 18 }}><RoundButton text="Got it" style="primary" height={36} fill onClick={close} /></div>
    </Dialog>
  );
}
export { Icon };
