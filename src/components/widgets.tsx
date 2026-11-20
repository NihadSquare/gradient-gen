import { cloneElement, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { contrastTextOn } from "../lib/colorutil";
import { Icon } from "./Icon";
import { useStore } from "../store/useStore";

const cx = (...a: (string | false | undefined)[]) => a.filter(Boolean).join(" ");

// ── Tooltip (shown after 450 ms, 6 px under the control) ─────────────────
export function Tip({ text, children }: { text?: string; children: ReactElement }) {
  const enabled = useStore((s) => s.prefs.tooltips);
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
  const timer = useRef<number>();
  const ref = useRef<HTMLSpanElement>(null);
  const hide = useCallback(() => { window.clearTimeout(timer.current); setTip(null); }, []);
  useEffect(() => hide, [hide]);
  if (!text) return children;
  return (
    <span ref={ref} style={{ display: "contents" }}
      onMouseOver={() => { if (!enabled || tip) return; window.clearTimeout(timer.current); timer.current = window.setTimeout(() => { const el = ref.current?.firstElementChild as HTMLElement | null; if (!el) return; const r = el.getBoundingClientRect(); setTip({ x: r.left, y: r.bottom + 6 }); }, 450); }}
      onMouseOut={(e) => { if (!ref.current?.contains(e.relatedTarget as Node)) hide(); }} onMouseDown={hide}>
      {children}
      {tip && createPortal(<div className="g-tip" style={{ left: Math.min(tip.x, window.innerWidth - 300), top: tip.y }}>{text}</div>, document.body)}
    </span>
  );
}

// ── Buttons ─────────────────────────────────────────────────────────────
interface BtnProps { text?: string; icon?: string; onClick?: () => void; style?: "primary" | "secondary" | "ghost"; height?: number; width?: number; radius?: number; size?: number; compact?: boolean; fill?: boolean; accentText?: boolean; disabled?: boolean; tip?: string; label?: string }
export function RoundButton({ text, icon, onClick, style = "secondary", height = 34, width, radius = 10, size = 10, compact, fill, accentText, disabled, tip, label }: BtnProps) {
  const sq = !text;
  const css: CSSProperties = { height, borderRadius: radius, fontSize: (size * 4) / 3, width: width ?? (sq ? height : undefined), padding: sq || width ? 0 : undefined };
  return (
    <Tip text={tip}>
      <button className={cx("g-btn", style, compact && "compact", fill && "fill", accentText && "accent-text")} style={css} disabled={disabled} onClick={onClick} aria-label={label ?? text ?? tip}>
        {icon && <Icon name={icon} size={18} />}{text}
      </button>
    </Tip>
  );
}

export function Toggle({ on, onChange, tip, label, disabled }: { on: boolean; onChange: (v: boolean) => void; tip?: string; label?: string; disabled?: boolean }) {
  return (
    <Tip text={tip}><button role="switch" aria-checked={on} aria-label={label ?? tip} className={cx("g-toggle", on && "on")} disabled={disabled} onClick={() => onChange(!on)} /></Tip>
  );
}

export function LockToggle({ on, onChange, text, tip }: { on: boolean; onChange: (v: boolean) => void; text?: string; tip?: string }) {
  const t = tip ?? (text ? `Lock ${text}: Auto Generate leaves it unchanged` : "Lock: keep this unchanged when randomizing");
  return (
    <Tip text={t}>
      <button className={cx("g-lock", on && "on")} aria-pressed={on} aria-label={t} onClick={() => onChange(!on)}>
        <span className="sq"><Icon name={on ? "lock" : "unlock"} size={16} /></span>{text}
      </button>
    </Tip>
  );
}

// ── Pill slider ─────────────────────────────────────────────────────────
export function PillSlider({ value, min, max, onChange, step, width, tip, label, disabled }: { value: number; min: number; max: number; onChange: (v: number) => void; step?: number; width?: number; tip?: string; label?: string; disabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const stepSize = step ?? (() => { const raw = (max - min) * 0.02; return [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10].reduce((a, b) => (Math.abs(b - raw) < Math.abs(a - raw) ? b : a)); })();
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)));
  const frac = max === min ? 0 : (value - min) / (max - min);
  const fromX = (clientX: number) => { const r = ref.current!.getBoundingClientRect(); const pad = 10; set(min + Math.min(1, Math.max(0, (clientX - r.left - pad) / Math.max(1, r.width - 2 * pad))) * (max - min)); };
  return (
    <Tip text={tip}>
      <div ref={ref} className={cx("g-slider", disabled && "dis")} style={width ? { width } : undefined} tabIndex={0} role="slider" aria-label={label ?? tip} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value}
        onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); (e.currentTarget as HTMLElement).focus(); fromX(e.clientX); }}
        onPointerMove={(e) => { if (e.buttons & 1) fromX(e.clientX); }}
        onWheel={(e) => { if (document.activeElement !== e.currentTarget) return; e.preventDefault(); set(Math.round((value + (e.deltaY < 0 ? 1 : -1) * stepSize) / stepSize) * stepSize); }}
        onKeyDown={(e) => { if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); set(value + stepSize); } if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); set(value - stepSize); } }}>
        <div className="tr" /><div className="fl" style={{ width: `calc((100% - 20px) * ${frac})` }} />
        <div className="kn" style={{ left: `calc(1px + (100% - 20px) * ${frac})`, marginLeft: 0 }} />
      </div>
    </Tip>
  );
}

