import {resolveBuildId} from './build-id.mjs';
import {cp,mkdtemp,rename,rm,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join,resolve} from 'node:path';
import {syncArchiveMusic} from './sync-music.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const inputs={src:'js',styles:'styles',config:'config',assets:'assets',catalog:'catalog',vendor:'vendor','index.html':'index.html'};
export const buildInputs=Object.keys(inputs);

export async function build(output=resolve(root,'dist'),{buildId=resolveBuildId()}={}){
 await syncArchiveMusic();
 const stage=await mkdtemp(join(dirname(output),'.build-'));
 const next=join(stage,'next'),previous=join(stage,'previous');
 let keepBackup=false;
 try{
  for(const [source,target] of Object.entries(inputs)){
   await cp(resolve(root,source),join(next,target),{recursive:true});
  }
  const schema=join(next,'js/playtest/schema.js');
  await writeFile(schema,(await readFile(schema,'utf8')).replace(/export const PLAYTEST_BUILD=.*?;/,'export const PLAYTEST_BUILD='+JSON.stringify(buildId)+';'));
  await writeFile(join(next,'build-info.json'),JSON.stringify({game:'art-archive',build:buildId})+'\n');
  let hadPrevious=false;
  try{await rename(output,previous);hadPrevious=true;}
  catch(error){if(error.code!=='ENOENT')throw error;}
  try{await rename(next,output);}
  catch(error){
   if(hadPrevious){
    try{await rename(previous,output);}
    catch(restoreError){
     keepBackup=true;
     throw new AggregateError([error,restoreError],'Build failed. Prior output retained at '+previous);
    }
   }
   throw error;
  }
 }finally{
  if(!keepBackup)await rm(stage,{recursive:true,force:true});
 }
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 await build();
 console.log('Built art-archive/dist');
}
