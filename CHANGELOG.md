# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## Windows app 4.1 - 2026-11-21

### Added
- Windows version of the desktop program as a single portable `GradientGen-4.1-win64.exe`, with a download link and details in the README
- `desktop/` folder with the program, its icon, Windows file properties and a one-click `build.bat`
- GitHub workflow `Build Windows app` that builds the `.exe` on a Windows machine, starts it once as a check, and puts it with a SHA-256 checksum into a draft release (works with immutable releases) that you publish yourself

### Changed
- The desktop program's version number is now **4.1** (it was 3.99), matching the web app. The window title, footer and About window show it. Nothing else in the program changed.
- The web app's status bar and About window show the same number: "Gradient Gen v4.1".

## [4.1.0] - 2026-11-17

The interface and the pictures now follow the desktop app *Gradient Gen* (then numbered v3.99) exactly.

### Changed
- **New interface, same as the desktop app:** header with View / Settings / Presets / Reset / About, Colors / Output / Overlays cards with Auto Generate and Save Image below them, numbered color stops, preview with Zoom / Show Palette / Reverse / Seed, Gradient and Effects cards, status bar, and the same windows (Settings, Theme, Presets, Palette Tools with Library / Edit / Harmony / Import, Contrast, Tutorial, About, full-screen View)
- **Same seed, same picture as the desktop app.** Python's and NumPy's random generators are reproduced exactly, bicubic resizing and Pillow's blur, blend, emboss and sharpen rules are followed. 63 of 66 test pictures are pixel-identical to the desktop output and the rest differ by less than 0.1 out of 255
- Presets use the desktop file format, so presets exported from the desktop app can be imported and the other way round
- Fonts: the desktop font order (Segoe UI Variable, Segoe UI, SF Pro, Helvetica Neue) with Inter bundled as the fallback
- On narrow screens the same cards stack in one column

### Added
- Tutorial window, Theme chooser, extract-colors-from-image picker, Contrast window with Pair / Palette / On Picture tabs
- Tests that compare the web engine with golden pictures made by the desktop engine

### Removed
- The web-only Keyboard shortcuts window and the palette-as-PNG export (shortcuts are now in the Tutorial, as on the desktop)

## [4.0.0] - 2026-11-08

First release of the web version, based on the desktop app *Gradient Gen v3.99*.

### Added
- 28 gradient types, 25 effects, 12-stop color editor with RGB / HSL / OKLab blending and four transition styles
- Palette tools: 28 built-in palettes, harmony generator, colors from an image, paste import, copy as HEX / JSON / CSS
- Color contrast checker with WCAG levels
- Text and logo overlays, background choice
- PNG, JPEG and WebP export up to 4096 px, batch mode as ZIP, copy as CSS / SVG / image
- Auto Generate with locks, undo / redo, presets with JSON import and export, 8 themes, keyboard shortcuts
- Works on phones, tablets and offline; fonts are bundled, no third-party requests

### Changed
- Seeded patterns use a new random generator, so the same seed gives a different pattern than the desktop app
- Noise and Grain effects are seeded, so the preview matches the export
- Largest export size is 4096 × 4096 px (was 8192)

[4.1.0]: https://github.com/nihadsquare/gradient-gen/releases/tag/v4.1.0
[4.0.0]: https://github.com/nihadsquare/gradient-gen/releases/tag/v4.0.0
