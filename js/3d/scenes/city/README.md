# KEYNLOCK — карта игрового мира

Interactive illustrated city map and Three.js r187 world concept for the game [keeraa/keynlock](https://github.com/keeraa/keynlock).

The seven district identifiers follow `js/data/world.js` in the main game. Districts are distinguished by architecture and landmarks: a clock tower, theater, art museum, formal gardens, factory chimneys, harbor piers and palace.

## Controls

- Left drag: orbit; right drag: pan; wheel/pinch: zoom.
- WASD / arrow keys: pan the map (also works with a Russian keyboard layout); hold Shift to move faster.
- The live 3D city opens by default. Click the map, a district name or a district in the sidebar to select or focus it.
- The «Районы» drawer has a toggle for the map labels.
- H hides the interface; Escape closes panels.
- Visual settings and label visibility persist locally.

## Code structure

| Module | Responsibility |
| --- | --- |
| `js/main.js` | Renderer, camera, lights, controls and settings |
| `js/district-labels.js` | Map labels, coordinate projection and label toggle |
| `js/city.js` | Buildings, streets, bridges, landmarks, vegetation and boats |
| `js/navigation/house-paths.js` | Pathfinding and paved approaches from doors to streets |
| `js/world-data.js` | District and location identifiers |
| `js/terrain.js`, `js/water.js` | Land relief and animated water |
| `js/materials.js`, `js/effects/` | Gouache textures and post-processing |
| `js/buildings/house-config.js` | Stable, versioned house blueprint and validated settings |
| `js/buildings/house-layout.js` | Floor-by-floor window positioning, including door/balcony clearance |
| `js/buildings/house-model.js` | One rebuildable Three.js house with configurable roof, walls, windows, entrance and details |
| `js/buildings/house-editor.js` | Controls and camera for `/house-builder/` |
| `js/landmarks/landmark-model.js` | Five reusable signature buildings, each with high/medium/low geometry |
| `js/landmarks/landmark-editor.js` | Interactive architectural inspector at `/landmark-lab/` |
| `js/buildings/house-fallback.js` | Paintable 2D projection if WebGL is unavailable |
| `tests/` | Scene geometry, optimization and district-label checks |

## Signature buildings

The standalone `/landmark-lab/` is a design and performance inspector for five special buildings:
the main-square church, a royal theater, the arts museum, town hall and hilltop palace.
Each procedural model has the same entrance orientation (+Z), is sized in world metres,
and can be inspected from four viewpoints in three geometry LOD levels. A model's meshes,
triangle count and bounding height are shown live. This is an independent asset library;
the legacy landmark silhouettes on the city map are intentionally unchanged until the
building and square layout is approved. Use `createLandmarkModel(THREE,id,{detail})` to
instantiate and explicitly call its `dispose()` when discarding the model.

## Single-house constructor

Open `/house-builder/` from the **Конструктор** button above the city map. Its current scope is a single, editable reference house. Controls include 1–4 storeys, facade width/depth, gable/hip/flat roof, ridge height, three color channels, front/side window counts, window and doorway shapes, shutters, chimney, balcony, and timber framing. The model updates immediately; it can be orbit-rotated and inspected from four preset views.

Configurations are saved in browser storage and can be downloaded or copied as JSON. Exports use `schema: "keynlock.house"`, `version: 1` and a normalized `params` object. The city's 125 existing houses remain unchanged until this reference design is approved; a future city generator can instantiate the same `house-model` geometry from exported blueprints, with shared-material and instancing optimizations as a separate phase.

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
- Static shadow maps update only when lighting changes; ocean reflections update immediately on camera motion and at ~30 fps while stationary. Static painted road/garden meshes are merged by material.
- `assets/city-concept-01.webp`: original hand-painted concept kept as a source reference. It is excluded from the deployed static build.
- Clickable district names are projected from `world-data.js` anchors and may be hidden from the sidebar.

## Local check

Run `npm run check` and `npm run build`. The deployable static output in `dist/` is regenerated for each build and ignored by Git. Serve it over HTTP (module imports will not work from `file:`). The browser visual smoke test in `tests/visual-check.cjs` requires Playwright and a Chromium environment with local networking and WebGL.
