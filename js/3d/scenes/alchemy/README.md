# KEYNLOCK — 3D Alchemy Laboratory

This directory contains the modular source and a standalone snapshot of the published **Alchemy Laboratory**, Site version **28** (2026-11-16).

- Live version: https://keynlock-alchemy-lab-1115.k1r11111.chatgpt.site/
- Entry point: `lab/index.html`
- Engine: Three.js r187
- `src/` — modular source, with local Three.js r187 vendor modules and scene assets.
- `scripts/build.mjs` — generates `dist/`, copying the five canonical metal textures from `../../shared/materials/metals/`.
- `tests/` — checks build fidelity, local imports, and shared materials.
- `lab/` — immutable, standalone version-28 reference snapshot.

Run `npm run release:check` here to build and verify `dist/`. Serve `dist/` with a static HTTP server. Both `dist/` and `lab/` are standalone and require no network imports.

The module source was recovered from the live deployment; its existing ES modules remain separate so runtime behavior and visuals are preserved. The project is isolated from the existing 2D alchemy gameplay and prototypes.
