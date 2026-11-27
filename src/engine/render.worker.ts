// Gradient Gen - Copyright (c) 2026 AK Nihad (Nihad Square). All rights reserved.
// Source-available, not open source: see LICENSE. Copying or reuse is not permitted without written permission.
/// <reference lib="webworker" />
import { ENGINE_BUILD, renderGradient } from "./render";
import { FIELDS_BUILD } from "./fields";
import { EFFECTS_BUILD } from "./effects";
import type { GradientSettings } from "./types";

export interface WorkerRequest {
  id: number;
  settings: GradientSettings;
  width: number;
  height: number;
}
export type WorkerReply =
  | { type: "progress"; id: number; f: number; label: string }
  | { type: "done"; id: number; width: number; height: number; buffer: ArrayBuffer; build?: string }
  | { type: "error"; id: number; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const BUILD = [ENGINE_BUILD, FIELDS_BUILD, EFFECTS_BUILD].join("|");

ctx.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { id, settings, width, height } = e.data;
  try {
    const px = renderGradient(settings, width, height, (f, label) => ctx.postMessage({ type: "progress", id, f, label } satisfies WorkerReply));
    const buffer = px.data.buffer as ArrayBuffer;
    ctx.postMessage({ type: "done", id, width: px.width, height: px.height, buffer, build: BUILD } satisfies WorkerReply, [buffer]);
  } catch (err) {
    ctx.postMessage({ type: "error", id, message: err instanceof Error ? err.message : String(err) } satisfies WorkerReply);
  }
};
