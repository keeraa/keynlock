import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { HOUSE_DEFAULTS, normalizeHouseConfig, createHouseModel, windowLayout } from '../modules/house-builder/index.js';

assert.equal(typeof createHouseModel,'function');
assert.ok(windowLayout(HOUSE_DEFAULTS));
assert.ok(normalizeHouseConfig({floors:3}).floors===3);
execFileSync(process.execPath,['scripts/export-house-module.mjs'],{stdio:'pipe'});
const exportPath=new URL('../exports/keynlock-house-builder/',import.meta.url);
const api=await import(new URL('modules/house-builder/index.js',exportPath));
assert.equal(api.HOUSE_DEFAULTS.floors,HOUSE_DEFAULTS.floors);
await stat(new URL('assets/house-textures/gouache-roof-tiles-dense-v3.webp',exportPath));
assert(!(await readdir(new URL('assets/house-textures/',exportPath))).includes('gouache-roof-tiles-finer-v2.webp'),
  'Standalone export should ship only the active painted textures');
await stat(new URL('vendor/three.js',exportPath));
const page=await readFile(new URL('house-builder/index.html',exportPath),'utf8');
assert.match(page,/modules\/house-builder\/editor\.js/);
assert.match(page,/data-standalone-house/);
assert.doesNotMatch(page,/street-lab|landmark-lab|path-builder/);
for(const file of ['css/editor-visual.css','js/effects/editor-visual.js',
  'js/effects/cartoon-filter.js','js/effects/drawing-shader.js','assets/cormorant-garamond-cyrillic.woff2']){
  await stat(new URL(file,exportPath));
}
await import(new URL('js/effects/editor-visual.js',exportPath));
console.log('Portable house builder: model API, textures, vendor and standalone page OK');