// ── Combo with the desktop's rounded drop-down list ─────────────────────
const ROW = 28, PAD = 6, MAXROWS = 9;
export function RoundCombo({ value, values, onChange, width = 12, center, disabled, height = 30, swatches, tip, label }: { value: string; values: readonly string[]; onChange: (v: string) => void; width?: number; center?: boolean; disabled?: boolean; height?: number; swatches?: boolean; tip?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const isHex = (v: string) => /^#[0-9A-Fa-f]{6}$/.test(v);
  const step = (d: number) => { if (disabled || !values.length) return; const i = values.indexOf(value); onChange(values[Math.max(0, Math.min(values.length - 1, (i < 0 ? (d > 0 ? -1 : values.length) : i) + d))]); };
  return (
    <Tip text={tip}>
      <button ref={btn} className={cx("g-combo", center && "center", open && "open")} style={{ height, minWidth: `calc(${width}ch + 40px)` }} disabled={disabled} aria-haspopup="listbox" aria-expanded={open} aria-label={label ?? tip}
        onMouseDown={(e) => { e.preventDefault(); btn.current?.focus(); if (!disabled) setOpen((o) => !o); }}
        onKeyDown={(e) => { if (e.key === "ArrowUp") { e.preventDefault(); step(-1); } else if (e.key === "ArrowDown") { e.preventDefault(); step(1); } else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(true); } }}
        onWheel={(e) => { if (document.activeElement === btn.current && !open) { e.preventDefault(); step(e.deltaY < 0 ? -1 : 1); } }}>
        {swatches && isHex(value) && <span className="g-chipsq" style={{ background: value, border: "1px solid rgb(var(--ink) / .35)", marginRight: 8 }} />}
        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</span>
        <span className="chev"><Icon name="chevron" size={14} /></span>
        {open && btn.current && <DropList anchor={btn.current} values={values} value={value} center={center} swatches={swatches} onPick={(v) => { onChange(v); setOpen(false); btn.current?.focus(); }} onClose={() => setOpen(false)} />}
      </button>
    </Tip>
  );
}

