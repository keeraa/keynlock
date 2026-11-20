# Shared key library

Canonical source of the key modules used by more than one scene
(Key Forge `js/3d/scenes/key-forge`, Key Archive `js/3d/scenes/key-archive`).

| File | What it is |
| --- | --- |
| `key-data.js` | Ten templates, fixed metals, Brotherhood bindings, `defaultDesign`, `normalizeKeyDesign` |
| `key-shapes.js` | Bow, holes, blade profile, the single key outline (`keyOutline`, `createKeyShape`, `joinedKeyShape`) |
| `key-placement.js` | Hang / floor anchors and placement matrices |
| `key-art.js` | Fixed art direction: lighting preset and ink outline values |
| `key-coat.js` | Soft coat builder (wax, mud) on a key, `stableNoise` |
| `key-mud.js` | Dried mud clods and their washing |
| `key-wax.js` | Candle wax coat and its melting |

Each static site publishes only its own `dist`, so every scene keeps a byte-identical
copy in `dist/js/`. **Edit the files here**, then mirror them:

```bash
node js/3d/shared/keys/sync.mjs --sync    # copy to every scene
node js/3d/shared/keys/sync.mjs --check   # CI: fail if a copy differs
```

Consumers are listed in `manifest.json`. Modules import siblings without `?v=` queries,
so a browser never loads two copies of one module. Scene-specific code (geometry
assembly, shaders, dirt rim, instancing) stays in each scene.
