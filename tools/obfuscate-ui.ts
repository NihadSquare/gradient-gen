// Gradient Gen - Copyright (c) 2026 AK Nihad (Nihad Square). All rights reserved.
// Source-available, not open source: see LICENSE. Copying or reuse is not permitted without written permission.
//
// Build step: scrambles the interface code (components, store, helpers) so the published
// website is hard to copy and read. The pixel engine (src/engine) is only minified, so rendering stays fast.
import JavaScriptObfuscator from "javascript-obfuscator";
import type { Plugin } from "vite";

// Interface files that are scrambled. renderClient.ts stays out: it contains the Worker URL that Vite rewrites.
const INCLUDE = /\/src\/(components|store|lib|data)\/[^/]+\.(tsx?|jsx?)$/;
const EXCLUDE = /\/src\/lib\/renderClient\.ts$/;

export function obfuscateUi(): Plugin {
  return {
    name: "gradient-gen-obfuscate-ui",
    apply: "build",
    enforce: "post", // after TypeScript / JSX have become plain JavaScript
    transform(code, id) {
      const path = id.split("?")[0].replace(/\\/g, "/");
      if (!INCLUDE.test(path) || EXCLUDE.test(path)) return null;
      const out = JavaScriptObfuscator.obfuscate(code, {
        sourceType: "module",
        target: "browser",
        compact: true,
        simplify: true,
        identifierNamesGenerator: "hexadecimal",
        renameGlobals: false,
        renameProperties: false, // never: React, zustand and the DOM depend on property names
        stringArray: true,
        stringArrayThreshold: 1,
        stringArrayEncoding: ["base64"],
        stringArrayRotate: true,
        stringArrayShuffle: true,
        stringArrayWrappersCount: 1,
        stringArrayWrappersType: "variable",
        splitStrings: false,
        controlFlowFlattening: false, // slows the code down
        deadCodeInjection: false,
        selfDefending: false,
        debugProtection: false,
        disableConsoleOutput: false,
        transformObjectKeys: false,
        numbersToExpressions: false,
        unicodeEscapeSequence: false,
        sourceMap: false,
      });
      return { code: out.getObfuscatedCode(), map: null };
    },
  };
}
