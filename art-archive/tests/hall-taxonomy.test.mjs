import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {migrateDestination} from '../catalog/hall-taxonomy.js';
import {migrateSelection} from '../catalog/selection-migrations.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url)));
const manifest=read('catalog/manifest.json'),config=read('config/scene.json'),seed=read('catalog/initial-selection.json');

test('every catalog work and initial override targets a current thematic wall; historical scenes are separate from myths',()=>{
 assert.equal(config.halls.length,6);
 assert.deepEqual(config.halls.map(h=>h.title),['Восток','Предметы и места','Портреты','Природа','Люди и жизнь','Мифы и легенды']);
 const zones=new Set(manifest.halls.flatMap(h=>h.walls.map(w=>h.id+'/'+w.id)));
 for(const p of manifest.paintings)assert(zones.has(p.placement.hall+'/'+p.placement.wall),p.id);
 for(const key of Object.values(seed.placements))assert(zones.has(key));
 for(const p of manifest.paintings){
  const key=p.placement.hall+'/'+p.placement.wall;
  if(p.placement.hall==='jp')assert(['still','buildings','interiors'].includes(p.placement.wall));
  if(p.placement.hall==='stories')assert(['myths','religion'].includes(p.placement.wall));
  assert.equal(migrateDestination(key,p.id),key,'current default must be stable: '+p.id);
 }
 for(const id of ['ART-1539','ART-1586','ART-1750']){
  const p=manifest.paintings.find(p=>p.id===id);assert.deepEqual(p.placement,{hall:'world',wall:'history'});
 }
});

test('old editor choices and floor destinations migrate once while exclusions and valid manual choices survive',()=>{
 const key='keynlock-painting-archive-1500-v1',hang='keynlock-art-hanging-v1';
 const memory=new Map([[key,JSON.stringify({selectionRevision:1,included:{'ART-0001':false},placements:{'ART-0001':'portraits/men',japan:'jp/nature',still:'world/still',history:'stories/history'}})],
  [hang,JSON.stringify({japan:{kind:'floor',destination:'jp/nature',floorRoom:'jp',x:2,y:.025,z:30,faceDown:true},other:{version:3,wall:'nature/side/-1',along:3,y:2}})]]);
 const storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
 migrateSelection(storage,seed);
 const state=JSON.parse(memory.get(key)),poses=JSON.parse(memory.get(hang));
 assert.equal(state.included['ART-0001'],false);assert.equal(state.placements['ART-0001'],'portraits/men');
 assert.equal(state.placements.japan,'cn/nature');assert.equal(state.placements.still,'jp/still');assert.equal(state.placements.history,'world/history');
 assert.deepEqual(poses.japan,{kind:'floor',destination:'cn/nature',floorRoom:'jp',x:2,y:.025,z:30,faceDown:true});
 assert.deepEqual(poses.other,{version:3,wall:'nature/side/-1',along:3,y:2});
 state.placements.japan='world/life';memory.set(key,JSON.stringify(state));migrateSelection(storage,seed);
 assert.equal(JSON.parse(memory.get(key)).placements.japan,'world/life');
});
