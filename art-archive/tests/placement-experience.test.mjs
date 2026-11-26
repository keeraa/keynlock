import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three.js';
import {createPlacementPreview} from '../src/paintings/placement-preview.js';
import {createPlacementFeedback} from '../src/paintings/placement-feedback.js';
import {createFrameMotion} from '../src/paintings/frame-motion.js';
import {makeLayout} from '../src/architecture/layout.js';
const config=JSON.parse(fs.readFileSync(new URL('../config/scene.json',import.meta.url))),layout=makeLayout(config),fy=config.building.floorElevation;
const slot={painting:{id:'preview-test',physicalSizeM:{width:.8,height:1},image:{}},width:.935,height:1,destination:'world/life',wall:{hall:'world'},normal:{x:0,z:1},x:0,y:1,z:20};

test('wall and table previews share the framed, slowly pulsing dashed ghost with the same invalid tint',()=>{
 const camera=new THREE.PerspectiveCamera(73,1.5),scene=new THREE.Scene();
 const motion=createFrameMotion(THREE,config,layout),preview=createPlacementPreview(THREE,{camera,scene,layout},{},config,motion);
 preview.select(slot);const wall={a:{x:0,z:20},b:{x:8,z:20},length:8,normal:{x:0,z:-1}};
 preview.wall(slot,wall,3,2,true,false,1000);
 const ghost=scene.getObjectByName('table-placement-preview'),dash=scene.getObjectByName('table-placement-outline');
 assert(ghost.visible);assert.equal(dash.material.color.getHex(),0xffe5a3);assert(dash.material.opacity>.75);
 const geometry=dash.geometry,opacity=dash.material.opacity;
 preview.wall(slot,wall,3,2,false,false,1800);assert.equal(dash.geometry,geometry);assert.equal(dash.material.color.getHex(),0xff3939);assert.notEqual(dash.material.opacity,opacity);
 preview.hide();preview.table({...slot,floorAngle:0,y:1},2000,true);assert.equal(dash.geometry,geometry);assert.equal(dash.material.color.getHex(),0xffe5a3);
 preview.dispose();assert.equal(scene.children.length,0);
});

test('a collision recovery that stays blocked never triggers the failed-pickup timeout',()=>{
 const camera=new THREE.PerspectiveCamera(73,1.5),scene=new THREE.Scene();camera.position.set(0,fy+1.78,20);
 let blocked=false,routeBlocked=false;
 const motion={pose:s=>({position:new THREE.Vector3(s.x,fy+s.y,s.z),quaternion:new THREE.Quaternion()}),blocked:()=>false,advance:()=>blocked?0:1,route:(s,from,to)=>routeBlocked?null:[{position:from.position.clone(),quaternion:from.quaternion.clone()},to]};
 const preview=createPlacementPreview(THREE,{camera,scene,layout},{},config,motion);preview.select(slot);preview.beginLift(slot,0);
 const eye=new THREE.Vector3(0,1.78,20),dir=new THREE.Vector3(0,0,-1);
 for(let now=0;now<=700;now+=16)preview.follow(slot,false,null,eye,dir,slot,now,false);
 assert(!preview.takeLiftFailure());blocked=routeBlocked=true;
 for(let now=720;now<3000;now+=16){preview.follow(slot,false,null,eye,dir,slot,now,false);assert(!preview.takeLiftFailure(),'an already held painting must remain held at an obstruction');}
 assert(scene.getObjectByName('carried-painting').visible);preview.dispose();
});

test('table placement turns flat before crossing the table without a diagonal-radius lift above the destination',()=>{
 const motion=createFrameMotion(THREE,config,layout),table=layout.storageTables[0],n={x:Math.sin(table.angle),z:Math.cos(table.angle)};
 const target={...slot,x:table.x,z:table.z,y:table.y+.025,floorAngle:table.angle,supportId:table.id};
 const from={position:new THREE.Vector3(table.x+n.x*2,fy+1.1,table.z+n.z*2),quaternion:new THREE.Quaternion().setFromEuler(new THREE.Euler(-.58,table.angle,0,'YXZ'))};
 const path=motion.route(slot,from,motion.pose(target),{lowArc:true});assert(path);
 assert(Math.max(...path.map(p=>p.position.y))<=fy+1.15,'placement must stay near hand/table height');
 for(let i=1;i<path.length;i++)assert.equal(motion.advance(slot,path[i-1],path[i]),1);
});

