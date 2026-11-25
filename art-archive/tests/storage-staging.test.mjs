import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three.js';
import {makeLayout} from '../src/architecture/layout.js';
import {arrangeExhibition} from '../src/paintings/exhibition.js';
import {floorSlots} from '../src/paintings/hanging.js';
import {floorSupport,settleFloor,findDrop} from '../src/paintings/floor-drop.js';
import {frameDimensions,frameFootprint,footprintsOverlap} from '../catalog/painting-geometry.js';
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
  assert(Math.hypot(t.x,t.z)-b.h>config.building.stair.openingRadius+.25);
  assert(Math.hypot(t.x,t.z)-b.h<config.building.stair.openingRadius+.30,'table is too far from the railing');
  assert(Math.abs(Math.atan2(t.x,t.z))>.8,'table blocks the descent approach');
 }
 const table=layout.storageTables[0],nav=createNavigation(config,layout),n={x:Math.sin(table.angle),z:Math.cos(table.angle)};
 const p={x:table.x+n.x*2,z:table.z+n.z*2};
 for(let i=0;i<90;i++)nav.move(p,new Set(['w','shift']),table.angle,.04,0);
 assert((p.x-table.x)*n.x+(p.z-table.z)*n.z>=table.depth/2+.26);
});

test('the full exhibition scatters without piles, leaves tables empty and includes every wing, treads and the lower floor, and remains reproducible',()=>{
 const first=floorSlots(page,layout,config),again=floorSlots(page,layout,config);
 assert.equal(first.length,page.length);assert.equal(new Set(first.map(p=>p.painting.id)).size,page.length);
 assert.deepEqual(first,again);
 for(const h of layout.halls)assert(first.some(p=>p.floorRoom===h.id));
 assert(first.filter(p=>p.supportId.startsWith('step-')).length>=4);
 const lower=first.filter(p=>p.supportId==='lower-landing');
 assert(lower.length>=18);
 assert(lower.some(p=>p.leanPitch));
 assert(lower.filter(p=>Math.max(p.width,p.height)>1.1).length>=6);
 assert(first.some(p=>p.floorRoom!=='center'&&p.leanPitch));
 assert(!first.some(p=>p.supportId.startsWith('table-')),'automatic staging must never use tables');
 const settled=settleFloor(first,layout,config);
 for(const slot of settled){
  const support=floorSupport(slot,layout,config);assert(support);
  const size=frameDimensions(slot,config.paintings),pitch=slot.leanPitch;
  const halfY=pitch?(size.height*Math.cos(pitch)+size.depth*Math.abs(Math.sin(pitch)))/2:size.depth/2;
  assert(Math.abs(slot.y-support.y-halfY)<1e-8,'an automatic pile was formed');
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
 const previousRadius=4.25, shift=previousRadius-Math.hypot(table.x,table.z);
 const oldDrop={...drop,x:drop.x+n.x*shift,z:drop.z+n.z*shift};
 const storage=new Map([['keynlock-art-hanging-v1',JSON.stringify({[slot.painting.id]:{...oldDrop,version:3,kind:'floor'}})]]);
 globalThis.localStorage={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)};globalThis.window={};
 t.after(()=>{delete globalThis.localStorage;delete globalThis.window;});
 const camera=new THREE.PerspectiveCamera(),session=createHangingSession({THREE,world:{camera,scene:new THREE.Scene(),layout},config,label:{},display:{setSlots(){}}});
 session.setPage([slot]);session.setActive(true);
 const restored=session.find(slot.painting.id);assert.equal(restored.supportId,table.id);assert.equal(restored.y,drop.y);
 assert(Math.hypot(restored.x-drop.x,restored.z-drop.z)<1e-8);
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
 const x=-3.6,z=0,y=-config.building.stair.depth+config.paintings.frameDepthM/2;
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
 session.interact();assert.equal(session.phase,'lowering');
 for(let i=0;i<150;i++){now+=16;session.update(true,now);}
 const placed=session.find(slot.painting.id);assert(placed);assert.equal(placed.supportId,'lower-landing');
 assert(Math.abs(placed.y-y)<1e-8);assert.equal(session.phase,'idle');session.dispose();
});

