import { useEffect, useRef, useState, type ReactNode } from "react";

// ── icons (stroke, 18px) ───────────────────────────────────────────────
const P: Record<string, string> = {
  undo: "M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3",
  redo: "m15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3",
  dice: "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z",
  unlock: "M7 11V8a5 5 0 0 1 9.5-2M6 11h12v9H6z",
  chevron: "m6 9 6 6 6-6",
  plus: "M12 5v14M5 12h14",
  close: "M6 6l12 12M18 6 6 18",
  copy: "M9 9h11v11H9zM5 15V4h11",
  download: "M12 4v12m0 0 5-5m-5 5-5-5M4 20h16",
  palette: "M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.9 1.5-1.9-.3-1 .4-2.1 1.5-2.1H17a4 4 0 0 0 4-4c0-5-4-10-9-10zM7.5 11h.01M10 7.5h.01M14 7.5h.01",
  contrast: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 3v18",
  save: "M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  expand: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  image: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9h.01",
  upload: "M12 16V4m0 0-5 5m5-5 5 5M4 20h16",
  keyboard: "M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5h.01",
  swap: "M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7",
  check: "m5 12 5 5 9-10",
  wand: "m5 19 10-10M14 4l1.5 2.5L18 8l-2.5 1.5L14 12l-1.5-2.5L10 8l2.5-1.5zM18 14l.8 1.4 1.4.8-1.4.8-.8 1.4-.8-1.4-1.4-.8 1.4-.8z",
  reset: "M4 12a8 8 0 1 0 3-6.2M4 4v5h5",
};
export function Icon({ name, size = 18 }: { name: keyof typeof P | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[name] ?? ""} />
    </svg>
  );
}

// ── layout ─────────────────────────────────────────────────────────────
export function Section({ title, children, defaultOpen = true, action }: { title: string; children: ReactNode; defaultOpen?: boolean; action?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-line/70 px-4 py-3">
      <div className="flex items-center">
        <button className="flex flex-1 items-center gap-2 py-1 text-left font-display text-[15px] font-extrabold tracking-tight" onClick={() => setOpen(!open)} aria-expanded={open}>
          <span className={`text-dim transition-transform ${open ? "" : "-rotate-90"}`}><Icon name="chevron" size={16} /></span>
          {title}
        </button>
        {action}
      </div>
      {open && <div className="mt-2 space-y-2.5">{children}</div>}
    </section>
  );
}

export function Row({ label, children, lock }: { label: string; children: ReactNode; lock?: ReactNode }) {
  return (
    <div className="grid grid-cols-[84px_1fr_auto] items-center gap-2">
      <span className="label">{label}</span>
      <div className="min-w-0">{children}</div>
      <div className="w-7">{lock}</div>
    </div>
  );
}

export function Lock({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button className={`icon-btn !h-7 !w-7 ${on ? "!text-accent" : ""}`} aria-pressed={on} title={`${on ? "Locked" : "Unlocked"}: Auto Generate ${on ? "keeps" : "changes"} ${label}`} onClick={() => onChange(!on)}>
      <Icon name={on ? "lock" : "unlock"} size={15} />
    </button>
  );
}

// ── inputs ─────────────────────────────────────────────────────────────
export function Select<T extends string>({ value, options, onChange, label }: { value: T; options: readonly T[] | readonly { value: T; label: string }[]; onChange: (v: T) => void; label?: string }) {
  return (
    <select className="field" value={value} aria-label={label} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (typeof o === "string" ? <option key={o} value={o}>{o.replace(/_/g, " ")}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
    </select>
  );
}

export function Slider({ value, min, max, step = 1, onChange, label, format }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; label: string; format?: (v: number) => string }) {
  return (
    <div className="flex items-center gap-2">
      <input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))}
        onWheel={(e) => { if (document.activeElement === e.currentTarget) { e.preventDefault(); onChange(Math.min(max, Math.max(min, value + (e.deltaY < 0 ? step : -step)))); } }} />
      {format && <span className="w-12 text-right text-[13px] tabular-nums text-dim">{format(value)}</span>}
    </div>
  );
}

/** a number box that lets you type freely and checks the value when you leave it */
export function NumberInput({ value, min, max, onCommit, className = "", label, step }: { value: number; min: number; max: number; onCommit: (v: number) => void; className?: string; label: string; step?: number }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const n = parseFloat(draft);
    setDraft(null);
    if (Number.isFinite(n)) onCommit(Math.min(max, Math.max(min, n)));
  };
  return (
    <input className={`field tabular-nums ${className}`} inputMode="decimal" aria-label={label} value={draft ?? String(Math.round(value * 100) / 100)} step={step}
      onFocus={(e) => e.target.select()} onChange={(e) => setDraft(e.target.value.replace(/[^0-9.\-]/g, ""))} onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") { commit(); (e.target as HTMLInputElement).blur(); } if (e.key === "Escape") setDraft(null); }} />
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? "bg-accent" : "bg-track"}`}>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: readonly T[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-lg bg-bg p-0.5" role="radiogroup">
      {options.map((o) => (
        <button key={o} role="radio" aria-checked={value === o} onClick={() => onChange(o)} className={`h-7 rounded-md px-3 text-[13px] font-semibold transition-colors ${value === o ? "bg-accent text-accent-ink" : "text-dim hover:text-ink"}`}>{o}</button>
      ))}
    </div>
  );
}

// ── modal ──────────────────────────────────────────────────────────────
export function Modal({ title, onClose, children, width = 520 }: { title: string; onClose: () => void; children: ReactNode; width?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", key, true);
    return () => { window.removeEventListener("keydown", key, true); prev?.focus?.(); };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} style={{ maxWidth: width }} className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-surface shadow-2xl outline-none sm:rounded-2xl">
        <div className="flex items-center border-b border-line px-5 py-3">
          <h2 className="flex-1 font-display text-lg font-extrabold">{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>
        <div className="scroll-thin overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function Swatch({ color, size = 28, onClick, title, selected }: { color: string; size?: number; onClick?: () => void; title?: string; selected?: boolean }) {
  return <button style={{ background: color, width: size, height: size }} className={`shrink-0 rounded-md border ${selected ? "border-ink ring-2 ring-accent" : "border-white/20"}`} onClick={onClick} title={title ?? color} aria-label={title ?? color} />;
}
