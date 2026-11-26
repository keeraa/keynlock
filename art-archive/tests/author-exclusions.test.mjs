import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import {createAuthorExclusions} from '../scripts/author-exclusions.mjs';
import {preserveAuthorExclusion} from '../src/persistence/author-exclusions.js';

test('F exclusions reach the next build, survive server restart and keep existing author choices',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'archive-exclusions-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const paths={selectionFile:join(dir,'selection.json'),manifestFile:join(dir,'manifest.json'),builtSelectionFile:join(dir,'built.json')};
 const original={selectionRevision:5,included:{'ART-0002':false},curatedExclusions:['ART-0871'],placements:{'ART-0002':'stories/religion'}};
 await writeFile(paths.selectionFile,JSON.stringify(original));
 await writeFile(paths.manifestFile,JSON.stringify({paintings:[{id:'ART-1278'},{id:'ART-1268'}]}));
 async function request(handler,id,origin='http://127.0.0.1:4187'){
  const req=Object.assign(Readable.from([JSON.stringify({id})]),{method:'POST',headers:{host:'127.0.0.1:4187',origin}});
  const res={writeHead(status){this.status=status;return this;},end(){}};
  await handler(req,res);return res.status;
 }
 const handler=createAuthorExclusions(paths);
 assert.equal(await request(handler,'ART-1278','https://other.example'),403);
 assert.equal(await readFile(paths.selectionFile,'utf8'),JSON.stringify(original));
 assert.equal(await request(handler,'ART-1278'),200);
 // A restarted server merges with the disk copy, not an obsolete in-memory seed.
 assert.equal(await request(createAuthorExclusions(paths),'ART-1268'),200);
 const saved=JSON.parse(await readFile(paths.selectionFile,'utf8'));
 assert.deepEqual(saved.curatedExclusions,['ART-0871','ART-1268','ART-1278']);
 assert.equal(saved.selectionRevision,7);assert.deepEqual(saved.placements,original.placements);assert.deepEqual(saved.included,original.included);
 assert.deepEqual(JSON.parse(await readFile(paths.builtSelectionFile,'utf8')),saved);
 assert.equal(await request(handler,'ART-1278'),200);
 assert.equal(JSON.parse(await readFile(paths.selectionFile,'utf8')).selectionRevision,7);
});

test('only the local author preview sends an exclusion to the project server',async t=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'location');
 t.after(()=>{if(previous)Object.defineProperty(globalThis,'location',previous);else delete globalThis.location;});
 Object.defineProperty(globalThis,'location',{value:{hostname:'archive.example'},configurable:true});
 const calls=[];t.mock.method(globalThis,'fetch',async(...args)=>{calls.push(args);return {ok:true};});
 assert.equal(await preserveAuthorExclusion('ART-1278'),null);assert.equal(calls.length,0);
 globalThis.location.hostname='127.0.0.1';assert.equal(await preserveAuthorExclusion('ART-1278'),true);
 assert.equal(calls[0][0],'/__authoring/exclusions');assert.deepEqual(JSON.parse(calls[0][1].body),{id:'ART-1278'});
});
