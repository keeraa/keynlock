// Run against the actual built game. QA uses a fresh context and never a player's save.
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
const cwd=fileURLToPath(new URL('../../',import.meta.url));
let server,browser,baseUrl;
before(async()=>{
 server=spawn(process.execPath,['serve.mjs'],{cwd,env:{...process.env,PORT:'4198'},stdio:['ignore','pipe','pipe']});
 baseUrl=await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('Preview did not start')),15000);server.once('error',reject);server.once('exit',code=>reject(Error('Preview exited '+code)));
  server.stdout.on('data',chunk=>{const match=chunk.toString().match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timer);resolve(match[0]);}});
 });
 browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
},{timeout:60000});
after(async()=>{await browser?.close();if(server&&server.exitCode===null){server.kill();await once(server,'exit');}});
async function open(t,art){
 const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 t.after(async()=>{await mkdir(new URL('../../test-results/',import.meta.url),{recursive:true});await page.screenshot({path:cwd+'/test-results/'+art+'.png'});await context.close();assert.deepEqual(errors,[]);});
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
