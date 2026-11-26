import {readFile,writeFile,cp,rm,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {buildHosted} from './build-hosted.mjs';
const project=new URL('../',import.meta.url);
export async function releaseHashes(directory){
 const hashes={};
 async function walk(relative=''){
  const entries=await readdir(join(directory,relative),{withFileTypes:true});
  for(const entry of entries.sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)){
   const path=relative?relative+'/'+entry.name:entry.name;
   if(path==='release-manifest.json')continue;
   if(entry.isDirectory())await walk(path);
   else if(entry.isFile())hashes[path]=createHash('sha256').update(await readFile(join(directory,path))).digest('hex');
   else throw Error('Unexpected release entry: '+path);
  }
 }
 await walk();return hashes;
}
export async function buildRelease(output,{buildId}={}){
 if(!/^[0-9a-f]{40}$/.test(buildId??''))throw Error('Release requires a full source commit SHA');
 const policy=JSON.parse(await readFile(new URL('config/release.json',project),'utf8'));
 if(policy.detailImages!=='github-immutable'||!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(policy.repository))throw Error('Unsupported release asset policy');
 await buildHosted(output,{buildId});
 await cp(new URL('drizzle/',project),join(output,'drizzle'),{recursive:true});
 const manifestPath=join(output,'client/catalog/manifest.json');
 const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
 const base=policy.repository.replace('https://github.com/','https://raw.githubusercontent.com/')+'/'+buildId+'/art-archive/catalog/';
 let externalized=0;
 for(const painting of manifest.paintings){
  const detail=painting.image?.detail;
  if(detail?.path?.startsWith('detail/')){
   await readFile(resolve(output,'client/catalog',detail.path));
   detail.path=base+detail.path;externalized++;
  }
 }
 await writeFile(manifestPath,JSON.stringify(manifest));
 await rm(join(output,'client/catalog/detail'),{recursive:true,force:true});
 await writeFile(join(output,'release.json'),JSON.stringify({schemaVersion:1,game:'art-archive',commit:buildId,repository:policy.repository,externalizedDetails:externalized,detailImages:policy.detailImages},null,2)+'\n');
 await writeFile(join(output,'release-manifest.json'),JSON.stringify({commit:buildId,files:await releaseHashes(output)},null,2)+'\n');
 return {commit:buildId,externalizedDetails:externalized};
}
export async function verifyRelease(output){
 const manifest=JSON.parse(await readFile(join(output,'release-manifest.json'),'utf8'));
 const actual=await releaseHashes(output),expected=manifest.files;
 const keys=Object.keys(actual);
 if(keys.length!==Object.keys(expected).length||keys.some(path=>actual[path]!==expected[path]))throw Error('Release contents do not match release-manifest.json');
 const info=JSON.parse(await readFile(join(output,'client/build-info.json'),'utf8'));
 if(info.build!==manifest.commit)throw Error('Release build identity mismatch');
 for(const path of ['.openai/hosting.json','server/index.js','server/wrangler.json','drizzle/0000_playtest.sql'])if(!actual[path])throw Error('Missing release file: '+path);
 return {commit:manifest.commit,files:keys.length};
}
