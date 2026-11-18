import * as THREE from '../vendor/three.js';
import { KEY_TEMPLATES, defaultDesign, fixedMetal } from './key-data.js';
import { createKeyModel } from './key-geometry.js';

// For a hall filled with repeated keys: make each distinct design only once,
// then render all of its placements in a single draw per material layer.
// Distinct rust/dirt recipes get independent shader uniforms, but share textures.
const instancedMaterials=new WeakMap();
export function createInstancedKeyCollection(entries) {
  if(!Array.isArray(entries))throw new TypeError('Expected an array of key placements');
  const batches=new Map();
  for(const entry of entries) {
    const design=entry?.design??(Number.isInteger(entry?.template)?defaultDesign(entry.template):null);
    if(!design||!KEY_TEMPLATES[design.template])throw new RangeError('Unknown key design');
    const identity=JSON.stringify([design.template,fixedMetal(design.template),design.shaftLength,
      design.headSize,design.teeth,design.cutDepth,design.thickness,
      design.rustAmount??0,design.dirtAmount??0,!!design.doubleSided,!!design.engraving,
      !!design.broken,design.broken?(design.breakAngle??70):0]);
    if(!batches.has(identity))batches.set(identity,{design,entries:[]});
    batches.get(identity).entries.push(entry);
  }
  const collection=new THREE.Group(),materials=[];
  let renderedTriangles=0,uniqueTriangles=0;
  const translation=new THREE.Matrix4();
  for(const {design,entries:batchEntries} of batches.values()) {
    const materialCache=new Map();
    const prototype=createKeyModel(design,{materialCache});
    materials.push(...materialCache.values());
    for(const mesh of prototype.children) {
      if(!mesh.isMesh)continue;
      const triangles=(mesh.geometry.index?.count??mesh.geometry.getAttribute('position').count)/3;
      renderedTriangles+=triangles*batchEntries.length;
      uniqueTriangles+=triangles;
      const instances=new THREE.InstancedMesh(mesh.geometry,mesh.material,batchEntries.length);
      instances.castShadow=mesh.castShadow;
      instances.receiveShadow=mesh.receiveShadow;
      instances.userData.exportable=mesh.userData.exportable;
      instances.userData.outlineable=mesh.userData.outlineable;
      instances.userData.templateId=KEY_TEMPLATES[design.template].id;
      for(let i=0;i<batchEntries.length;i++) {
        const entry=batchEntries[i];
        const position=entry.position??[0,0,0];
        const matrix=entry.matrix?.isMatrix4?entry.matrix:
          translation.makeTranslation(position[0]??position.x??0,position[1]??position.y??0,position[2]??position.z??0);
        instances.setMatrixAt(i,matrix);
      }
      instances.instanceMatrix.needsUpdate=true;
      collection.add(instances);
    }
  }
  collection.userData.keyCount=entries.length;
  collection.userData.drawCalls=collection.children.length;
  collection.userData.uniqueDesigns=batches.size;
  collection.userData.renderedTriangles=renderedTriangles;
  collection.userData.uniqueTriangles=uniqueTriangles;
  instancedMaterials.set(collection,materials);
  return collection;
}

export function disposeInstancedKeyCollection(collection) {
  if(!instancedMaterials.has(collection))return;
  const geometries=new Set();
  for(const mesh of collection.children)if(mesh.isMesh)geometries.add(mesh.geometry);
  for(const geometry of geometries)geometry.dispose();
  for(const material of instancedMaterials.get(collection))material.dispose();
  collection.clear();
  instancedMaterials.delete(collection);
}
