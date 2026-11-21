# KEYNLOCK Painted Materials

Single source of truth for the approved KEYNLOCK gouache textures and district
ground palettes. Works in the city, the pedestrian-path builder, house builder,
landmark models and future 3D scenes; it has no dependence on a specific editor.

## Source

- `index.js` declares **every active file name once** and exports house,
  landmark and ground texture registries, plus URL resolvers.
- `ground-palettes.js` declares all seven district palettes.
- `../../assets/ground/` contains two painted ground images (earth and brush grass).
- `../../assets/house-textures/` contains painted stone, roofs, windows,
  masonry, moss, doors and other reusable architectural textures.

```js
import {gouacheAssetUrl} from './modules/keynlock-materials/index.js';
const grassImage=new Image();
grassImage.src=gouacheAssetUrl('ground','grass');
```

`scripts/build.mjs` publishes only files from `ACTIVE_GOUACHE_FILES`.
The `house-builder` export includes this module, preserving the same paths.
Historical PNG source paintings remain outside production builds.

When copying these materials to another KEYNLOCK scene, keep this registry and
the referenced `assets/` folders together. Edit an approved texture or palette
here, then have the consuming scenes pull the updated source; avoid scene-local
copies with independent names or defaults.
