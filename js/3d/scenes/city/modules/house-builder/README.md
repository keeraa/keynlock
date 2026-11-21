# KEYNLOCK House Builder

Independent 3D building module. The city map, terrain, street generator and game state are **not** required.

## Public entry points

- `modules/house-builder/index.js` — pure model API: schema, normalization, geometry, layout and stats. Accepts the caller's Three.js namespace.
- `modules/house-builder/editor.js` — mounts the interactive editor in `house-builder/index.html`; requires a browser and its existing DOM.

```js
import * as THREE from 'three';
import { HOUSE_DEFAULTS, createHouseModel } from './modules/house-builder/index.js';

const house = createHouseModel(THREE, HOUSE_DEFAULTS, { detail: 'high' });
scene.add(house.group);
// Release with the model's existing dispose() lifecycle when removing it.
```

When a scene controls window lighting, create one `createHouseGlass(THREE)` from the public API and pass it as the `glass` option to every `createHouseModel` in that scene. Call `glass.setAppearance(settings)` to update the windows, then `glass.dispose()` after disposing the scene's houses. Models created without a scene scope own their own window material. Texture resources stay shared.

## Internal architecture

| Source | Responsibility |
| --- | --- |
| `modules/house-builder/core/house-config.js` | Schema, defaults, validation, palette and blueprint export |
| `modules/house-builder/core/house-layout.js` | Deterministic windows and facade positions |
| `modules/house-builder/core/house-model.js` | Model assembly and detail variants |
| `modules/house-builder/core/geometry/{primitives,roof,openings,details}.js` | Isolated mesh-building subsystems |
| `modules/house-builder/core/house-resource-manager.js` | Owned GPU geometry/materials and shared resource lifecycle |
| `modules/house-builder/core/house-materials.js` | Shared fixed materials and scene-owned window glass |
| `modules/house-builder/core/house-textures.js` | Painted textures and cache lifecycle |
| `modules/keynlock-materials/` | Shared, versioned KEYNLOCK gouache material registry |
| `modules/house-builder/core/house-batch.js` | Mesh batching for city-scale rendering |
| `modules/house-builder/core/house-fallback.js` | Canvas fallback without WebGL |
| `js/buildings/editor/{ui,camera,persistence}.js` | Editor-specific interface, camera, and saved blueprints |
| `js/buildings/house-editor.js` | Interactive editor bootstrap and rendering loop |
| `house-builder/index.html`, `style.css` | Standalone editor page and styling |

The `js/buildings/house-*.js` files are backward-compatible reexports. The canonical model implementation lives inside `modules/house-builder/core`. The model API remains independent of the editor.

## Moving it to another repository

Run `npm run export:house` at the repository root. It creates `exports/keynlock-house-builder/`, containing the isolated model implementation, editor adapters, Three.js runtime, original gouache textures and public entry point. `exports/keynlock-house-builder.tar.gz` is the same package as an archive.

Serve the folder over HTTP and open `/house-builder/` (or its root redirect). It needs no build tool, package installation or KEYNLOCK world-map code.

When embedding the model only, import from `modules/house-builder/index.js` and provide Three.js to `createHouseModel`.
