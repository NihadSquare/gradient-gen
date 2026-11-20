import { useEffect, useRef, useState } from "react";
import { renderGradient } from "../engine/render";
import { Rng } from "../engine/rng";
import { BLEND_MODES, TRANSITIONS, isHex } from "../engine/color";
import { clampNum } from "../engine/sanitize";
import { EFFECTS, GRADIENT_TYPES, MAX_COLORS, POSITIONS, type GradientSettings } from "../engine/types";
import { downloadText } from "../lib/files";
import { useStore, type Preset } from "../store/useStore";
import { Icon } from "./Icon";
import { Dialog, Label, RoundButton, RoundEntry } from "./widgets";

/** The picture of a saved preset, drawn small (the desktop's preset_thumbnail) */
export function presetToSettings(p: Preset): GradientSettings {
  let n = String(p.num_colors ?? "2"); if (!/^([2-9]|1[0-2])$/.test(n)) n = "2"; const num = Number(n);
  const cols = (Array.isArray(p.colors) ? p.colors : []).slice(0, MAX_COLORS).map((c) => (isHex(String(c).toUpperCase()) ? String(c).toUpperCase() : "#CCCCCC"));
  while (cols.length < MAX_COLORS) cols.push("#CCCCCC");
  const ops = (Array.isArray(p.color_opacities) ? p.color_opacities : []).map((o) => clampNum(o, 0, 1, 1)); while (ops.length < MAX_COLORS) ops.push(1);
  const raw = p.color_positions; const pos = Array.isArray(raw) && raw.length >= num ? raw.map((v) => clampNum(v, 0, 1, 0)) : Array.from({ length: num }, (_, i) => i / (num - 1));
  const tr = Array.isArray(p.stop_trans) ? p.stop_trans : [];
  return {
    stops: Array.from({ length: num }, (_, i) => ({ color: cols[i], pos: pos[i] ?? 0, opacity: ops[i], trans: ((TRANSITIONS as readonly string[]).includes(tr[i] as string) ? tr[i] : "Smooth") as never })),
    reverse: !!p.reverse_colors, blend: ((BLEND_MODES as readonly string[]).includes(p.blend_mode as string) ? p.blend_mode : "RGB") as never,
    type: ((GRADIENT_TYPES as readonly string[]).includes(p.gradient_type as string) ? p.gradient_type : "Linear") as never, direction: clampNum(parseFloat(String(p.direction ?? "0").replace("°", "")), 0, 360, 0),
    position: ((POSITIONS as readonly string[]).includes(p.other_direction as string) ? p.other_direction : "Center") as never, customX: clampNum(p.custom_x, 0, 100, 50), customY: clampNum(p.custom_y, 0, 100, 50),
    effect: ((EFFECTS as readonly string[]).includes(p.effect as string) ? p.effect : "None") as never, effect2: ((EFFECTS as readonly string[]).includes(p.secondary_effect as string) ? p.secondary_effect : "None") as never,
    intensity: clampNum(p.intensity, 0, 0.5, 0.1), intensity2: clampNum(p.secondary_intensity, 0, 0.5, 0.1), seed: Number.isFinite(Number(p.noise_seed)) ? Math.abs(Math.floor(Number(p.noise_seed))) % 2 ** 31 : new Rng(1).int(0, 1e9),
  };
}

function Thumb({ p }: { p: Preset }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    try { const px = renderGradient(presetToSettings(p), 144, 80); const c = ref.current!; c.width = 144; c.height = 80; c.getContext("2d")!.putImageData(new ImageData(px.data as Uint8ClampedArray<ArrayBuffer>, 144, 80), 0, 0); } catch { /* leave blank */ }
  }, [p]);
  return <canvas ref={ref} className="checker" style={{ width: 72, height: 40, borderRadius: 6, display: "block" }} />;
}

