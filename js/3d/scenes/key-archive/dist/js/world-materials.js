import * as THREE from '../vendor/three.js';
import { makePaintTexture } from './art.js?v=17';
import { getPaintedMetalTexture } from './painted-textures.js';
import { createHallSurfaceMaterials, createArchiveWoodTexture } from './hall-surface-textures.js?v=26';

function makeContactShadowMaterial() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 12, 64, 64, 63);
  gradient.addColorStop(0, 'rgba(36,31,27,.52)');
  gradient.addColorStop(.45, 'rgba(36,31,27,.29)');
  gradient.addColorStop(1, 'rgba(36,31,27,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -1 });
}

export function createMaterials() {
  const brassPaint = getPaintedMetalTexture('brass');
  const wood = makePaintTexture('wood', 45);
  const floorWood = makePaintTexture('wood', 81);
  floorWood.repeat.set(7, 13);
  const plaster = makePaintTexture('plaster', 32);
  const carpetFallback = makePaintTexture('rug', 177);
  const walnut = createArchiveWoodTexture(wood);
  return {
    wood: new THREE.MeshStandardMaterial({ map: walnut, color: 0xe1ded7, roughness: .98 }),
    darkWood: new THREE.MeshStandardMaterial({ map: walnut, color: 0xa19b93, roughness: .98 }),
    carvedWood: new THREE.MeshStandardMaterial({ map: walnut, color: 0xbcb3a6, roughness: .99 }),
    cabinetWalnut: new THREE.MeshStandardMaterial({ map: walnut, color: 0x8c8881, roughness: .98 }),
    agedBronze: new THREE.MeshStandardMaterial({ color: 0x77705e, roughness: .91, metalness: .18 }),
    contactShadow: makeContactShadowMaterial(),
    floor: new THREE.MeshStandardMaterial({ map: floorWood, color: 0xada596, roughness: .98 }),
    ...createHallSurfaceMaterials(plaster, wood, carpetFallback),
    blackWood: new THREE.MeshStandardMaterial({ map: walnut, color: 0x615d56, roughness: .99 }),
    cabinetBack: new THREE.MeshStandardMaterial({ color: 0x0b0d0d, roughness: 1 }),
    brass: new THREE.MeshStandardMaterial({ map: brassPaint, color: 0xb49a65, roughness: .89, metalness: .16 }),
    darkBrass: new THREE.MeshStandardMaterial({ map: brassPaint, color: 0x7d6b55, roughness: .93, metalness: .12 }),
    ink: new THREE.MeshStandardMaterial({ color: 0x171d1d, roughness: .93 }),
    glass: new THREE.MeshBasicMaterial({ color: 0xabc9c2, transparent: true, opacity: .51, depthWrite: false }),
    windowLight: new THREE.MeshBasicMaterial({ color: 0xf7eacb, transparent: true, opacity: .23, depthWrite: false }),
    light: new THREE.MeshBasicMaterial({ color: 0xe5ca96 }),
  };
}
