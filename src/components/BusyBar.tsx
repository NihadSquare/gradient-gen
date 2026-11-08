import { useEffect } from "react";
import { useStore } from "../store/useStore";

export function BusyBar() {
  const busy = useStore((s) => s.busy);
  if (!busy) return null;
  return (
    <div className="fixed inset-x-0 bottom-20 z-[55] mx-auto flex w-[min(92vw,420px)] items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-2xl" role="status">
      <div className="min-w-0 flex-1"><div className="truncate text-[13px]">{busy.label}</div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-track"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.round(Math.min(1, busy.progress) * 100)}%` }} /></div></div>
      {busy.cancel && <button className="btn-soft !h-8" onClick={busy.cancel}>Cancel</button>}
    </div>
  );
}

export function Toasts() {
  const toast = useStore((s) => s.toast);
  const set = useStore((s) => s.set);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => set({ toast: null }), 4500); return () => clearTimeout(t); }, [toast, set]);
  if (!toast) return null;
  const color = toast.kind === "bad" ? "text-bad" : toast.kind === "warn" ? "text-warn" : "text-ok";
  return (
    <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 px-3" role={toast.kind === "bad" ? "alert" : "status"}>
      <div className={`flex items-center gap-2 rounded-xl border border-line bg-surface2 px-4 py-2.5 text-[13px] shadow-2xl`}>
        <span className={`h-2 w-2 rounded-full bg-current ${color}`} />{toast.text}
      </div>
    </div>
  );
}
