// Optional browser-level contract for embedding into a foreign 3D scene.
// Run: node tests/workbench-embed.smoke.mjs (requires Playwright + Chromium).
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');

const folder=resolve('public');
const page=`<!doctype html><html lang="ru"><head><meta charset="utf-8">
<style>body{margin:0;background:rgb(255,0,255)}#scene{background:lime!important}
#host,#second{position:relative;width:980px;height:680px;margin:12px}</style></head>
<body><div id="host"></div><div id="second"></div>
<script type="module">
  import {mountWorkbench} from '/js/workbench-mount.js';
  window.mountWorkbench=mountWorkbench;
  window.workbench=await mountWorkbench(document.getElementById('host'),{initialMode:'assembly'});
  window.embeddedReady=true;
</script></body></html>`;
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html',
  '.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.json':'application/json'};
const server=createServer(async(req,res)=>{
  const route=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(route==='/embed-test'){res.writeHead(200,{'content-type':'text/html'});res.end(page);return;}
  const path=resolve(folder,`.${route}`);
  if(path!==folder&&!path.startsWith(folder+sep)){res.writeHead(403);res.end();return;}
  try{
    const content=await readFile(path);
    res.writeHead(200,{'content-type':mime[extname(path)]||'application/octet-stream'});
    res.end(content);
  }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(0,'127.0.0.1');
await new Promise(resolve=>server.once('listening',resolve));
let browser;
try{
  browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:[
    '--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
    '--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
  const browserPage=await browser.newPage({viewport:{width:1220,height:870}});
  const failures=[];
  browserPage.on('pageerror',error=>failures.push(error.message));
  await browserPage.goto(`http://127.0.0.1:${server.address().port}/embed-test`);
  await browserPage.waitForFunction(()=>window.embeddedReady,{timeout:20000});
  const state=await browserPage.evaluate(async()=>{
    const host=document.getElementById('host');
    const root=host.shadowRoot.querySelector('main.app');
    const mode=window.workbench.getMode();
    const background=getComputedStyle(root).backgroundColor;
    const scoped=document.getElementById('scene')===null&&
      host.shadowRoot.getElementById('scene')!==null;
    const widths=[root.clientWidth,root.clientHeight];
    window.workbench.setMode('key');
    window.workbench.setMode('mechanism');
    window.workbench.setMode('code');
    const target=host.shadowRoot.getElementById('codeTarget').textContent;
    window.workbench.hide();
    const hidden=host.hidden;
    window.workbench.show();
    const restored=!host.hidden&&window.workbench.getMode()==='code';
    const second=await window.mountWorkbench(document.getElementById('second'),
      {initialMode:'key',active:false});
    const secondHidden=document.getElementById('second').hidden;
    second.show();
    second.setMode('assembly');
    const independent=window.workbench.getMode()==='code'&&second.getMode()==='assembly';
    second.dispose();
    const secondRemoved=document.getElementById('second').shadowRoot.childNodes.length===0;
    window.workbench.dispose();
    const removed=host.shadowRoot.childNodes.length===0;
    window.workbench=await window.mountWorkbench(host,{initialMode:'key'});
    const remounted=host.shadowRoot.querySelector('main.app')!==null&&
      window.workbench.getMode()==='key';
    window.workbench.dispose();
    return {mode,background,scoped,widths,target,hidden,restored,
      secondHidden,independent,secondRemoved,removed,remounted};
  });
  assert.equal(state.mode,'assembly');
  assert.equal(state.scoped,true,'IDs must stay inside Shadow DOM');
  assert.equal(state.background,'rgb(13, 23, 27)','host page CSS cannot repaint the workbench');
  assert.ok(state.widths[0]>900&&state.widths[1]>600);
  assert.ok(state.target.replace(/\s/g,'').length===6,'casket target remains available');
  for(const key of ['hidden','restored','secondHidden','independent','secondRemoved','removed','remounted'])
    assert.equal(state[key],true,key);
  assert.deepEqual(failures,[],'embedded page must have no uncaught errors');
  console.log('Embedded workbench: scoped styles, 4 modes, hide/show, two instances, dispose/remount OK');
}finally{
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
