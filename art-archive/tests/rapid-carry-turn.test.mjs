import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three.js';
import {makeLayout} from '../src/architecture/layout.js';
import {createPlacementPreview} from '../src/paintings/placement-preview.js';
import {createFrameMotion} from '../src/paintings/frame-motion.js';
const config=JSON.parse(fs.readFileSync(new URL('../config/scene.json',import.meta.url))),layout=makeLayout(config),fy=config.building.floorElevation;
for(const large of [false,true])for(const side of [0,4.65])test(`a rapid camera turn does not strand a ${large?'trolley':'handheld'} frame behind the player at hall x=${side}`,()=>{
 const hall=layout.halls[0],at=layout.world(hall,0,hall.start+13),camera=new THREE.PerspectiveCamera(73,16/9),scene=new THREE.Scene();
 camera.position.set(at.x,fy+1.78,at.z);let yaw=hall.angle;
 const width=large?8.8:.8,height=large?4.6:1;
 const slot={painting:{id:'rapid-turn',physicalSizeM:{width,height},image:{}},width:width+.135,height,x:at.x,y:.025,z:at.z-.8,floorAngle:hall.angle,normal:{x:0,z:1}};
 const motion=createFrameMotion(THREE,config,layout),preview=createPlacementPreview(THREE,{camera,scene,layout,carryYaw:()=>yaw},{},config,motion);
 preview.select(slot);preview.beginLift(slot,0);let now=0,checkGround=false;
 const origin=new THREE.Vector3(),dir=new THREE.Vector3();
 const tick=()=>{camera.rotation.set(0,yaw,0,'YXZ');origin.copy(camera.position);origin.y-=fy;camera.getWorldDirection(dir);preview.follow(slot,large,hall,origin,dir,slot,now,false);
  const held=scene.getObjectByName('carried-painting');assert(held.visible);assert(!motion.blocked(slot,held.position,held.quaternion),'every recovery pose must clear the geometry');
  if(large&&checkGround){assert(Math.abs(held.position.y-fy-(height+.135)/2-.29)<.001);assert(held.getObjectByName('painting-trolley').visible,'the carrier must not vanish during steering recovery');}
  now+=16;};
 for(let i=0;i<150;i++)tick();
 assert(!preview.takeLiftFailure());
 for(let i=0;i<100;i++){const before=camera.position.clone(),to=before.clone();to.x+=side/100;camera.position.lerpVectors(before,to,preview.constrainMovement(before,to));tick();}
 const root=scene.getObjectByName('carried-painting');checkGround=true;const geometry=root.children[0].geometry;
 if(!large)motion.setObstacles([{painting:{id:'standing-neighbour',physicalSizeM:{width:.3,height:1.6}},width:.435,height:1.6,
  x:camera.position.x+.5,y:.9,z:camera.position.z-.45,normal:{x:0,z:1}}]);
 for(const turn of [2.8,-2.8,Math.PI]){
  yaw=hall.angle+turn;tick();for(let i=0;i<90;i++)tick();
  const local=root.position.clone().sub(camera.position).applyQuaternion(camera.quaternion.clone().invert());
  assert(root.visible);assert(!motion.blocked(slot,root.position,root.quaternion));
  assert.equal(root.children[0].geometry,geometry);assert(!preview.takeLiftFailure());
  assert(local.z<-.05,`frame stranded behind view: ${local.toArray()}`);
 }
 preview.dispose();
});