test('success smoke starts around all four sides, disperses briefly, then costs no visible draw call',()=>{
 const scene=new THREE.Scene(),feedback=createPlacementFeedback(THREE,scene,config);feedback.show(slot,1000);
 const smoke=scene.getObjectByName('placement-success');assert(smoke.isPoints&&smoke.visible);assert.equal(smoke.geometry.attributes.position.count,80);
 const p=smoke.geometry.attributes.position;let left=false,right=false,top=false,bottom=false;
 for(let i=0;i<p.count;i++){left||=p.getX(i)<-.46;right||=p.getX(i)>.46;top||=p.getY(i)>.55;bottom||=p.getY(i)<-.55;}
 assert(left&&right&&top&&bottom);assert.equal(smoke.material.depthWrite,false);
 feedback.update(1500);assert(smoke.visible);feedback.update(2100);assert(!smoke.visible);
 feedback.dispose();assert.equal(scene.children.length,0);
});

test('a wide floor painting tilts into the trolley pose without requiring its diagonal above the ceiling',()=>{
 const motion=createFrameMotion(THREE,config,layout),hall=layout.halls[0],at=layout.world(hall,0,hall.start+10);
 const large={...slot,painting:{...slot.painting,physicalSizeM:{width:5,height:2.5}},width:5.135,height:2.5,
  x:at.x,z:at.z,y:.025,floorAngle:hall.angle,normal:{x:0,z:1}};
 const from=motion.pose(large),to={position:new THREE.Vector3(at.x+.6,fy+1.6075,at.z+1),quaternion:new THREE.Quaternion()};
 const path=motion.route(large,from,to,{pickup:true});assert(path,'an unobstructed tilt must be possible');
 assert(Math.max(...path.map(p=>p.position.y))<fy+2.4,'do not hoist the diagonal above the painting');
 for(let i=1;i<path.length;i++)assert.equal(motion.advance(large,path[i-1],path[i]),1);
});

test('a blocked initial pickup keeps its visible frame and reports its obstruction only once',()=>{
 const camera=new THREE.PerspectiveCamera(73,1.5),scene=new THREE.Scene();camera.position.set(0,fy+1.78,20);
 const motion={pose:s=>({position:new THREE.Vector3(s.x,fy+s.y,s.z),quaternion:new THREE.Quaternion()}),blocked:()=>true,advance:()=>0,route:()=>null};
 const preview=createPlacementPreview(THREE,{camera,scene,layout},{},config,motion);preview.select(slot);preview.beginLift(slot,0);
 let warnings=0;
 for(let now=0;now<2500;now+=16){preview.follow(slot,false,null,new THREE.Vector3(0,1.78,20),new THREE.Vector3(0,0,-1),slot,now,false);if(preview.takeLiftFailure())warnings++;}
 assert.equal(warnings,1);assert(scene.getObjectByName('carried-painting').visible);
 preview.dispose();
});

test('walking with a carried painting stops at the wall without losing the frame or jumping between poses',()=>{
 const camera=new THREE.PerspectiveCamera(73,1.5),scene=new THREE.Scene(),hall=layout.halls[0],at=layout.world(hall,0,hall.start+10);
 camera.position.set(at.x,fy+1.78,at.z);camera.lookAt(at.x,fy+1.78,at.z-1);
 const motion=createFrameMotion(THREE,config,layout),preview=createPlacementPreview(THREE,{camera,scene,layout},{},config,motion);
 const s={...slot,x:at.x,y:.025,z:at.z-1,floorAngle:hall.angle};preview.select(s);preview.beginLift(s,0);
 const origin=new THREE.Vector3(),dir=new THREE.Vector3();
 const follow=now=>{origin.copy(camera.position);origin.y-=fy;camera.getWorldDirection(dir);preview.follow(s,false,hall,origin,dir,s,now,false);};
 for(let now=0;now<1000;now+=16)follow(now);
 const held=scene.getObjectByName('carried-painting');let stopped=false;
 for(let now=1000;now<5000;now+=16){
  const before=camera.position.clone(),desired=before.clone();desired.x+=.06;
  const allowed=preview.constrainMovement(before,desired);stopped||=allowed<1;
  camera.position.lerpVectors(before,desired,allowed);
  const pose=held.position.clone();follow(now);
  assert(held.visible);assert(held.position.distanceTo(pose)<.3,'wall contact cannot restart a lifting bounce');
  assert(held.position.distanceTo(camera.position)<3,'the camera cannot run away from the carried frame');
 }
 assert(stopped);preview.dispose();
});

test('running during a blocked pickup cannot leave the frame behind at a stair height change',()=>{
 const camera=new THREE.PerspectiveCamera(73,1.5),scene=new THREE.Scene();camera.position.set(0,fy+1.78,20);
 const motion={pose:s=>({position:new THREE.Vector3(s.x,fy+s.y,s.z),quaternion:new THREE.Quaternion()}),blocked:()=>true,advance:()=>0,route:()=>null};
 const preview=createPlacementPreview(THREE,{camera,scene,layout},{},config,motion);preview.select(slot);preview.beginLift(slot,0);
 const origin=new THREE.Vector3(),dir=new THREE.Vector3(0,0,-1),held=scene.getObjectByName('carried-painting');
 for(let now=0;now<3500;now+=16){
  const from=camera.position.clone(),to=from.clone().add(new THREE.Vector3(.05,-.025,.075));
  camera.position.lerpVectors(from,to,preview.constrainMovement(from,to));
  origin.copy(camera.position);origin.y-=fy;preview.follow(slot,false,null,origin,dir,slot,now,false);
  assert(held.visible);assert(held.position.distanceTo(camera.position)<=2.8001);
 }
 preview.dispose();
});

