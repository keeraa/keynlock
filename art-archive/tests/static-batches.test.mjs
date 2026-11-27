import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.js';
import {batchStatic} from '../src/rendering/static-batches.js';

test('nested roof batches keep their transform and disappear with the cutaway',()=>{
  const root=new THREE.Group(),roof=new THREE.Group(),wing=new THREE.Group();
  root.position.y=8;wing.rotation.y=.6;
  root.add(roof);roof.add(wing);
  const material=new THREE.MeshBasicMaterial(),geometry=new THREE.BoxGeometry(1,1,2);
  for(const layer of [root,roof,wing]){
    for(const x of [-3,3]){
      const mesh=new THREE.Mesh(geometry,material);
      mesh.position.set(x,layer===wing?6:2,5);layer.add(mesh);
    }
  }
  root.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(wing,true);
  const batch=batchStatic(THREE,root,[root,roof,wing]);
  assert.equal(batch.count,3);
  const after=new THREE.Box3().setFromObject(wing,true);
  assert(bounds.min.distanceTo(after.min)<1e-5 && bounds.max.distanceTo(after.max)<1e-5);
  roof.visible=false;let visible=0;
  root.traverseVisible(object=>{if(object.isMesh)visible++;});
  assert.equal(visible,1);
  batch.dispose();geometry.dispose();material.dispose();
});

test('indexed batches retain exact transformed positions, hard normals and UV seams through room changes',()=>{
  const root=new THREE.Group(),material=new THREE.MeshBasicMaterial(),box=new THREE.BoxGeometry();
  const reference=[];
  for(const room of ['left','right']){
    const wing=new THREE.Group();wing.userData.galleryId=room;root.add(wing);
    const part=new THREE.Mesh(box,material);wing.add(part);part.rotation.y=.7;part.position.x=room==='left'?-1:1;
    root.updateMatrixWorld(true);
    reference.push(box.toNonIndexed().applyMatrix4(part.matrixWorld));
  }
  const batch=batchStatic(THREE,root,[root]);
  const merged=root.getObjectByName('static:').geometry;
  assert(merged.attributes.position.count<merged.index.count);
  for(const rooms of [['left','right'],['right'],['left','right']]){
    batch.selectRooms(new Set(rooms));
    const count=Math.min(merged.drawRange.count,merged.index.count);
    assert.equal(count,36*rooms.length);
    for(let i=0;i<count;i++){
      const src=reference[rooms[Math.floor(i/36)]==='left'?0:1],j=merged.index.getX(i);
      for(const name of ['position','normal','uv']){
        const attr=src.attributes[name],actual=merged.attributes[name];
        for(let k=0;k<attr.itemSize;k++)assert.equal(actual.getComponent(j,k),attr.getComponent(i%36,k));
      }
    }
  }
  batch.dispose();for(const g of reference)g.dispose();box.dispose();material.dispose();
});
