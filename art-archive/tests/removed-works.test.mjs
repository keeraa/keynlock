import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {makeLayout} from '../src/architecture/layout.js';
import {arrangeExhibition} from '../src/paintings/exhibition.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url)));
test('user-removed oversize works have no catalog entries, bundled images or active import links',()=>{
 const manifest=read('catalog/manifest.json'),removed=read('catalog/removed-works.json'),plan=read('catalog/atelier-import.json');
 assert.equal(removed.works.length,6);assert.equal(manifest.count,manifest.paintings.length);
 for(const {id} of removed.works){
  assert(!manifest.paintings.some(p=>p.id===id));assert(!plan.additions.some(p=>p.id===id));
  assert(!Object.values(plan.links).some(p=>p.archiveId===id));
  for(const folder of ['images','detail'])assert(!fs.existsSync(new URL('../catalog/'+folder+'/'+id+'.webp',import.meta.url)));
 }
 const config=read('config/scene.json'),e=arrangeExhibition(manifest,read('catalog/initial-selection.json'),makeLayout(config),config.paintings);
 assert(![...e.reserveReasons.values()].includes('oversize'));
 assert(e.byId.has('ART-1826'),'The Last Supper still fits and remains available');
});
