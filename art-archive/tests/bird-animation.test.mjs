import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.js';
import {smoothWingBeat} from '../src/environment/bird-animation.js';
test('smoothed wing beats preserve normalized rotations and close the loop without a pose jump',()=>{
 const track=new THREE.QuaternionKeyframeTrack('wing.quaternion',[0,.1,.3,.6],[0,0,0,1,.7,0,0,.714,0,0,0,1,-.1,0,0,.995]);
 const clip=new THREE.AnimationClip('Flap',.6,[track]),result=smoothWingBeat(THREE,clip).tracks[0];
 assert.deepEqual([...result.values.slice(0,4)],[...result.values.slice(-4)]);
 for(let i=0;i<result.values.length;i+=4)assert(Math.abs(Math.hypot(...result.values.slice(i,i+4))-1)<1e-6);
 assert.equal(track.times.length,4);
});
