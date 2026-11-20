// Talks to the render worker. The preview slot keeps only the newest request; the export slot can be cancelled.
import { renderGradient, type Pixels } from "../engine/render";
import type { GradientSettings } from "../engine/types";
import type { WorkerReply, WorkerRequest } from "../engine/render.worker";

interface Job {
  id: number;
  settings: GradientSettings;
  width: number;
  height: number;
  resolve: (p: Pixels) => void;
  reject: (e: Error) => void;
  onProgress?: (f: number, label: string) => void;
}

export class Superseded extends Error {
  constructor() {
    super("superseded");
  }
}

let nextId = 1;

export class RenderSlot {
  private worker: Worker | null = null;
  private current: Job | null = null;
  private pending: Job | null = null;
  private broken = false;

  constructor(private latestWins: boolean) {}

  private ensure(): Worker | null {
    if (this.broken) return null;
    if (this.worker) return this.worker;
    try {
      const w = new Worker(new URL("../engine/render.worker.ts", import.meta.url), { type: "module" });
      w.onmessage = (e: MessageEvent<WorkerReply>) => this.onMessage(e.data);
      w.onerror = () => {
        this.broken = true; // workers unavailable: fall back to the main thread
        this.worker = null;
        const j = this.current;
        this.current = null;
        if (j) this.runInline(j);
      };
      this.worker = w;
      return w;
    } catch {
      this.broken = true;
      return null;
    }
  }

  private onMessage(m: WorkerReply) {
    const job = this.current;
    if (!job || job.id !== m.id) return;
    if (m.type === "progress") {
      job.onProgress?.(m.f, m.label);
      return;
    }
    this.current = null;
    if (m.type === "done") job.resolve({ width: m.width, height: m.height, data: new Uint8ClampedArray(m.buffer) });
    else job.reject(new Error(m.message));
    this.next();
  }

  private runInline(job: Job) {
    setTimeout(() => {
      try {
        job.resolve(renderGradient(job.settings, job.width, job.height, job.onProgress));
      } catch (e) {
        job.reject(e instanceof Error ? e : new Error(String(e)));
      }
      this.current = null;
      this.next();
    }, 0);
  }

  private next() {
    if (this.current || !this.pending) return;
    const job = this.pending;
    this.pending = null;
    this.current = job;
    const w = this.ensure();
    if (w) w.postMessage({ id: job.id, settings: job.settings, width: job.width, height: job.height } satisfies WorkerRequest);
    else this.runInline(job);
  }

  render(settings: GradientSettings, width: number, height: number, onProgress?: (f: number, label: string) => void): Promise<Pixels> {
    return new Promise<Pixels>((resolve, reject) => {
      const job: Job = { id: nextId++, settings, width, height, resolve, reject, onProgress };
      if (this.latestWins && this.pending) this.pending.reject(new Superseded());
      this.pending = job;
      this.next();
    });
  }

  /** stop the running job and any waiting one */
  cancel() {
    const err = new Error("cancelled");
    this.pending?.reject(err);
    this.pending = null;
    if (this.current) {
      this.current.reject(err);
      this.current = null;
      this.worker?.terminate();
      this.worker = null;
    }
  }
}

export const previewSlot = new RenderSlot(true);
export const exportSlot = new RenderSlot(false);