function DropList({ anchor, values, value, center, swatches, onPick, onClose }: { anchor: HTMLElement; values: readonly string[]; value: string; center?: boolean; swatches?: boolean; onPick: (v: string) => void; onClose: () => void }) {
  const n = values.length, rows = Math.max(1, Math.min(n, MAXROWS));
  const cur = values.indexOf(value);
  const [off, setOff] = useState(cur >= rows ? Math.max(0, Math.min(cur - Math.floor(rows / 2), n - rows)) : 0);
  const [hov, setHov] = useState(cur);
  const [pos, setPos] = useState<{ x: number; y: number; w: number }>({ x: 0, y: 0, w: 90 });
  const ref = useRef<HTMLDivElement>(null);
  const h = rows * ROW + 2 * PAD + 2;
  useLayoutEffect(() => {
    const r = anchor.getBoundingClientRect();
    let y = r.bottom + 3;
    if (y + h > window.innerHeight - 8) y = r.top - h - 3;
    setPos({ x: r.left, y: Math.max(0, y), w: Math.max(r.width, 90) });
  }, [anchor, h]);
  useEffect(() => {
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node) && !anchor.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
      else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setHov((hv) => { const nx = Math.max(0, Math.min(n - 1, (hv < 0 ? (e.key === "ArrowDown" ? 0 : n - 1) : hv + (e.key === "ArrowDown" ? 1 : -1)))); setOff((o) => (nx < o ? nx : nx >= o + rows ? nx - rows + 1 : o)); return nx; }); }
      else if (e.key === "Enter") { e.preventDefault(); setHov((hv) => { if (hv >= 0) onPick(values[hv]); return hv; }); }
    };
    document.addEventListener("mousedown", down, true); document.addEventListener("keydown", key, true);
    return () => { document.removeEventListener("mousedown", down, true); document.removeEventListener("keydown", key, true); };
  }, [anchor, n, rows, values, onClose, onPick]);
  const span = rows * ROW, thumbTop = (span * off) / n, thumbH = Math.max(6, (span * rows) / n);
  return createPortal(
    <div ref={ref} className="g-pop" style={{ left: pos.x, top: pos.y, width: pos.w, height: h }}
      onWheel={(e) => { if (n <= rows) return; e.preventDefault(); const st = n > 2 * rows ? 3 : 1; setOff((o) => Math.max(0, Math.min(n - rows, o + (e.deltaY < 0 ? -st : st)))); }}>
      {values.slice(off, off + rows).map((v, i) => {
        const idx = off + i;
        return (
          <div key={v + idx} className={cx("row", idx === cur && "cur", idx === hov && "hov", center && "center")} onMouseMove={() => setHov(idx)} onMouseDown={(e) => { e.preventDefault(); onPick(v); }}>
            {swatches && /^#[0-9A-Fa-f]{6}$/.test(v) && <span className="g-chipsq" style={{ background: v, border: "1px solid rgb(var(--ink) / .35)" }} />}{v}
          </div>
        );
      })}
      {n > rows && <div className="sb" style={{ top: PAD + 2 + thumbTop, height: thumbH - 4 }} />}
    </div>, document.body);
}

// ── Entry ───────────────────────────────────────────────────────────────
export function RoundEntry({ value, onChange, onCommit, width = 6, center = true, disabled, height = 30, numeric, maxLength, placeholder, tip, label, color, onEnter, type = "text", style }: { value: string; onChange?: (v: string) => void; onCommit?: (v: string) => void; width?: number; center?: boolean; disabled?: boolean; height?: number; numeric?: boolean; maxLength?: number; placeholder?: string; tip?: string; label?: string; color?: string; onEnter?: () => void; type?: string; style?: CSSProperties }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value;
  const commit = () => { if (draft !== null) { onCommit?.(draft); setDraft(null); } };
  return (
    <Tip text={tip}>
      <div className={cx("g-entry", disabled && "dis")} style={{ height, minWidth: `calc(${width}ch + 30px)`, ...style }}>
        <input type={type} aria-label={label ?? tip} value={shown} disabled={disabled} maxLength={maxLength} placeholder={placeholder} spellCheck={false} inputMode={numeric ? "numeric" : undefined}
          style={{ textAlign: center ? "center" : "left", color }}
          onFocus={(e) => e.target.select()}
          onChange={(e) => { const v = numeric ? e.target.value.replace(/[^0-9]/g, "") : e.target.value; if (onChange && !onCommit) onChange(v); else setDraft(v); if (onChange && onCommit) onChange(v); }}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") { commit(); onEnter?.(); (e.target as HTMLInputElement).blur(); } if (e.key === "Escape") { setDraft(null); (e.target as HTMLInputElement).blur(); } }} />
      </div>
    </Tip>
  );
}

