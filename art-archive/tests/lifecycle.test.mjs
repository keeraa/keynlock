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
