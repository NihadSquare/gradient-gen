// Gradient Gen - Copyright (c) 2026 AK Nihad (Nihad Square). All rights reserved.
// Source-available, not open source: see LICENSE. Copying or reuse is not permitted without written permission.
// Official-site check. The app starts only on the official address, on localhost, and not inside someone else's page.
// To allow another address (for example your own domain), add it to ALLOWED_HOSTS in config.ts
// or build with VITE_ALLOWED_HOSTS=example.com,www.example.com
import { ALLOWED_HOSTS, SITE_URL } from "../config";

function allowedHosts(): string[] {
  const extra = String(import.meta.env.VITE_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return [...ALLOWED_HOSTS, ...extra];
}

function framedByOthers(): boolean {
  try {
    if (window.top === window.self) return false;
    void window.top!.location.hostname; // throws when the outer page is on another site
    return false;
  } catch {
    return true;
  }
}

export function isOfficialHost(): boolean {
  if (import.meta.env.DEV) return true;
  const host = window.location.hostname.toLowerCase();
  return allowedHosts().includes(host) && !framedByOthers();
}

function showBlocked() {
  document.title = "Gradient Gen – unofficial copy";
  const root = document.getElementById("root") ?? document.body;
  root.textContent = "";
  const wrap = document.createElement("div");
  wrap.setAttribute("style", "min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0D0A1F;color:#ECE9FF;font:16px/1.5 system-ui,Segoe UI,sans-serif;padding:24px;text-align:center");
  const box = document.createElement("div");
  box.setAttribute("style", "max-width:460px;background:#16122E;border:1px solid #2F2862;border-radius:16px;padding:28px");
  const h = document.createElement("h1");
  h.setAttribute("style", "font-size:22px;font-weight:700;margin:0 0 10px");
  h.textContent = "This is not the official Gradient Gen";
  const p = document.createElement("p");
  p.setAttribute("style", "margin:0 0 18px;color:#B9B4E6");
  p.textContent = "This page is an unofficial copy and has been switched off. The real, free app is here:";
  const a = document.createElement("a");
  a.href = SITE_URL;
  a.target = "_top";
  a.setAttribute("style", "display:inline-block;background:#5240FF;color:#fff;text-decoration:none;font-weight:700;padding:10px 18px;border-radius:10px");
  a.textContent = "Open the official app";
  box.append(h, p, a);
  wrap.append(box);
  root.append(wrap);
}

/** Runs `start` only on an official address; otherwise shows a notice. */
export function runGuard(start: () => void): void {
  if (isOfficialHost()) start();
  else showBlocked();
}
