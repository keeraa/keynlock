import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three.js';
import {makeLayout} from '../src/architecture/layout.js';
import {arrangeExhibition} from '../src/paintings/exhibition.js';
import {accepts,placedSlot} from '../src/paintings/hanging.js';
import {createHangingSession} from '../src/paintings/hanging-session.js';
const json=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url)));
const config=json('../config/scene.json'),layout=makeLayout(config);
const catalog=json('../catalog/manifest.json'),seed=json('../catalog/initial-selection.json');
const exhibition=arrangeExhibition(catalog,seed,layout,config.paintings);
const page=exhibition.slots(0);
test('pick from floor, walk to the end wall, hang at the reticle and restore by ID after remount',t=>{
 const memory=new Map();
 t.after(()=>{delete globalThis.window;delete globalThis.localStorage;});
 globalThis.window={};globalThis.localStorage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
 const slot=page.find(s=>s.wall.id==='cn/end'),wall=slot.wall,n=wall.normal;
 const camera=new THREE.PerspectiveCamera(),scene=new THREE.Scene(),label={};
 let visible;
 const create=()=>createHangingSession({THREE,world:{camera,scene,layout},config,label,display:{setSlots(s){visible=s;}}});
 const session=create();
 session.setPage([slot]);session.setActive(true);
 const floor=visible[0],fy=config.building.floorElevation;
 camera.position.set(floor.x,fy+1.7,floor.z+1);camera.lookAt(floor.x,fy+floor.y,floor.z);
 assert(session.interact());assert.equal(visible.length,0);
 const x=(wall.a.x+wall.b.x)/2,z=(wall.a.z+wall.b.z)/2;
 camera.position.set(x+n.x*3,fy+1.7,z+n.z*3);camera.lookAt(x,fy+2.1,z);
 const before=camera.position.clone();
 session.update(true);assert(scene.getObjectByName('carried-painting').visible);
 assert(session.interact());assert.equal(visible.length,0);
 assert(scene.getObjectByName('wall-preview').visible);
 assert(!scene.getObjectByName('carried-painting').visible);
 assert(session.interact());assert(camera.position.equals(before));assert.equal(visible[0].wall.id,wall.id);
 assert.equal(visible[0].floorAngle,undefined);assert(Math.abs(visible[0].y-2.1)<1e-8);
 const restored=create();restored.setPage([slot]);restored.setActive(true);
 assert(Math.abs(restored.find(slot.painting.id).y-2.1)<1e-8);
 assert(restored.interact());assert.equal(visible[0].floorAngle,undefined);
 assert(restored.interact(restored.wallPick()));restored.drop();restored.update(true,performance.now()+1700);
 assert.equal(visible.length,1);assert.notEqual(visible[0].floorAngle,undefined);
 assert(visible[0].y<.1 && visible[0].z>camera.position.z);
 const afterDrop=create();afterDrop.setPage([slot]);afterDrop.setActive(true);
 assert.equal(afterDrop.find(slot.painting.id).floorAngle,visible[0].floorAngle);
 assert.equal(afterDrop.find(slot.painting.id).z,visible[0].z);afterDrop.dispose();
 session.dispose();restored.dispose();assert.equal(scene.children.length,0);
});
test('automatic arrangement enforces wall themes, frame clearance and wall boundaries',()=>{
 const s=page.find(s=>s.wall.id==='nature/end'),wall=s.wall;
 assert(accepts(wall,s));assert(!accepts(layout.walls.find(w=>w.hall==='jp'),s));
 const center=wall.length/2, placed=placedSlot(s,wall,center,2,config.paintings,[]);
 assert(placed);assert.equal(placedSlot(s,wall,0,2,config.paintings,[]),null);
 const other={...s,painting:{...s.painting,id:'other'}};
 assert.equal(placedSlot(other,wall,center,2,config.paintings,[placed]),null);
});

