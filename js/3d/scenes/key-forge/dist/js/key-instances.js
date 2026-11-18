import * as THREE from '../vendor/three.js';
import { KEY_TEMPLATES, defaultDesign, normalizeKeyDesign } from './key-data.js';
import { createKeyModel } from './key-geometry.js';
import { createKeyPlacementMatrix } from './key-placement.js';

// Geometry families are shared across different rust amounts and per-key
// pigment seeds. Only actual shape differences (including the opaque dirt rim)
// create another draw-call batch.
const collections=new WeakMap();
const meshCollections=new WeakMap();

function entryDesign(entry) {
  const index=entry?.design?.template??entry?.template;
  if(!Number.isInteger(index)||!KEY_TEMPLATES[index])throw new RangeError('Unknown key design');
  return normalizeKeyDesign({...defaultDesign(index),...(entry.design??{})});
}

function shapeSignature(d) {
  return JSON.stringify([d.template,d.shaftLength,d.headSize,d.teeth,d.cutDepth,
    d.thickness,!!d.doubleSided,!!d.engraving,d.dirtAmount>0,
    !!d.broken,d.broken?d.breakAngle:0]);
}

function paintSeed(id,entry) {
  if(entry.paintSeed!==undefined) {
    if(!Number.isFinite(entry.paintSeed)||entry.paintSeed<0)throw new TypeError('Invalid paint seed');
    return entry.paintSeed;
  }
  let hash=2166136261;
  for(const char of String(id))hash=Math.imul(hash^char.charCodeAt(0),16777619);
  return (hash>>>0)/4294967295*29.7;
}

function placementMatrix(entry,design) {
  if(entry.matrix?.isMatrix4)return entry.matrix.clone();
  if(entry.placement)return createKeyPlacementMatrix(design,entry.placement);
  const p=entry.position??[0,0,0];
  const coords=Array.isArray(p)?p:[p.x??0,p.y??0,p.z??0];
  if(coords.length!==3||coords.some(v=>!Number.isFinite(v)))
    throw new TypeError('Invalid key position');
  return new THREE.Matrix4().makeTranslation(...coords);
}

function stats(collection,state) {
  let triangles=0,uniqueTriangles=0;
  for(const batch of state.batches.values()) {
    triangles+=batch.trianglesPerKey*batch.ids.length;
    uniqueTriangles+=batch.trianglesPerKey;
  }
  collection.userData.keyCount=state.records.size;
  collection.userData.drawCalls=collection.children.length;
  collection.userData.shadowCasterBatches=collection.children.filter(mesh=>mesh.castShadow).length;
  collection.userData.uniqueDesigns=state.batches.size;
  collection.userData.renderedTriangles=triangles;
  collection.userData.uniqueTriangles=uniqueTriangles;
}

function snapshot(record) {
  if(!record)return null;
  return {id:record.id,templateId:KEY_TEMPLATES[record.design.template].id,
    design:{...record.design},matrix:record.matrix.clone(),
    instanceId:record.index,paintSeed:record.seed};
}

function stateFor(collection) {
  const state=collections.get(collection);
  if(!state)throw new Error('Key collection is not active');
  return state;
}

export function createInstancedKeyCollection(entries,{castShadow=true,receiveShadow=true}={}) {
  if(!Array.isArray(entries))throw new TypeError('Expected an array of key placements');
  const groups=new Map(),records=new Map();
  for(const [order,entry] of entries.entries()) {
    const design=entryDesign(entry);
    const id=entry.id??'key-'+order;
    if(records.has(id))throw new RangeError('Duplicate key instance id');
    const signature=shapeSignature(design);
    if(!groups.has(signature))groups.set(signature,{signature,design,records:[]});
    const record={id,design,seed:paintSeed(id,entry),matrix:placementMatrix(entry,design),
      batch:null,index:0};
    records.set(id,record);
    groups.get(signature).records.push(record);
  }
  const collection=new THREE.Group(),batches=new Map();
  for(const group of groups.values()) {
    const materialCache=new Map();
    const prototype=createKeyModel(group.design,{materialCache});
    const ids=group.records.map(record=>record.id);
    const batch={signature:group.signature,ids,meshes:[],materials:[...materialCache.values()],
      trianglesPerKey:0};
    for(const [index,record] of group.records.entries()) {
      record.index=index;
      record.batch=batch;
    }
    for(const source of prototype.children) {
      if(!source.isMesh)continue;
      const triangles=(source.geometry.index?.count??source.geometry.getAttribute('position').count)/3;
      batch.trianglesPerKey+=triangles;
      const mesh=new THREE.InstancedMesh(source.geometry,source.material,ids.length);
      mesh.castShadow=castShadow&&source.castShadow;
      mesh.receiveShadow=receiveShadow&&source.receiveShadow;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      Object.assign(mesh.userData,{exportable:source.userData.exportable,
        outlineable:source.userData.outlineable,templateId:KEY_TEMPLATES[group.design.template].id,
        keyInstanceIds:ids});
      meshCollections.set(mesh,collection);
      if(source.userData.exportable!==false) {
        const paint=new Float32Array(ids.length*3);
        for(const [index,record] of group.records.entries()) {
          paint[index*3]=Math.max(0,Math.min(200,record.design.rustAmount??0))/100;
          paint[index*3+1]=record.design.dirtAmount/100;
          paint[index*3+2]=record.seed;
        }
        mesh.geometry.setAttribute('instanceKeyPaint',
          new THREE.InstancedBufferAttribute(paint,3).setUsage(THREE.DynamicDrawUsage));
      }
      for(const record of group.records)mesh.setMatrixAt(record.index,record.matrix);
      mesh.instanceMatrix.needsUpdate=true;
      mesh.computeBoundingSphere();
      collection.add(mesh);
      batch.meshes.push(mesh);
    }
    prototype.clear();
    batches.set(group.signature,batch);
  }
  const state={records,batches};
  collections.set(collection,state);
  collection.userData.selectedKeyId=null;
  stats(collection,state);
  return collection;
}

