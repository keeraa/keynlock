import test from 'node:test';
import assert from 'node:assert/strict';
import {createDragController} from '../public/js/lab/physics/drag-controller.js';
import * as THREE from '../public/vendor/three.js';

test('rigid drag keeps the exact point initially grabbed',()=>{
  const object={position:new THREE.Vector3(1,2,.25)};
  let released=null;
  const drag=createDragController({THREE,toLocal:point=>point,
    bounds:{x:[-4,4],y:[-4,4]},onRelease:body=>{released=body;}});
  const original=object.position.clone();
  drag.begin(object,new THREE.Vector3(1.2,2.1,0),{id:1});
  assert.ok(object.position.equals(original),'grabbing alone must not move the object');
  drag.move(new THREE.Vector3(2.2,3.1,0));
  assert.equal(object.position.x,2);
  assert.equal(object.position.y,3);
  assert.equal(object.position.z,.25,'drag preserves the height of the grasped point');
  assert.ok(drag.isDragging(1));
  assert.ok(drag.end());
  assert.ok(released);
  assert.ok(!drag.isDragging(1));
});

test('dragging an attached cover lifts over the lock before it can intersect',()=>{
  const object={position:new THREE.Vector3(0,0,.4)};
  const drag=createDragController({THREE,toLocal:point=>point,
    bounds:{x:[-3,3],y:[-3,3]}});
  drag.begin(object,new THREE.Vector3(.2,0,.4),{
    id:'cover',minimumZ:-.8,
    minimumZAt:(x,y)=>Math.abs(x)<1?1.1:-.6});
  assert.equal(object.position.z,.4,'contact point is preserved at mouse-down');
  drag.move(new THREE.Vector3(.3,0,.4));
  assert.equal(object.position.z,1.1,'cover cannot clip into the raised housing');
  drag.move(new THREE.Vector3(2.5,0,.4));
  assert.ok(object.position.z>=1.1,'dragging aside does not snap the part down');
  drag.end();
});

test('detaching a part eases from its socket while tracking the pointer',()=>{
  const object={position:new THREE.Vector3(0,0,.5)};
  const drag=createDragController({THREE,toLocal:point=>point,
    bounds:{x:[-4,4],y:[-4,4]}});
  drag.begin(object,new THREE.Vector3(0,0,.5),{
    id:'part:pin-0',smoothTime:.20,minimumZAt:()=>1.1});
  drag.move(new THREE.Vector3(1,0,.5));
  assert.equal(object.position.x,0,
    'the part does not jump sideways on the initial pointer movement');
  assert.ok(object.position.z>=1.1,
    'the part clears the metal socket before moving sideways');
  drag.update(.05);
  assert.ok(object.position.x>0&&object.position.x<.5,
    'initial extraction starts gradually');
  drag.update(.05);drag.update(.05);drag.update(.05);
  assert.ok(Math.abs(object.position.x-1)<1e-6,
    'the part reaches its requested spot at the end of the extraction');
  assert.ok(object.position.z>=1.1);
  drag.end();
});

test('spring exits its drilled bore before rising or following the cursor',()=>{
  const object={position:new THREE.Vector3(0,0,.3)};
  let released=0;
  const drag=createDragController({THREE,toLocal:point=>point,
    bounds:{x:[-4,4],y:[-4,4]},onRelease:()=>{released++;}});
  drag.begin(object,new THREE.Vector3(0,0,.3),{
    id:'part:spring-0',smoothTime:.2,minimumZAt:()=>1.2,
    extraction:{axis:new THREE.Vector3(0,1,0),distance:.64,
      exitZ:1.3,duration:.5}});
  drag.move(new THREE.Vector3(2,-1,.3));
  for(let i=0;i<5;i++)drag.update(.05);
  assert.ok(object.position.y>.4&&object.position.y<.64,
    'spring slides along the axis of the socket first');
  assert.equal(object.position.x,0,'no sideways clipping through drilled metal');
  assert.equal(object.position.z,.3,'vertical lifting begins only after axial travel');
  drag.end();
  assert.equal(released,0,'early release does not drop an embedded spring');
  for(let i=0;i<6;i++)drag.update(.05);
  assert.equal(released,1);
  assert.ok(Math.abs(object.position.y-.64)<1e-6);
  assert.ok(object.position.z>=1.3,'fully withdrawn spring clears the lock');
  assert.equal(object.position.x,0,'release does not jump to the cursor');
});