test('a work is rejected in another hall and fits any sufficiently large wall of its assigned hall',()=>{
 const s=exhibition.byId.get('ART-1539');
 assert.equal(s.painting.physicalSizeM.width,7.16);
 const {camera,scene}={camera:new THREE.PerspectiveCamera(),scene:new THREE.Scene()};
 let slots;const session=createHangingSession({THREE,world:{camera,scene,layout},config,label:{},display:{setSlots(s){slots=s;}}});
 session.setPage([s]);session.setActive(true);
 const p=slots[0],fy=config.building.floorElevation;
 camera.position.set(p.x,fy+1.7,p.z+.8);camera.lookAt(p.x,fy+p.y,p.z);assert(session.interact());
 const aim=wall=>{
   const x=(wall.a.x+wall.b.x)/2,z=(wall.a.z+wall.b.z)/2;
   camera.position.set(x+wall.normal.x*4,fy+1.78,z+wall.normal.z*4);camera.lookAt(x,fy+1.78,z);session.update(true);
 };
 const preview=scene.getObjectByName('wall-preview');
 aim(layout.walls.find(w=>w.id==='jp/end'));
 const red=preview.children.find(o=>o.material?.transparent);
 assert(red.visible);session.interact();assert.equal(slots.length,0);
 aim(layout.hangingWalls.find(w=>w.id==='nature/end'));assert(red.visible);
 aim(layout.hangingWalls.find(w=>w.id==='world/end'));assert(!red.visible);
 aim(layout.hangingWalls.find(w=>w.id==='center/0'));
 assert(red.visible && red.material.opacity>0 && red.material.opacity<1);
 assert.equal(red.scale.x,s.width);assert.equal(red.scale.y,s.height+2*config.paintings.frameWidthM);
 aim(s.wall);assert(!red.visible);session.update(true,performance.now()+450);assert(preview.children.some(o=>o.isGroup&&o.visible));
 assert(preview.position.y-fy>=s.height/2+config.paintings.frameWidthM+.84-1e-8);
 session.dispose();
});

test('the entrance strip supports small paintings, preserves the old wall origin, and accepts the adjacent gallery',()=>{
 const h=layout.halls[1],wall=layout.walls.find(w=>w.hall===h.id&&w.id.includes('/-1/'));
 assert(Math.abs(layout.local(h,wall.a.x,wall.a.z).z-h.start-.12)<1e-8);
 assert(Math.abs(layout.local(h,wall.a.x,wall.a.z).z+wall.legacyAlongShift-h.start-1)<1e-8);
 const piece=page.find(s=>s.wall.hall===h.id);
 assert(accepts(layout.walls.find(w=>w.id==='center/0'),piece));
 assert(!accepts(layout.walls.find(w=>w.id==='center/3'),piece));
});

test('R can lower a seven-metre work on clear floor and a miniature onto a supporting stack',async()=>{
 const {findDrop}=await import('../src/paintings/floor-drop.js');
 const hall=layout.halls.find(h=>h.id==='nature'),point=layout.world(hall,0,hall.start+4),dir=layout.world(hall,0,1);
 const origin={...point,y:1.78};
 const raft=exhibition.byId.get('ART-1539');
 const large=findDrop(raft,origin,dir,hall.id,layout,config,[]);
 assert(large && large.width===raft.width && large.y<.1);
 const small=page.find(s=>s.wall.hall==='nature'&&s.width<.6);
 const baseline=findDrop(small,origin,dir,hall.id,layout,config,[]);
 const support={...baseline,width:baseline.width+.5,height:baseline.height+.5,y:.2,painting:{id:'support'}};
 const stacked=findDrop(small,origin,dir,hall.id,layout,config,[support]);
 assert(stacked && Math.abs(stacked.y-support.y-config.paintings.frameDepthM)<1e-8);
 assert.equal(findDrop(raft,{x:0,y:1.7,z:0},{x:1,z:0},'center',layout,config,[]),null);
});

test('a steep or shallow downward reticle determines the exact contact point on the support',async()=>{
 const {findDrop,settleFloor,covered}=await import('../src/paintings/floor-drop.js');
 const h=layout.halls[0],origin={x:2,y:1.7,z:h.start+4};
 const s=page.find(s=>s.width<.55 && s.height<.75);
 const aim=(pitch,x=0)=>new THREE.Vector3(x,-pitch,1).normalize();
 const drop=(d,items=[])=>findDrop(s,origin,d,h.id,layout,config,items);
 const near=drop(aim(1)),far=drop(aim(.4,.15));
 assert(near && far && far.z>near.z+2 && far.x>near.x);
 for(const [placed,d] of [[near,aim(1)],[far,aim(.4,.15)]]){
   const t=(placed.y-config.paintings.frameDepthM/2-origin.y)/d.y;
   assert(Math.abs(placed.x-origin.x-t*d.x)<1e-8 && Math.abs(placed.z-origin.z-t*d.z)<1e-8);
 }
 const support={...near,painting:{id:'base'},width:1.5,height:1.5};
 const stack=drop(aim(1),[support]);
 assert(Math.abs(stack.y-support.y-config.paintings.frameDepthM)<1e-8);
 assert(covered(support,[support,stack],config.paintings));
 const [alone]=settleFloor([stack],layout,config);
 assert(Math.abs(alone.y-config.paintings.frameDepthM/2)<1e-8);
});

