// Run against the actual built game. QA uses a fresh context and never a player's save.
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
const cwd=fileURLToPath(new URL('../../',import.meta.url));
let server,baseUrl;
before(async()=>{
 server=spawn(process.execPath,['serve.mjs'],{cwd,env:{...process.env,PORT:'4198'},stdio:['ignore','pipe','pipe']});
 baseUrl=await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('Preview did not start')),15000);server.once('error',reject);server.once('exit',code=>reject(Error('Preview exited '+code)));
  server.stdout.on('data',chunk=>{const match=chunk.toString().match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timer);resolve(match[0]);}});
 });
},{timeout:60000});
after(async()=>{if(server&&server.exitCode===null){server.kill();await once(server,'exit');}});
async function open(t,art){
 const browser=await chromium.launch({headless:true,args:['--enable-webgl','--mute-audio','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({locale:'ru-RU',viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{
  // Exercise the supported fallback used by embedded browsers. Pointer-lock
  // mouse movement must not turn the camera while clicking menu controls.
  HTMLCanvasElement.prototype.requestPointerLock=undefined;
  if(!localStorage.getItem('keynlock-art-archive-controls-v1'))localStorage.setItem('keynlock-art-archive-controls-v1',JSON.stringify({limitFps:true}));
 });
 t.after(async()=>{
  try{
   // A live software-WebGL frame can delay readback. Capture the stable pause
   // view, and always release GPU resources even if capture itself fails.
   if(!await page.locator('#pause').isVisible())await page.keyboard.press('p');
   await mkdir(new URL('../../test-results/',import.meta.url),{recursive:true});
   await writeFile(cwd+'/test-results/'+art+'.html',await page.content());
   await writeFile(cwd+'/test-results/'+art+'.errors.json',JSON.stringify(errors));
   // Freeze only after every gameplay assertion: let software WebGL finish the
   // last frame instead of queuing new frames while capture waits for readback.
   await page.evaluate(()=>{window.requestAnimationFrame=()=>0;});
   await page.screenshot({path:cwd+'/test-results/'+art+'.png',timeout:60000});
  }finally{await context.close();await browser.close();}
  assert.deepEqual(errors,[]);
 });
 await page.goto(baseUrl+'/?art='+art+'&playtest=qa',{waitUntil:'domcontentloaded'});
 await page.locator('#load-screen').waitFor({state:'hidden',timeout:180000});
 await page.locator('#painting-controls').getByText(/взять/).waitFor({timeout:30000});
 await page.locator('#scene').click({button:'right'});
 return page;
}
test('pause shows the exact build and preserves visual defaults without a retired depth control',{timeout:240000},async t=>{
 const page=await open(t,'ART-1586');
 await page.keyboard.press('Escape');await page.locator('#pause').waitFor({state:'visible'});
 const info=await (await fetch(baseUrl+'/build-info.json')).json();
 assert.equal(await page.locator('#build-info').getAttribute('data-build'),info.build);
 assert.equal(await page.locator('#toon').isChecked(),false);
 assert.equal(await page.locator('#placement-effect').inputValue(),'smoke');
 assert.equal(await page.locator('#distance-blur').count(),0);
 await page.locator('#resume-btn').click();await page.locator('#pause').waitFor({state:'hidden'});
});
test('a heavy painting can be picked up, inspected, parked and restored after reload',{timeout:240000},async t=>{
 const page=await open(t,'ART-1548');
 await page.keyboard.press('e');await page.keyboard.press('l');
 await page.locator('#painting-controls').getByText(/оставить картину на тележке/).waitFor({timeout:30000});
 await page.mouse.down({button:'right'});await page.mouse.move(700,330,{steps:8});await page.mouse.up({button:'right'});
 await page.locator('#painting-controls[data-can-park="true"]').waitFor({timeout:30000});
 await page.keyboard.press('e');
 await page.waitForFunction(()=>{
  const saved=JSON.parse(localStorage.getItem('keynlock-art-hanging-v1')??'{}');return saved['ART-1548']?.kind==='trolley';
 },null,{timeout:30000});
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('keynlock-art-hanging-v1'))['ART-1548']);
 await page.reload({waitUntil:'domcontentloaded'});await page.locator('#load-screen').waitFor({state:'hidden',timeout:180000});
 const restored=await page.evaluate(()=>JSON.parse(localStorage.getItem('keynlock-art-hanging-v1'))['ART-1548']);
 assert.deepEqual(restored,saved);
 await page.locator('#painting-label').getByText('Смерть Сарданапала',{exact:true}).waitFor({timeout:30000});
});
