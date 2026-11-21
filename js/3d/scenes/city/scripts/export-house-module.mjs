// Reproducible, dependency-limited export of the KEYNLOCK building editor.
// This script deliberately never copies world-map, terrain, streets or landmarks.
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {HOUSE_TEXTURE_DEFINITIONS,HOUSE_FALLBACK_TEXTURES,HOUSE_MOSS_TEXTURE} from '../modules/house-builder/core/house-texture-assets.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const exportRoot=resolve(root,'exports');
const target=resolve(exportRoot,'keynlock-house-builder');
await mkdir(exportRoot,{recursive:true});
await rm(target,{recursive:true,force:true});

const folders=['js/buildings','modules/house-builder','modules/keynlock-materials','house-builder'];
for(const folder of folders){
  await mkdir(resolve(target,dirname(folder)),{recursive:true});
  await cp(resolve(root,folder),resolve(target,folder),{recursive:true});
}
for(const file of ['js/effects/editor-visual.js','js/effects/cartoon-filter.js',
  'js/effects/drawing-shader.js','css/editor-visual.css','assets/cormorant-garamond-cyrillic.woff2']){
  await mkdir(resolve(target,dirname(file)),{recursive:true});
  await cp(resolve(root,file),resolve(target,file));
}
await mkdir(resolve(target,'assets/house-textures'),{recursive:true});
const usedTextures=new Set([...HOUSE_TEXTURE_DEFINITIONS.map(([,file])=>file),
  ...HOUSE_FALLBACK_TEXTURES.map(([,file])=>file),HOUSE_MOSS_TEXTURE]);
for(const file of usedTextures){
  await cp(resolve(root,'assets/house-textures',file),resolve(target,'assets/house-textures',file));
}
await mkdir(resolve(target,'vendor'),{recursive:true});
for(const file of ['three.js','three-core.js','OrbitControls.js']){
  await cp(resolve(root,'vendor',file),resolve(target,'vendor',file));
}

// Keep exported links entirely within the isolated package.
const pagePath=resolve(target,'house-builder/index.html');
const page=await readFile(pagePath,'utf8');
await writeFile(pagePath,page
  .replace('<html lang="ru">','<html lang="ru" data-standalone-house>')
  .replace(/\s*<a href="\.\.\/(?:street-lab|landmark-lab|path-builder)\/" class="back-button">[^<]*<\/a>/g,''));
await writeFile(resolve(target,'index.html'),`<!doctype html><html lang="ru"><meta charset="utf-8"><title>KEYNLOCK — Конструктор домов</title><meta http-equiv="refresh" content="0;url=./house-builder/"><script>location.replace('./house-builder/')</script><a href="./house-builder/">Открыть редактор</a></html>\n`);
await writeFile(resolve(target,'package.json'),JSON.stringify({
  name:'@keynlock/house-builder',version:'1.0.0',private:true,type:'module',
  description:'Portable Three.js house model and standalone visual editor',
  exports:{'.':'./modules/house-builder/index.js','./editor':'./modules/house-builder/editor.js'},
},null,2)+'\n');

const archive=resolve(exportRoot,'keynlock-house-builder.tar.gz');
execFileSync('tar',['-czf',archive,'-C',exportRoot,'keynlock-house-builder']);
console.log(`Standalone house editor: ${target}`);
console.log(`Portable archive: ${archive}`);
