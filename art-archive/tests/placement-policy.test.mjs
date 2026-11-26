import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three.js';
import {makeLayout} from '../src/architecture/layout.js';
import {createFrameMotion} from '../src/paintings/frame-motion.js';
import {createWallPlacement} from '../src/paintings/wall-placement.js';
import {createPlacementSave} from '../src/paintings/placement-save.js';
import {frameDimensions} from '../catalog/painting-geometry.js';
import {createPaintingInteraction} from '../src/paintings/interaction-state.js';
import {createCarryPose} from '../src/paintings/carry-pose.js';
const config=JSON.parse(fs.readFileSync(new URL('../config/scene.json',import.meta.url))),layout=makeLayout(config);

test('wall policy rechecks occupancy and obstacles when a preview is committed, preserving free-mode rules',()=>{
 const wall=layout.hangingWalls.find(w=>w.id==='world/end'),along=wall.length/2,y=2.4;
 const slot={painting:{id:'policy',physicalSizeM:{width:.8,height:1}},width:.935,height:1,destination:'world/life'};
 let free=false,occupied=[];
 const motion=createFrameMotion(THREE,config,layout),rules=createWallPlacement(config,motion,{isFree:()=>free,occupied:()=>occupied});
 const preview=rules.evaluate(slot,wall,along,y);assert(preview.slot);assert.equal(preview.reason,null);
 occupied=[{...preview.slot,painting:{id:'another'}}];
 assert.equal(rules.evaluate(slot,wall,along,y).reason,'occupied_or_too_large');
 assert(rules.surface(slot,wall,along,y),'red occupied hints still require a complete wall surface');
 assert.equal(rules.surface(slot,wall,.01,y),null,'a hint cannot cross a corner');
 occupied=[];motion.setObstacles([{...preview.slot,painting:{id:'obstacle'}}]);
 assert.equal(rules.evaluate(slot,wall,along,y).reason,'collision');
 motion.setObstacles([]);
 const other=layout.hangingWalls.find(w=>w.id==='nature/end');
 assert.equal(rules.evaluate(slot,other,other.length/2,y).reason,'wrong_hall');
 free=true;assert(rules.evaluate(slot,other,other.length/2,y).slot);
 const half=frameDimensions(slot,config.paintings).height/2;
 for(const mode of [false,true]){
  free=mode;
  const limits=rules.limits(wall);
  assert.equal(rules.surface(slot,wall,along,.84+half),null,'the entire frame must clear the wooden panel and its cap');
  assert.equal(rules.evaluate(slot,wall,slot.width/2,y).slot,null,'frames need an inset from wall ends');
  assert.equal(rules.surface(slot,wall,along,limits.maxTopM-half+.01),null,'frames cannot touch the upper wall edge');
  assert(rules.evaluate(slot,wall,along,limits.minBottomM+half).slot,'a frame fits completely above the panel');
 }
});

test('held inspection derives carry presentation without adding a competing interaction phase',()=>{
 const state=createPaintingInteraction(),slot={painting:{id:'held'}};
 assert(!state.canAimAtWall);state.pick(slot,slot);state.place();state.inspect(true);
 assert.equal(state.phase,'placing');assert(!state.canAimAtWall);
 assert.deepEqual(state.carryView(false),{raised:true,inspectHeavy:false});
 assert.deepEqual(state.carryView(true),{raised:false,inspectHeavy:true});
 state.carry();state.inspect(false);assert(state.canAimAtWall);
 state.raise(true);assert.equal(state.phase,'examining');assert(!state.canAimAtWall);
 state.raise(false);assert(state.canAimAtWall);
 state.lower({slot});assert.equal(state.phase,'lowering');assert(!state.canAimAtWall);
 state.reset();assert.equal(state.phase,'idle');assert.equal(state.carrying,null);
});

test('carry pose calculation leaves the scene and camera untouched and reuses its math objects',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(73,16/9),hall=layout.halls[0];
 const point=layout.world(hall,0,hall.start+16);camera.position.set(point.x,config.building.floorElevation+1.78,point.z);camera.rotation.y=hall.angle;camera.updateMatrixWorld();
 const before=camera.matrixWorld.clone(),origin=camera.position.clone();origin.y-=config.building.floorElevation;
 const dir=new THREE.Vector3();camera.getWorldDirection(dir);
 const resolve=createCarryPose(THREE,{scene,camera,layout,carryYaw:()=>hall.angle},config,createFrameMotion(THREE,config,layout));
 const slot={painting:{id:'large',physicalSizeM:{width:4.96,height:3.92}},width:5.095,height:3.92};
 const first=resolve(slot,true,hall,origin,dir,false),position=first.position,rotation=first.quaternion;
 const snapshot=position.clone(),second=resolve(slot,true,hall,origin,dir,false);
 assert.equal(second.position,position);assert.equal(second.quaternion,rotation);assert(position.equals(snapshot));
 assert.equal(scene.children.length,0);assert(camera.matrixWorld.equals(before));
 const far=new THREE.Vector3(-slot.width/2,0,0).applyQuaternion(rotation).add(position).project(camera);
 assert(Math.abs(far.x)<.04);assert(second.trolley);
});


test('old free-mode saves below the plaster are restored above the panel with a side inset',t=>{
 const previous=[globalThis.window,globalThis.localStorage],memory=new Map();
 globalThis.window={};globalThis.localStorage={getItem:key=>memory.get(key),setItem:(key,value)=>memory.set(key,value)};
 t.after(()=>{[globalThis.window,globalThis.localStorage]=previous;});
 const wall=layout.hangingWalls.find(w=>w.id==='world/end');
 const slot={painting:{id:'low-save',physicalSizeM:{width:.8,height:1}},width:.935,height:1,destination:'world/life'};
 memory.set('keynlock-art-hanging-v1-free',JSON.stringify({[slot.painting.id]:{version:3,wall:wall.id,along:slot.width/2,y:.6}}));
 const rules=createWallPlacement(config,createFrameMotion(THREE,config,layout),{isFree:()=>true});
 const saves=createPlacementSave({layout,config,wallSettings:rules.limits,onError:()=>assert.fail('save failed')});
 const restored=saves.restoreWall(slot,[]);
 assert(restored,'a previously low painting is retained on the wall');
 assert(Math.abs(restored.y-frameDimensions(slot,config.paintings).height/2-config.paintings.minBottomM)<1e-7);
 assert(Math.abs(restored.along-slot.width/2-config.paintings.edgeMarginM)<1e-7);
});
