import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from '../vendor/three.js';
import {makeLayout} from '../src/architecture/layout.js';
import {entrancePaintColor} from '../src/architecture/entrance-junction.js';
import {createArchiveBuilding} from '../src/architecture/create-building.js';
import {createNavigation} from '../src/player/movement.js';
import {stairTreads} from '../src/architecture/stair-profile.js';
const config=JSON.parse(await fs.readFile(new URL('../config/scene.json',import.meta.url)));
// Stub the canvas while testing actual Three geometry in Node.
const originalDocument=globalThis.document;
globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},strokeRect(){},fillText(){}})})};
const materials=Object.fromEntries(['stone','gold','darkWood','plaster','wood','ivory','floor','rug','roof','exterior','garden','glow'].map(key=>[key,new THREE.MeshBasicMaterial()]));
materials.make=(color)=>new THREE.MeshStandardMaterial({color});
materials.glass=new THREE.MeshPhysicalMaterial({transparent:true,opacity:.16,depthWrite:false,side:THREE.DoubleSide});
const building=createArchiveBuilding({THREE,config,layout:makeLayout(config),materials});
globalThis.document=originalDocument;building.root.updateMatrixWorld(true);
function surfaceY(x,z,fromY){
 const ray=new THREE.Raycaster(new THREE.Vector3(x,fromY,z),new THREE.Vector3(0,-1,0),0,1);
 return ray.intersectObject(building.root,true)[0]?.point.y;
}
test('rendered landing and all stair treads match navigation heights',()=>{
 const s=config.building.stair,base=config.building.floorElevation,nav=createNavigation(config,makeLayout(config)),radius=(s.innerRadius+s.outerRadius)/2;
 for(const z of [s.outerRadius-.1,3.05,s.openingRadius+.29]){
  assert(Math.abs(surfaceY(0,z,base+.4)-base)<1e-5,'Missing top landing geometry');assert.equal(nav.floorAt(0,z,0),0);
 }
 for(const step of stairTreads(s)){
  const a=(step.a+step.b)/2,x=Math.sin(a)*radius,z=Math.cos(a)*radius;
  assert(Math.abs(surfaceY(x,z,base+step.y+.3)-(base+step.y))<1e-5,`Visible tread ${step.index}`);
  assert.equal(nav.floorAt(x,z,step.y),step.y);
 }
 assert.equal(stairTreads(s)[0].y,0);assert.equal(stairTreads(s).at(-1).y,-s.depth);
});
test('all six gallery vaults crown at the configured height, with solid side walls',()=>{
 const vaults=[],walls=[],glass=[];
 building.root.traverse(o=>{if(o.name==='gallery-vault')vaults.push(o);if(o.name==='gallery-wall')walls.push(o);if(o.material?.transparent)glass.push(o);});
 assert.equal(vaults.length,6);assert.equal(walls.length,12);assert.equal(glass.filter(o=>o.name==='diffuse-ceiling').length,6);assert(glass.some(o=>o.name==='glass-dome'));
 for(const vault of vaults){vault.geometry.computeBoundingBox();assert(Math.abs(vault.geometry.boundingBox.max.y-config.building.height)<1e-5);}
 for(const wall of walls){wall.geometry.computeBoundingBox();assert(wall.geometry.boundingBox.max.y>=config.building.height-config.building.vaultRise);}
});
test('rotunda painting panels are wider than 2m and dome is clear glass',()=>{
 const layout=makeLayout(config);assert(layout.centerSegments.every(s=>s.length>2));
 const dome=building.root.getObjectByName('glass-dome');assert(dome.material.isMeshPhysicalMaterial);assert(dome.material.opacity<.2);assert.equal(dome.castShadow,false);
});
test('eye height and aim height differ with pitch, without changing scene scale',()=>{
 const camera=new THREE.PerspectiveCamera(config.camera.fov,16/9,.07,250),base=config.building.floorElevation;
 camera.position.set(0,base+1.78,-17);camera.updateMatrixWorld(true);
 const down=new THREE.Raycaster(camera.position,new THREE.Vector3(0,-1,0),0,10);
 const floorY=down.intersectObject(building.root,true)[0].point.y;
 const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(0,0),camera);
 const level=ray.intersectObject(building.root,true)[0].point.y-floorY;
 assert(Math.abs(level-1.7475)<1e-5);
 camera.rotation.x=THREE.MathUtils.degToRad(3);camera.updateMatrixWorld(true);ray.setFromCamera(new THREE.Vector2(0,0),camera);
 const tilted=ray.intersectObject(building.root,true)[0].point.y-floorY;
 const wing=makeLayout(config).halls.find(h=>h.id==='nature');
 const distance=wing.start+wing.length-.15-Math.abs(camera.position.z);
 assert(Math.abs(tilted-(level+distance*Math.tan(THREE.MathUtils.degToRad(3))))<1e-5);assert.equal(camera.position.y,base+1.78);
});

