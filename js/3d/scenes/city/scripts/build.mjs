import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {ACTIVE_GOUACHE_FILES} from '../modules/keynlock-materials/index.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=resolve(root,'dist');
// dist/ is reproducible output, so stale assets cannot survive a rebuild.
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
for(const item of ['index.html','css','js','vendor','modules','house-builder','street-lab','landmark-lab','path-builder']) {
  await cp(resolve(root,item),resolve(output,item),{recursive:true,force:true});
}
await mkdir(resolve(output,'assets'),{recursive:true});
await cp(resolve(root,'assets/cormorant-garamond-cyrillic.woff2'),
  resolve(output,'assets/cormorant-garamond-cyrillic.woff2'));
await cp(resolve(root,'assets/map'),resolve(output,'assets/map'),{recursive:true,force:true});
for(const name of ACTIVE_GOUACHE_FILES){
  const destination=resolve(output,'assets',name);
  await mkdir(dirname(destination),{recursive:true});
  await cp(resolve(root,'assets',name),destination);
}
console.log(`Static build ready in dist/ (${ACTIVE_GOUACHE_FILES.length} active gouache assets)`);