test('a second tall portrait turns to fit the table and finds a clear neighbouring spot without intersecting the first',()=>{
 const table=layout.storageTables[0],c=Math.cos(table.angle),s=Math.sin(table.angle),frame=config.paintings.frameWidthM;
 const at=(x,z)=>({x:table.x+c*x+s*z,z:table.z-s*x+c*z});
 const work=(id,width,height)=>({painting:{id,physicalSizeM:{width,height}},width:width+2*frame,height,wall:{hall:'center'},normal:{x:0,z:1}});
 const first={...work('first',.25,.25),...at(-1,-.4),y:table.y+config.paintings.frameDepthM/2,floorAngle:table.angle,floorRoom:'center',supportId:table.id};
 const portrait=work('second',.5,1.65),eye=at(0,2);
 const origin=new THREE.Vector3(eye.x,1.78,eye.z),dir=new THREE.Vector3(table.x,table.y,table.z).sub(origin).normalize();
 const second=findDrop(portrait,origin,dir,'center',layout,config,[first]);
 assert(second,'portrait fits after a quarter turn and a small lateral adjustment');
 assert.equal(second.supportId,table.id);assert.equal(second.y,table.y+config.paintings.frameDepthM/2);
 assert(!footprintsOverlap(frameFootprint(first,config.paintings),frameFootprint(second,config.paintings)));
 assert.equal(floorSupport(second,layout,config).id,table.id);
 const restored=settleFloor([],layout,config,[first,second]);
 for(const item of restored)assert.equal(item.y,table.y+config.paintings.frameDepthM/2);
});

test('a second miniature can rest on the first on a table without sinking or floating',()=>{
 const table=layout.storageTables[0],frame=config.paintings.frameWidthM,depth=config.paintings.frameDepthM;
 const make=(id,w,h)=>({painting:{id,physicalSizeM:{width:w,height:h}},width:w+2*frame,height:h,wall:{hall:'center'},normal:{x:0,z:1}});
 const first={...make('base',.6,.6),x:table.x,y:table.y+depth/2,z:table.z,floorAngle:table.angle,floorRoom:'center',supportId:table.id};
 const origin=new THREE.Vector3(table.x+Math.sin(table.angle)*2,1.78,table.z+Math.cos(table.angle)*2);
 const dir=new THREE.Vector3(table.x,table.y+depth,table.z).sub(origin).normalize();
 const second=findDrop(make('top',.3,.3),origin,dir,'center',layout,config,[first]);
 assert(second);assert.equal(second.supportId,table.id);assert(Math.abs(second.y-first.y-depth)<1e-8);
});

test('table ghost pulses with a dashed border and matches the final E placement of a second portrait',t=>{
 const table=layout.storageTables[0],n={x:Math.sin(table.angle),z:Math.cos(table.angle)},u={x:Math.cos(table.angle),z:-Math.sin(table.angle)};
 const template=page.find(p=>p.width<.6),frame=config.paintings.frameWidthM,fy=config.building.floorElevation;
 const work=(id,w,h)=>({...template,painting:{...template.painting,id,physicalSizeM:{width:w,height:h}},width:w+2*frame,height:h});
 const first=work('table-first',.25,.25),second=work('table-second',.5,1.65);
 const at=(x,z)=>({x:table.x+x*u.x+z*n.x,z:table.z+x*u.z+z*n.z});
 const firstAt=at(-1,-.4),secondAt=at(0,2);
 const memory=new Map([['keynlock-art-hanging-v1',JSON.stringify({
  'table-first':{version:3,kind:'floor',...firstAt,y:table.y+.025,floorAngle:table.angle,floorRoom:'center',supportId:table.id,
   tableOffset:[firstAt.x-table.x,firstAt.z-table.z]},
  'table-second':{version:3,kind:'floor',...secondAt,y:.025,floorAngle:table.angle,floorRoom:'center'}
 })]]);
 globalThis.window={};globalThis.localStorage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
 t.after(()=>{delete globalThis.window;delete globalThis.localStorage;});
 const camera=new THREE.PerspectiveCamera(),scene=new THREE.Scene();let visible;
 const session=createHangingSession({THREE,world:{camera,scene,layout},config,label:{},display:{setSlots(v){visible=v;}}});
 session.setPage([first,second]);session.setActive(true);
 const eye=at(0,3.2);camera.position.set(eye.x,fy+1.78,eye.z);camera.lookAt(secondAt.x,fy+.025,secondAt.z);
 assert(session.interact());assert.equal(session.inspectSlot().painting.id,'table-second');
 camera.lookAt(table.x,fy+table.y,table.z);
 const now=performance.now();for(let i=1;i<=30;i++)session.update(true,now+i*50);
 const ghost=scene.getObjectByName('table-placement-preview');assert(ghost.visible);
 const outline=scene.getObjectByName('table-placement-outline');assert(outline.isMesh && outline.material.isMeshBasicMaterial);
 assert(outline.geometry.getAttribute('position').count>=24);assert.equal(outline.material.depthWrite,false);
 const previewPosition=ghost.position.clone(),previewRotation=ghost.quaternion.clone(),opacity=outline.material.opacity;
 const geometry=outline.geometry;
 session.update(true,now+2300);assert.notEqual(outline.material.opacity,opacity);assert.equal(outline.geometry,geometry);
 session.interact();assert.equal(session.phase,'lowering');assert(!ghost.visible);
 session.update(true,performance.now()+5000);
 const placed=visible.find(s=>s.painting.id==='table-second');
 assert.equal(session.phase,'idle');assert.equal(placed.supportId,table.id);assert.equal(visible.length,2);
 assert(Math.abs(placed.y-table.y-.025)<1e-8);
 assert(Math.abs(previewPosition.x-placed.x)<1e-8 && Math.abs(previewPosition.z-placed.z)<1e-8);
 assert(Math.abs(previewPosition.y-fy-placed.y-.008)<1e-8);
 const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2,placed.floorAngle,0,'YXZ'));
 assert(rotation.angleTo(previewRotation)<1e-7);
 let disposed=0;geometry.addEventListener('dispose',()=>disposed++);session.dispose();assert.equal(disposed,1);
 assert.equal(scene.children.length,0);
});