test('raised glass dome and circular drum join the gallery vaults',()=>{
 const dome=building.root.getObjectByName('glass-dome');
 assert.equal(dome.position.y,11.2);
 const bounds=new THREE.Box3().setFromObject(dome);
 assert(Math.abs(bounds.max.y-config.building.floorElevation-17.5)<1e-4);
 const drum=[];building.root.traverse(o=>{if(o.name==='rotunda-upper-drum')drum.push(o);});assert.equal(drum.length,1);
 for(const facet of drum){const b=new THREE.Box3().setFromObject(facet);assert(b.min.y<config.building.floorElevation+config.building.height-.25);assert(Math.abs(b.max.y-config.building.floorElevation-11.2)<1e-5);}
 const ray=new THREE.Raycaster(new THREE.Vector3(0,config.building.floorElevation+9,0),new THREE.Vector3(0,0,-1),0,30);
 assert(ray.intersectObject(building.root,true).length>0,'Upper entrance axis must be closed below the dome');
});

test('every entrance shoulder is closed above the vault profile',()=>{
 const layout=makeLayout(config),{wingWidth:w,height,vaultRise}=config.building;
 for(const h of layout.halls)for(let x=-w/2+.05;x<w/2;x+=.17){
  const y=height-vaultRise+vaultRise*Math.sqrt(1-(x/(w/2))**2)+.025;
  const p=layout.world(h,x,0),d=layout.world(h,0,1);
  const ray=new THREE.Raycaster(new THREE.Vector3(p.x,config.building.floorElevation+y,p.z),new THREE.Vector3(d.x,0,d.z),0,config.building.radius+2);
  assert(ray.intersectObject(building.root,true).length,`Open vault shoulder: ${h.id} ${x}`);
 }
});
test('gallery vault surfaces are continuous and bare floors meet the rotunda',()=>{
 const layout=makeLayout(config),base=config.building.floorElevation;
 for(const h of layout.halls){
  for(const z of [Math.max(h.start+.5,layout.ringRadius+.5),h.start+h.length/2,h.start+h.length-.4])for(const x of [-4.3,-2,0,2,4.3]){
   const p=layout.world(h,x,z),ray=new THREE.Raycaster(new THREE.Vector3(p.x,base+6,p.z),new THREE.Vector3(0,1,0),0,3);
   assert(ray.intersectObject(building.root,true).length,`Open roof: ${h.id} ${x} ${z}`);
  }
  const p=layout.world(h,2,h.start+h.length/2);
  assert(Math.abs(surfaceY(p.x,p.z,base+.5)-base)<1e-5,'Bare gallery floor must be at y=0');
 }
});

