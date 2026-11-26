import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.js';
import {createLifecycle} from '../src/app/lifecycle.js';
import {createPlayerController} from '../src/player/controller.js';
import {createPlayerCamera} from '../src/scene/camera.js';
import {createPointerLock} from '../src/player/pointer-lock.js';
import {PLAYER_DEFAULTS} from '../config/runtime.js';

test('disposing a host removes listeners and frees resources once in reverse order',()=>{
 const target=new EventTarget(),life=createLifecycle(),calls=[];
 life.listen(target,'tick',()=>calls.push('event'));life.own(()=>calls.push('renderer'));life.own(()=>calls.push('scene'));
 target.dispatchEvent(new Event('tick'));life.dispose();life.dispose();target.dispatchEvent(new Event('tick'));
 assert.deepEqual(calls,['event','scene','renderer']);
});
test('camera and player share eye height, honor floor elevation and reset independently of UI',()=>{
 const config={building:{floorElevation:14},camera:{fov:73,initialPitch:.1}},camera=createPlayerCamera(THREE,config);
 const navigation={move(position){position.x+=1;return {floorY:-2,moving:true};}};
 const player=createPlayerController({THREE,camera,navigation,config});
 assert.equal(camera.position.y,14+PLAYER_DEFAULTS.eyeHeight);assert.equal(camera.fov,73);
 const before=camera.position.clone();player.update(.04,10,false);assert(camera.position.equals(before));
 player.held.add('w');player.update(.04,20,true);assert.equal(player.state.floorY,-2);assert.equal(camera.position.x,before.x+1);
 player.turn(100,30);player.level();assert.equal(player.state.pitch,0);player.reset();
 assert.equal(camera.position.y,14+PLAYER_DEFAULTS.eyeHeight);assert.equal(player.state.floorY,0);assert.equal(player.state.yaw,0);assert.equal(player.state.pitch,.1);assert.equal(player.held.size,0);
});
test('pointer lock releases capture and browser events stop reaching a disposed host',async()=>{
 const doc=new EventTarget();doc.pointerLockElement=null;let released=0,unlocks=0;
 const canvas={requestPointerLock(){doc.pointerLockElement=canvas;doc.dispatchEvent(new Event('pointerlockchange'));return Promise.resolve();}};
 doc.exitPointerLock=()=>{released++;doc.pointerLockElement=null;doc.dispatchEvent(new Event('pointerlockchange'));};
 const lock=createPointerLock({canvas,document:doc,isPlayMode:()=>true,onBrowserUnlock:()=>unlocks++});
 lock.request();await Promise.resolve();assert(lock.locked());lock.dispose();lock.dispose();
 doc.dispatchEvent(new Event('pointerlockchange'));doc.dispatchEvent(new Event('pointerlockerror'));lock.request();
 assert.equal(released,1);assert.equal(unlocks,0);assert.equal(lock.locked(),false);assert.equal(lock.unavailable,false);
});
test('a late Promise-based pointer lock grant is released after the host was disposed',async()=>{
 const doc=new EventTarget();doc.pointerLockElement=null;let grant,released=0;
 const canvas={requestPointerLock:()=>new Promise(resolve=>{grant=resolve;})};
 doc.exitPointerLock=()=>{released++;doc.pointerLockElement=null;};
 const lock=createPointerLock({canvas,document:doc,isPlayMode:()=>true});
 lock.request();lock.dispose();doc.pointerLockElement=canvas;grant();await Promise.resolve();assert.equal(released,1);assert.equal(lock.locked(),false);
});

test('RMB zoom eases in and out while mouse look remains available in any direction',()=>{
 const config={building:{floorElevation:8}},camera=new THREE.PerspectiveCamera(73,1.5);
 const player=createPlayerController({THREE,camera,navigation:{move:()=>({floorY:0})},config});
 player.zoom(true);assert.equal(camera.fov,73,'pressing RMB must not snap the projection');
 player.update(.016,16,false);const first=camera.fov;
 assert(first<73&&first>73*.62);
 player.turn(100,35);player.update(.016,32,false);
 assert(camera.fov<first);assert(camera.rotation.y<0);assert(camera.rotation.x<0);
 for(let i=0;i<100;i++)player.update(.016,48+i*16,false);
 assert(Math.abs(camera.fov-73*.62)<.002);
 player.zoom(false);const near=camera.fov;player.update(.016,1700,false);
 assert(camera.fov>near&&camera.fov<73,'release must ease back too');
 for(let i=0;i<100;i++)player.update(.016,1716+i*16,false);
 assert.equal(camera.fov,73);
});
