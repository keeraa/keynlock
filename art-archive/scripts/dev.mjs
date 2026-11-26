import {watch} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {build,buildInputs} from './build.mjs';
import {sourceRevision} from './source-revision.mjs';
const root=new URL('../',import.meta.url),directory=fileURLToPath(root);
await build();await import('../serve.mjs');
let revision=await sourceRevision(directory,buildInputs),timer,building=false,pending=false;
async function rebuild(){
 if(building){pending=true;return;}building=true;
 try{
  const next=await sourceRevision(directory,buildInputs);
  if(next===revision)return;
  await build();revision=await sourceRevision(directory,buildInputs);console.log('Rebuilt dist; refresh the browser.');
 }catch(error){console.error('Build failed:',error);}
 finally{building=false;if(pending){pending=false;void rebuild();}}
}
for(const path of buildInputs)watch(new URL(path,root),{recursive:path!=='index.html'},()=>{clearTimeout(timer);timer=setTimeout(rebuild,100);});
