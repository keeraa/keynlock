import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const pub=fileURLToPath(new URL('../public/',import.meta.url));
const source=path=>readFileSync(join(pub,path),'utf8');

test('a host scene can import the workbench without starting the standalone app',async()=>{
  const {mountWorkbench}=await import('../public/js/workbench-mount.js');
  assert.equal(typeof mountWorkbench,'function');
  await assert.rejects(mountWorkbench(null),TypeError);
  assert.match(source('js/main.js'),/createWorkbenchApp\(/);
  assert.doesNotMatch(source('js/workbench-app.js'),/addEventListener\('beforeunload'/);
  assert.match(source('js/workbench-mount.js'),/attachShadow\(\{mode:'open'\}\)/);
  assert.match(source('style.css'),/:host \.app\{/);
});

test('key, assembly, gears, mechanism and casket have separate controller boundaries',()=>{
  const app=source('js/workbench-app.js');
  for(const mode of ['key','assembly','gears','mechanism','code']){
    assert.ok(existsSync(join(pub,`js/modes/${mode}-mode.js`)),mode);
    assert.match(app,new RegExp(`${mode}:\\{index:`));
  }
  assert.match(app,/modes\[state\.mode\]\.leave\(\)/);
  assert.match(app,/modes\[state\.mode\]\.enter\(\)/);
  assert.match(app,/hostListeners\)node\.removeEventListener/);
  assert.doesNotMatch(app,/document\.body\.classList/);
  assert.match(source('js/modes/mechanism-mode.js'),/if\(!instance\)/,
    'the heavy mechanism sandbox must initialize lazily');
});

test('all JavaScript imports resolve locally, independent of any host import map',()=>{
  function files(folder){
    return readdirSync(folder,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?
      files(join(folder,entry.name)):[join(folder,entry.name)]);
  }
  const modules=files(join(pub,'js')).concat(files(join(pub,'vendor')))
    .filter(path=>path.endsWith('.js'));
  for(const file of modules){
    const text=readFileSync(file,'utf8');
    for(const match of text.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g)){
      const before=text.slice(text.lastIndexOf('\n',match.index)+1,match.index).trim();
      if(before.startsWith('*')||before.startsWith('//'))continue;
      const specifier=match[1];
      assert.ok(specifier.startsWith('.'),`${file} uses bare import ${specifier}`);
      assert.ok(existsSync(resolve(dirname(file),specifier)),`${file}: ${specifier} missing`);
    }
  }
  assert.doesNotMatch(source('index.html'),/type="importmap"/);
  for(const name of ['painted-gear','painted-pin','painted-brass','painted-steel'])
    assert.ok(existsSync(join(pub,`assets/${name}.webp`)));
});
