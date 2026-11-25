import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from '../scripts/build.mjs';
const root=new URL('../',import.meta.url);
async function files(dir){const result=[];for(const entry of await fs.readdir(dir,{withFileTypes:true})){const url=new URL(entry.name+(entry.isDirectory()?'/':''),dir);if(entry.isDirectory())result.push(...await files(url));else result.push(url);}return result;}
test('generated modules exactly match source and all relative imports resolve',async t=>{
 const temp=await fs.mkdtemp(join(tmpdir(),'keynlock-build-test-'));
 t.after(()=>fs.rm(temp,{recursive:true,force:true}));
 const dist=join(temp,'dist');
 await build(dist);
 const bundle=pathToFileURL(dist+sep);
 const source=new URL('src/',root),output=new URL('js/',bundle),sources=await files(source),built=await files(output);
 assert.equal(built.length,sources.length);
 for(const url of sources){const relative=url.href.slice(source.href.length),generated=new URL(relative,output),text=await fs.readFile(url,'utf8');assert.equal(await fs.readFile(generated,'utf8'),text,relative);
  for(const match of text.matchAll(/(?:from\s+|import\s*)['"](\.[^'"]+)['"]/g))await fs.access(new URL(match[1],generated));
 }
 const html=await fs.readFile(new URL('index.html',bundle),'utf8');assert(html.includes('./js/app/bootstrap.js'));assert(html.includes('./styles/index.css'));
 await fs.access(new URL('config/scene.json',bundle));assert.equal((await fs.readFile(new URL('config/scene.json',bundle),'utf8')),await fs.readFile(new URL('config/scene.json',root),'utf8'));
});
test('public scene dependency graph contains no standalone host or second Three.js import',async()=>{
 const seen=new Set();async function walk(url){if(seen.has(url.href))return;seen.add(url.href);const text=await fs.readFile(url,'utf8');
  assert(!/new THREE.WebGLRenderer|requestAnimationFrame|localStorage|document\.getElementById/.test(text),url.pathname);
  for(const match of text.matchAll(/(?:from\s+|import\s*)['"](\.[^'"]+)['"]/g)){assert(!/vendor\/three\.js/.test(match[1]),url.pathname);const dependency=new URL(match[1],url);assert(!dependency.pathname.includes('/src/app/'),dependency.pathname);assert(!dependency.pathname.includes('/src/ui/'),dependency.pathname);await walk(dependency);}
 }
 await walk(new URL('src/scene/create-scene.js',root));assert(seen.size>15);
});
