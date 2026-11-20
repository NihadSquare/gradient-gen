import { useStore } from "../store/useStore";
import { PreviewArea } from "./Preview";
import { Icon } from "./Icon";
import { Dialog, Label, RoundButton } from "./widgets";
import { PaletteToolsDialog } from "./PaletteTools";
import { ContrastDialog } from "./ContrastDialog";
import { PresetsDialog } from "./PresetsDialog";
import { AboutDialog, AccentDialog, ColorPickerDialog, SettingsDialog, ThemePickerDialog, TutorialDialog } from "./DialogsA";

function MsgBox() {
  const m = useStore((s) => s.msg); const set = useStore((s) => s.set);
  if (!m) return null;
  const done = (v: boolean) => { set({ msg: null }); m.resolve(v); };
  return (
    <Dialog title={m.title} width={420} onClose={() => done(false)}>
      <div style={{ display: "flex", gap: 14 }}>
        <span style={{ color: m.kind === "error" ? "rgb(var(--bad))" : m.kind === "warn" ? "rgb(var(--warn))" : "rgb(var(--accent))", marginTop: 2 }}><Icon name={m.kind === "yesno" ? "help" : "info"} size={26} /></span>
        <div style={{ whiteSpace: "pre-wrap", fontSize: 13.333, lineHeight: 1.45, flex: 1 }}>{m.text}</div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
        {m.kind === "yesno" ? (<><RoundButton text="No" height={32} width={80} onClick={() => done(false)} /><RoundButton text="Yes" style="primary" height={32} width={80} onClick={() => done(true)} /></>) : <RoundButton text="OK" style="primary" height={32} width={80} onClick={() => done(true)} />}
      </div>
    </Dialog>
  );
}

function ProgressBox() {
  const p = useStore((s) => s.progress);
  if (!p) return null;
  return (
    <Dialog title={p.title} width={360} onClose={() => {}} >
      <Label>{p.text}</Label>
      <div className="g-progress" style={{ marginTop: 12 }}><i style={{ width: `${Math.round(p.frac * 100)}%` }} /></div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}><RoundButton text="Cancel" height={32} width={90} onClick={async () => { (await import("../lib/actions")).cancelExport(); }} /></div>
    </Dialog>
  );
}

export function Fullscreen() {
  const s = useStore();
  if (!s.fullscreen) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 70, background: "#000" }} onKeyDown={() => {}}>
      <PreviewArea fullscreen />
      <button aria-label="Close" onClick={() => s.set({ fullscreen: false })} style={{ position: "absolute", right: 12, top: 10, color: "#fff", background: "rgb(0 0 0 / .5)", border: 0, width: 34, height: 34, borderRadius: 17, fontSize: 16 }}>✕</button>
    </div>
  );
}

export function DialogHost() {
  const d = useStore((s) => s.dialog);
  return (<>
    {d === "settings" && <SettingsDialog />}{d === "theme" && <ThemePickerDialog />}{d === "accent" && <AccentDialog />}{d === "color" && <ColorPickerDialog />}
    {d === "presets" && <PresetsDialog />}{d === "contrast" && <ContrastDialog />}{d === "palette" && <PaletteToolsDialog />}{d === "about" && <AboutDialog />}{d === "tutorial" && <TutorialDialog />}
    <MsgBox /><ProgressBox />
  </>);
}
