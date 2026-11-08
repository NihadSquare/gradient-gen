import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// "./" makes the build work on any GitHub Pages path (user site or project site)
// without editing this file. Set VITE_BASE to override it (for example "/gradient-gen/").
export default defineConfig({
  base: process.env.VITE_BASE || "./",
  plugins: [react()],
  worker: { format: "es" },
  build: { target: "es2022", chunkSizeWarningLimit: 900 },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
