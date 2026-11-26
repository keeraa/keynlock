import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three.js';
import {makeLayout} from '../src/architecture/layout.js';
import {arrangeExhibition} from '../src/paintings/exhibition.js';
import {accepts,placedSlot,floorSlots,aimedFrameAtRay} from '../src/paintings/hanging.js';
import {createHangingSession} from '../src/paintings/hanging-session.js';
import {tutorialWork} from '../src/paintings/floor-scatter.js';
import {createHangingTutorial} from '../src/ui/hanging-tutorial.js';
import {covered} from '../src/paintings/floor-drop.js';
import {PLAYER_DEFAULTS} from '../config/runtime.js';
import {createNavigation} from '../src/player/movement.js';
const json=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url)));
const config=json('../config/scene.json'),layout=makeLayout(config);
const catalog=json('../catalog/manifest.json'),seed=json('../catalog/initial-selection.json');
const exhibition=arrangeExhibition(catalog,seed,layout,config.paintings);
const page=exhibition.slots(0);
test('pick from floor, walk to the end wall, hang at the reticle and restore by ID after remount',t=>{
 const memory=new Map();
 t.after(()=>{delete globalThis.window;delete globalThis.localStorage;});
 globalThis.window={};globalThis.localStorage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
 const slot=page.find(s=>s.wall.hall==='cn' && s.height<.85),wall=layout.hangingWalls.find(w=>w.id==='cn/end'),n=wall.normal;
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
 session.setInspecting(true);session.update(true,performance.now()+1000);
 const examined=scene.getObjectByName('carried-painting');assert(examined.visible,'held inspection uses the framed scene object');
 assert.equal(session.carriedId,slot.painting.id,'inspection does not drop or replace the painting');
 session.setInspecting(false);session.update(true,performance.now()+1200);
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
test('the starter work is face-up near spawn and plays distinct pickup and mount cues while advancing the tutorial',t=>{
 const memory=new Map();
 globalThis.window={};globalThis.localStorage={getItem:key=>memory.get(key),setItem:(key,value)=>memory.set(key,value)};
 t.after(()=>{delete globalThis.window;delete globalThis.localStorage;});
 const camera=new THREE.PerspectiveCamera(),scene=new THREE.Scene(),node={},archiveTask={};
 const tutorial=createHangingTutorial(node,archiveTask,layout,config.paintings),sounds=[];
 const session=createHangingSession({THREE,world:{camera,scene,layout},config,label:{},display:{setSlots(){}},onMount:tutorial.mounted,playSound:kind=>sounds.push(kind)});
 t.after(()=>session.dispose());
 session.setPage(page);session.setActive(true);tutorial.setPage(page,session.find);
 const work=tutorialWork(page,config.paintings),floor=session.find(work.painting.id),spawn=PLAYER_DEFAULTS.spawn;
 assert(floor.floorAngle!==undefined&&!floor.faceDown);
 assert(Math.hypot(floor.x-spawn.x,floor.z-spawn.z)<1.65);
 assert.match(node.textContent,/Поднимите отмеченную картину.*Красная Фудзи/);
 assert.equal(archiveTask.hidden,true);
 const fy=config.building.floorElevation,wall=layout.hangingWalls.find(w=>w.id===work.wall.hall+'/end');
 camera.position.set(spawn.x,fy+PLAYER_DEFAULTS.eyeHeight,spawn.z);
 camera.lookAt(floor.x,fy+floor.y,floor.z);
 assert(session.interact());tutorial.update(session.carriedId);assert.match(node.textContent,/Повесьте.*зелёной рамкой/);
 const x=(wall.a.x+wall.b.x)/2,z=(wall.a.z+wall.b.z)/2;
 camera.position.set(x+wall.normal.x*2.6,fy+1.78,z+wall.normal.z*2.6);camera.lookAt(x,fy+2.15,z);
 session.update(true);assert(session.interact());assert(session.interact());
 assert.equal(session.find(work.painting.id).wall.id,wall.id);
 tutorial.update(null);
 assert.equal(node.hidden,false);
 assert.equal(archiveTask.hidden,true);
 assert.match(node.textContent,/Теперь другой зал/);
 assert.deepEqual(sounds,['pickup','mount','correctPlace']);
 const installed=session.find(work.painting.id);
 camera.lookAt(installed.x,fy+installed.y,installed.z);session.update(true);
 assert.equal(session.wallPick(),work.painting.id);
 assert(session.interact(session.wallPick()));
 assert.equal(session.phase,'carrying');
 assert.deepEqual(sounds,['pickup','mount','correctPlace','unmount']);
});

test('automatic arrangement enforces wall themes, frame clearance and wall boundaries',()=>{
 const s=page.find(s=>s.wall.hall==='nature' && s.height<1),wall=layout.walls.find(w=>w.id==='nature/end');
 assert(accepts(wall,s));assert(!accepts(layout.walls.find(w=>w.hall==='jp'),s));
 const center=wall.length/2, placed=placedSlot(s,wall,center,2,config.paintings,[]);
 assert(placed);assert.equal(placedSlot(s,wall,0,2,config.paintings,[]),null);
 const other={...s,painting:{...s.painting,id:'other'}};
 assert.equal(placedSlot(other,wall,center,2,config.paintings,[placed]),null);
});

test('a work is rejected in another hall and fits any sufficiently large wall of its assigned hall',()=>{
 const s=exhibition.byId.get('ART-1586');
 assert.equal(s.painting.physicalSizeM.width,2.22);
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
 const hint=scene.getObjectByName('table-placement-preview'),outline=scene.getObjectByName('table-placement-outline');
 const invalid=()=>outline.material.color.getHex()===0xff3939;
 session.interact();assert.equal(slots.length,0);assert(hint.visible&&invalid());
 aim(layout.hangingWalls.find(w=>w.id==='nature/end'));assert(invalid());
 aim(layout.hangingWalls.find(w=>w.id==='world/end'));assert(!invalid());
 aim(layout.hangingWalls.find(w=>w.id==='center/0'));assert(invalid());
 assert(outline.isMesh&&outline.material.opacity>0&&outline.material.opacity<1);
 aim(s.wall);assert(!invalid());session.update(true,performance.now()+450);assert(hint.visible);
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

test('placement can lower a seven-metre work on clear floor and a miniature onto a supporting stack',async()=>{
 const {findDrop}=await import('../src/paintings/floor-drop.js');
 const hall=layout.halls.find(h=>h.id==='nature'),point=layout.world(hall,0,hall.start+4),dir=layout.world(hall,0,1);
 const origin={...point,y:1.78};
 const painting={id:'test-seven-metre-work',physicalSizeM:{width:7.16,height:4.91}};
 const raft={painting,width:painting.physicalSizeM.width+2*config.paintings.frameWidthM,height:painting.physicalSizeM.height,wall:layout.walls.find(w=>w.id==='world/end'),normal:{x:0,z:1}};
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
 const s=page.find(s=>s.painting.id==='ART-1815');
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
 session.interact();
 const liftStart=performance.now();for(let i=1;i<=40;i++)session.update(true,liftStart+i*40);
 const held=scene.getObjectByName('carried-painting'),before=held.position.clone();
 assert(scene.getObjectByName('masterpiece-seal'));
 session.drop();
 assert.equal(session.phase,'lowering');
 assert(held.visible);
 session.update(true,performance.now()+400);
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

test('preview and placement share the same reach; leaving reach restores carrying without losing placement intent',t=>{
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
 const ghost=scene.getObjectByName('wall-preview'),held=scene.getObjectByName('carried-painting');
 at(10);session.update(true);assert.equal(memory.size,0);
 assert(controls.textContent.includes('оставить картину на тележке'));
 assert.equal(session.phase,'carrying');assert(!ghost.visible);assert(held.visible);
 at(3);session.interact();assert.equal(session.phase,'placing');assert(ghost.visible);assert(!held.visible);
 at(10);session.update(true);assert(!ghost.visible);assert(held.visible);
 session.interact();assert.equal(memory.size,0);assert.equal(session.phase,'placing');
 camera.lookAt(camera.position.clone().add(new THREE.Vector3(0,20,0)));
 session.update(true);assert(!ghost.visible);assert(held.visible);
 // Returning to reach resumes the same placement intent; there is never a distant red ghost.
 at(3);session.update(true);assert(ghost.visible);assert(!held.visible);
 session.interact();assert.equal(memory.size,1);
 assert.equal(session.phase,'lowering');
 assert(!session.canSprint());
 const startPose=held.position.clone(),start=performance.now();
 session.update(true,start+120);
 assert(held.position.distanceTo(startPose)>.01);
 session.update(true,start+450);
 assert(session.canSprint());
 assert(scene.getObjectByName('placement-success').visible);
 assert.match(messages[0],/Зал оформлен/);
 assert(!label.textContent.includes('E или'));
 session.dispose();
});

test('an old floor save crossing the stair rail moves onto supporting floor without changing the painting',async()=>{
 const {settleFloor,floorSupport}=await import('../src/paintings/floor-drop.js');
 const source=exhibition.byId.get('ART-1510');
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

test('restoring a mounted portrait clears its old scattered room and floor pose without rewriting the save',t=>{
 const staged=floorSlots(page,layout,config);
 const source=staged.find(s=>s.destination.startsWith('portraits/') && s.floorRoom!=='portraits' && s.height<1.5);
 assert(source,'fixture must start in a different room');
 const wall=layout.hangingWalls.find(w=>w.id==='portraits/side/-1');
 const record=JSON.stringify({[source.painting.id]:{version:3,wall:wall.id,along:3,y:2.1}});
 const memory=new Map([['keynlock-art-hanging-v1',record]]);
 globalThis.window={};globalThis.localStorage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
 t.after(()=>{delete globalThis.window;delete globalThis.localStorage;});
 let visible;
 const session=createHangingSession({THREE,world:{camera:new THREE.PerspectiveCamera(),scene:new THREE.Scene(),layout},config,label:{},display:{setSlots(v){visible=v;}}});
 session.setPage(page);session.setActive(true);
 const mounted=visible.find(s=>s.painting.id===source.painting.id);
 assert.equal(mounted.wall.id,wall.id);assert.equal(mounted.floorRoom,undefined);
 assert.equal(mounted.floorAngle,undefined);assert.equal(mounted.supportId,undefined);
 assert.equal(mounted.faceDown,false);assert.equal(mounted.trolley,false);
 assert.equal(memory.get('keynlock-art-hanging-v1'),record);
 session.dispose();
});

test('R recovers a carried miniature stranded outside the building without losing the ID or leaving carrying locked',()=>{
 const slot=page.find(s=>s.width<.6 && s.height<.6),camera=new THREE.PerspectiveCamera(),scene=new THREE.Scene();
 let visible;const messages=[];
 const session=createHangingSession({THREE,world:{camera,scene,layout},config,label:{},display:{setSlots(v){visible=v;}},notify:m=>messages.push(m)});
 session.setPage([slot]);session.setActive(true);
 const source=visible[0],fy=config.building.floorElevation;
 camera.position.set(source.x,fy+1.7,source.z+1);camera.lookAt(source.x,fy+source.y,source.z);
 assert(session.interact());assert.equal(visible.length,0);
 camera.position.set(1000,fy+1.7,1000);camera.lookAt(1000,fy,1001);
 session.drop();
 assert.equal(session.phase,'idle');assert.equal(visible.length,1);
 assert.equal(visible[0].painting.id,slot.painting.id);
 assert.equal(visible[0].x,source.x);assert.equal(visible[0].z,source.z);
 assert(messages.some(m=>m.includes('возвращена')));session.dispose();
});

test('click or R releases a large carried frame, including while examining it',t=>{
 const memory=new Map();globalThis.window={};globalThis.localStorage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
 t.after(()=>{delete globalThis.window;delete globalThis.localStorage;});
 const slot=page.find(s=>Math.max(s.painting.physicalSizeM.width,s.height)>=config.paintings.hoistFromM);
 assert(slot);
 for(const click of [true,false]){
  memory.clear();
  const camera=new THREE.PerspectiveCamera(),scene=new THREE.Scene(),fy=config.building.floorElevation;
  let visible;
  const session=createHangingSession({THREE,world:{camera,scene,layout},config,label:{},display:{setSlots(v){visible=v;}}});
  session.setPage([slot]);session.setActive(true);
  const source=visible[0];
  camera.position.set(source.x+source.normal.x*2,fy+1.78,source.z+source.normal.z*2);
  camera.lookAt(source.x,fy+source.y,source.z);
  assert(session.interact());assert.equal(session.phase,'carrying');assert(!session.canSprint());
  const now=performance.now();
  for(let i=1;i<=40;i++)session.update(true,now+i*50);
  assert.equal(session.phase,'carrying');
  if(!click){
   session.raise(true);
   session.update(true,now+2050);
   assert.equal(session.phase,'examining');
  }
  camera.lookAt(camera.position.x,fy+8,camera.position.z);
  if(click)assert(session.interact(null,'click'));else session.drop();
  session.update(true,performance.now()+400);
  assert.equal(session.phase,'idle');assert(session.canSprint());
  assert.equal(visible[0].painting.id,slot.painting.id);
  assert.equal(visible[0].trolley,true);
  assert.equal(JSON.parse(memory.get('keynlock-art-hanging-v1'))[slot.painting.id].kind,'trolley');
  session.dispose();
 }
});

test('context E throws toward the floor, starts its cue just before landing and preserves the ID',t=>{
 const memory=new Map();globalThis.window={};globalThis.localStorage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
 t.after(()=>{delete globalThis.window;delete globalThis.localStorage;});
 const slot=page.find(s=>s.painting.id==='ART-1815'),camera=new THREE.PerspectiveCamera(),scene=new THREE.Scene();
 const sounds=[],thrown=[];
 let visible;const session=createHangingSession({THREE,world:{camera,scene,layout},config,label:{},onThrow:slot=>thrown.push(slot.painting.id),playSound:kind=>sounds.push(kind),display:{setSlots(v){visible=v;}}});
 session.setPage([slot]);session.setActive(true);
 const source=visible[0],fy=config.building.floorElevation;
 camera.position.set(source.x,fy+1.78,source.z+1);camera.lookAt(source.x,fy+source.y,source.z);
 assert(session.interact());
 camera.lookAt(camera.position.x,fy,camera.position.z-2);
 const now=performance.now();for(let i=1;i<=30;i++)session.update(true,now+i*50);
 const held=scene.getObjectByName('carried-painting'),start=held.position.clone();
 assert(session.interact());assert.equal(session.phase,'lowering');
 assert(!sounds.includes('drop'),'floor impact must not sound while the painting is still in flight');
 assert.deepEqual(thrown,[],'the tutorial must wait until the throw lands');
 assert(held.position.distanceTo(start)<.001,'throw starts at the held pose');
 let earlyImpact=false;
 const throwStart=performance.now();
 for(let elapsed=10;elapsed<=2000;elapsed+=10){
  session.update(true,throwStart+elapsed);
  if(sounds.includes('drop')){earlyImpact=session.phase==='lowering';break;}
 }
 assert(earlyImpact,'impact cue should begin just before the flight ends');
 session.update(true,performance.now()+3000);
 assert.equal(sounds.filter(kind=>kind==='drop').length,1);
 assert.equal(session.phase,'idle');assert.equal(visible.length,1);
 assert.deepEqual(thrown,[slot.painting.id]);
 assert.equal(visible[0].painting.id,slot.painting.id);assert(visible[0].supportId.startsWith('floor/'));
 assert(Math.abs(visible[0].z-camera.position.z)>1,'lands ahead, not below the player');
 assert.equal(JSON.parse(memory.get('keynlock-art-hanging-v1'))[slot.painting.id].kind,'floor');
 session.dispose();
});

test('a ballistic throw accelerates downwards and cannot cross another painting',async()=>{
 const {createFrameMotion}=await import('../src/paintings/frame-motion.js');
 const cfg={...config,building:{...config.building,stair:undefined,floorElevation:0}},motion=createFrameMotion(THREE,cfg,{hangingWalls:[]});
 const slot={width:.5,height:.4},from={position:new THREE.Vector3(0,1.3,0),quaternion:new THREE.Quaternion()},to={position:new THREE.Vector3(0,.025,-2),quaternion:new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2,0,0))};
 const flight=motion.throwRoute(slot,from,to);assert(flight);
 assert(flight.path[0].position.equals(from.position));assert(flight.path.at(-1).position.distanceTo(to.position)<1e-8);
 const y=flight.path.map(p=>p.position.y);assert(y[2]-2*y[1]+y[0]<0,'gravity bends the path downwards');
 motion.setObstacles([{width:5,height:5,x:0,y:2.5,z:-1,normal:{x:0,z:1}}]);
 assert.equal(motion.throwRoute(slot,from,to),null);
});

test('Dora Wheeler lifts clear of a larger floor frame before turning, then follows a freely walking player',t=>{
 const dora=catalog.paintings.find(p=>p.id==='ART-0013'),hall=layout.halls[0],point=layout.world(hall,0,hall.start+8),fy=config.building.floorElevation;
 const source={...page.find(s=>s.destination==='portraits/women'),painting:dora,width:dora.physicalSizeM.width+2*config.paintings.frameWidthM,height:dora.physicalSizeM.height};
 const base={...source,painting:{...dora,id:'pickup-base',physicalSizeM:{width:3,height:3}},width:3+2*config.paintings.frameWidthM,height:3};
 const saved={};for(const [slot,y] of [[base,.025],[source,.075]])saved[slot.painting.id]={version:3,kind:'floor',...point,y,floorAngle:0,floorRoom:hall.id};
 const memory=new Map([['keynlock-art-hanging-v1',JSON.stringify(saved)]]);
 globalThis.window={};globalThis.localStorage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
 t.after(()=>{delete globalThis.window;delete globalThis.localStorage;});
 const camera=new THREE.PerspectiveCamera(),scene=new THREE.Scene(),nav=createNavigation(config,layout);
 let visible;const session=createHangingSession({THREE,world:{camera,scene,layout,navigation:nav},config,label:{},display:{setSlots(v){visible=v;nav.setPaintingObstacles(v);}}});
 session.setPage([base,source]);session.setActive(true);
 camera.position.set(point.x,fy+1.78,point.z+1.5);camera.lookAt(point.x,fy+.075,point.z);
 assert(session.interact());assert.equal(session.inspectSlot().painting.id,dora.id);
 camera.lookAt(point.x,fy+1.78,point.z-10);
 const held=scene.getObjectByName('carried-painting'),now=performance.now();
 for(let i=1;i<=100;i++)session.update(true,now+i*16);
 assert.equal(session.phase,'carrying');assert(held.position.y>fy+.7);
 const expected=camera.quaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-.58));
 assert(held.quaternion.angleTo(expected)<.1,'pickup must finish turning into the hand pose');
 const start=camera.position.clone();
 for(let i=101;i<=151;i++){nav.move(camera.position,new Set(['a']),0,.016,0);session.update(true,now+i*16);}
 assert(camera.position.distanceTo(start)>3,'carried picture must not lock WASD');
 assert(held.position.distanceTo(camera.position)<3,'carried picture must follow rather than remain in the pile');
 session.drop();session.update(true,performance.now()+10000);
 assert.equal(session.phase,'idle');assert(visible.some(s=>s.painting.id===dora.id));session.dispose();
});

test('entrance arch clearance rejects a manually hung frame at the mouth and permits the next clear position',()=>{
 const wall=layout.hangingWalls.find(w=>w.id==='portraits/side/-1'),slot=page.find(s=>s.destination==='portraits/women' && s.height<1);
 const settings={...config.paintings,edgeMarginM:0,minBottomM:.84};
 assert.equal(placedSlot(slot,wall,slot.width/2+.05,2,settings,[]),null);
 assert(placedSlot(slot,wall,slot.width/2+wall.minAlong+.001,2,settings,[]));
 for(const s of exhibition.byId.values()){
  if(s.floorAngle!==undefined)continue;
  const along=((s.x-s.wall.a.x)*(s.wall.b.x-s.wall.a.x)+(s.z-s.wall.a.z)*(s.wall.b.z-s.wall.a.z))/s.wall.length;
  assert(along-s.width/2>=(s.wall.minAlong??0)-1e-7);
  assert(along+s.width/2<=(s.wall.maxAlong??s.wall.length)+1e-7);
 }
});

test('pause preserves the visible carry pose and resumes without replaying the lift',t=>{
 let now=1000;t.mock.method(performance,'now',()=>now);
 const camera=new THREE.PerspectiveCamera(73,1.6),scene=new THREE.Scene();
 const session=createHangingSession({THREE,world:{camera,scene,layout},config,label:{},display:{setSlots(){}}});
 const slot=page.find(s=>s.width<.55&&s.height<.55);
 session.setPage([slot]);session.setActive(true);
 const floor=session.find(slot.painting.id),fy=config.building.floorElevation;
 camera.position.set(floor.x,fy+1.7,floor.z+1.1);
 camera.lookAt(floor.x,fy+floor.y,floor.z);
 assert(session.interact());
 for(let i=0;i<70;i++)session.update(true,now+=16);
 const root=scene.getObjectByName('carried-painting'),before=root.position.clone(),rotation=root.quaternion.clone();
 assert(root.visible);
 session.update(false,now);
 session.update(false,now+=4500);
 assert(root.visible);assert(root.position.equals(before));assert(root.quaternion.equals(rotation));
 session.update(true,now);
 assert(root.visible);assert(root.position.distanceTo(before)<.01);assert(root.quaternion.angleTo(rotation)<.01);
 session.dispose();
});

test('a carried frame stops against the rail partway down the flight',async()=>{
 const {createFrameMotion}=await import('../src/paintings/frame-motion.js');
 const {topGuardPaths}=await import('../src/architecture/stair-profile.js');
 const stair=config.building.stair;
 const a=topGuardPaths(stair).outerFlight[18],radius=Math.hypot(a.x,a.z),fy=config.building.floorElevation;
 const rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.atan2(a.x,a.z));
 const pose=r=>({position:new THREE.Vector3(a.x*r/radius,fy+a.y-.34,a.z*r/radius),quaternion:rotation});
 const frame={width:.22,height:.18},motion=createFrameMotion(THREE,config,layout);
 assert(motion.advance(frame,pose(radius+.7),pose(radius-.6))<1);
 assert(motion.advance(frame,pose(radius-.6),pose(radius+.7))<1);
});

test('Monet’s wide canvas clears the wall before turning onto the trolley',t=>{
 let now=1000;
 t.mock.method(performance,'now',()=>now);
 const slot=exhibition.byId.get('ART-0005');
 const wall=layout.hangingWalls.find(w=>w.id==='nature/end'),along=wall.length/2,y=2.25;
 const fy=config.building.floorElevation,n=wall.normal;
 const memory=new Map([['keynlock-art-hanging-v1',JSON.stringify({
   [slot.painting.id]:{version:3,wall:wall.id,along,y},
 })]]);
 globalThis.window={};globalThis.localStorage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
 t.after(()=>{delete globalThis.window;delete globalThis.localStorage;});
 const camera=new THREE.PerspectiveCamera(),scene=new THREE.Scene(),messages=[];
 const session=createHangingSession({THREE,world:{camera,scene,layout},config,label:{},display:{setSlots(){}},notify:message=>messages.push(message)});
 session.setPage([slot]);session.setActive(true);
 const mounted=session.find(slot.painting.id);
 assert.equal(mounted.wall.id,wall.id);
 camera.position.set(mounted.x+n.x*2.5,fy+1.78,mounted.z+n.z*2.5);
 camera.lookAt(mounted.x,fy+y,mounted.z);
 assert.equal(session.wallPick(),slot.painting.id);
 assert(session.interact(slot.painting.id));
 const carried=scene.getObjectByName('carried-painting');
 const initial=carried.position.clone(),rotation=carried.quaternion.clone();
 now+=32;session.update(true,now);
 assert(carried.position.distanceTo(initial)>.001);
 assert(carried.quaternion.angleTo(rotation)<1e-5,'outward motion starts before the frame swings');
 for(let i=0;i<70;i++){now+=16;session.update(true,now);}
 assert.equal(session.phase,'carrying');
 assert.equal(session.inspectSlot().painting.id,slot.painting.id);
 assert(messages.length===0);
 assert((carried.position.x-mounted.x)*n.x+(carried.position.z-mounted.z)*n.z>.13);
 session.dispose();
});


test('reading the wall label stops at five metres and a nearer wall still occludes the work',()=>{
 const slot={...page[0],x:0,y:1,z:0,normal:{x:0,z:1}};
 const direction={x:0,y:0,z:-1};
 assert.equal(aimedFrameAtRay({x:0,y:1,z:5.3},direction,[slot],config.paintings),null);
 assert.equal(aimedFrameAtRay({x:0,y:1,z:4.9},direction,[slot],config.paintings),slot);
 assert.equal(aimedFrameAtRay({x:0,y:1,z:4.9},direction,[slot],config.paintings,4.8),null);
});

test('free mode mounts on another gallery’s wall without marked places and keeps a separate saved arrangement',t=>{
 const memory=new Map(),previous=[globalThis.window,globalThis.localStorage];
 globalThis.window={};globalThis.localStorage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
 t.after(()=>{[globalThis.window,globalThis.localStorage]=previous;});
 const slot=page.find(s=>s.painting.id==='ART-1815'),camera=new THREE.PerspectiveCamera(),scene=new THREE.Scene();
 const session=createHangingSession({THREE,world:{camera,scene,layout},config,label:{},display:{setSlots(){}}});
 t.after(()=>session.dispose());
 session.setPage([slot]);session.setActive(true);session.setFreePlacement(true);
 const floor=session.find(slot.painting.id),fy=config.building.floorElevation;
 camera.position.set(floor.x,fy+1.78,floor.z+1);camera.lookAt(floor.x,fy+floor.y,floor.z);
 assert(session.interact());
 const wall=layout.hangingWalls.find(w=>w.hall!==slot.wall.hall&&w.hall!=='center'&&w.id.endsWith('/end'));
 const x=(wall.a.x+wall.b.x)/2,z=(wall.a.z+wall.b.z)/2;
 camera.position.set(x+wall.normal.x*2.5,fy+1.78,z+wall.normal.z*2.5);camera.lookAt(x,fy+1.7,z);
 session.update(true);assert(session.interact());assert(session.interact());
 assert.equal(session.find(slot.painting.id).wall.id,wall.id);
 assert.equal(scene.getObjectByName('painting-compositions').children.length,0);
 assert.equal(JSON.parse(memory.get('keynlock-art-hanging-v1-free'))[slot.painting.id].wall,wall.id);
 assert.equal(memory.has('keynlock-art-hanging-v1'),false);
 session.setFreePlacement(false);
 assert.notEqual(session.find(slot.painting.id).floorAngle,undefined);
 session.setFreePlacement(true);
 assert.equal(session.find(slot.painting.id).wall.id,wall.id);
});

test('only a flat painting resting on the frame blocks a floor pickup',()=>{
 const lower={...page.find(s=>s.painting.id==='ART-1815'),floorAngle:0,x:0,y:.025,z:20,floorRoom:'cn'};
 const upper={...lower,painting:{...lower.painting,id:'upper'},y:.075};
 assert.equal(covered(lower,[lower,upper],config.paintings),true);
 assert.equal(covered(lower,[lower,{...upper,leanPitch:-.22}],config.paintings),false);
 assert.equal(covered(lower,[lower,{...upper,trolley:true}],config.paintings),false);
 assert.equal(covered(lower,[lower,{...upper,y:.0575}],config.paintings),false);
});

test('a painting restored below the stairs from another exhibition page keeps its ID when picked up',t=>{
 const previous=[globalThis.window,globalThis.localStorage],memory=new Map();
 globalThis.window={};globalThis.localStorage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
 t.after(()=>{[globalThis.window,globalThis.localStorage]=previous;});
 const extra=page.find(s=>s.painting.id==='ART-1815'),fy=config.building.floorElevation;
 memory.set('keynlock-art-hanging-v1',JSON.stringify({[extra.painting.id]:{version:3,kind:'floor',destination:extra.destination,
  x:4,y:0,z:0,floorAngle:0,floorRoom:'center',supportId:'table-disposal'}}));
 const camera=new THREE.PerspectiveCamera(),scene=new THREE.Scene();
 const session=createHangingSession({THREE,world:{camera,scene,layout},config,label:{},display:{setSlots(){}}});t.after(()=>session.dispose());
 session.setPage([],[extra],true);
 const found=session.find(extra.painting.id);assert(found);
 camera.position.set(found.x,fy+found.y+1.78,found.z+1);camera.lookAt(found.x,fy+found.y,found.z);
 assert(session.interact());assert.equal(session.phase,'carrying');
 assert.equal(session.inspectSlot()?.painting.id,extra.painting.id,'a visible painting cannot become an empty carried slot');
});
test('interacting with a distant reticle throws weakly forward instead of denying or restoring the source',t=>{
 const memory=new Map(),old=[globalThis.window,globalThis.localStorage];
 globalThis.window={};globalThis.localStorage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
 t.after(()=>{[globalThis.window,globalThis.localStorage]=old;});
 const slot=page.find(s=>s.wall.hall==='cn'&&s.height<.5&&s.width<.5),camera=new THREE.PerspectiveCamera(),scene=new THREE.Scene(),events=[];
 let visible=[];const session=createHangingSession({THREE,world:{camera,scene,layout},config,label:{},display:{setSlots:slots=>{visible=slots;}},onEvent:(name,data)=>events.push({name,data})});t.after(()=>session.dispose());
 session.setPage([slot]);session.setActive(true);
 const floor=visible[0],fy=config.building.floorElevation;
 camera.position.set(floor.x,fy+1.7,floor.z+1);camera.lookAt(floor.x,fy+floor.y,floor.z);assert(session.interact());
 const hall=layout.halls.find(h=>h.id==='cn'),start=layout.world(hall,0,hall.start+4),ahead=layout.world(hall,0,hall.start+20);
 camera.position.set(start.x,fy+1.7,start.z);camera.lookAt(ahead.x,fy+1.7,ahead.z);
 session.update(true,performance.now()+2000);session.interact();
 assert.equal(session.phase,'lowering');const thrown=events.find(e=>e.name==='painting_throw');assert(thrown);assert.equal(thrown.data.weakThrow,true);
 session.update(true,performance.now()+5000);assert.equal(visible.length,1);
 const landed=visible[0],dx=landed.x-start.x,dz=landed.z-start.z,fx=ahead.x-start.x,fz=ahead.z-start.z;
 assert(dx*fx+dz*fz>0);assert(Math.abs(dx*fz-dz*fx)<1e-5);assert(Math.hypot(dx,dz)<=2.6+1e-6);
 assert(!events.some(e=>e.name==='painting_recovered'));
});

test('E leaves a heavy painting on its current trolley when the reticle hits a distant wall',t=>{
 let now=1000;t.mock.method(performance,'now',()=>now);
 const memory=new Map(),events=[];globalThis.window={};globalThis.localStorage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
 t.after(()=>{delete globalThis.window;delete globalThis.localStorage;});
 const slot=page.find(s=>s.destination.startsWith('center/')&&s.width>2),camera=new THREE.PerspectiveCamera(73,1.5),scene=new THREE.Scene(),controls={};
 const session=createHangingSession({THREE,world:{camera,scene,layout},config,label:{},controls,onEvent:(name,data)=>events.push({name,...data}),display:{setSlots(){}}});t.after(()=>session.dispose());
 session.setPage([slot]);session.setActive(true);
 const source=session.find(slot.painting.id),fy=config.building.floorElevation;
 camera.position.set(source.x,fy+1.78,source.z+1);camera.lookAt(source.x,fy+source.y,source.z);assert(session.interact());
 for(let i=1;i<=40;i++){now+=40;session.update(true,now);}
 const inspected=scene.getObjectByName('carried-painting'),heightBefore=inspected.position.y;
 session.setInspecting(true);for(let i=0;i<40;i++){now+=40;session.update(true,now);}
 assert(inspected.getObjectByName('painting-trolley').visible,'RMB must show the painting together with its carrier');
 assert(Math.abs(inspected.position.y-heightBefore)<.02,'inspection must keep the wheels on the floor');
 assert(session.inspectionTarget());session.setInspecting(false);
 const wall=layout.hangingWalls.find(w=>w.id==='cn/end');
 camera.lookAt((wall.a.x+wall.b.x)/2,fy+1.78,(wall.a.z+wall.b.z)/2);
 for(let i=41;i<=80;i++){now+=40;session.update(true,now);}
 assert.match(controls.textContent,/оставить картину на тележке/,'a real distant wall must take the parking branch');
 const before=scene.getObjectByName('carried-painting').position.clone();
 assert(session.interact());now+=400;session.update(true,now);
 assert.equal(session.phase,'idle');assert.equal(session.carriedId,undefined);
 const parked=session.find(slot.painting.id);assert(parked.trolley);
 assert(Math.hypot(parked.x-before.x,parked.z-before.z)<.001,'park at the actual trolley, rather than the distant reticle');
 assert(Math.abs(fy+parked.y-before.y)<.05,'only settle the wheels onto the supporting floor or rug');
 assert(events.some(e=>e.name==='painting_drop'&&e.surface==='trolley'));
 assert(!events.some(e=>e.name==='painting_recovered'||e.name==='placement_failed'&&e.reason==='out_of_reach'));
});

test('aiming a carried painting at a suitable wall shows its dashed ghost before pressing E',t=>{
 const memory=new Map();globalThis.window={};globalThis.localStorage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
 t.after(()=>{delete globalThis.window;delete globalThis.localStorage;});
 const slot=page.find(s=>s.wall.hall==='cn'&&s.height<.85),wall=layout.hangingWalls.find(w=>w.id==='cn/end'),n=wall.normal,fy=config.building.floorElevation;
 const camera=new THREE.PerspectiveCamera(),scene=new THREE.Scene();
 const session=createHangingSession({THREE,world:{camera,scene,layout},config,label:{},display:{setSlots(){}}});t.after(()=>session.dispose());
 session.setPage([slot]);session.setActive(true);const source=session.find(slot.painting.id);
 camera.position.set(source.x,fy+1.7,source.z+1);camera.lookAt(source.x,fy+source.y,source.z);assert(session.interact());
 const x=(wall.a.x+wall.b.x)/2,z=(wall.a.z+wall.b.z)/2;
 const aim=distance=>{camera.position.set(x+n.x*distance,fy+1.7,z+n.z*distance);camera.lookAt(x,fy+2,z);session.update(true);};
 aim(3);assert.equal(session.phase,'carrying');assert(scene.getObjectByName('table-placement-preview').visible);
 assert(scene.getObjectByName('table-placement-outline').visible);assert(scene.getObjectByName('carried-painting').visible);
 assert(!scene.getObjectByName('wall-preview').visible,'the hint must not become the real held pose or the origin of a throw');
 session.setInspecting(true);session.update(true);assert(!scene.getObjectByName('table-placement-preview').visible);
 session.setInspecting(false);aim(3);assert(scene.getObjectByName('table-placement-preview').visible);
 aim(10);assert(!scene.getObjectByName('table-placement-preview').visible,'no unreachable placement hint');assert.equal(memory.size,0);
 aim(3);session.interact();session.interact();assert.equal(session.find(slot.painting.id).wall.id,wall.id);
});
