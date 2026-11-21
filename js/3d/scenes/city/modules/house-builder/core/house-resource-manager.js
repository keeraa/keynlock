import { acquireHouseTextures } from './house-textures.js';
import { acquireFixedHouseMaterials, createHouseGlass } from './house-materials.js';

// Geometry belongs to a model instance; paint textures and fixed materials
// remain reference-counted across every house using the same Three.js runtime.
export function disposeHouseGeometry(group) {
  const geometries = new Set();
  group.traverse(object => {
    if (object.isMesh && object.geometry) geometries.add(object.geometry);
  });
  for (const geometry of geometries) geometry.dispose();
  group.clear();
}

export function createHouseResourceManager(THREE, paintedTexture, glass) {
  const sharedTextures = acquireHouseTextures(THREE, paintedTexture);
  const sharedMaterials = acquireFixedHouseMaterials(THREE);
  const ownedGlass = glass ? null : createHouseGlass(THREE);
  const mats = {
    plaster: new THREE.MeshStandardMaterial({color:'#dec8a4', roughness:.98}),
    roof: new THREE.MeshStandardMaterial({color:'#a8604b', roughness:.94, side:THREE.DoubleSide}),
    roofEdge: new THREE.MeshStandardMaterial({color:'#693d39', roughness:1}),
    wood: new THREE.MeshStandardMaterial({color:'#675340', roughness:.95}),
    shutter: new THREE.MeshStandardMaterial({color:'#675340', roughness:.98}),
    door: new THREE.MeshStandardMaterial({color:'#e2d1be', roughness:.97}),
    ...sharedMaterials.materials,
    glass: (glass ?? ownedGlass).material,
  };
  const ownedMaterials = [mats.plaster,mats.roof,mats.roofEdge,mats.wood,mats.shutter,mats.door];
  let disposed = false;
  sharedTextures.attach(mats);
  return {
    materials:mats,
    setColors(config) {
      mats.plaster.color.set(config.plasterColor);
      mats.roof.color.set(config.roofColor);
      mats.wood.color.set(config.woodColor);
      mats.shutter.color.set(config.woodColor);
      mats.door.color.set(config.woodColor).lerp(new THREE.Color('#ffffff'),.64);
      mats.roofEdge.color.set(config.roofColor).multiplyScalar(.56);
    },
    dispose() {
      if(disposed)return;
      disposed=true;
      for(const material of ownedMaterials)material.dispose();
      ownedGlass?.dispose();
      sharedTextures.release();
      sharedMaterials.release();
    },
  };
}
