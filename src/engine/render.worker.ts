/// <reference lib="webworker" />
import { renderGradient } from "./render";
import type { GradientSettings } from "./types";

export interface WorkerRequest {
  id: number;
  settings: GradientSettings;
  width: number;
  height: number;
}
export type WorkerReply =
  | { type: "progress"; id: number; f: number; label: string }
  | { type: "done"; id: number; width: number; height: number; buffer: ArrayBuffer }
  | { type: "error"; id: number; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { id, settings, width, height } = e.data;
  try {
    const px = renderGradient(settings, width, height, (f, label) => ctx.postMessage({ type: "progress", id, f, label } satisfies WorkerReply));
    const buffer = px.data.buffer as ArrayBuffer;
    ctx.postMessage({ type: "done", id, width: px.width, height: px.height, buffer } satisfies WorkerReply, [buffer]);
  } catch (err) {
    ctx.postMessage({ type: "error", id, message: err instanceof Error ? err.message : String(err) } satisfies WorkerReply);
  }
};