test('table placement is axis aligned, with the image bottom toward the player from all four sides',()=>{
 const table=layout.storageTables[0],slot=page.find(s=>s.width<.6 && s.height<.6);
 for(const side of [0,1,2,3]){
  const a=table.angle+side*Math.PI/2,origin=new THREE.Vector3(table.x+Math.sin(a)*2,1.78,table.z+Math.cos(a)*2);
  const direction=new THREE.Vector3(table.x,table.y,table.z).sub(origin).normalize();
  const target=findDrop(slot,origin,direction,'center',layout,config,[]);assert(target?.supportId===table.id);
  const angle=(target.floorAngle-table.angle)/(Math.PI/2);assert(Math.abs(angle-Math.round(angle))<1e-8);
  const bottom=new THREE.Vector3(Math.sin(target.floorAngle),0,Math.cos(target.floorAngle));
  assert(bottom.dot(new THREE.Vector3(origin.x-table.x,0,origin.z-table.z).normalize())>.999);
 }
});

test('a clamped table portrait stays readable from the actual viewer, even when the reticle points past its final centre',()=>{
 const table=layout.storageTables[0],c=Math.cos(table.angle),s=Math.sin(table.angle),frame=config.paintings.frameWidthM;
 const at=(x,z)=>new THREE.Vector3(table.x+c*x+s*z,0,table.z-s*x+c*z);
 const eye=at(0,.4);eye.y=1.78;const aim=at(0,.6);aim.y=table.y;
 const slot={painting:{id:'readable',physicalSizeM:{width:1,height:.9}},width:1+2*frame,height:.9,wall:{hall:'center'},normal:{x:0,z:1}};
 const target=findDrop(slot,eye,aim.sub(eye).normalize(),'center',layout,config,[]);assert(target?.supportId===table.id);
 const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2,target.floorAngle,0,'YXZ'));
 // The image's UV-top is +Y in its plane, and must lie farther from the viewer than its bottom.
 const imageTop=new THREE.Vector3(0,1,0).applyQuaternion(rotation);
 const toViewer=new THREE.Vector3(eye.x-target.x,0,eye.z-target.z).normalize();
 assert(imageTop.dot(toViewer)<-.99,'rendered image must face the player upright, not follow the ray heading');
});

test('table preview follows both reticle axes without drifting to an edge to improve facing',()=>{
 const table=layout.storageTables[0],frame=config.paintings.frameWidthM;
 const at=(x,z,y)=>new THREE.Vector3(table.x+Math.cos(table.angle)*x+Math.sin(table.angle)*z,y,table.z-Math.sin(table.angle)*x+Math.cos(table.angle)*z);
 const eye=at(0,2,1.78),slot={painting:{id:'follow-reticle',physicalSizeM:{width:.3,height:.3}},width:.3+2*frame,height:.3,wall:{hall:'center'},normal:{x:0,z:1}};
 let previous=null;
 for(const [x,z] of [[-.6,-.2],[-.3,-.1],[0,0],[.3,.1],[.6,.2]]){
  const aimed=at(x,z,table.y),placed=findDrop(slot,eye,aimed.clone().sub(eye).normalize(),'center',layout,config,[]);
  assert(placed?.supportId===table.id);
  assert(Math.hypot(placed.x-aimed.x,placed.z-aimed.z)<1e-8,'preview must stay at the reticle, not a corner');
  if(previous){assert.equal(placed.floorAngle,previous.floorAngle);assert(Math.hypot(placed.x-previous.x,placed.z-previous.z)<.32);}
  previous=placed;
 }
});