test('floor highlight fades, lift starts at the selected frame and R starts at its current carried pose',t=>{
 const memory=new Map();globalThis.window={};globalThis.localStorage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
 t.after(()=>{delete globalThis.window;delete globalThis.localStorage;});
 let now=1000;
 t.mock.method(performance,'now',()=>now);
 const hall=layout.halls[0],fy=config.building.floorElevation;
 const s=page.find(s=>s.wall.hall===hall.id && s.width<.6 && s.height<.8);
 const camera=new THREE.PerspectiveCamera(),scene=new THREE.Scene(),label={};
 let visible;const session=createHangingSession({THREE,world:{camera,scene,layout},config,label,display:{setSlots(v){visible=v;}}});
 session.setPage([s]);session.setActive(true);
 const start=visible[0];camera.position.set(start.x+1,fy+1.7,start.z);
 camera.lookAt(start.x,fy+start.y,start.z);
 const glow=scene.getObjectByName('floor-focus'),held=scene.getObjectByName('carried-painting');
 session.update(true);const opacity=glow.material.opacity;
 now+=25;session.update(true);assert(glow.visible && glow.material.opacity>opacity && glow.material.opacity<=.15);
 assert.equal(glow.geometry.type,'BoxGeometry');
 assert(glow.scale.z>config.paintings.frameDepthM,'highlight must cover both sides and all wooden edges');
 session.interact();assert.equal(held.position.y,fy+start.y);
 now+=100;session.update(true);assert(held.position.y>fy+start.y && held.position.y<fy+start.y+.24);
 camera.position.set(2,fy+1.7,hall.start+8);camera.lookAt(2,fy,hall.start+10);
 for(let i=0;i<80;i++){now+=16;session.update(true);}
 const before=held.position.clone(),rotation=held.quaternion.clone();
 session.drop();assert(held.position.distanceTo(before)<1e-7 && held.quaternion.angleTo(rotation)<1e-6);
 now+=170;session.update(true);assert(held.visible && held.position.distanceTo(before)>.005);
 now+=1700;session.update(true);const landed=visible[0];
 assert(Math.abs(landed.x-2)<1e-7 && Math.abs(landed.z-hall.start-10)<1e-7);
 assert(Math.abs(landed.y-config.paintings.frameDepthM/2)<1e-7);session.dispose();
});

test('swept frames stop at an intervening picture even when both animation endpoints are clear',async()=>{
 const {createFrameMotion}=await import('../src/paintings/frame-motion.js');
 const motion=createFrameMotion(THREE,config),fy=config.building.floorElevation;
 const s={width:1,height:.8,x:0,y:1,z:0,normal:{x:0,z:1}};
 motion.setObstacles([s]);
 const from=motion.pose({...s,z:-1}),to=motion.pose({...s,z:1});
 assert(!motion.blocked(s,from.position,from.quaternion) && !motion.blocked(s,to.position,to.quaternion));
 const stop=motion.advance(s,from,to);assert(stop>0 && stop<.5);
 assert(motion.blocked(s,new THREE.Vector3(0,fy+.1,0),to.quaternion));
});

test('legacy themed side-wall saves reopen on the continuous physical face at the same world point',t=>{
 const old=layout.walls.find(w=>w.id==='world/-1/history'),slot=page.find(s=>s.destination.startsWith('world/') && s.width<.65);
 const saved={[slot.painting.id]:{version:2,wall:old.id,along:2,y:3}};
 globalThis.window={};globalThis.localStorage={getItem:()=>JSON.stringify(saved)};
 t.after(()=>{delete globalThis.window;delete globalThis.localStorage;});
 let visible;
 const session=createHangingSession({THREE,world:{layout,camera:new THREE.PerspectiveCamera(),scene:new THREE.Scene()},config,label:{},display:{setSlots(v){visible=v;}}});
 session.setPage([slot]);session.setActive(true);
 const [work]=visible,depth=config.paintings.wallClearanceM+config.paintings.frameDepthM/2;
 assert.equal(work.wall.id,'world/side/-1');
 for(const axis of ['x','z'])assert(Math.abs(work[axis]-old.a[axis]-(old.b[axis]-old.a[axis])*2/old.length-old.normal[axis]*depth)<1e-7);
 assert(work.wall.length>old.length*2);
 session.dispose();
});

