import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sceneCatalog} from '../catalog/load-catalog.js';
import {makeLayout} from '../src/architecture/layout.js';
import {arrangeExhibition} from '../src/paintings/exhibition.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url)));
const plan=read('catalog/atelier-import.json'),manifest=read('catalog/manifest.json');
const config=read('config/scene.json'),catalog=sceneCatalog(manifest,new URL('../catalog/manifest.json',import.meta.url));

test('dimension registry covers every imported ID, preserves uncertainty and converts centimetres to metres',()=>{
 const audit=read('catalog/atelier-dimensions.json');
 assert.equal(Object.keys(audit.works).length,141);
 assert.equal(plan.additions.filter(p=>p.physicalSizeM).length,135);
 const unresolved=[];
 for(const entry of plan.additions){
  const a=audit.works[entry.atelierId],p=catalog.get(entry.id);
  assert.equal(a.archiveId,entry.id);assert(a.source.startsWith('https://'));
  assert.deepEqual(p.physicalSizeM,entry.physicalSizeM);
  if(a.status==='unresolved'){
   unresolved.push(entry.atelierId);assert.equal(p.physicalSizeM,null);
   assert.equal(a.heightCm,null);assert.equal(a.widthCm,null);assert(a.note.length>50);
  }else{
   assert(a.heightCm>0 && a.widthCm>0);
   assert(Math.abs(p.physicalSizeM.height-a.heightCm/100)<1e-7);
   assert(Math.abs(p.physicalSizeM.width-a.widthCm/100)<1e-7);
   assert.equal(p.physicalSizeM.verification,a.status);
  }
 }
 assert.deepEqual(unresolved.sort(),['birth-krishna','flowers-birds-minhwa','galaxy-musicians','india-milkmaid','qianlong-hunt','tiger-magpie']);
});

test('dimensions belong to the identified version and replacement scrolls cannot fetch the wrong Atelier image',()=>{
 const get=id=>catalog.get(plan.links[id].archiveId);
 assert.equal(get('anatomy-lesson').physicalSizeM.height,1.695);
 assert.equal(get('judith-holofernes').physicalSizeM.height,1.588);
 assert.equal(get('salisbury-cathedral').physicalSizeM.width,1.92);
 assert.equal(get('isle-dead').year,'1880');assert.equal(get('isle-dead').physicalSizeM.height,1.11);
 assert.match(get('rex').title,/Andante/);assert.equal(get('rex').physicalSizeM.height,.731);
 for(const id of ['lakshmi','murugan']){assert.match(get(id).title,/chromolithograph/);assert.equal(get(id).physicalSizeM.basis,'sheet');}
 for(const id of ['court-ladies','han-palace']){
  const p=get(id);assert(p.image.sourceUrl.includes('commons.wikimedia.org'));
  assert.equal(p.image.hdUrl,undefined);assert.equal(p.image.detail.originalUrl,undefined);
  assert(p.importSource.originalAtelierImage.startsWith('assets/restoration/'));
  assert.equal(p.image.sizeMatch,'needs_review');
 }
});

test('every Atelier work has a stable archive link, existing works are reused and additions have offline reproductions',()=>{
 assert.equal(Object.keys(plan.links).length,160);
 assert.equal(plan.additions.length,141);
 assert.equal(manifest.count,1160);assert.equal(new Set(manifest.paintings.map(p=>p.id)).size,manifest.count);
 for(const [atelierId,link] of Object.entries(plan.links)){
  const work=catalog.get(link.archiveId);assert(work,atelierId);assert(work.atelierIds.includes(atelierId));
 }
 assert.equal(plan.links['rococo-bolt'].archiveId,'ART-1591');
 assert.equal(plan.links['starry-night'].archiveId,'ART-1518');
 assert.notEqual(plan.links['rococo-swing'].archiveId,'ART-0541');
 assert.notEqual(plan.links['oedipus-sphinx'].archiveId,'ART-1581');
 assert.notEqual(plan.links['magritte-lovers'].archiveId,'ART-0878');
 for(const entry of plan.additions){
  const work=catalog.get(entry.id),image=work.image;
  for(const path of [image.path,image.detail.path])assert(fs.existsSync(new URL('../catalog/'+path,import.meta.url)),path);
  assert.equal(image.fit,'contain');assert.equal(work.importSource.id,entry.atelierId);
  assert(Number.isInteger(image.overviewCell));assert(image.overviewCell>0 && image.overviewCell<manifest.overviewAtlas.columns*manifest.overviewAtlas.rows);
  assert(image.detail.widthPx>=image.widthPx && image.detail.heightPx>=image.heightPx);
 }
});

test('measured Atelier works participate in exhibitions while missing sizes and abstract works remain explicitly in reserve',()=>{
 const result=arrangeExhibition(catalog,read('catalog/initial-selection.json'),makeLayout(config),config.paintings);
 for(const entry of plan.additions){
  if(!entry.physicalSizeM){assert.equal(result.reserveReasons.get(entry.id),entry.placement.hall==='reserve'?'unassigned':'unmeasured');continue;}
  assert(entry.physicalSizeM.source.startsWith('https://'));
  assert(result.byId.has(entry.id) || ['unassigned','oversize','image'].includes(result.reserveReasons.get(entry.id)),entry.id);
 }
 for(const id of ['great-wave','girl-pearl','birth-venus','vangogh-self'])assert(result.byId.has(plan.links[id].archiveId),id);
});

test('locating an imported miniature below the rotunda arrives on its floor or tread, not above the ceiling',async()=>{
 const {paintingLocation}=await import('../src/player/painting-location.js');
 const {stairTreads}=await import('../src/architecture/stair-profile.js');
 const {createNavigation}=await import('../src/player/movement.js');
 const layout=makeLayout(config),nav=createNavigation(config,layout),camera={fov:73,aspect:1.5};
 const base={width:.3,height:.2,floorAngle:0,floorRoom:'center',wall:{hall:'cn'},normal:{x:0,z:1}};
 const lower=paintingLocation({...base,x:3.5,z:0,y:-config.building.stair.depth+.025,supportId:'lower-landing'},layout,config,camera);
 assert.equal(lower.floorY,-config.building.stair.depth);
 assert.equal(nav.floorAt(lower.x,lower.z,lower.floorY),lower.floorY);
 assert(lower.y<config.building.floorElevation);
 const tread=stairTreads(config.building.stair)[12],a=(tread.a+tread.b)/2;
 const step=paintingLocation({...base,x:Math.sin(a)*2.4,z:Math.cos(a)*2.4,y:tread.y+.025,supportId:'step-12'},layout,config,camera);
 assert.equal(step.floorY,tread.y);assert.equal(nav.floorAt(step.x,step.z,step.floorY),tread.y);
});
