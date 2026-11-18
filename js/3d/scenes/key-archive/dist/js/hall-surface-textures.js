import * as THREE from '../vendor/three.js';

// Separate original gouache paintings for plaster and the continuous wood vault.
// Asset paths are resolved relative to the module so hosting works at any base URL.
export const HALL_SURFACE_URLS = Object.freeze({
  wall: new URL('../assets/gouache-plaster-wall-v1.webp', import.meta.url).href,
  ceiling: new URL('../assets/gouache-vault-ceiling-v2.webp', import.meta.url).href,
  carpet: new URL('../assets/gouache-carpet-v1.webp', import.meta.url).href,
});

// Shared archive palette: cream-sage plaster, soft green columns, pale-oak vault,
// faded claret fabric and warm walnut framing.
export const HALL_PALETTE = Object.freeze({
  wall: 0xcbd4c8,
  pilaster: 0xb6cbbd,
  ceiling: 0xf1e9d8,
  carpet: 0xdcc9c5,
  trim: 0xcbb09b,
  beam: 0xb69d89,
});

export const HALL_SURFACE_TILE_METERS = Object.freeze({
  wall: 3.8, ceiling: 4.8, carpet: 3.7, trim: 2.6,
});

function loadPaintedTexture(url, fallback, repeatU, repeatV) {
  const texture = new THREE.TextureLoader().load(url, undefined, undefined, () => {
    // A procedural texture is retained as an offline/unsupported-format fallback.
    texture.image = fallback.image;
    texture.needsUpdate = true;
  });
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.MirroredRepeatWrapping;
  texture.repeat.set(repeatU, repeatV);
  texture.anisotropy = 8;
  return texture;
}

export function createHallSurfaceMaterials(plasterFallback, woodFallback, carpetFallback) {
  const plaster = (repeatU, repeatV, color = HALL_PALETTE.wall) => new THREE.MeshStandardMaterial({
    map: loadPaintedTexture(HALL_SURFACE_URLS.wall, plasterFallback, repeatU, repeatV),
    color,
    roughness: .98,
  });
  const wallTile = HALL_SURFACE_TILE_METERS.wall;
  const ceilingTile = HALL_SURFACE_TILE_METERS.ceiling;
  const carpetTile = HALL_SURFACE_TILE_METERS.carpet;
  const beamPaint = woodFallback.clone();
  beamPaint.repeat.set(24 / HALL_SURFACE_TILE_METERS.trim, 1);
  beamPaint.needsUpdate = true;
  return {
    // ExtrudeGeometry uses world-sized UVs; BoxGeometry uses normalized UVs.
    hallWall: plaster(1 / wallTile, 1 / wallTile),
    hallEnd: plaster(24 / wallTile, 11 / wallTile),
    // Pilasters receive physical-length UVs directly on their box geometry.
    hallPilaster: plaster(1, 1, HALL_PALETTE.pilaster),
    hallVault: new THREE.MeshStandardMaterial({
      map: loadPaintedTexture(HALL_SURFACE_URLS.ceiling, woodFallback,
        24 / ceilingTile, 46.8 / ceilingTile),
      color: HALL_PALETTE.ceiling,
      roughness: .98,
    }),
    hallCarpet: new THREE.MeshStandardMaterial({
      map: loadPaintedTexture(HALL_SURFACE_URLS.carpet, carpetFallback,
        16 / carpetTile, 37 / carpetTile),
      color: HALL_PALETTE.carpet,
      roughness: 1,
    }),
    hallTrim: new THREE.MeshStandardMaterial({
      map: woodFallback, color: HALL_PALETTE.trim, roughness: .98,
    }),
    hallBeam: new THREE.MeshStandardMaterial({
      map: beamPaint, color: HALL_PALETTE.beam, roughness: .98,
    }),
  };
}
