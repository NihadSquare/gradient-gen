#!/usr/bin/env node
// Gradient Gen - Copyright (c) 2026 AK Nihad (Nihad Square). All rights reserved.
// Source-available, not open source: see LICENSE. Copying or reuse is not permitted without written permission.
//
// Keeps the ownership protections from being lost by accident: every source file carries the
// copyright header, the engine keeps its build identifiers, and the official-site list exists.
// Plain Node (no extra dev dependency), run by "npm test" before the Vitest suite.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const MARKER = /gg\.[0-9a-f]{12}\.[0-9a-f]{4}/;
let problems = [];

function listFiles(dir, exts) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) out.push(...listFiles(p, exts));
    else if (exts.includes(path.extname(name))) out.push(p);
  }
  return out;
}

const srcFiles = listFiles(path.join(root, "..", "src"), [".ts", ".tsx", ".css"]);
const missingHeader = srcFiles.filter((f) => !/Copyright \(c\) 2026 AK Nihad/.test(fs.readFileSync(f, "utf8").slice(0, 400)));
if (missingHeader.length) problems.push("Missing copyright header:\n" + missingHeader.map((f) => "  - " + path.relative(path.join(root, ".."), f)).join("\n"));

for (const name of ["render.ts", "fields.ts", "effects.ts"]) {
  const f = path.join(root, "..", "src", "engine", name);
  if (!MARKER.test(fs.readFileSync(f, "utf8"))) problems.push("Missing build identifier in src/engine/" + name);
}
const desktopFile = path.join(root, "..", "desktop", "gradient_gen.py");
if (!MARKER.test(fs.readFileSync(desktopFile, "utf8"))) problems.push("Missing build identifier in desktop/gradient_gen.py");

const configSrc = fs.readFileSync(path.join(root, "..", "src", "config.ts"), "utf8");
if (!/ALLOWED_HOSTS = \[/.test(configSrc)) problems.push("src/config.ts is missing ALLOWED_HOSTS (the official-site guard)");

if (problems.length) {
  console.error("Ownership protection check FAILED:\n\n" + problems.join("\n\n"));
  process.exit(1);
}
console.log("Ownership protection check: OK (" + srcFiles.length + " source files, engine markers and official-site list all present)");
