import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.js';
import {createBirdRoute} from '../src/environment/bird-route.js';
test('a landing route keeps velocity through its intermediate point and brakes only at the perch',()=>{
 const v=(x,y,z)=>new THREE.Vector3(x,y,z),points=[v(0,30,0),v(10,29,0),v(17,24,0)];
 const route=createBirdRoute(THREE,points,[v(3,0,0),v(2.3,-.6,0),v(0,0,0)],[4,4]);
 const at=t=>{const p=v(0,0,0);route.sample(t,p);return p;},step=.001;
 const incoming=at(4).sub(at(4-step)).divideScalar(step),outgoing=at(4+step).sub(at(4)).divideScalar(step);
 assert(incoming.distanceTo(outgoing)<.01);
 assert(incoming.length()>2);
 assert(at(8).distanceTo(points[2])<1e-8);
 assert(at(8).distanceTo(at(8-step))/step<.01);
 for(let t=0;t<=8;t+=.05)assert(at(t).y>=24-1e-8);
});
