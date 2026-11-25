import {watch} from 'node:fs';
import {build,buildInputs} from './build.mjs';
const root=new URL('../',import.meta.url);await build();await import('../serve.mjs');
let timer,building=false,pending=false;
async function rebuild(){if(building){pending=true;return;}building=true;try{await build();console.log('Rebuilt dist; refresh the browser.');}catch(error){console.error('Build failed:',error);}finally{building=false;if(pending){pending=false;void rebuild();}}}
for(const path of buildInputs)watch(new URL(path,root),{recursive:path!=='index.html'},()=>{clearTimeout(timer);timer=setTimeout(rebuild,100);});
