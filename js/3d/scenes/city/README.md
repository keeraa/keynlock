# KEYNLOCK — редактор зданий

Three.js r187 architectural workshop for the game [keeraa/keynlock](https://github.com/keeraa/keynlock). The root URL opens the parametric house editor; special landmarks and district building prototypes remain in their labs. The terrain editor is intentionally a separate future project.

The seven district identifiers follow `js/data/world.js` in the main game. Districts are distinguished by architecture and landmarks: a clock tower, theater, art museum, formal gardens, factory chimneys, harbor piers and palace.

## Editors

- `/house-builder/` — main parametric 3D house editor (opens by default).
- `/landmark-lab/` — special architectural models and their levels of detail.
- `/street-lab/` — district house and block composition tests.
- `/path-builder/` — place, rotate, drag, delete and persist ordinary/landmark buildings; pedestrian paths regenerate between their entrances.

## Portable house module

`modules/house-builder/index.js` is the stable, UI-free model API. `modules/house-builder/editor.js` mounts the visual editor. The architecture, dependency list and embed instructions are in [`modules/house-builder/README.md`](modules/house-builder/README.md).

`npm run export:house` produces a standalone source folder and `.tar.gz` archive in ignored `exports/`. `npm run test:house-module` verifies the extracted API, asset paths and standalone editor page.

## Code structure

| Module | Responsibility |
| --- | --- |
| `js/main.js` | Renderer, camera, lights, controls and settings |
| `js/district-labels.js` | Map labels, coordinate projection and label toggle |
| `js/city.js` | Map orchestration, system initialization and lifecycle |
| `js/city/city-coast.js` | Terrain meshes, shoreline, seabed and sea |
| `js/city/city-roads.js` | Street grid, bridges, building setbacks and river channel |
| `js/city/city-meshes.js` | Instancing and merging static painted surfaces |
| `js/city/city-scenery.js` | Trees, parks, gardens and street furniture |
| `js/city/city-industry.js` | Factories, farms and animated windmill |
| `js/city/city-waterfront.js` | Quays, warehouses, fishing boats and ships |
| `js/city/city-buildings.js` | House instancing, six signature models and building effects |
| `js/city/city-night.js` | Reusable night-light pool and camera-distance selection |
| `js/city/city-house-lots.js` | Deterministic district lots, setbacks and door connections |
| `js/street/street-smoke.js`, `js/street/street-lod-fade.js` | Shared smoke emitters and stable, cached LOD transitions for districts |
| `js/navigation/house-paths.js` | Shared paved approaches from houses, landmarks and public destinations to streets |
| `js/navigation/pedestrian-network.js` | Topological pedestrian graph: street/path intersections, named destinations and shortest routes |
| `js/navigation/path-layout.js` | Pure A* layout of pedestrian footpaths around movable building footprints |
| `js/path-builder/scene.js` | Independent Three.js construction sandbox; model selection and pointer interactions |
| `js/path-builder/path-painter.js` | Cached paving atlas, shader-driven reveal animation and shared 2D preview |
| `js/path-builder/model-types.js` | Approved scene scales and 3D-measured footprints shared with 2D |
| `modules/keynlock-materials/` | Single texture registry and the seven shared ground palettes |
| `js/path-builder/fallback.js` | Fully editable overhead construction plan when WebGL is unavailable |
| `js/path-builder/editor.js` | Connects the map controller, browser controls, scene and previews |
| `js/path-builder/editor-controller.js` | Map edits, history, persistence and scene updates |
| `js/path-builder/editor-view.js` | DOM controls, house workspace, map status and export download |
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
| `js/landmarks/landmark-model.js` | Public landmark constructor, LOD selection and cleanup |
| `js/landmarks/buildings/` | Six independent signature building factories |
| `js/landmarks/landmark-geometry.js`, `js/landmarks/landmark-materials.js` | Shared architectural primitives and painted texture leases |
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
- All generated houses retain a paved approach tucked under the entrance sill. The same routing service now connects the six landmarks at the foot of their real stairs, the market and upper garden, avoids landmark footprints, and detours around enclosed lots and the river when needed.
- `createCity().pedestrianNetwork` contains the public roads, doorstep paths, factory and farm access, windmill lane and garden walks as a single graph. `findRoute(fromId,toId)` returns a shortest polyline between named entrances (e.g. `house-0`, `landmark-museum`, `market`, `upper-garden`, `windmill`). Intersections and shared segments are split/deduplicated once; the graph is ready for future resident navigation.
- The town waterfront has a raised stone-paved apron separated from the wild sandy shores. The two promenade arms stop before the open river mouth, whose terrain descends beneath the sea without a coastline skirt.
- Three inland bridges are aligned with continuous raised road ribbons and eased approaches; the coastal bridge and unfinished rail viaduct were removed. Roads climbing steep hills use closely spaced level stone treads and risers; the castle-side lane now climbs without an abrupt paved dogleg.
- Industrial residences and the factory complex, chimneys, and loading yard sit together beyond the western riverbank, connected by industrial road loops and paved entrances.
- The shared detailed palace model sits directly on its hill, surrounded by blue-roofed residences. Factory and warehouse roof panels use common local foundations to stay aligned on slopes. Stone plinths extend to the lowest corners of waterfront warehouses and steeply sloping residential lots.
- At night the town turns dark blue, with pooled warm lights and soft halos from street lanterns and seaward-facing residential windows. The outline pass excludes transparent glow sprites.
- Chimney smoke grows while slowly rising from the outlet. City houses share one particle batch; a district scene also uses one batch, and each special building uses one draw for all of its chimneys. Smoke and window halos reuse the same cached paintings across the editors.
- Gouache moss covers the foundations of ordinary and signature buildings. Changing its height updates existing vertices and UVs without recreating GPU geometry.
- Static shadow maps update only when lighting changes; ocean reflections update immediately on camera motion and at ~30 fps while stationary. Static painted road/garden meshes are merged by material.
- Production and standalone exports copy only active texture files from the shared manifest. Unused and original paintings stay in source history; the large copper roof is shipped as a compressed WebP.
- `assets/city-concept-01.webp`: original hand-painted concept kept as a source reference. It is excluded from the deployed static build.
- Clickable district names are projected from `world-data.js` anchors and may be hidden from the sidebar.

## Local check

Run `npm run check` and `npm run build`. The deployable static output in `dist/` is regenerated for each build and ignored by Git. Serve it over HTTP (module imports will not work from `file:`). The browser visual smoke test in `tests/visual-check.cjs` requires Playwright and a Chromium environment with local networking and WebGL.

The separate `npm run test:path-visual` captures the construction editor and checks
soft foundation-shadow gradients, ground-paint contrast and runtime errors.
Use `KEYNLOCK_REQUIRE_WEBGL=1 npm run test:path-visual` in a GPU-enabled CI
runner to fail rather than accept the 2D fallback. All other path/texture
regression and performance contracts run without a GPU under `npm run check`.
