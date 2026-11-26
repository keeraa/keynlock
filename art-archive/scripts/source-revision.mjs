import {readdir,stat} from 'node:fs/promises';
import {join} from 'node:path';
// Reading assets and refreshing Git's index may emit filesystem notifications.
// Only additions, removals, size or modification-time changes require a rebuild.
export async function sourceRevision(root,inputs){
 const entries=[];
 async function walk(path){
  let info;try{info=await stat(join(root,path));}catch(error){if(error.code==='ENOENT'){entries.push(path+':missing');return;}throw error;}
  if(info.isDirectory())for(const name of (await readdir(join(root,path))).sort())await walk(path+'/'+name);
  else entries.push(path+':'+info.size+':'+info.mtimeMs);
 }
 for(const path of inputs)await walk(path);
 return entries.join('\n');
}