test('central floor and gallery floors never overlap away from their shared edge',()=>{
 const layout=makeLayout(config),base=config.building.floorElevation;
 for(const h of layout.halls)for(const offset of [-.15,.15])for(const x of [-4,-2,0,2,4]){
  const p=layout.world(h,x,h.start+offset),ray=new THREE.Raycaster(new THREE.Vector3(p.x,base+.1,p.z),new THREE.Vector3(0,-1,0),0,.15);
  const objects=new Set(ray.intersectObject(building.root,true).filter(hit=>Math.abs(hit.point.y-base)<1e-5).map(hit=>hit.object.id));
  assert.equal(objects.size,1,`Overlapping floor surfaces: ${h.id} ${x} ${offset}`);
 }
});
test('six flat painting walls have no columns in their central hanging area',()=>{
 const layout=makeLayout(config),base=config.building.floorElevation;
 assert.equal(layout.centerSegments.length,6);
 for(const panel of layout.centerSegments){
  const mid={x:(panel.a.x+panel.b.x)/2,z:(panel.a.z+panel.b.z)/2};
  const ray=new THREE.Raycaster(new THREE.Vector3(mid.x+panel.normal.x,base+2,mid.z+panel.normal.z),new THREE.Vector3(-panel.normal.x,0,-panel.normal.z),0,2);
  const hit=ray.intersectObject(building.root,true)[0];assert.equal(hit.object.name,'rotunda-hanging-wall');
 }
});
test('each gallery has one continuous plaster end wall from floor to vault crown',()=>{
 const walls=[];building.root.traverse(o=>{if(o.name==='gallery-end-wall')walls.push(o);});assert.equal(walls.length,6);
 for(const wall of walls){wall.geometry.computeBoundingBox();assert.equal(wall.geometry.boundingBox.min.y,0);assert(Math.abs(wall.geometry.boundingBox.max.y-config.building.height)<1e-5);assert.equal(wall.material,materials.plaster);}
 assert.equal(building.root.getObjectByName('entrance-beam'),undefined);
});
test('rotunda painting walls meet the upper plaster on the same plane without a crown',()=>{
 const caps=[];building.root.traverse(o=>{if(o.name==='gallery-wainscot-cap')caps.push(o);});
 assert.equal(caps.length,1);
 assert.equal(building.root.getObjectByName('hanging-wall-crown'),undefined);
 const base=config.building.floorElevation+config.building.height;
 for(const wall of makeLayout(config).hangingWalls.filter(w=>w.hall==='center')){
  const {normal:n,a,b}=wall;
  for(const t of [.1,.5,.9]){
   const x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;
   for(const offset of [-.025,.025]){
    const ray=new THREE.Raycaster(new THREE.Vector3(x+n.x,base+offset,z+n.z),new THREE.Vector3(-n.x,0,-n.z),0,2);
    const hit=ray.intersectObject(building.root,true)[0];
    assert(hit,wall.id);
    assert(Math.abs(hit.distance-1)<1e-5,wall.id+' at '+offset);
   }
  }
 }
 const ring=config.building.radius-.08;
 for(let index=0;index<36;index++){
  const angle=index/36*Math.PI*2;
  const ray=new THREE.Raycaster(new THREE.Vector3(0,config.building.floorElevation+config.building.domeBaseHeight-.15,0),new THREE.Vector3(Math.cos(angle),0,Math.sin(angle)),0,ring+.4);
  const hit=ray.intersectObject(building.root,true)[0];
  assert.equal(hit?.object.name,'rotunda-upper-drum');
  assert(Math.abs(hit.distance-ring)<.003,'upper rotunda must follow one circular radius');
 }
 const signs=[];building.root.traverse(o=>{if(o.name==='entrance-sign')signs.push(o);});assert.equal(signs.length,6);
 for(const sign of signs){assert.equal(sign.position.y,config.building.height+1.45);assert(sign.geometry.parameters.width>6.8);}
});

test('rotunda corner details stay behind the backs of frames across the full plaster face',()=>{
 const {wallClearanceM}=config.paintings;
 for(const wall of makeLayout(config).hangingWalls.filter(w=>w.hall==='center')){
  const n=new THREE.Vector3(wall.normal.x,0,wall.normal.z);
  for(const along of [.001,.025,.08,.16,wall.length-.16,wall.length-.08,wall.length-.025,wall.length-.001]){
   for(const y of [1.1,4,config.building.height-.3]){
    const start=new THREE.Vector3(wall.a.x+(wall.b.x-wall.a.x)*along/wall.length,config.building.floorElevation+y,
      wall.a.z+(wall.b.z-wall.a.z)*along/wall.length).addScaledVector(n,1);
    const hit=new THREE.Raycaster(start,n.clone().negate(),0,1.05).intersectObject(building.root,true)[0];
    assert(hit && hit.distance>=1-wallClearanceM-1e-5,`${wall.id} at ${along}, ${y}: ${hit?.object.name} projects ${1-hit?.distance}m`);
   }
  }
 }
});