export function PresetsDialog() {
  const s = useStore(); const close = () => s.set({ dialog: null });
  const [name, setName] = useState("New Preset Name");
  const [sel, setSel] = useState<number | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const list = s.presets;
  const err = (m: string) => s.showMsg("Error", m, "error");
  const need = async (verb: string) => { if (sel === null || !list[sel]) { await err(`Select a preset to ${verb}`); return null; } return sel; };
  const order = list.map((_, k) => k).sort((a, b) => Number(!list[a].favorite) - Number(!list[b].favorite) || a - b);
  const save = async () => {
    const n = name.trim(); if (!n) return err("Preset name cannot be empty");
    const preset = { ...s.presetOf(), name: n, favorite: false } as Preset; const next = [...list]; const k = next.findIndex((e) => e.name === n);
    if (k >= 0) { preset.favorite = !!next[k].favorite; next[k] = preset; setSel(k); } else { next.push(preset); setSel(next.length - 1); }
    s.savePresets(next);
  };
  const load = async () => { const i = await need("load"); if (i !== null) s.applyPreset(list[i]); };
  return (
    <Dialog title="Manage Presets" width={500} onClose={close}>
      <div style={{ fontSize: 17.333, fontWeight: 700 }}>Presets</div>
      <div style={{ margin: "10px 0 4px" }}><Label dim size={9}>Name</Label></div>
      <RoundEntry value={name} width={30} center={false} label="Preset name" style={{ width: "100%" }} onChange={setName} />
      <div style={{ margin: "14px 0 4px" }}><Label dim size={9}>Saved presets   (click: select  |  double-click: load  |  star: favourite)</Label></div>
      <div className="g-scrollthin" style={{ height: 260, overflowY: "auto", paddingRight: 0 }}>
        {order.length === 0 && <div style={{ padding: "10px 0", maxWidth: 400 }}><Label dim size={9}>No presets yet. Set up a look, type a name above and press Save Current.</Label></div>}
        {order.map((i) => {
          const p = list[i]; const on = i === sel; const fav = !!p.favorite;
          return (
            <div key={i} onClick={() => { setSel(i); setName(String(p.name ?? "")); }} onDoubleClick={() => { setSel(i); s.applyPreset(p); }}
              style={{ display: "flex", alignItems: "center", margin: "3px 12px 3px 0", background: on ? "color-mix(in srgb, rgb(var(--accent)) 32%, rgb(var(--surface2)))" : "rgb(var(--surface2))", cursor: "default" }}>
              <div style={{ margin: "8px 10px 8px 8px" }}><Thumb p={p} /></div>
              <div style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13.333 }}>{String(p.name ?? "Unnamed")}</div>
              <div style={{ margin: "0 8px 0 6px" }} onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                <RoundButton icon={fav ? "star_fill" : "star"} style={fav ? "primary" : "ghost"} height={30} radius={9} tip={fav ? "Remove from favourites" : "Add to favourites (shown first)"} onClick={() => { const n = [...list]; n[i] = { ...n[i], favorite: !fav }; s.savePresets(n); }} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, margin: "14px 0 6px" }}>
        <RoundButton text="Load" style="primary" height={36} fill onClick={load} />
        <RoundButton text="Save Current" height={36} fill onClick={save} />
        <RoundButton text="Random" icon="sparkle" height={36} fill tip="Apply a random preset (from your favourites if you have any)" onClick={async () => { if (!list.length) return err("No presets saved yet"); const pool = list.filter((p) => p.favorite); const arr = pool.length ? pool : list; s.applyPreset(arr[Math.floor(Math.random() * arr.length)]); }} />
      </div>
      <input ref={file} hidden type="file" accept="application/json,.json" onChange={async (e) => {
        const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
        try { const j = JSON.parse(await f.text()); const items = Array.isArray(j) ? j : [j]; if (!items.length || items.some((x) => typeof x !== "object" || x === null || !("name" in x))) throw new Error("Invalid preset format"); s.savePresets([...list, ...items]); s.say(`Preset imported from ${f.name}`, 6000); } catch (x) { await err(`Failed to import preset: ${(x as Error).message}`); }
      }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4 }}>
        <RoundButton text="Rename" style="ghost" height={32} fill onClick={async () => { const i = await need("rename"); if (i === null) return; const n = name.trim(); if (!n) return err("New preset name cannot be empty"); const next = [...list]; next[i] = { ...next[i], name: n }; s.savePresets(next); }} />
        <RoundButton text="Delete" style="ghost" height={32} fill onClick={async () => { const i = await need("delete"); if (i === null) return; s.savePresets(list.filter((_, k) => k !== i)); setSel(null); }} />
        <RoundButton text="Import" style="ghost" height={32} fill onClick={() => file.current?.click()} />
        <RoundButton text="Export" style="ghost" height={32} fill onClick={async () => { const i = await need("export"); if (i === null) return; const fn = `${String(list[i].name).replace(/[^\w.-]+/g, "_") || "preset"}.json`; downloadText(JSON.stringify(list[i], null, 2), fn); s.say(`Preset exported to ${fn}`, 6000); }} />
      </div>
    </Dialog>
  );
}
export { Icon };
