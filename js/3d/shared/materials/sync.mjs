/** Sync deployment snapshots from the canonical KEYNLOCK gouache library.
 * Run at repository root: node js/3d/shared/materials/sync.mjs --check|--sync
 */
import {readFile,copyFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../../..');
const manifest=JSON.parse(await readFile(resolve(root,'js/3d/shared/materials/manifest.json'),'utf8'));
const mode=process.argv.includes('--sync')?'sync':'check';
const hash=data=>createHash('sha256').update(data).digest('hex');
let changed=0;
for(const material of manifest.materials){
  const canonical=resolve(root,material.path);
  const bytes=await readFile(canonical);
  for(const consumer of material.consumers){
    if(consumer===material.path)continue;
    const destination=resolve(root,consumer);
    let same=false;
    try{same=hash(await readFile(destination))===hash(bytes);}catch{}
    if(same)continue;
    changed++;
    if(mode==='sync'){
      await mkdir(dirname(destination),{recursive:true});
      await copyFile(canonical,destination);
      process.stdout.write('synced '+consumer+'\\n');
    }else process.stderr.write('out of sync '+consumer+'\\n');
  }
}
if(mode==='check'&&changed)process.exitCode=1;
else process.stdout.write(mode+': '+changed+' mirror(s) '+(mode==='check'?'out of sync':'updated')+'\\n');
