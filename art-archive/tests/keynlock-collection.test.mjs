import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {sceneCatalog} from '../catalog/load-catalog.js';
import {frameFootprint,footprintsOverlap} from '../catalog/painting-geometry.js';
import {makeLayout} from '../src/architecture/layout.js';
import {arrangeExhibition} from '../src/paintings/exhibition.js';
const root=new URL('../',import.meta.url);
const read=path=>JSON.parse(readFileSync(new URL(path,root)));

test('Keynlock works retain a separate collection, provenance and game-world approval',()=>{
 const manifest=read('catalog/manifest.json'),collection=read('catalog/collections/keynlock.json');
 const catalog=sceneCatalog(manifest,new URL('catalog/manifest.json',root));
 assert.equal(collection.paintingIds.length,17);
 const works=collection.paintingIds.map(id=>catalog.get(id));
 assert.equal(new Set(works.map(p=>p.importSource.sha256)).size,works.length);
 for(const work of works){
  assert.equal(work.collection,'keynlock');assert.equal(work.censorship.status,'approved');
  assert.equal(work.censorship.context,'fictional_game_world');
  assert.equal(work.rights.status,'user_provided');assert.equal(work.physicalSizeM.basis,'game_design');
  for(const path of [work.image.path,work.image.detail.path,work.importSource.original])assert(existsSync(new URL('catalog/'+path,root)));
  assert(work.image.overviewCell>0);assert(work.image.detail.widthPx>1000);
 }
 const config=read('config/scene.json');
 const exhibition=arrangeExhibition({...manifest,paintings:works},{},makeLayout(config),config.paintings);
 const slots=exhibition.slots(0);
 assert.equal(slots.length,works.length,'all collection works can be used in the existing scene');
 assert(slots.every(slot=>slot.floorAngle!==undefined&&slot.supportId.startsWith('table-')));
 assert.equal(new Set(slots.map(slot=>slot.supportId)).size,6);
 for(const [i,first] of slots.entries())for(const second of slots.slice(i+1))
  if(first.supportId===second.supportId)assert(!footprintsOverlap(frameFootprint(first,config.paintings),frameFootprint(second,config.paintings)));
});

test('collection search and selection export preserve all collection works and their censorship labels',async()=>{
 const {runInNewContext}=await import('node:vm');
 const manifest=read('catalog/manifest.json'),browser=new EventTarget();
 browser.editorCatalog=manifest.paintings.map(p=>({...p,rights:p.rights.status,gamePlacement:p.placement}));
 const context={window:browser,localStorage:{getItem:()=>null},initialSelection:{},document:{querySelector:()=>null},GAME_HALLS:manifest.halls.map(h=>({...h,walls:h.walls.map(w=>[w.id,w.title])}))};
 const core=readFileSync(new URL('catalog/editor/core.js',root),'utf8'),exporter=readFileSync(new URL('catalog/editor/import-export.js',root),'utf8');
 const result=runInNewContext(core+'\n'+exporter+`\n({exported:exportSelection().paintings.filter(p=>p.collection==='keynlock'),matches:data.filter(p=>searchIndex.get(p.id).includes('кеййнлок')).map(p=>p.id)})`,context);
 const {paintingIds}=read('catalog/collections/keynlock.json');
 assert.equal(result.exported.length,paintingIds.length);assert.equal(result.matches.length,paintingIds.length);
 for(const work of result.exported){assert.equal(work.censorship_status,'approved');assert.equal(work.rights_status,'user_provided');}
});
