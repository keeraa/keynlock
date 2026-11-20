import * as THREE from '../vendor/three.js';
import { HALL_END_WALL_HEIGHT } from './hall-architecture.js';

// Separate original gouache paintings for plaster and the continuous wood vault.
// Asset paths are resolved relative to the module so hosting works at any base URL.
export const HALL_SURFACE_URLS = Object.freeze({
  wall: new URL('../assets/gouache-archive-limewash-v8.webp', import.meta.url).href,
  ceiling: new URL('../assets/gouache-archive-ivory-v3.webp', import.meta.url).href,
  carpet: new URL('../assets/gouache-carpet-plain-v4.webp', import.meta.url).href,
  wood: new URL('../assets/gouache-archive-walnut-v5.webp', import.meta.url).href,
});

// Shared archive palette: pale plaster, shaded columns, pale-oak vault,
// faded claret fabric and warm walnut framing.
export const HALL_PALETTE = Object.freeze({
  wall: 0xf0e9df,
  pilaster: 0xe3d9cc,
  ceiling: 0xffffff,
  carpet: 0xdcd0cb,
  trim: 0xb9aea0,
  beam: 0x948a7c,
});

export const HALL_SURFACE_TILE_METERS = Object.freeze({
  ceiling: 4.8, carpet: 4.4, trim: 2.6,
});

const PLASTER_WIDTH = 48;
const PLASTER_HEIGHT = 15;

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

export function createArchiveWoodTexture(fallback) {
  return loadPaintedTexture(HALL_SURFACE_URLS.wood, fallback, 1, 1);
}

export function createHallSurfaceMaterials(plasterFallback, woodFallback, carpetFallback) {
  // Share one painting across the walls and the pilasters, with separate UV transforms.
  const plasterPaint = loadPaintedTexture(HALL_SURFACE_URLS.wall, plasterFallback, 1, 1);
  plasterPaint.wrapS = plasterPaint.wrapT = THREE.ClampToEdgeWrapping;
  const plaster = (width, height, offsetU, color = HALL_PALETTE.wall) => {
    const map = plasterPaint.clone();
    map.repeat.set(width / PLASTER_WIDTH, height / PLASTER_HEIGHT);
    map.offset.set(offsetU, .025);
    return new THREE.MeshStandardMaterial({ map, color, roughness: .98 });
  };
  const ceilingTile = HALL_SURFACE_TILE_METERS.ceiling;
  const carpetTile = HALL_SURFACE_TILE_METERS.carpet;
  const trimPaint = loadPaintedTexture(HALL_SURFACE_URLS.wood, woodFallback, 1, 1);
  const beamPaint = loadPaintedTexture(HALL_SURFACE_URLS.wood, woodFallback, 7, 1);
  return {
    // ExtrudeGeometry uses world-sized UVs; BoxGeometry uses normalized UVs.
    hallWall: plaster(1, 1, .5),
    hallEnd: plaster(24, HALL_END_WALL_HEIGHT, .18),
    // Pilasters receive physical-length UVs directly on their box geometry.
    hallPilaster: plaster(1, 1, .83, HALL_PALETTE.pilaster),
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
      map: trimPaint, color: HALL_PALETTE.trim, roughness: .98,
    }),
    hallBeam: new THREE.MeshStandardMaterial({
      map: beamPaint, color: HALL_PALETTE.beam, roughness: .98,
    }),
  };
}
