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
 assert.deepEqual(model.snap(compatible,wall,1.31,2,tryPosition),{along:1,y:2},'the whole marked rectangle accepts the reticle');
 assert.equal(model.snap(compatible,wall,1,3,tryPosition),null);
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


test('similar sizes cannot snap into or overlap a reserved footprint',()=>{
 const wall={id:'portraits/end',hall:'portraits',length:8,a:{x:0,z:0},b:{x:8,z:0},normal:{x:0,z:1}};
 const config={building:{floorElevation:8},paintings:{frameWidthM:.05}};
 const model=createWallCompositions(THREE,{scene:new THREE.Scene()},config);
 const piece=(id,x,width,height)=>({painting:{id,physicalSizeM:{width:width-.1,height:height-.1}},width,height:height-.1,wall,x,z:0,y:2,tier:1});
 const small=piece('small',2,1,1.2),large=piece('large',4,1.08,1.28);
 model.rebuild([small,large],()=>wall);model.refresh([]);
 assert.equal(model.snap(small,wall,4,2,()=>assert.fail('must not snap to a slightly larger cell')),null);
 assert.equal(model.acceptsPlacement({...small,along:4}),false);
 assert.equal(model.acceptsPlacement({...small,along:2.03}),false,'off-centre placement cannot consume part of a reserved cell');
 assert.equal(model.acceptsPlacement({...small,along:2}),true);
 assert.equal(model.acceptsPlacement({...small,painting:{...small.painting,id:'same-size'},along:2}),true,'identical sizes can safely swap');
 assert.equal(model.acceptsPlacement({...small,along:6}),true,'unused wall space remains available');
 model.refresh([{...small,along:4}]);
 assert.equal(model.summary(wall,4,2).filled,0,'a small work does not count as filling a larger place');
 model.dispose();
});


test('a large marked place accepts off-centre aim without snapping to a wrong-sized cell',()=>{
 const wall={id:'world/end',hall:'world',length:15,a:{x:0,z:0},b:{x:15,z:0},normal:{x:0,z:1}};
 const model=createWallCompositions(THREE,{scene:new THREE.Scene()},{building:{floorElevation:8},paintings:{frameWidthM:.0675}});
 const large={painting:{id:'ART-1548',physicalSizeM:{width:4.96,height:3.92}},width:5.095,height:3.92,wall,x:5,y:3.1275,z:0,tier:1};
 const small={...large,painting:{id:'other',physicalSizeM:{width:1,height:1}},width:1.135,height:1,x:9,y:2};
 model.rebuild([large,small],()=>wall);model.refresh([]);
 const target=(along,y)=>({along,y});
 assert.deepEqual(model.snap(large,wall,6.8,4.2,target),{along:5,y:3.1275});
 assert.equal(model.snap(large,wall,9,2,target),null);
 model.dispose();
});
