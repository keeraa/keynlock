#!/usr/bin/env node
/**
 * Import explicitly approved CC0 Poly Haven glTF assets for the KEYNLOCK model library.
 * Dependency filenames and folder structure are taken from Poly Haven's public API;
 * triangle counts are verified against the uploaded 2K archives before publishing.
 * Run at repository root: node scripts/import-approved-polyhaven-models.mjs
 */
import {mkdir,readFile,writeFile,stat} from 'node:fs/promises';
import path from 'node:path';

const ROOT=process.cwd();
const MANIFEST='js/3d/shared/models/polyhaven-imports.json';
const USER_AGENT='KEYNLOCK-asset-library/1.0 (+https://github.com/keeraa/keynlock)';
const options={headers:{'User-Agent':USER_AGENT,'Accept':'application/json, application/octet-stream'}};
const manifest=JSON.parse(await readFile(MANIFEST,'utf8'));
function safeRel(input){
  const name=String(input).replace(/\\/g,'/');
  if(!name||name.startsWith('/')||name.split('/').includes('..')||name.includes('\\0'))
    throw new Error('Invalid asset path: '+input);
  return name;
}
async function get(url){
  const response=await fetch(url,options);
  if(!response.ok)throw new Error(`Download ${response.status}: ${url}`);
  return Buffer.from(await response.arrayBuffer());
}
function countTriangles(glTF){
  return (glTF.meshes||[]).reduce((sum,mesh)=>
    sum+(mesh.primitives||[]).reduce((n,primitive)=>{
      if((primitive.mode??4)!==4)throw new Error('Unexpected GLTF primitive type');
      const i=primitive.indices;
      const count=i===undefined
        ?glTF.accessors[primitive.attributes.POSITION]?.count
        :glTF.accessors[i]?.count;
      if(!Number.isInteger(count)||count%3)throw new Error('Invalid glTF triangle indices');
      return n+count/3;
    },0),0);
}
async function exists(file){try{await stat(file);return true;}catch{return false;}}
for(const asset of manifest.models){
  const folder=path.resolve(ROOT,'js/3d/shared/models/assets',safeRel(asset.id));
  const file=path.join(folder,safeRel(asset.gltfFile));
  if(await exists(file)){console.log('Already present:',asset.id);continue;}
  const api='https://api.polyhaven.com/files/'+encodeURIComponent(asset.sourceId);
  const meta=JSON.parse((await get(api)).toString('utf8'));
  const main=meta.gltf?.['2k']?.gltf;
  if(!main?.url)throw new Error('No 2K glTF source for '+asset.sourceId);
  const body=await get(main.url);
  const parsed=JSON.parse(body.toString('utf8'));
  const count=countTriangles(parsed);
  if(count!==asset.triangles)throw new Error(
    `Triangle mismatch ${asset.id}: expected ${asset.triangles}, got ${count}`);
  // The API's include map contains the GLTF's external .bin and image files.
  // Resolve against declared glTF URIs, not guessed CDN paths.
  const included=Object.entries(main.include||{});
  const required=[
    ...(parsed.buffers||[]).map(x=>x.uri),
    ...(parsed.images||[]).map(x=>x.uri).filter(Boolean)
  ];
  const dependencyFiles=[];
  for(const uri of required){
    safeRel(uri);
    if(uri.startsWith('data:'))continue;
    const dep=included.find(([name,item])=>name===uri||name.endsWith('/'+uri)||
      (item.url&&decodeURIComponent(new URL(item.url).pathname).endsWith('/'+uri)));
    if(!dep?.[1]?.url)throw new Error('Missing API dependency '+uri+' for '+asset.sourceId);
    dependencyFiles.push([uri,await get(dep[1].url)]);
  }
  await mkdir(folder,{recursive:true});
  for(const [uri,data] of dependencyFiles){
    const destination=path.join(folder,uri);
    await mkdir(path.dirname(destination),{recursive:true});
    await writeFile(destination,data);
  }
  await writeFile(file,body);
  console.log('Imported',asset.id,count,'triangles,',dependencyFiles.length,'dependencies');
}
