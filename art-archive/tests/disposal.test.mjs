import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three.js';
import {makeLayout} from '../src/architecture/layout.js';
import {createDisposalState,DISPOSAL_KEY,LEGACY_DISPOSAL_SUPPORT} from '../src/paintings/disposal-state.js';
import {createHangingSession} from '../src/paintings/hanging-session.js';
import {aimedSupport} from '../src/paintings/floor-drop.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url)));
const config=read('config/scene.json'),manifest=read('catalog/manifest.json'),layout=makeLayout(config),receiver=layout.disposalStation,fy=config.building.floorElevation;
const work=id=>{const painting=manifest.paintings.find(p=>p.id===id);return {painting,width:painting.physicalSizeM.width+2*config.paintings.frameWidthM,height:painting.physicalSizeM.height,destination:painting.placement.hall+'/'+painting.placement.wall,wall:{hall:painting.placement.hall},normal:{x:0,z:1}};};
const point=(x,z,y=receiver.y)=>new THREE.Vector3(receiver.x+Math.cos(receiver.angle)*x+Math.sin(receiver.angle)*z,y,receiver.z-Math.sin(receiver.angle)*x+Math.cos(receiver.angle)*z);
function memory(t){const m=new Map();globalThis.window={};globalThis.localStorage={getItem:k=>m.get(k),setItem:(k,v)=>m.set(k,v)};t.after(()=>{delete globalThis.window;delete globalThis.localStorage;});return m;}

test('disposal commits only approved Keynlock works and survives reload without deleting source records',()=>{
 let saved={};const opts={read:()=>saved,write:(key,value)=>{saved=value;return true;}};
 const model=createDisposalState(opts),target={...work('KNL-0001'),supportId:LEGACY_DISPOSAL_SUPPORT},ordinary={...work('ART-0001'),supportId:LEGACY_DISPOSAL_SUPPORT};
 assert.equal(model.commit([ordinary]).accepted.length,0);
 const result=model.commit([target,ordinary]);assert.equal(result.accepted.length,1);assert.equal(result.rejected,1);
 assert(createDisposalState(opts).has('KNL-0001'));assert(!model.has('ART-0001'));
 assert.equal(model.commit([target]).accepted.length,0);assert(manifest.paintings.some(p=>p.id==='KNL-0001'));
 const fail=createDisposalState({read:()=>({}),write:()=>false});assert.equal(fail.commit([target]),null);assert(!fail.has('KNL-0001'));
});

test('receiver is in the wall and old tray placements restore to the lower floor',t=>{
 const m=memory(t),slot=work('KNL-0001');
 m.set('keynlock-art-hanging-v1',JSON.stringify({[slot.painting.id]:{version:3,kind:'floor',destination:slot.destination,
  x:3.65,z:.6,y:receiver.floorY+.885,floorAngle:0,floorRoom:'center',supportId:LEGACY_DISPOSAL_SUPPORT}}));
 const camera=new THREE.PerspectiveCamera(),scene=new THREE.Scene();
 const session=createHangingSession({THREE,world:{camera,scene,layout},config,label:{},display:{setSlots(){}}});
 session.setPage([slot]);session.setActive(true);
 const restored=session.find(slot.painting.id);
 assert.equal(restored.supportId,'lower-landing');
 assert.equal(restored.y,receiver.floorY+config.paintings.frameDepthM/2);
 const eye=point(0,1.6,receiver.floorY+1.78),dir=point(0,0).sub(eye).normalize();
 assert.notEqual(aimedSupport(eye,dir,layout,config)?.kind,'table');
 assert(!m.has(DISPOSAL_KEY));session.dispose();
});

test('aiming a carried work at the wall slot consumes only an approved painting and persists the result',t=>{
 const m=memory(t),target=work('KNL-0002'),ordinary=work('ART-0001'),taken=point(0,1.55,receiver.floorY+.025);
 let now=1000;t.mock.method(performance,'now',()=>now);
 const saved=Object.fromEntries([target,ordinary].map((slot,i)=>[slot.painting.id,{version:3,kind:'floor',destination:slot.destination,
  x:taken.x+(i===0?-.6:.6),z:taken.z,y:taken.y,floorAngle:0,floorRoom:'center',supportId:'lower-landing'}]));
 m.set('keynlock-art-hanging-v1',JSON.stringify(saved));
 const camera=new THREE.PerspectiveCamera(73,1.5),scene=new THREE.Scene(),controls={};
 let disposed=[];const sounds=[];
 const session=createHangingSession({THREE,world:{camera,scene,layout},config,label:{},controls,playSound:kind=>sounds.push(kind),display:{setSlots(){}},onDisposed:ids=>disposed.push(...ids)});
 session.setPage([target,ordinary]);session.setActive(true);
 const eye=point(0,2.15,receiver.floorY+1.78);
 camera.position.set(eye.x,fy+eye.y,eye.z);
 const aim=p=>{camera.lookAt(p.x,fy+p.y,p.z);session.update(true,now+=1000);};
 for(const slot of [ordinary,target]){
  aim(session.find(slot.painting.id));assert(session.interact());assert.equal(session.phase,'carrying');
  aim(point(0,0));assert(session.interact());
  if(slot===ordinary){
   assert.equal(session.phase,'carrying');assert(!m.has(DISPOSAL_KEY));
   session.setPage([target,ordinary]);
  }else assert.equal(session.phase,'idle');
 }
 assert.deepEqual(disposed,[target.painting.id]);
 assert.equal(sounds.filter(kind=>kind==='disposal').length,1);
 assert.equal(sounds.filter(kind=>kind==='disposalScrape').length,1);
 assert(sounds.includes('deny'));
 assert.deepEqual(JSON.parse(m.get(DISPOSAL_KEY)).destroyed,[target.painting.id]);
 session.update(true,now+950);session.setPage([ordinary,target]);
 assert(!session.find(target.painting.id));assert(session.find(ordinary.painting.id));
 session.dispose();assert.equal(scene.children.length,0);
});

test('all quest paintings occur exactly once in the scatter of every exhibition, and destroyed works stay absent',async()=>{
 const {arrangeExhibition}=await import('../src/paintings/exhibition.js');
 const {playableSelection}=await import('../src/paintings/playable-selection.js');
 const {floorSlots}=await import('../src/paintings/hanging.js');
 const exhibition=arrangeExhibition(manifest,read('catalog/initial-selection.json'),layout,config.paintings),all=[...exhibition.byId.values()];
 for(let page=0;page<exhibition.pageCount;page++){
  const selected=playableSelection(exhibition.slots(page),all),staged=floorSlots(selected,layout,config);
  assert.equal(new Set(selected.map(s=>s.painting.id)).size,selected.length);
  assert.equal(staged.filter(s=>s.painting.collection==='keynlock').length,17);
 }
 const filtered={...manifest,paintings:manifest.paintings.filter(p=>p.id!=='KNL-0001')};
 const after=arrangeExhibition(filtered,{},layout,config.paintings);
 assert(!playableSelection(after.slots(0),[...after.byId.values()]).some(s=>s.painting.id==='KNL-0001'));
});
