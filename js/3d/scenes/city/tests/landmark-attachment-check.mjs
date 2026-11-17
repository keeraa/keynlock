import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.js';
import {createLandmarkModel,LANDMARK_CATALOG} from '../js/landmarks/landmark-model.js';

const touch=(a,b,slack=.026)=>a.min.x<=b.max.x+slack&&b.min.x<=a.max.x+slack&&
  a.min.y<=b.max.y+slack&&b.min.y<=a.max.y+slack&&
  a.min.z<=b.max.z+slack&&b.min.z<=a.max.z+slack;
const errors=[];

for(const item of LANDMARK_CATALOG)for(const detail of ['high','medium','low']){
  const model=createLandmarkModel(THREE,item.id,{detail});
  const meshes=[];
  model.group.updateMatrixWorld(true);
  model.group.traverse(mesh=>{if(mesh.isMesh)meshes.push(mesh);});
  const boxes=meshes.map(mesh=>new THREE.Box3().setFromObject(mesh));
  assert(meshes.length>0,`${item.id}/${detail} has no geometry`);

  // A component is attached if it touches the foundation or another piece
  // with a continuous chain back to the foundation. A 2.6 cm tolerance
  // accounts for rounded mesh edges and surface painting depth offsets.
  const attached=new Uint8Array(meshes.length);
  const queue=[0];attached[0]=1;
  for(let q=0;q<queue.length;q++)for(let i=0;i<meshes.length;i++){
    if(attached[i]||!touch(boxes[queue[q]],boxes[i]))continue;
    attached[i]=1;queue.push(i);
  }
  const detached=meshes.flatMap((mesh,i)=>attached[i]?[]:[{mesh,box:boxes[i]}]);
  const nearest=(box)=>Math.min(...boxes.filter((_,i)=>attached[i]).map(other=>
    Math.hypot(...['x','y','z'].map(axis=>Math.max(0,
      other.min[axis]-box.max[axis],box.min[axis]-other.max[axis])))));
  if(detached.length)errors.push(`Detached meshes (${detached.length}) in ${item.id}/${detail}: `+
    detached.slice(0,12).map(({mesh,box})=>`${mesh.geometry.type} `+
      `${mesh.getWorldPosition(new THREE.Vector3()).toArray().map(n=>n.toFixed(2))} `+
      `(nearest ${nearest(box).toFixed(3)}m)`).join('; '));
  model.dispose();
}

assert.deepEqual(errors,[],'All landmarks must consist of connected geometry');
console.log('Landmarks: all six building types, all three LOD levels, no disconnected meshes');