export function getKeyInstance(collection,id) {
  return snapshot(stateFor(collection).records.get(id));
}

// Pass the first Three.js Raycaster hit (including hit.instanceId). Both the
// painted body and opaque dirt rim resolve to the same stable gameplay key id.
export function keyInstanceFromIntersection(hit) {
  const mesh=hit?.object;
  const collection=meshCollections.get(mesh);
  if(!collection||!collections.has(collection)||!Number.isInteger(hit.instanceId))return null;
  const id=mesh.userData.keyInstanceIds[hit.instanceId];
  return id===undefined?null:getKeyInstance(collection,id);
}

export function selectKeyInstance(collection,id=null) {
  const selected=id===null?null:getKeyInstance(collection,id);
  collection.userData.selectedKeyId=selected?.id??null;
  return selected;
}

export function moveKeyInstance(collection,id,transform) {
  const record=stateFor(collection).records.get(id);
  if(!record)return null;
  if(transform?.isMatrix4)record.matrix.copy(transform);
  else if(transform?.matrix?.isMatrix4)record.matrix.copy(transform.matrix);
  else if(transform?.mode)record.matrix.copy(createKeyPlacementMatrix(record.design,transform));
  else {
    const p=Array.isArray(transform)?transform:transform?.position??transform;
    const c=Array.isArray(p)?p:[p?.x,p?.y,p?.z];
    if(c.length!==3||c.some(v=>!Number.isFinite(v)))throw new TypeError('Invalid key position');
    record.matrix.setPosition(...c);
  }
  for(const mesh of record.batch.meshes) {
    mesh.setMatrixAt(record.index,record.matrix);
    mesh.instanceMatrix.needsUpdate=true;
    mesh.computeBoundingSphere();
    mesh.computeBoundingBox();
  }
  return snapshot(record);
}

// Cosmetic rust changes never regenerate triangles. Dirt has its own physical
// rim, so changing its on/off state needs a new geometry family.
export function setKeyInstanceRust(collection,id,rustAmount) {
  const record=stateFor(collection).records.get(id);
  if(!record)return null;
  if(!Number.isFinite(rustAmount))throw new TypeError('Invalid rust amount');
  record.design.rustAmount=Math.max(0,Math.min(200,rustAmount));
  for(const mesh of record.batch.meshes) {
    const paint=mesh.geometry.getAttribute('instanceKeyPaint');
    if(!paint)continue;
    paint.setX(record.index,record.design.rustAmount/100);
    paint.needsUpdate=true;
  }
  return snapshot(record);
}

function disposeBatch(collection,batch) {
  for(const mesh of batch.meshes) {
    collection.remove(mesh);
    mesh.geometry.dispose();
    mesh.dispose();
    meshCollections.delete(mesh);
  }
  for(const material of batch.materials)material.dispose();
}

// Swap-with-last leaves no holes in the GPU buffers; all layer indexes, ray
// hits and gameplay IDs are updated together, without rebuilding the hall.
export function removeKeyInstance(collection,id) {
  const state=stateFor(collection),record=state.records.get(id);
  if(!record)return false;
  const {batch,index}=record;
  const last=batch.ids.length-1;
  if(index!==last) {
    const replacementId=batch.ids[last],replacement=state.records.get(replacementId);
    for(const mesh of batch.meshes) {
      const matrix=new THREE.Matrix4();mesh.getMatrixAt(last,matrix);
      mesh.setMatrixAt(index,matrix);
      const paint=mesh.geometry.getAttribute('instanceKeyPaint');
      if(paint) {
        paint.setXYZ(index,paint.getX(last),paint.getY(last),paint.getZ(last));
        paint.needsUpdate=true;
      }
    }
    batch.ids[index]=replacementId;
    replacement.index=index;
  }
  batch.ids.pop();
  state.records.delete(id);
  if(collection.userData.selectedKeyId===id)collection.userData.selectedKeyId=null;
  for(const mesh of batch.meshes) {
    mesh.count=batch.ids.length;
    mesh.instanceMatrix.needsUpdate=true;
    if(mesh.count){mesh.computeBoundingSphere();mesh.computeBoundingBox();}
  }
  if(batch.ids.length===0) {
    disposeBatch(collection,batch);
    state.batches.delete(batch.signature);
  }
  stats(collection,state);
  return true;
}

export function disposeInstancedKeyCollection(collection) {
  const state=collections.get(collection);
  if(!state)return;
  for(const batch of state.batches.values())disposeBatch(collection,batch);
  state.records.clear();state.batches.clear();
  collections.delete(collection);
  collection.userData.selectedKeyId=null;
  stats(collection,state);
}
