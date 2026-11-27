import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three.js';
import {makeLayout} from '../src/architecture/layout.js';
import {arrangeExhibition} from '../src/paintings/exhibition.js';
import {floorSlots} from '../src/paintings/hanging.js';
import {floorSupport,settleFloor,findDrop} from '../src/paintings/floor-drop.js';
import {frameFootprint,footprintsOverlap} from '../catalog/painting-geometry.js';
import {createPaintingInteraction} from '../src/paintings/interaction-state.js';
import {createHangingSession} from '../src/paintings/hanging-session.js';
import {createNavigation} from '../src/player/movement.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url)));
const config=read('config/scene.json'),layout=makeLayout(config);
const page=arrangeExhibition(read('catalog/manifest.json'),read('catalog/initial-selection.json'),layout,config.paintings).slots(0);

test('six usable tables surround the stairs without occupying the descent approach',()=>{
 assert.equal(layout.storageTables.length,6);
 for(const t of layout.storageTables){
  const b=frameFootprint({x:t.x,z:t.z,width:t.width,height:t.depth-2*config.paintings.frameWidthM,floorAngle:t.angle},config.paintings);
  assert(Math.hypot(t.x,t.z)-Math.hypot(b.w,b.h)>config.building.stair.openingRadius+.25);
  assert(Math.abs(Math.atan2(t.x,t.z))>.8,'table blocks the descent approach');
 }
 const table=layout.storageTables[0],nav=createNavigation(config,layout),n={x:Math.sin(table.angle),z:Math.cos(table.angle)};
 const p={x:table.x+n.x*2,z:table.z+n.z*2};
 for(let i=0;i<90;i++)nav.move(p,new Set(['w','shift']),table.angle,.04,0);
 assert((p.x-table.x)*n.x+(p.z-table.z)*n.z>=table.depth/2+.26);
});

test('the full exhibition scatters without piles, includes every wing, tables, treads and the lower floor, and remains reproducible',()=>{
 const first=floorSlots(page,layout,config),again=floorSlots(page,layout,config);
 assert.equal(first.length,page.length);assert.equal(new Set(first.map(p=>p.painting.id)).size,page.length);
 assert.deepEqual(first,again);
 for(const h of layout.halls)assert(first.some(p=>p.floorRoom===h.id));
 assert(first.filter(p=>p.supportId.startsWith('step-')).length>=4);
 assert(first.filter(p=>p.supportId==='lower-landing').length>=8);
 for(const table of layout.storageTables)assert(first.some(p=>p.supportId===table.id));
 const settled=settleFloor(first,layout,config);
 for(const slot of settled){
  const support=floorSupport(slot,layout,config);assert(support);
  assert(Math.abs(slot.y-support.y-config.paintings.frameDepthM/2)<1e-8,'an automatic pile was formed');
 }
 for(let a=0;a<first.length;a++)for(let b=a+1;b<first.length;b++)if(first[a].supportId===first[b].supportId)
  assert(!footprintsOverlap(frameFootprint(first[a],config.paintings),frameFootprint(first[b],config.paintings)),first[a].painting.id+' overlaps '+first[b].painting.id);
 const changed=floorSlots(page,layout,{...config,paintings:{...config.paintings,scatterSeed:444}});
 assert(changed.some((p,i)=>p.x!==first[i].x||p.z!==first[i].z));
});

test('R targets the tabletop and restored storage preserves the supporting table and height',t=>{
 const slot=page.find(s=>s.width<.6&&s.height<.6),table=layout.storageTables[0];
 const n={x:Math.sin(table.angle),z:Math.cos(table.angle)};
 const origin=new THREE.Vector3(table.x+n.x*2,1.7,table.z+n.z*2),dir=new THREE.Vector3(table.x,table.y,table.z).sub(origin).normalize();
 const drop=findDrop(slot,origin,dir,'center',layout,config,[]);
 assert(drop);assert.equal(drop.supportId,table.id);assert.equal(drop.y,table.y+config.paintings.frameDepthM/2);
 const storage=new Map([['keynlock-art-hanging-v1',JSON.stringify({[slot.painting.id]:{...drop,version:3,kind:'floor'}})]]);
 globalThis.localStorage={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)};globalThis.window={};
 t.after(()=>{delete globalThis.localStorage;delete globalThis.window;});
 const camera=new THREE.PerspectiveCamera(),session=createHangingSession({THREE,world:{camera,scene:new THREE.Scene(),layout},config,label:{},display:{setSlots(){}}});
 session.setPage([slot]);session.setActive(true);
 const restored=session.find(slot.painting.id);assert.equal(restored.supportId,table.id);assert.equal(restored.y,drop.y);
 session.dispose();
});

test('inspection, placement and lowering are mutually exclusive interaction phases',()=>{
 const state=createPaintingInteraction(),slot={painting:{id:'test'}},source={floorAngle:.3};
 assert.equal(state.phase,'idle');assert.throws(()=>state.place());
 state.pick(slot,source);assert.equal(state.phase,'carrying');assert.throws(()=>state.pick(slot,source));
 state.raise(true);assert.equal(state.phase,'examining');assert.equal(state.carrying,slot);
 state.place();assert.equal(state.phase,'placing');assert(!state.raised);state.raise(true);assert(state.placing);
 state.carry();assert.equal(state.phase,'carrying');
 const landing={slot,path:[],start:0,duration:400};state.lower(landing);
 assert.equal(state.phase,'lowering');assert.equal(state.carrying,null);assert.equal(state.landing,landing);
 state.reset();assert.equal(state.phase,'idle');assert.equal(state.source,null);
});

test('a painting below the stairs lifts and drops on the lower floor without jumping to the third storey',t=>{
 const slot=page.find(s=>s.width<.5&&s.height<.5);
 const x=3.6,z=0,y=-config.building.stair.depth+config.paintings.frameDepthM/2;
 const memory=new Map([['keynlock-art-hanging-v1',JSON.stringify({[slot.painting.id]:{version:3,kind:'floor',destination:slot.destination,x,y,z,floorAngle:0,floorRoom:'center',supportId:'lower-landing'}})]]);
 globalThis.window={};globalThis.localStorage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
 t.after(()=>{delete globalThis.window;delete globalThis.localStorage;});
 let now=1000;t.mock.method(performance,'now',()=>now);
 const camera=new THREE.PerspectiveCamera(73,1.5),scene=new THREE.Scene(),fy=config.building.floorElevation;
 const session=createHangingSession({THREE,world:{camera,scene,layout},config,label:{},display:{setSlots(){}}});
 session.setPage([slot]);session.setActive(true);
 camera.position.set(x+.7,fy-config.building.stair.depth+1.7,z);camera.lookAt(x,fy+y,z);
 assert(session.interact());assert.equal(session.phase,'carrying');
 for(let i=0;i<100;i++){now+=16;session.update(true,now);}
 const held=scene.getObjectByName('carried-painting');
 assert(held.position.y<fy-1,'painting teleported to the upper floor');
 camera.lookAt(x,fy-config.building.stair.depth,z);session.update(true,now);
 session.drop();assert.equal(session.phase,'lowering');
 for(let i=0;i<150;i++){now+=16;session.update(true,now);}
 const placed=session.find(slot.painting.id);assert(placed);assert.equal(placed.supportId,'lower-landing');
 assert(Math.abs(placed.y-y)<1e-8);assert.equal(session.phase,'idle');session.dispose();
});
