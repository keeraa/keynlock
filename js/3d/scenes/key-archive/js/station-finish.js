import * as THREE from '../vendor/three.js';

export const STATION_PAINT_URLS = Object.freeze({
  glaze: new URL('../assets/gouache-station-glaze-v1.webp', import.meta.url).href,
  iron: new URL('../assets/gouache-station-iron-v1.webp', import.meta.url).href,
  bench: new URL('../assets/gouache-workbench-walnut-v1.webp', import.meta.url).href,
});

export function createStationFinishes() {
  const loader = new THREE.TextureLoader();
  function paint(kind) {
    const map = loader.load(STATION_PAINT_URLS[kind]);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    return map;
  }
  const bench = paint('bench');
  const iron = paint('iron');
  return {
    glaze: paint('glaze'),
    iron: new THREE.MeshStandardMaterial({ map: iron, color: 0x888780, roughness: .91 }),
    soot: new THREE.MeshStandardMaterial({ map: iron, color: 0x5a524c, roughness: 1 }),
    benchTop: new THREE.MeshStandardMaterial({ map: bench, color: 0xf5e9dc, roughness: .95 }),
    benchEdge: new THREE.MeshStandardMaterial({ map: bench, color: 0xb4a499, roughness: .98 }),
  };
}
