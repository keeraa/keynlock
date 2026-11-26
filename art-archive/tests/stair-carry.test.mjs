import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three.js';
import {makeLayout} from '../src/architecture/layout.js';
import {createNavigation,EYE_HEIGHT} from '../src/player/movement.js';
import {createFrameMotion} from '../src/paintings/frame-motion.js';
import {createPlacementPreview} from '../src/paintings/placement-preview.js';
const config=JSON.parse(fs.readFileSync(new URL('../config/scene.json',import.meta.url))),layout=makeLayout(config);
const fy=config.building.floorElevation,s=config.building.stair,r=(s.innerRadius+s.outerRadius)/2;
const point=a=>new THREE.Vector3(r*Math.sin(a),0,r*Math.cos(a));
for(const sprint of [false,true])test(`a framed 165 by 157 cm painting can be carried upstairs and downstairs ${sprint?'while sprinting':'while walking'}`,()=>{
 const camera=new THREE.PerspectiveCamera(73,1.5),scene=new THREE.Scene(),nav=createNavigation(config,layout);
 const motion=createFrameMotion(THREE,config,layout),preview=createPlacementPreview(THREE,{camera,scene,layout},{},config,motion);
 const start=point(s.sweep+.24).multiplyScalar(4.2/r);
 camera.position.copy(start);camera.position.y=fy-s.depth+EYE_HEIGHT;
 const slot={painting:{id:'stairs-wide',physicalSizeM:{width:1.654,height:1.568},image:{}},width:1.789,height:1.568,
 x:start.x,y:-s.depth+1.15,z:start.z,normal:{x:Math.sin(s.sweep),z:Math.cos(s.sweep)}};
 preview.select(slot);preview.beginLift(slot,0);
 let now=0,floor=-s.depth;
 const origin=new THREE.Vector3(),dir=new THREE.Vector3();
 const follow=()=>{origin.copy(camera.position);origin.y-=fy;camera.getWorldDirection(dir);preview.follow(slot,false,null,origin,dir,slot,now,false);now+=16;};
 camera.lookAt(point(s.sweep).setY(camera.position.y));
 for(let i=0;i<120;i++)follow();
 const held=scene.getObjectByName('carried-painting');
 const travel=(target)=>{
  for(let tick=0;tick<300&&camera.position.clone().setY(0).distanceTo(target)>.025;tick++){
   const before=camera.position.clone(),previousFloor=floor,dx=target.x-before.x,dz=target.z-before.z,yaw=Math.atan2(-dx,-dz);
   camera.rotation.set(0,yaw,0,'YXZ');
   const result=nav.move(camera.position,new Set(sprint?['w','shift']:['w']),yaw,Math.min(.016,Math.hypot(dx,dz)/(sprint?7.4:4.4)),floor);
   camera.position.y=fy+result.floorY+EYE_HEIGHT;
   const allowed=preview.constrainMovement(before,camera.position);camera.position.lerpVectors(before,camera.position,allowed);
   floor=previousFloor+(result.floorY-previousFloor)*allowed;follow();
  }
  assert(camera.position.clone().setY(0).distanceTo(target)<.09,`stuck entering or leaving the flight: target=${target.toArray()}, eye=${camera.position.toArray()}, frame=${held.position.toArray()}`);
 };
 travel(point(s.sweep+.24));
 for(const [from,to] of [[s.sweep+.2,-.02],[-.02,s.sweep+.2]]){
  for(let angle=from;Math.sign(to-from)*(to-angle)>0;angle+=Math.sign(to-from)*.05){
   const target=point(angle);
   for(let tick=0;tick<12&&Math.hypot(camera.position.x-target.x,camera.position.z-target.z)>.015;tick++){
    const before=camera.position.clone(),previousFloor=floor,dx=target.x-before.x,dz=target.z-before.z;
    const yaw=Math.atan2(-dx,-dz);camera.rotation.set(Math.sin(now/500)*.8,yaw,0,'YXZ');
    const result=nav.move(camera.position,new Set(sprint?['w','shift']:['w']),yaw,Math.min(.016,Math.hypot(dx,dz)/(sprint?7.4:4.4)),floor);
    camera.position.y=fy+result.floorY+EYE_HEIGHT;
    const allowed=preview.constrainMovement(before,camera.position);camera.position.lerpVectors(before,camera.position,allowed);
    floor=previousFloor+(result.floorY-previousFloor)*allowed;follow();
    assert(held.visible);assert(!motion.blocked(slot,held.position,held.quaternion),'carried frame must stay clear of stairs and railings');
    const eyeInFrame=camera.position.clone().sub(held.position).applyQuaternion(held.quaternion.clone().invert());
    assert(Math.abs(eyeInFrame.z)>.09||Math.abs(eyeInFrame.x)>1||Math.abs(eyeInFrame.y)>.9,'the camera must stay outside the carried canvas');
   }
   assert(Math.hypot(camera.position.x-target.x,camera.position.z-target.z)<.09,`stuck at angle ${angle}, floor ${floor}`);
  }
  assert(Math.abs(floor-(to<0?0:-s.depth))<.02);
  if(to<0){travel(new THREE.Vector3(0,0,4.2));travel(point(0));}
  else travel(point(s.sweep+.24).multiplyScalar(4.2/r));
 }
 preview.dispose();
});

test('frame corners cannot cut through a tread, the upper slab or the lower wall',()=>{
 const motion=createFrameMotion(THREE,config,layout);
 const slot={width:.6,height:.4,painting:{id:'stair-corner',physicalSizeM:{width:.465,height:.4}}};
 const treadAngle=2,at=point(treadAngle),rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),treadAngle);
 const nav=createNavigation(config,layout),height=nav.floorAt(at.x,at.z,-1.4);
 assert.notEqual(height,null);
 // The centre rests over the lower tread, while its leading lower corner cuts
 // into the next higher tread. A centre-only floor check misses this.
 const position=at.clone().setY(fy+height+.2);
 assert(motion.blocked(slot,position,rotation));
 position.y+=.4;assert(!motion.blocked(slot,position,rotation));
 const level=new THREE.Quaternion(),slab=new THREE.Vector3(0,fy-.08,s.openingRadius-.12);
 assert(motion.blocked(slot,slab,level),'a frame crossing the opening edge must hit the slab');
 const lower=new THREE.Vector3(0,fy-s.depth+1,-5.48);
 assert(motion.blocked(slot,lower,level),'lower curved plaster wall must be solid');
 lower.z=-5.2;assert(!motion.blocked(slot,lower,level));
});