test('the wooden plinth is flush across all gallery bays',()=>{
 const layout=makeLayout(config);
 for(const h of layout.halls)for(const side of [-1,1])for(let i=0;i<config.building.wallBays;i++){
   const z=i===0?h.start:h.start-.09+i*(h.length+.09)/config.building.wallBays;
   const p=layout.world(h,side*(h.width/2-1),z),d=layout.world(h,side,0);
   const hit=new THREE.Raycaster(new THREE.Vector3(p.x,config.building.floorElevation+.16,p.z),
     new THREE.Vector3(d.x,0,d.z),0,1).intersectObject(building.root,true).find(hit=>hit.object.name!=='entrance-surround');
   assert.equal(hit?.object.name,'gallery-wainscot');assert(Math.abs(hit.distance-.8)<1e-5);
 }
});

test('each gallery has a category-coloured entrance arch that meets the floor and rounds into the vault',()=>{
 const layout=makeLayout(config),base=config.building.floorElevation;
 for(const hall of layout.halls){
  const arch=building.root.getObjectByName('category-arch:'+hall.id);assert(arch);
  assert.equal(arch.children.length,1);
  assert.equal(arch.children[0].name,'entrance-surround');
  assert(arch.children[0].material.color.equals(entrancePaintColor(THREE,hall.color)));
  const bounds=new THREE.Box3().setFromObject(arch);
  assert.equal(bounds.min.y,base);
  assert(bounds.max.y<config.building.floorElevation+config.building.height+.2);
  for(const side of [-1,1])for(const y of [.05,.8,1]){
   const origin=layout.world(hall,side*(hall.width/2-.18),hall.start-.6);
   const forward=layout.world(hall,0,1);
   const ray=new THREE.Raycaster(new THREE.Vector3(origin.x,base+y,origin.z),new THREE.Vector3(forward.x,0,forward.z),0,2);
   assert.equal(ray.intersectObject(building.root,true)[0]?.object,arch.children[0]);
  }
  const position=arch.children[0].geometry.attributes.position;
  const edge=i=>new THREE.Vector3().fromBufferAttribute(position,i*4+1);
  for(let i=1;i<position.count/8-1;i++){
   const previous=edge(i).sub(edge(i-1)),next=edge(i+1).sub(edge(i));
   assert(previous.angleTo(next)<Math.PI/12,'the arch silhouette must turn gradually');
  }
 }
 assert.equal(config.building.chandelierClearance,undefined);
 assert.equal(config.building.height,7.09);
});

test('every gallery has an opal ceiling aperture instead of candle chandeliers, with no overlapping plaster',()=>{
 const panels=[];building.root.traverse(o=>{if(o.name==='diffuse-ceiling')panels.push(o);});
 assert.equal(panels.length,config.halls.length);
 assert.equal(new Set(panels.map(p=>p.material)).size,1,'opal panels share a material');
 for(const p of panels){
  assert.equal(p.material.transparent,true);assert(p.material.opacity>0 && p.material.opacity<1);
  assert.equal(p.material.depthWrite,false);assert.equal(p.material.toneMapped,false);
  p.geometry.computeBoundingBox();assert(p.geometry.boundingBox.max.y<=config.building.height+.00001);
 }
 const layout=makeLayout(config);
 for(const h of layout.halls){
  const p=layout.world(h,.4,h.start+h.length/2),y=config.building.floorElevation;
  const ray=new THREE.Raycaster(new THREE.Vector3(p.x,y+2,p.z),new THREE.Vector3(0,1,0),0,10);
  const hit=ray.intersectObject(building.root,true)[0];
  assert.equal(hit?.object.name,'diffuse-ceiling','central strip must replace the plaster, not sit beneath it');
  assert(Math.abs(hit.point.y-y-config.building.height)<.01);
 }
 const candleMeshes=[];building.roofs.traverse(o=>{if(o.material===materials.glow)candleMeshes.push(o);});
 assert.equal(candleMeshes.length,0);
});


test('diffusers have actual pane rebates and one shared static frost shader',()=>{
 const bars=[],panels=[];building.root.traverse(o=>{if(o.name==='diffuser-crossbar')bars.push(o);if(o.name==='diffuse-ceiling')panels.push(o);});
 assert(bars.length>config.halls.length*10);assert(bars.length<config.halls.length*25);
 const shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>'};
 panels[0].material.onBeforeCompile(shader);
 assert(shader.fragmentShader.includes('opalNoise'));assert(shader.fragmentShader.includes('fwidth'));
 assert(!shader.fragmentShader.includes('uniform float time'));assert(shader.vertexShader.includes('vOpalCoordinates=uv'));
});
