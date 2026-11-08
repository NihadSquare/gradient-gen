# Porting notes: desktop v3.99 → web 4.0

## How the port was checked

The desktop renderer (Python, NumPy, Pillow) was run headlessly on 53 test cases and the web renderer was run on the same settings. Results at 240 × 135 px:

- **Color ramp** (RGB, HSL, OKLab, all transition styles, hard edges, opacity): identical in every table entry (difference 0).
- **Gradient types that do not use random numbers** (Linear, Radial, Conical, Diamond, Spiral, Swirl, Plasma, Cylindrical, Pixelated, Abstract, Parametric, Hexagonal, Wave, Starburst, Kaleidoscope, Tiled, Bilinear, Halftone, Dither, Fractal): pixel-identical.
- **Effects that do not use random numbers** (Wave, Ripples, Liquidify, Distort, Posterize, Vignette, Solarize, Mosaic, Chromatic, Color invers, Gradient map, Bloom, Blur, Glow): identical or within rounding (mean difference ≤ 0.13 of 255). Sepia, Emboss, Sharpen and Edge detect differ by under 1 on average.

## What is different

| Topic | Desktop | Web |
| --- | --- | --- |
| Seeded patterns (Perlin, Mesh, Aurora, Marble, Contour, Silk, Stained glass, Voronoi, Pixel sort, Glitch, Frosted, Light leak, Anti band) | Python / NumPy generators | A different random generator, so **the same seed gives a different (equally valid) pattern**. Presets saved in the desktop app keep their colors and settings but these patterns will look different. |
| Noise and Grain effects | Different random noise on every render | Seeded, so the preview does not flicker and equals the export |
| Largest size | 8192 × 8192 px | 4096 × 4096 px (browser memory) |
| Blur effects | Pillow Gaussian blur | Three-pass box blur (a close approximation that also works in Safari) |
| Emboss | Filters all four channels | Filters color only and keeps your opacity |
| Text overlay font | Bundled font | Hanken Grotesk Bold (bundled with the app) |
| Presets and palettes | Files on disk | Browser storage, with JSON import / export |
| Windows-only features | Drag-and-drop, tooltips window, icon | Not needed |

## Ideas for later

- Optional account sync for presets (would need a backend).
- WebGL renderer for instant previews of the heaviest types.
- Tiled rendering to lift the 4096 px limit.
