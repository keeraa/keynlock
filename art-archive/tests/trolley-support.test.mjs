import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three.js';
import {makeLayout} from '../src/architecture/layout.js';
import {settleTrolley} from '../src/paintings/floor-drop.js';
import {createPaintingProps} from '../src/paintings/props.js';
const config=JSON.parse(fs.readFileSync(new URL('../config/scene.json',import.meta.url))),layout=makeLayout(config);

test('restored monumental carts discard floor tilt and suspended height; all wheels touch supported ground',()=>{
 const props=createPaintingProps(THREE,config.paintings),hall=layout.halls[0];
 for(const [width,height,side] of [[7.3,4.9,0],[2.2,3,-hall.width/2+1.6]]){
  const point=layout.world(hall,side,hall.start+hall.length/2);
  const slot={...point,width,height,y:9,floorAngle:hall.angle+1.2,normal:{x:Math.sin(hall.angle),z:Math.cos(hall.angle)},painting:{id:'test'},wall:{hall:hall.id}};
  const parked=settleTrolley(slot,layout,config);
  assert.equal(parked.floorAngle,undefined);
  const cart=props.cart(parked);cart.position.set(parked.x,parked.y,parked.z);cart.rotation.y=hall.angle;
  const bounds=new THREE.Box3().setFromObject(cart);
  const surface=side===0?.047:0;
  assert(Math.abs(bounds.min.y-surface)<1e-7,`${width}m cart lowest point ${bounds.min.y}, floor ${surface}`);
  assert.equal(parked.x,point.x);assert.equal(parked.z,point.z);
 }
 props.dispose();
});
