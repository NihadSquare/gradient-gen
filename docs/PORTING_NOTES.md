# Porting notes: desktop v3.99 → web 4.1

The goal is that the web app looks, behaves and draws exactly like the desktop app.

## How the port was checked

The real desktop engine (Python, NumPy, Pillow) was run headlessly and the web engine was run on the same settings. 66 pictures were compared (all 28 gradient types at 240 × 135, the seeded types again at 1300 × 90 and 301 × 177, and 23 effects):

- **63 of 66 pictures are pixel-identical** (mean difference below 0.05 out of 255), including every seeded pattern (Perlin, Mesh, Aurora, Marble, Contour, Silk, Stained glass, Voronoi, Fractal) and the seeded effects (Pixel sort, Glitch, Light leak, Anti band, Frosted).
- The other three (Blur, Bloom, Frosted on a detailed picture) differ by less than 0.1 out of 255 on average, because Pillow's Gaussian blur rounds to whole numbers after every pass.
- The color ramp (RGB, HSL, OKLab, all transitions) is identical in every table entry.

To get there the port reproduces:

- Python's `random.Random`, NumPy's legacy `RandomState` and NumPy's `default_rng` (PCG64 with SeedSequence), bit for bit (`src/engine/nprng.ts`, tested against fixtures made with the real libraries)
- Pillow's bicubic resize for enlarged noise and fractals, its Gaussian blur, its truncating blend, its flipped emboss kernel and its rounded smooth filter for sharpen

`tests/desktop.test.ts` keeps 23 golden pictures from the desktop engine and fails if the web engine drifts away from them.

## What is still different

| Topic | Desktop | Web |
| --- | --- | --- |
| Largest size | 8192 × 8192 px | 4096 × 4096 px (browser memory) |
| Noise and Grain effects | Different random noise on every render | Seeded, so the preview does not flicker and equals the export |
| Undo / redo | Last 5 Auto Generate pictures | Every edit (up to 80 steps) |
| Default Folder, Remember Window | Available | Not possible in a browser, so the rows are hidden |
| Ask Before Closing | Asks when closing the window | Uses the browser's "leave this page?" warning |
| Batch export | Saves files into a folder | Saves one ZIP |
| Presets and palettes | Files on disk | Browser storage; the preset file format is the same, so files can be imported and exported both ways |
| Text drawn on the picture | Pillow text | Browser canvas text, so letter shapes can differ slightly |

## Ideas for later

- Optional account sync for presets (would need a backend).
- Tiled rendering to lift the 4096 px limit.