test('reticle can hit the exposed side of a wooden rail beyond the painted face',async()=>{
 const {frameAtRay}=await import('../src/paintings/hanging.js');
 const slot={x:0,y:1,z:0,width:1,height:.7,normal:{x:0,z:1}};
 assert.equal(frameAtRay({x:1,y:1,z:0},{x:-1,y:0,z:0},[slot],config.paintings,2),slot);
 assert.equal(frameAtRay({x:1,y:1,z:.09},{x:-1,y:0,z:0},[slot],config.paintings,2),null);
});

test('nearby frames align bottom, top or centre on the same wall only',async()=>{
  const {adjacentLevel}=await import('../src/paintings/hanging.js');
  const wall={id:'world/end'},slot={width:.5,height:.4};
  const hung=[{wall,along:1,width:1,height:2,y:2}];
  for(const level of [1.2,2,2.8])assert.equal(adjacentLevel(slot,wall,2,level+.07,hung),level);
  assert.equal(adjacentLevel(slot,wall,2,1.5,hung),null);
  assert.equal(adjacentLevel(slot,wall,3,2,hung),null);
  assert.equal(adjacentLevel(slot,{id:'other'},2,2,hung),null);
});

test('debug vacancy replacement persists separately from the original player save',t=>{
 const slot=page.find(s=>s.wall.id==='cn/end'),replacement={...slot,painting:{...slot.painting,id:'debug-replacement'}};
 const key='keynlock-art-hanging-v1';
 const original=JSON.stringify({[slot.painting.id]:{version:3,wall:'cn/end',along:3,y:3}});
 const memory=new Map([[key,original]]);
 globalThis.window={};globalThis.localStorage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
 t.after(()=>{delete globalThis.window;delete globalThis.localStorage;});
 const create=debugSelection=>createHangingSession({debugSelection,THREE,world:{camera:new THREE.PerspectiveCamera(),scene:new THREE.Scene(),layout},config,label:{},display:{setSlots(){}}});
 const debug=create(true);debug.setPage([slot]);debug.setActive(true);
 assert.equal(debug.fillVacancy(debug.find(slot.painting.id),replacement),replacement);debug.dispose();
 assert.equal(memory.get(key),original);
 for(const debugSelection of [true,false]){
   const s=create(debugSelection);s.setPage([replacement]);s.setActive(true);
   assert.equal(s.find(replacement.painting.id).floorAngle===undefined,debugSelection);
   s.dispose();
 }
});

test('a large painting parks upright at its actual trolley pose and restores there by ID',t=>{
 const memory=new Map();
 globalThis.window={};globalThis.localStorage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
 t.after(()=>{delete globalThis.window;delete globalThis.localStorage;});
 const slot=page.find(s=>s.destination.startsWith('center/') && s.width>2);
 const camera=new THREE.PerspectiveCamera(73,1.5),scene=new THREE.Scene(),label={};
 let visible;
 const create=()=>createHangingSession({THREE,world:{camera,scene,layout},config,label,display:{setSlots(v){visible=v;}}});
 const session=create();session.setPage([slot]);session.setActive(true);
 const floor=visible[0],fy=config.building.floorElevation;
 camera.position.set(floor.x,fy+1.78,floor.z+1);camera.lookAt(floor.x,fy+floor.y,floor.z);
 session.interact();session.update(true,performance.now()+1600);
 const held=scene.getObjectByName('carried-painting'),before=held.position.clone();
 assert(scene.getObjectByName('masterpiece-seal'));
 session.drop();
 const parked=session.find(slot.painting.id);
 assert(parked.trolley);assert.equal(parked.floorAngle,undefined);
 assert(new THREE.Vector3(parked.x,fy+parked.y,parked.z).distanceTo(before)<1e-8);
 const restored=create();restored.setPage([slot]);restored.setActive(true);
 assert.equal(restored.find(slot.painting.id).floorAngle,undefined,'restored cart must not inherit the staged floor rotation');
 assert(Math.abs(restored.find(slot.painting.id).y-slot.height/2-config.paintings.frameWidthM-.29)<1e-8);
 assert.deepEqual(restored.find(slot.painting.id).normal,parked.normal);
 assert.equal(restored.find(slot.painting.id).x,parked.x);
 const supported=restored.find(slot.painting.id);
 camera.position.set(supported.x+supported.normal.x*2,fy+supported.y,supported.z+supported.normal.z*2);
 camera.lookAt(supported.x,fy+supported.y,supported.z);
 assert(restored.interact());assert(restored.canRaise());
 restored.dispose();session.dispose();
});

