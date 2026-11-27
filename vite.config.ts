// Gradient Gen - Copyright (c) 2026 AK Nihad (Nihad Square). All rights reserved.
// Source-available, not open source: see LICENSE. Copying or reuse is not permitted without written permission.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { obfuscateUi } from "./tools/obfuscate-ui";

// "./" makes the build work on any GitHub Pages path (user site or project site)
// without editing this file. Set VITE_BASE to override it (for example "/gradient-gen/").
export default defineConfig({
  base: process.env.VITE_BASE || "./",
  plugins: [react(), obfuscateUi()],
  worker: { format: "es" },
  build: { target: "es2022", chunkSizeWarningLimit: 900, sourcemap: false },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
