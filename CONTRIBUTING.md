# Contributing to Gradient Gen

Thank you for helping. Small fixes and big ideas are both welcome.

## Report a bug or suggest a feature

Open an [issue](https://github.com/NihadSquare/gradient-gen/issues/new/choose) and pick the matching form. For a bug, please include your browser and version, your device, what you did, and what you expected. A preset exported from *Presets → Export all* helps a lot when a picture looks wrong.

## Change the code

1. Fork the repository and create a branch (`fix-contour-lines`, `add-new-effect`).
2. Install and start the app:
   ```bash
   npm install
   npm run dev
   ```
3. Make your change. Where it makes sense, add a test in `tests/`.
4. Before you open a pull request, run:
   ```bash
   npm run typecheck
   npm test
   npm run build
   ```
5. Open a pull request and fill in the template. Keep it focused: one change per pull request.

## Project rules

- **The engine stays free of the DOM.** Everything in `src/engine/` must run in a Web Worker and in Node. Browser-only code goes in `src/lib/` or `src/components/`.
- **Resolution independence.** Pattern sizes are defined for a 450 px wide picture and scale with the width (`scale` and `ref` in the engine), so an export looks like the preview.
- **Same seed, same picture.** Use the seeded generator (`Rng`), never `Math.random()`, inside the engine.
- **Nothing is uploaded.** Please do not add analytics, trackers or network requests to other sites.
- **Accessibility.** Controls need labels, keyboard access and visible focus.

## Add a gradient type or an effect

- Gradient type: add the name to `GRADIENT_TYPES` in `src/engine/types.ts` and a generator with the same name in `src/engine/fields.ts`.
- Effect: add the name to `EFFECTS` in `src/engine/types.ts` and a `case` in `src/engine/effects.ts`.

The test suite renders every type and effect, so a missing piece fails the tests.

By contributing you agree that your work is released under the [MIT licence](LICENSE). Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).
