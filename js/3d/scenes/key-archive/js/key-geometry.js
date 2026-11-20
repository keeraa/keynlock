import * as THREE from '../vendor/three.js';
import { KEY_TEMPLATES, fixedMetal } from './key-data.js?v=plain-gouache';
import { joinedKeyShape } from './key-shapes.js?v=2';
import { getMetalMaterial } from './key-materials.js?v=wax-and-bundles';
import { crustWidth, dirtTriangles, getDirtMaterial } from './key-dirt.js?v=wax-and-bundles';
import { getKeyAnchors } from './key-placement.js?v=plain-gouache';

function extrude(shape,depth) {
  // Flat caps and one side wall per edge retain the silhouette and STL volume.
  // Small geometric bevels doubled the triangle count of every hall key.
  return new THREE.ExtrudeGeometry(shape,{depth,steps:1,curveSegments:12,
    bevelEnabled:false});
}

function addMesh(group,geometry,material,position=[0,0,0],exportable=true) {
  const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...position);
  mesh.castShadow=exportable;mesh.receiveShadow=exportable;
  mesh.userData.exportable=exportable;group.add(mesh);
  return mesh;
}


// Reuse vertices only when every paint/shading attribute is bit-identical.
// Indexed triangles and normals are unchanged; GPU uploads fewer vertices.
function indexMergedGeometry(geometry) {
  const p=geometry.getAttribute('position'),n=geometry.getAttribute('normal');
  const uv=geometry.getAttribute('uv'),c=geometry.getAttribute('color');
  if(p.count<500)return;
  const pBits=new Uint32Array(p.array.buffer,p.array.byteOffset,p.array.length);
  const nBits=new Uint32Array(n.array.buffer,n.array.byteOffset,n.array.length);
  const uvBits=new Uint32Array(uv.array.buffer,uv.array.byteOffset,uv.array.length);
  const cBits=c?new Uint32Array(c.array.buffer,c.array.byteOffset,c.array.length):null;
  const positions=new Float32Array(p.array.length),normals=new Float32Array(n.array.length);
  const uvs=new Float32Array(uv.array.length),colors=c?new Float32Array(c.array.length):null;
  const indices=new (p.count>65535?Uint32Array:Uint16Array)(p.count);
  const buckets=new Map(),representatives=[];
  let unique=0;
  for(let i=0;i<p.count;i++) {
    let hash=2166136261;
    for(let k=0;k<3;k++)hash=Math.imul(hash^pBits[i*3+k],16777619);
    for(let k=0;k<3;k++)hash=Math.imul(hash^nBits[i*3+k],16777619);
    for(let k=0;k<2;k++)hash=Math.imul(hash^uvBits[i*2+k],16777619);
    if(cBits)for(let k=0;k<3;k++)hash=Math.imul(hash^cBits[i*3+k],16777619);
    const bucket=buckets.get(hash);
    let vertex=-1;
    if(bucket)for(const index of bucket) {
      const source=representatives[index];
      let equal=true;
      for(let k=0;k<3;k++)if(pBits[i*3+k]!==pBits[source*3+k]||nBits[i*3+k]!==nBits[source*3+k]||
        (cBits&&cBits[i*3+k]!==cBits[source*3+k])){equal=false;break;}
      if(equal)for(let k=0;k<2;k++)if(uvBits[i*2+k]!==uvBits[source*2+k]){equal=false;break;}
      if(equal){vertex=index;break;}
    }
    if(vertex<0) {
      vertex=unique++;representatives.push(i);
      positions.set(p.array.subarray(i*3,i*3+3),vertex*3);
      normals.set(n.array.subarray(i*3,i*3+3),vertex*3);
      uvs.set(uv.array.subarray(i*2,i*2+2),vertex*2);
      if(colors)colors.set(c.array.subarray(i*3,i*3+3),vertex*3);
      if(bucket)bucket.push(vertex);else buckets.set(hash,[vertex]);
    }
    indices[i]=vertex;
  }
  geometry.setAttribute('position',new THREE.BufferAttribute(positions.slice(0,unique*3),3));
  geometry.setAttribute('normal',new THREE.BufferAttribute(normals.slice(0,unique*3),3));
  geometry.setAttribute('uv',new THREE.BufferAttribute(uvs.slice(0,unique*2),2));
  if(colors)geometry.setAttribute('color',new THREE.BufferAttribute(colors.slice(0,unique*3),3));
  geometry.setIndex(new THREE.BufferAttribute(indices,1));
}