// ── Segmented ───────────────────────────────────────────────────────────
export function Segmented<T extends string>({ value, options, onChange, segWidth = 92, height = 34 }: { value: T; options: readonly T[]; onChange: (v: T) => void; segWidth?: number; height?: number }) {
  return (
    <div className="g-seg" role="radiogroup" style={{ height: height - 10 + 2 + 8 - 2 }}>
      {options.map((o) => (
        <button key={o} role="radio" aria-checked={value === o} className={value === o ? "on" : ""} style={{ width: segWidth, height: height - 8 }} onClick={() => onChange(o)}>{o}</button>
      ))}
    </div>
  );
}

export function ColorSwatch({ color, label, width = 108, height = 30, onClick, tip, disabled }: { color: string; label?: string; width?: number | string; height?: number; onClick?: () => void; tip?: string; disabled?: boolean }) {
  const ok = /^#[0-9A-Fa-f]{6}$/.test(color);
  return (
    <Tip text={tip}>
      <button className="g-swatch" disabled={disabled} onClick={onClick} aria-label={tip ?? label ?? color}
        style={{ width, height, background: ok ? color : "rgb(var(--surface2))", color: ok ? contrastTextOn(color) : "rgb(var(--dim))", cursor: onClick && !disabled ? "pointer" : "default" }}>{label ?? color}</button>
    </Tip>
  );
}

// ── Layout helpers ──────────────────────────────────────────────────────
export function Card({ title, icon, children, radius = 14, className, style }: { title?: string; icon?: string; children: ReactNode; radius?: number; className?: string; style?: CSSProperties }) {
  return (
    <div className={cx("g-card", radius === 16 && "r16", className)} style={style}>
      {title && <div className="g-card-title">{icon && <span style={{ display: "flex" }}><Icon name={icon} size={14} /></span>}{title}</div>}
      {children}
    </div>
  );
}
export const Label = ({ children, dim, size = 10, bold, style }: { children: ReactNode; dim?: boolean; size?: number; bold?: boolean; style?: CSSProperties }) => (
  <span className={cx("g-label", dim ? "c-dim" : "c-text")} style={{ fontSize: (size * 4) / 3, fontWeight: bold ? 700 : 400, ...style }}>{children}</span>
);

// ── Dialog (themed window with a title bar like the desktop's) ──────────
export function Dialog({ title, width, onClose, children, pad = "18px 22px" }: { title: string; width: number; onClose: () => void; children: ReactNode; pad?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === "Escape" && !document.querySelector(".g-pop")) { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", key, true);
    return () => { window.removeEventListener("keydown", key, true); prev?.focus?.(); };
  }, [onClose]);
  return createPortal(
    <div className="g-back" onMouseDown={(e) => { if (e.target === e.currentTarget) e.stopPropagation(); }}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="g-win" style={{ width, outline: "none" }}>
        <div className="bar"><span>{title}</span><button className="x" aria-label="Close" onClick={onClose}>✕</button></div>
        <div className="body" style={{ padding: pad }}>{children}</div>
      </div>
    </div>, document.body);
}

export const Sep = ({ m = "14px 0" }: { m?: string }) => <div className="g-sep" style={{ margin: m }} />;
