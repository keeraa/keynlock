# KEYNLOCK — редактор зданий

Текущая версия игрового мира: https://keynlock-world-map-1115.k1r11111.chatgpt.site

Чат разработки: https://chatgpt.com/c/6afb4b25-7b64-83ed-a650-1656902b597f

Three.js r187 architectural workshop for the game [keeraa/keynlock](https://github.com/keeraa/keynlock). The root URL opens the parametric house editor; special landmarks and district building prototypes remain in their labs. The terrain editor is intentionally a separate future project.

The seven district identifiers follow `js/data/world.js` in the main game. Districts are distinguished by architecture and landmarks: a clock tower, theater, art museum, formal gardens, factory chimneys, harbor piers and palace.

## Editors

- `/house-builder/` — main parametric 3D house editor (opens by default).
- `/landmark-lab/` — special architectural models and their levels of detail.
- `/street-lab/` — district house and block composition tests.

## Portable house module

`modules/house-builder/index.js` is the stable, UI-free model API. `modules/house-builder/editor.js` mounts the visual editor. The architecture, dependency list and embed instructions are in [`modules/house-builder/README.md`](modules/house-builder/README.md).

`npm run export:house` produces a standalone source folder and `.tar.gz` archive in ignored `exports/`. `npm run test:house-module` verifies the extracted API, asset paths and standalone editor page.

## Code structure

| Module | Responsibility |
| --- | --- |
| `js/main.js` | Renderer, camera, lights, controls and settings |
| `js/district-labels.js` | Map labels, coordinate projection and label toggle |
| `js/city.js` | Map scene orchestration: streets, bridges, terrain objects and boats |
| `js/city/city-house-lots.js` | Deterministic district lots, setbacks and door connections |
| `js/street/street-smoke.js`, `js/street/street-lod-fade.js` | Shared smoke emitters and stable, cached LOD transitions for districts |
| `js/navigation/house-paths.js` | Pathfinding and paved approaches from doors to streets |
| `js/world-data.js` | District and location identifiers |
| `js/terrain.js`, `js/water.js` | Land relief and animated water |
| `js/materials.js`, `js/effects/` | Gouache textures and post-processing |
| `js/buildings/house-config.js` | Stable, versioned house blueprint and validated settings |
| `js/buildings/house-layout.js` | Floor-by-floor window positioning, including door/balcony clearance |
| `js/buildings/house-model.js` | One rebuildable Three.js house with configurable roof, walls, windows, entrance and details |
| `modules/house-builder/core/house-atmosphere.js` | Shared painted moss, chimney and window-glow resources; in-place moss height updates |
| `modules/house-builder/core/building-smoke-batch.js` | One GPU particle draw per city, street scene or landmark, with shared fade and density |
| `modules/house-builder/core/house-texture-assets.js` | Active house/fallback texture manifest used by the build and portable export |
| `js/buildings/house-editor.js` | Controls and camera for `/house-builder/` |
| `js/landmarks/landmark-model.js` | Six reusable signature buildings, each with high/medium/low geometry |
| `js/landmarks/landmark-editor.js` | Interactive architectural inspector at `/landmark-lab/` |
| `js/buildings/house-fallback.js` | Paintable 2D projection if WebGL is unavailable |
| `tests/` | Scene geometry, optimization and district-label checks |

## Signature buildings

The standalone `/landmark-lab/` is a design and performance inspector for six special buildings:
the main-square church, a royal theater, the arts museum, town hall, hilltop palace and clock tower.
Each procedural model has the same entrance orientation (+Z), is sized in world metres,
and can be inspected from four viewpoints in three geometry LOD levels. A model's meshes,
triangle count and bounding height are shown live. The city uses the same
approved painted models with smaller scale and medium LOD. Use `createLandmarkModel(THREE,id,{detail})` to
instantiate and explicitly call its `dispose()` when discarding the model.

## Single-house constructor

Open `/house-builder/` from the **Конструктор** button above the city map. Its current scope is a single, editable reference house. Controls include 1–4 storeys, facade width/depth, gable/hip/flat roof, ridge height, three color channels, front/side window counts, window and doorway shapes, shutters, chimney, balcony, and timber framing. The model updates immediately; it can be orbit-rotated and inspected from four preset views.

Configurations are saved in browser storage and can be downloaded or copied as JSON. Exports use `schema: "keynlock.house"`, `version: 1` and a normalized `params` object. The city currently instantiates 122 houses with the shared painted `house-model`, batched by district and facade variant.

## Visual pipeline

- Three.js r187 + orthographic camera, instanced buildings, foliage and chimney smoke.
- Cartoon-light and contour shaders adapted directly from the KEYNLOCK pin laboratory, with matching two sliders for each effect.
- Canvas-generated hand-painted albedo with adjustable stroke intensity, material stylization and brush detail; five surface palettes.
- Reflective, translucent sea with procedural sandy seabed, animated tides, surf foam and matched river normals. The land relief is now three times the original height while sea level remains fixed; the river follows a smooth, meandering spline with variable width, a wider sandy bed, animated flow highlights and soft, transparent bank edges before blending into the sea.
- Extended eastern countryside with nine cultivated fields and an animated four-sail windmill, served by two connected stone farm lanes.
- All stone-sett streets, squares and doorstep paths use a shared world-space texture scale, so narrow footpaths and wide boulevards have the same stone size and uninterrupted courses at intersections. Dense crosswise/lengthwise tessellation and exact sampling of the rendered terrain triangles prevent hillside roads from sinking into the grass.
- All generated houses have a paved approach tucked under the entrance sill. Routes avoid neighboring foundations and the river, join public streets or existing paths, and use a walkable-grid detour around enclosed lots when needed.
- The town waterfront has a raised stone-paved apron separated from the wild sandy shores. The two promenade arms stop before the open river mouth, whose terrain descends beneath the sea without a coastline skirt.
- Three inland bridges are aligned with continuous raised road ribbons and eased approaches; the coastal bridge and unfinished rail viaduct were removed. Roads climbing steep hills use closely spaced level stone treads and risers; the castle-side lane now climbs without an abrupt paved dogleg.
- Industrial residences and the factory complex, chimneys, and loading yard sit together beyond the western riverbank, connected by industrial road loops and paved entrances.
- The castle sits on a raised plateau with an open arched gateway, masonry entrance steps and large multi-storey windows. Blue-roofed residences surround the hill. Factory, warehouse, and palace roof panels use common local foundations to stay aligned on slopes. Stone plinths extend to the lowest corners of waterfront warehouses and steeply sloping residential lots.
- At night the town turns dark blue, with pooled warm lights and soft halos from street lanterns and seaward-facing residential windows. The outline pass excludes transparent glow sprites.
- Chimney smoke grows while slowly rising from the outlet. City houses share one particle batch; a district scene also uses one batch, and each special building uses one draw for all of its chimneys. Smoke and window halos reuse the same cached paintings across the editors.
- Gouache moss covers the foundations of ordinary and signature buildings. Changing its height updates existing vertices and UVs without recreating GPU geometry.
- Static shadow maps update only when lighting changes; ocean reflections update immediately on camera motion and at ~30 fps while stationary. Static painted road/garden meshes are merged by material.
- Production and standalone exports copy only active texture files from the shared manifest. Unused and original paintings stay in source history; the large copper roof is shipped as a compressed WebP.
- `assets/city-concept-01.webp`: original hand-painted concept kept as a source reference. It is excluded from the deployed static build.
- Clickable district names are projected from `world-data.js` anchors and may be hidden from the sidebar.

## Local check

Run `npm run check` and `npm run build`. The deployable static output in `dist/` is regenerated for each build and ignored by Git. Serve it over HTTP (module imports will not work from `file:`). The browser visual smoke test in `tests/visual-check.cjs` requires Playwright and a Chromium environment with local networking and WebGL.
