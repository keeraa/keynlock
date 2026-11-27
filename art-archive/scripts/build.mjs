import {cp,mkdir,rename,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
// Only generated folders are replaced. All editable files live outside dist.
export async function build(){
 const stage=resolve(root,'.build-'+process.pid),dist=resolve(root,'dist'),old=resolve(root,'.previous-build-'+process.pid);
 await rm(stage,{recursive:true,force:true});await mkdir(stage);
 try{
  for(const [source,target]of [['src','js'],['styles','styles'],['config','config'],['assets','assets'],['catalog','catalog'],['vendor','vendor'],['index.html','index.html']])await cp(resolve(root,source),resolve(stage,target),{recursive:true});
  await rm(old,{recursive:true,force:true});
  try{await rename(dist,old);}catch(error){if(error.code!=='ENOENT')throw error;}
  try{await rename(stage,dist);}catch(error){try{await rename(old,dist);}catch{}throw error;}
  await rm(old,{recursive:true,force:true});
 }finally{await rm(stage,{recursive:true,force:true});}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){await build();console.log('Built art-archive/dist');}
