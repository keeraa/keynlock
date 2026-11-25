import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import * as THREE from '../vendor/three.js';
import {makeLayout} from '../src/architecture/layout.js';
import {createHallVisibility} from '../src/scene/hall-visibility.js';
import {createRoomIndex} from '../src/rendering/room-index.js';

const config=JSON.parse(await fs.readFile(new URL('../config/scene.json',import.meta.url)));
const layout=makeLayout(config), camera=new THREE.PerspectiveCamera(73,1.6,.05,200);
test('deep views retain the opposite wing, reveal side wings at the mouth, and reset for plan and shadow passes',()=>{
  const visibility=createHallVisibility(THREE,layout,config.building);
  for(const [i,h] of layout.halls.entries()) {
    const at=layout.world(h,0,h.start+h.length-1);
    camera.position.set(at.x,config.building.floorElevation+1.78,at.z);
    camera.lookAt(0,camera.position.y,0);
    visibility.update(camera);
    assert(visibility.visible.has(h.id));
    assert(visibility.visible.has(layout.halls[(i+3)%6].id));
    for (const offset of [1,5]) assert(!visibility.visible.has(layout.halls[(i+offset)%6].id));
    const near=layout.world(h,0,h.start+1);
    camera.position.set(near.x,camera.position.y,near.z);
    visibility.update(camera);
    assert(visibility.visible.size>3);
    visibility.update(camera,true);
    assert.equal(visibility.visible.size,7);
  }
});

test('repeated room selections keep one index buffer and restore all original triangles',()=>{
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(18),3));
  const full=[0,2,1,3,4,5,1,2,3];g.setIndex(full);
  const select=createRoomIndex(THREE,g,[{start:0,end:3,room:'a'},{start:3,end:6,room:'b'},{start:6,end:9}]);
  select(new Set(['b']));
  const attr=g.index, version=attr.version;
  assert.deepEqual([...attr.array.slice(0,g.drawRange.count)],full.slice(3));
  select(new Set(['b']));
  assert.equal(attr.version,version);
  select(null);
  assert.equal(attr,g.index);
  assert.equal(g.drawRange.count,9);assert.deepEqual([...attr.array],full);
  g.dispose();
});
