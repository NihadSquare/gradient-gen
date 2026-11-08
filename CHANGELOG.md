# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

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

[4.0.0]: https://github.com/NihadSquare/gradient-gen/releases/tag/v4.0.0
