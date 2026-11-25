import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.js';
import {createWallCompositions} from '../src/paintings/wall-compositions.js';

test('planned places snap by size, count actual occupants and reappear when a work is moved away',()=>{
 const wall={id:'jp/end',hall:'jp',length:12,a:{x:0,z:0},b:{x:12,z:0},normal:{x:0,z:1}};
 const scene=new THREE.Scene();
 const config={building:{floorElevation:8},paintings:{frameWidthM:.05}};
 const model=createWallCompositions(THREE,{scene},config);
 const piece=(id,x,width=1)=>({
   painting:{id,physicalSizeM:{width:width-.1,height:.9}},
   width,height:.9,wall,x,y:2,z:0,tier:0,
 });
 const planned=Array.from({length:8},(_,i)=>piece(String(i),i+1));
 model.rebuild(planned,()=>wall);model.refresh([]);
 const root=scene.getObjectByName('painting-compositions');
 const vertices=()=>root.children[0].geometry.getAttribute('position').count;
 assert.equal(vertices(),8*8);
 const geometry=root.children[0].geometry,points=geometry.attributes.position;
 assert.equal(geometry.index.count,8*18);
 assert(points.getX(1)<1.5 && points.getX(2)===1.5);
 assert(points.getY(1)<points.getY(2), 'the two vertices around the corner form a short diagonal');
 const compatible=piece('other',1),tryPosition=(along,y)=>({along,y});
 assert.deepEqual(model.snap(compatible,wall,1.17,2,tryPosition),{along:1,y:2});
 assert.equal(model.snap(compatible,wall,1.31,2,tryPosition),null);
 assert.equal(model.snap(piece('wide',1,1.6),wall,1,2,tryPosition),null);
 model.refresh([{...compatible,along:1},{...piece('free',5),along:5.4}]);
 const {group,filled,total}=model.summary(wall,1,2);
 assert.deepEqual([group.filled,group.places.length,filled,total],[1,4,1,8]);
 assert.equal(vertices(),7*8);
 assert.equal(model.snap(compatible,wall,1,2,tryPosition),null);
 model.refresh([]);
 assert.equal(vertices(),8*8);
 model.dispose();
 assert.equal(scene.children.length,0);
});