test('wall flight and its reverse finish in 150 ms, with no snap when aim returns mid-flight',()=>{
 const camera=new THREE.PerspectiveCamera(73,1.5),scene=new THREE.Scene();camera.position.set(0,fy+1.78,20);
 const motion={blocked:()=>false,advance:()=>1};
 const preview=createPlacementPreview(THREE,{camera,scene,layout},{},config,motion),origin=new THREE.Vector3(0,1.78,20),dir=new THREE.Vector3(0,0,-1);
 preview.select(slot);
 const follow=now=>preview.follow(slot,false,null,origin,dir,slot,now,false);
 for(let now=0;now<1000;now+=16)follow(now);
 const root=scene.getObjectByName('carried-painting'),ghost=scene.getObjectByName('table-placement-preview'),wall={a:{x:0,z:17},b:{x:8,z:17},length:8,normal:{x:0,z:1}};
 const carry=root.position.clone();preview.beginWall(1000);preview.wall(slot,wall,2,2,true,false,1000);
 assert(ghost.position.distanceTo(carry)<1e-8);assert(!root.visible);
 preview.wall(slot,wall,2,2,true,false,1150);const atWall=ghost.position.clone();assert(Math.abs(atWall.x-2)<1e-8);assert(atWall.distanceTo(carry)>1);
 const outline=scene.getObjectByName('table-placement-outline');assert(outline.visible);
 preview.beginReturn(1150);assert(!outline.visible,'the dashed border disappears as soon as the painting returns');follow(1150);preview.returnToCarry(1150);assert(ghost.position.distanceTo(atWall)<1e-8);
 follow(1225);preview.returnToCarry(1225);assert(!outline.visible);const halfway=ghost.position.clone();
 assert(halfway.distanceTo(atWall)>.1&&halfway.distanceTo(root.position)>.1);
 preview.beginWall(1225);preview.wall(slot,wall,2,2,true,false,1225);assert(ghost.position.distanceTo(halfway)<1e-8,'reversing direction starts at the visible frame');assert(outline.visible,'the border returns only when aiming at a placement');
 preview.wall(slot,wall,2,2,true,false,1375);preview.beginReturn(1375);
 follow(1525);preview.returnToCarry(1525);assert(root.visible);assert(!ghost.visible);
 preview.dispose();
});

for(const yaw of [0,.7,2.4])test(`a stuck transported frame blocks the player crossing it at yaw ${yaw}`,()=>{
 const camera=new THREE.PerspectiveCamera(73,1.5),scene=new THREE.Scene();
 const large={...slot,painting:{...slot.painting,physicalSizeM:{width:8.8,height:4.6}},width:8.935,height:4.6,y:2.6};
 const motion={pose:s=>({position:new THREE.Vector3(s.x,fy+s.y,s.z),quaternion:new THREE.Quaternion()}),blocked:()=>true,advance:()=>0,route:()=>null};
 const preview=createPlacementPreview(THREE,{camera,scene,layout},{},config,motion);preview.select(large);preview.beginLift(large,0);
 const root=scene.getObjectByName('carried-painting');root.visible=true;root.rotation.y=yaw;
 const normal=new THREE.Vector3(0,0,1).applyQuaternion(root.quaternion);
 const from=root.position.clone().addScaledVector(normal,.9);from.y=fy+1.78;
 const to=from.clone().addScaledVector(normal,-1.8);
 const fraction=preview.constrainMovement(from,to);
 assert(fraction>.1&&fraction<.5,'swept player capsule must stop before the canvas, even during a blocked pickup');
 const stopped=from.clone().lerp(to,fraction);
 assert(preview.constrainMovement(stopped,to)<.001,'repeated input must not creep through');
 assert.equal(preview.constrainMovement(stopped,from),1,'player can retreat from the jam');
 const inside=root.position.clone().addScaledVector(normal,.15);inside.y=from.y;
 assert.equal(preview.constrainMovement(inside,from),1,'an existing overlap can be escaped');
 const along=from.clone().add(new THREE.Vector3(.2,0,0).applyQuaternion(root.quaternion));
 assert.equal(preview.constrainMovement(from,along),1,'moving beside the painting remains possible');
 preview.dispose();
});
