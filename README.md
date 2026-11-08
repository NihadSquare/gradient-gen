# Gradient Gen

[![Deploy](https://github.com/NihadSquare/gradient-gen/actions/workflows/deploy.yml/badge.svg)](https://github.com/NihadSquare/gradient-gen/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-5240FF.svg)](LICENSE)

**Make backgrounds and wallpapers in your browser.** 28 gradient types, 25 effects, multi-stop colors with RGB / HSL / OKLab blending, palette tools, overlays and exports up to 4096 px.

### 👉 [Open Gradient Gen](https://nihadsquare.github.io/gradient-gen/)

![Gradient Gen screenshot](docs/screenshot.jpg)

It is a static site: every picture is drawn on your device, nothing is uploaded, there is no sign-up and no server to run or pay for. It is the web version of the desktop app *Gradient Gen v3.99*.

## Features

- **Colors**: up to 12 stops on a draggable bar, per-stop opacity, four transition styles (Smooth, Ease, Step, Hold), reverse
- **28 gradient types**: Linear, Radial, Conical, Diamond, Spiral, Swirl, Plasma, Voronoi, Cylindrical, Pixelated, Abstract, Parametric, Perlin, Wave, Starburst, Kaleidoscope, Tiled, Hexagonal, Bilinear, Fractal, Mesh, Aurora, Marble, Contour, Halftone, Dither, Silk, Stained glass
- **25 effects**, two at a time: noise, grain, blur, glow, glitch, pixel sort, light leak, gradient map and more
- **Palette tools**: 28 built-in palettes, harmony generator (11 schemes), colors from an image (7 pick modes), paste hex / Coolors / GIMP, save your own, copy as HEX / JSON / CSS
- **Color contrast checker** with WCAG levels and one-click fixes
- **Overlays**: text and logo, plus White / Black / Transparent background
- **Output**: PNG, JPEG, WebP; 13 size presets; batch mode that saves a ZIP; guides (thirds, golden ratio, safe area, social crops)
- **Copy as CSS / SVG / image**
- **Auto Generate** with per-setting locks, **undo / redo**, **presets** (import / export JSON), 8 themes, keyboard shortcuts
- Works on phones and tablets, and offline once loaded

## Run it locally

Requires Node.js 18 or newer.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests
npm run build      # production build in dist/
npm run preview    # serve dist/ locally
```

## Deploy your own copy

1. Fork this repository (or push the code to a new one).
2. *Settings* → *Pages* → *Build and deployment* → *Source:* **GitHub Actions**.
3. Push to `main`. The workflow in `.github/workflows/deploy.yml` runs the checks and publishes the site at `https://YOUR-USERNAME.github.io/REPOSITORY-NAME/`.

The build uses relative paths (`base: "./"`), so it works at any address, including a custom domain. Change `REPO_URL` and `SITE_URL` in `src/config.ts` and the address in `index.html` to point to your copy.

## How it works

| Folder | What is in it |
| --- | --- |
| `src/engine/` | The renderer. No DOM, so it runs in a Web Worker and in Node tests. `fields.ts` (gradient types), `effects.ts`, `color.ts` (OKLab / HSL / ramp table), `palette.ts`, `code.ts` (CSS / SVG), `random.ts` (Auto Generate) |
| `src/lib/` | Browser glue: worker client, canvas overlays, file saving, ZIP writer, themes, storage |
| `src/store/` | App state (zustand), history, presets, saved palettes |
| `src/components/` | React interface |
| `tests/` | Vitest unit tests |

Previews are drawn by a Web Worker so the page stays responsive. If workers are unavailable the app falls back to the main thread.

See [docs/PORTING_NOTES.md](docs/PORTING_NOTES.md) for what changed compared with the desktop version and how the port was checked.

## Limits

- Largest picture: **4096 × 4096 px** (browsers limit canvas and memory, especially on phones).
- Batch size depends on the picture size so the ZIP fits in memory (up to 100).
- Everything is stored in your browser (`localStorage`). Clearing site data removes presets and saved palettes; use *Presets → Export all* to keep a backup.

## Contributing

Bug reports and ideas are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) first. Security issues: see [SECURITY.md](SECURITY.md).

## Credits and licence

Developed by **AK Nihad** ([@NihadSquare](https://github.com/NihadSquare)) under the **Nihad Square** brand.
Released under the [MIT licence](LICENSE). Third-party software and fonts are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