// Merge into preallocated typed buffers. This keeps the exact triangles and
// materials but avoids copying thousands of floats into growable JS arrays.
function mergeKeyMeshes(group) {
  group.updateMatrixWorld(true);
  const batches=new Map();
  group.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const exportable=mesh.userData.exportable!==false;
    const outlineable=mesh.userData.outlineable===true;
    const key=`${mesh.material.uuid}:${exportable}:${outlineable}`;
    if(!batches.has(key))batches.set(key,{
      material:mesh.material,exportable,outlineable,parts:[],vertexCount:0,
    });
    const batch=batches.get(key);
    const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry;
    if(geometry!==mesh.geometry)mesh.geometry.dispose();
    geometry.applyMatrix4(mesh.matrixWorld);
    batch.vertexCount+=geometry.getAttribute('position').count;
    batch.parts.push(geometry);
  });
  group.clear();
  for(const batch of batches.values()) {
    const positions=new Float32Array(batch.vertexCount*3);
    const normals=new Float32Array(batch.vertexCount*3);
    const uvs=new Float32Array(batch.vertexCount*2);
    const colors=batch.material.vertexColors?new Float32Array(batch.vertexCount*3):null;
    let offset=0;
    for(const part of batch.parts) {
      const position=part.getAttribute('position'),normal=part.getAttribute('normal');
      const uv=part.getAttribute('uv'),color=part.getAttribute('color');
      positions.set(position.array,offset*3);
      normals.set(normal.array,offset*3);
      if(uv)uvs.set(uv.array,offset*2);
      if(colors) {
        if(color)colors.set(color.array,offset*3);
        else colors.fill(1,offset*3,(offset+position.count)*3);
      }
      offset+=position.count;
      part.dispose();
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));
    geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2));
    if(colors)geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    indexMergedGeometry(geometry);
    geometry.computeBoundingSphere();
    const merged=addMesh(group,geometry,batch.material,[0,0,0],batch.exportable);
    merged.userData.outlineable=batch.outlineable;
  }
}

// A private paint cache lets a hall batch keep its own rust/dirt uniforms while
// all batches still share the same gouache texture resources and shader code.
export function createKeyModel(design,{materialCache=null}={}) {
  const template=KEY_TEMPLATES[design.template];
  const group=new THREE.Group();
  const cache=materialCache??new Map();
  const metal=getMetalMaterial(fixedMetal(design.template),design.rustAmount??0,
    design.template,design.dirtAmount??0,cache);
  const depth=design.thickness/100;
  // One watertight piece of metal: no internal side wall or cap at the neck.
  addMesh(group,extrude(joinedKeyShape(template,design),depth),metal);
  if(crustWidth(design)>0) {
    const dirt=addMesh(group,dirtTriangles(template,design),getDirtMaterial(),[0,0,0],false);
    dirt.userData.outlineable=true;
  }
  mergeKeyMeshes(group);
  group.userData.template=template.id;
  group.userData.anchors=getKeyAnchors(design);
  group.userData.materialCache=cache;
  group.userData.ownsMaterialCache=!materialCache;
  return group;
}

// Metal and rust change only shader inputs. Reuse every vertex/triangle and
// GPU buffer instead of extruding the entire key again for cosmetic sliders.
export function updateKeyPaint(group,design) {
  const material=getMetalMaterial(fixedMetal(design.template),design.rustAmount??0,
    design.template,design.dirtAmount??0,group.userData.materialCache);
  group.traverse(mesh=>{
    if(mesh.isMesh&&mesh.userData.exportable!==false)mesh.material=material;
  });
}

// Public lifecycle for another scene (e.g. the key collection hall).
// Shared gouache textures and the shared dirt material remain reusable.
export function disposeKeyModel(group) {
  const geometries=new Set();
  group.traverse(mesh=>{if(mesh.isMesh)geometries.add(mesh.geometry);});
  for(const geometry of geometries)geometry.dispose();
  if(group.userData.ownsMaterialCache)
    for(const material of group.userData.materialCache.values())material.dispose();
  group.clear();
}
