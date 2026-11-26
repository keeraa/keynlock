import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,rm,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {releaseHashes,verifyRelease} from '../scripts/release-build.mjs';
import {prepareRelease} from '../scripts/prepare-release.mjs';
const sha='a'.repeat(40);
test('release verification detects tampering, extra files and a mismatched build identity',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'art-release-contract-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const entries={'.openai/hosting.json':'{}','server/index.js':'// worker','server/wrangler.json':'{}','drizzle/0000_playtest.sql':'-- schema','client/build-info.json':JSON.stringify({build:sha})};
 for(const [path,text] of Object.entries(entries)){await mkdir(join(dir,path,'..'),{recursive:true});await writeFile(join(dir,path),text);}
 const seal=async()=>writeFile(join(dir,'release-manifest.json'),JSON.stringify({commit:sha,files:await releaseHashes(dir)}));
 await seal();assert.equal((await verifyRelease(dir)).commit,sha);
 await writeFile(join(dir,'extra.txt'),'unexpected');await assert.rejects(verifyRelease(dir),/contents/);await rm(join(dir,'extra.txt'));
 await writeFile(join(dir,'server/index.js'),'changed');await assert.rejects(verifyRelease(dir),/contents/);
 await writeFile(join(dir,'client/build-info.json'),JSON.stringify({build:'other'}));await seal();await assert.rejects(verifyRelease(dir),/identity/);
});
test('release output cannot overwrite the source tree',async()=>{
 await assert.rejects(prepareRelease({output:new URL('../',import.meta.url).pathname}),/outside the source repository/);
});
