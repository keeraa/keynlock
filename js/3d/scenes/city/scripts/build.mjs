import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {HOUSE_TEXTURE_DEFINITIONS,HOUSE_FALLBACK_TEXTURES,HOUSE_MOSS_TEXTURE} from '../modules/house-builder/core/house-texture-assets.js';
import {LANDMARK_TEXTURE_ASSETS} from '../js/landmarks/landmark-textures.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=resolve(root,'dist');
// dist/ is reproducible output, so stale assets cannot survive a rebuild.
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
for(const item of ['index.html','css','js','vendor','modules','house-builder','street-lab','landmark-lab']) {
  await cp(resolve(root,item),resolve(output,item),{recursive:true,force:true});
}
await mkdir(resolve(output,'assets'),{recursive:true});
await cp(resolve(root,'assets/cormorant-garamond-cyrillic.woff2'),
  resolve(output,'assets/cormorant-garamond-cyrillic.woff2'));
const productionTextures=new Set([
  ...HOUSE_TEXTURE_DEFINITIONS.map(([,file])=>file),
  ...HOUSE_FALLBACK_TEXTURES.map(([,file])=>file),
  HOUSE_MOSS_TEXTURE,
  ...Object.values(LANDMARK_TEXTURE_ASSETS),
]);
await mkdir(resolve(output,'assets/house-textures'),{recursive:true});
for(const name of productionTextures){
  await cp(resolve(root,'assets/house-textures',name),resolve(output,'assets/house-textures',name));
}
console.log(`Static build ready in dist/ (${productionTextures.size} active texture assets)`);