test('a rotating carried frame stops before the real wall while a mounted frame fits in front',async()=>{
 const {createFrameMotion}=await import('../src/paintings/frame-motion.js');
 const wall={a:{x:-5,z:0},b:{x:5,z:0},length:10,normal:{x:0,z:1}};
 const motion=createFrameMotion(THREE,config,{hangingWalls:[wall]});
 const slot={width:2,height:1};
 const from={position:new THREE.Vector3(0,10,1),quaternion:new THREE.Quaternion()};
 const to={position:new THREE.Vector3(0,10,-1),quaternion:new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),.6)};
 assert(motion.advance(slot,from,to)<.5);
 assert(!motion.blocked(slot,new THREE.Vector3(0,10,config.paintings.frameDepthM/2+config.paintings.wallClearanceM),from.quaternion));
});

test('stacked neighbours align left edges, right edges and centres without pulling distant frames',async()=>{
 const {adjacentPosition}=await import('../src/paintings/hanging.js');
 const wall={id:'a'},slot={width:.5,height:.4},hung=[{wall,along:2,y:2,width:1,height:.8}];
 for(const x of [1.75,2,2.25])assert.deepEqual(adjacentPosition(slot,wall,x+.05,2.95,hung,.0675),{x,y:2.95});
 assert.equal(adjacentPosition(slot,wall,2.05,5,hung,.0675),null);
});

test('preview survives a missing wall ray and distant placement is rejected before near placement succeeds',t=>{
 const memory=new Map(),messages=[];
 globalThis.window={};globalThis.localStorage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
 t.after(()=>{delete globalThis.window;delete globalThis.localStorage;});
 const slot=page.find(s=>s.wall.id==='cn/end'),wall=slot.wall,n=wall.normal,fy=config.building.floorElevation;
 const camera=new THREE.PerspectiveCamera(),scene=new THREE.Scene(),controls={},label={};
 const session=createHangingSession({THREE,world:{camera,scene,layout},config,label,controls,display:{setSlots(){}},notify:m=>messages.push(m)});
 session.setPage([slot]);session.setActive(true);
 const floor=session.find(slot.painting.id);
 camera.position.set(floor.x,fy+1.7,floor.z+1);camera.lookAt(floor.x,fy+floor.y,floor.z);
 session.interact();
 const x=(wall.a.x+wall.b.x)/2,z=(wall.a.z+wall.b.z)/2;
 const at=distance=>{camera.position.set(x+n.x*distance,fy+1.7,z+n.z*distance);camera.lookAt(x,fy+2.1,z);};
 at(10);session.interact();session.interact();assert.equal(memory.size,0);
 assert(controls.textContent.includes('Подойдите ближе'));
 camera.lookAt(camera.position.clone().add(new THREE.Vector3(0,20,0)));
 session.update(true);
 assert(scene.getObjectByName('wall-preview').visible);
 assert(!scene.getObjectByName('carried-painting').visible);
 at(3);session.interact();assert.equal(memory.size,1);
 assert(scene.getObjectByName('placement-success').visible);
 assert(messages[0].includes('на своём месте'));
 assert(!label.textContent.includes('E или'));
 session.dispose();
});

test('an old floor save crossing the stair rail moves onto supporting floor without changing the painting',async()=>{
 const {settleFloor,floorSupport}=await import('../src/paintings/floor-drop.js');
 const source=page.find(s=>s.painting.id==='ART-1510');
 const bad={...source,x:3.2,z:0,y:1,floorAngle:0,floorRoom:'center'};
 assert.equal(floorSupport(bad,layout,config),null);
 const [fixed]=settleFloor([],layout,config,[bad]);
 assert(floorSupport(fixed,layout,config));
 assert.equal(fixed.painting.id,bad.painting.id);
 assert.equal(fixed.width,bad.width);
 assert(fixed.y<.1);
 assert(Math.hypot(fixed.x-bad.x,fixed.z-bad.z)>0);
});

test('a carried frame cannot cross the guardrail around the stairs',async()=>{
 const {createFrameMotion}=await import('../src/paintings/frame-motion.js');
 const motion=createFrameMotion(THREE,config,layout),slot={width:1,height:.6};
 const from={position:new THREE.Vector3(4.5,config.building.floorElevation+.7,0),quaternion:new THREE.Quaternion()};
 const to={position:new THREE.Vector3(2,config.building.floorElevation+.7,0),quaternion:new THREE.Quaternion()};
 assert(motion.advance(slot,from,to)<1);
});
