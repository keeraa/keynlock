import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.js';
import {createPaintingCollisions} from '../src/player/painting-collisions.js';
import {frameOrientation} from '../catalog/painting-geometry.js';
import {overviewGeometry} from '../src/paintings/overview.js';
import {frameAtRay} from '../src/paintings/hanging.js';
const settings={frameWidthM:.05,frameDepthM:.05};
const slot={painting:{id:'test',physicalSizeM:{width:1,height:1},image:{widthPx:100,heightPx:100,overviewCell:1}},width:1.1,height:1,x:0,y:.025,z:0,floorAngle:.3,normal:{x:0,z:1}};

test('flat paintings never trap walkers on floors, saved piles or stair treads; upright objects remain solid',()=>{
 const collisions=createPaintingCollisions(settings,1.78);
 for(const floorY of [0,-.4,-4.2])for(const offset of [.025,.1,.2,.5]){
  collisions.setSlots([{...slot,y:floorY+offset}]);
  for(let x=-.5;x<=.5;x+=.1)assert(!collisions.blocked(x,0,floorY));
 }
 collisions.setSlots([{...slot,floorAngle:undefined,y:.8}]);assert(collisions.blocked(0,0,0));
 collisions.setSlots([{...slot,floorAngle:undefined,depth:1.3,y:.43,height:.76}]);assert(collisions.blocked(0,0,0));
});

test('face-down paintings show a solid wooden back in the atlas and remain pickable',()=>{
 const flipped={...slot,faceDown:true};
 assert.equal(frameOrientation(flipped).pitch,Math.PI/2);
 const geometry=overviewGeometry(THREE,[flipped],{columns:4,rows:4,cellSize:64,gutter:1},settings);
 const p=geometry.getAttribute('position'),normal=geometry.getAttribute('normal');
 // The first eight vertices are the clipped front, followed by the wooden back.
 assert(p.getY(0)<flipped.y);assert(p.getY(8)>flipped.y);assert(normal.getY(8)>.9);
 assert.equal(frameAtRay({x:0,y:1.7,z:0},{x:0,y:-1,z:0},[flipped],settings,3),flipped);
 geometry.dispose();
});
