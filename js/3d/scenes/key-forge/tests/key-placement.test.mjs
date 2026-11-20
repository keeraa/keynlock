import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.js';
import { KEY_TEMPLATES, defaultDesign, getKeyAnchors,
  createKeyPlacementMatrix, createKeyModel, disposeKeyModel } from '../dist/js/key-model.js';

function close(a,b,epsilon=1e-6) { assert.ok(a.distanceTo(b)<epsilon,`${a.toArray()} != ${b.toArray()}`); }

test('у всех форм есть независимые точки подвеса и опоры на полу',()=>{
  for(let i=0;i<KEY_TEMPLATES.length;i++) {
    const design={...defaultDesign(i),broken:i%2===0,breakAngle:80};
    const anchors=getKeyAnchors(design);
    assert.ok(anchors.hang[0]<-.9,KEY_TEMPLATES[i].id);
    assert.ok(anchors.hang[0]<anchors.holeCenter[0],KEY_TEMPLATES[i].id);
    assert.equal(anchors.floor[2],0);
    const model=createKeyModel(design);
    assert.deepEqual(model.userData.anchors,anchors);
    disposeKeyModel(model);
    const at=new THREE.Vector3(i*2,1.6,3.4);
    for(const mode of ['floor','hang']) {
      const matrix=createKeyPlacementMatrix(design,{mode,position:at.toArray(),yaw:.38});
      close(new THREE.Vector3(...anchors[mode]).applyMatrix4(matrix),at);
      const expected=mode==='floor'?new THREE.Vector3(0,1,0):null;
      if(expected)close(new THREE.Vector3(0,0,1).transformDirection(matrix),expected);
      else close(new THREE.Vector3(1,0,0).transformDirection(matrix),new THREE.Vector3(0,-1,0));
    }
  }
});

test('неверная позиция и режим крепления отклоняются',()=>{
  assert.throws(()=>getKeyAnchors({template:100}),RangeError);
  assert.throws(()=>createKeyPlacementMatrix(defaultDesign(0),{mode:'wall'}),RangeError);
  assert.throws(()=>createKeyPlacementMatrix(defaultDesign(0),{position:[Infinity,0,0]}),TypeError);
});
