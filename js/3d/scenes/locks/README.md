# KEYNLOCK — 3D lock mechanisms

The `lab/` directory contains a self-contained, deployable snapshot of the
**Keynlock — 3D замки** laboratory, version **51** (2026-11-16).

Source deployment: https://keynlock-pin-lab-1114.k1r11111.chatgpt.site

Open `lab/index.html` through the repository's static HTTP server. All required
assets are stored locally in `lab/`; the laboratory is isolated from the existing
2D game until an integration is explicitly implemented.

`lab/app.js` is the published minified Three.js application bundle. It preserves
the working scene but is **not** the original modular authoring source; future
refactoring should start from the original source repository where available.
