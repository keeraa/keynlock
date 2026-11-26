import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,utimes,stat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sourceRevision} from '../scripts/source-revision.mjs';
test('development rebuilds ignore access-only notifications but detect edits, additions and removal',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'art-watch-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const file=join(dir,'source.js');await writeFile(file,'one');await utimes(file,new Date(),new Date(1700000000000));const a=await sourceRevision(dir,['source.js','new.js']),info=await stat(file);
 await utimes(file,new Date(Date.now()+10000),info.mtime);assert.equal(await sourceRevision(dir,['source.js','new.js']),a);
 await writeFile(file,'longer');const b=await sourceRevision(dir,['source.js','new.js']);assert.notEqual(b,a);
 await writeFile(join(dir,'new.js'),'new');const c=await sourceRevision(dir,['source.js','new.js']);assert.notEqual(c,b);
 await rm(file);assert.notEqual(await sourceRevision(dir,['source.js','new.js']),c);
});
