import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=resolve(root,'dist');
// dist/ is reproducible output, so stale assets cannot survive a rebuild.
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
for(const item of ['index.html','css','js','vendor','house-builder','street-lab','landmark-lab']) {
  await cp(resolve(root,item),resolve(output,item),{recursive:true,force:true});
}
await mkdir(resolve(output,'assets'),{recursive:true});
await cp(resolve(root,'assets/cormorant-garamond-cyrillic.woff2'),
  resolve(output,'assets/cormorant-garamond-cyrillic.woff2'));
await cp(resolve(root,'assets/house-textures'),resolve(output,'assets/house-textures'),{recursive:true});
console.log('Static build ready in dist/');
