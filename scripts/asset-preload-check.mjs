import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../js/core/asset-preload.js',import.meta.url),'utf8');
const manifest={images:['assets/branding/logo-01.png','assets/restoration/painting.jpg','assets/map/city-map.jpg']};
const flush=async()=>{for(let i=0;i<24;i++)await Promise.resolve();};
function harness(){
  const requests=[],images=[],timers=new Map(),classes=[],marks=[];
  let nextTimer=0,domReady,retry,menuCalls=0;
  const bar={style:{}},status={},button={hidden:true,addEventListener:(_,fn)=>retry=fn};
  const document={readyState:'loading',querySelector:selector=>({'#bootLoaderProgress':bar,'#bootLoaderStatus':status,'#bootLoaderRetry':button}[selector]||null),
    addEventListener:(type,fn)=>{if(type==='DOMContentLoaded')domReady=fn;},body:{classList:{add:name=>classes.push(name)}}};
  const window={dispatchEvent(){}};
  class Image{constructor(){images.push(this);}set src(value){this.url=value;}removeAttribute(){this.cancelled=true;}}
  function fetch(src,options){
    let resolve,reject;
    const body=new Promise((ok,fail)=>{resolve=ok;reject=fail;});
    const request={src,options,done:false,finish(value){this.done=true;resolve(value);},fail(){this.done=true;reject(Error('offline'));}};
    options.signal.addEventListener('abort',()=>request.fail(),{once:true});requests.push(request);
    return Promise.resolve({ok:true,json:()=>body,arrayBuffer:()=>body});
  }
  runInNewContext(source,{window,document,Image,fetch,AbortController,performance:{mark:name=>marks.push(name)},console:{warn(){}},
    CustomEvent:class{constructor(type){this.type=type;}},setTimeout:(fn,ms)=>{timers.set(++nextTimer,{fn,ms});return nextTimer;},clearTimeout:id=>timers.delete(id)});
  return {window,requests,images,timers,classes,marks,bar,button,status,get menuCalls(){return menuCalls;},
    registerMenu(){window.KeynlockMainMenu={assetsReady:()=>menuCalls++};},domReady:()=>domReady(),retry:()=>retry()};
}
async function drain(h){
  for(let i=0;i<30;i++){
    await flush();const pending=h.requests.filter(r=>!r.done);
    if(!pending.length)return;
    pending.forEach(r=>r.finish(new ArrayBuffer(1)));
  }
  throw Error('Preload did not settle');
}
const full=harness();
assert.equal(full.requests[0].src,'./asset-manifest.json');
full.requests[0].finish(manifest);await flush();
assert.equal(full.requests.length,5,'Use a bounded four-request queue.');
assert(!full.classes.includes('assets-ready'),'Response headers alone must not complete loading.');
await drain(full);
assert(full.requests.some(r=>r.src==='assets/restoration/painting.jpg'),'Paintings must be downloaded before play.');
for(const src of Object.values(full.window.KeynlockAudioAssets).flat())assert(full.requests.some(r=>r.src===src));
assert(full.requests.slice(1).every(r=>r.options.cache==='force-cache'));
assert(!full.classes.includes('assets-ready'),'Wait for menu registration even if resources are cached.');
full.registerMenu();full.domReady();await full.window.KeynlockAssetsReady;
assert.equal(full.menuCalls,1);assert.equal(full.bar.style.width,'100%');assert.equal(full.timers.size,0);
assert.equal(full.images.length,0,'Do not decode the entire gallery into Image objects.');

const failed=harness();failed.registerMenu();failed.domReady();failed.requests[0].finish(manifest);await flush();
const broken=failed.requests[1];broken.fail();await drain(failed);
assert.equal(failed.menuCalls,0);assert.equal(failed.button.hidden,false);
assert.notEqual(failed.bar.style.width,'100%');
const count=failed.requests.length;failed.retry();await flush();
assert.equal(failed.requests.length,count+1,'Retry only the missing resource.');
assert.equal(failed.requests.at(-1).src,broken.src);
failed.requests.at(-1).finish(new ArrayBuffer(1));await failed.window.KeynlockAssetsReady;
assert.equal(failed.menuCalls,1);assert(failed.button.hidden);

const stalled=harness();stalled.registerMenu();stalled.domReady();await flush();
for(const {fn,ms} of [...stalled.timers.values()]){assert.equal(ms,30000);fn();}
await flush();assert.equal(stalled.menuCalls,0);assert.equal(stalled.button.hidden,false);
stalled.retry();await flush();stalled.requests.at(-1).finish(manifest);await drain(stalled);
await stalled.window.KeynlockAssetsReady;assert.equal(stalled.menuCalls,1);

const helper=full.window.KeynlockPreloadImages;
const first=helper(['assets/example.png','assets/example.png']),second=helper(['assets/example.png']);
assert.equal(full.images.length,1);full.images[0].onerror();await Promise.all([first,second]);
const retry=helper(['assets/example.png']);assert.equal(full.images.length,2);
full.images[1].onload();assert.equal((await retry)[0],true);
console.log('Full startup loading OK — complete image/audio bodies, gallery, bounded queue, cache, failure gate, retry and script registration.');
