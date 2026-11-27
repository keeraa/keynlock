import test from 'node:test';
import assert from 'node:assert/strict';
import {createPaintingInspector} from '../src/ui/painting-inspector.js';

function fixture(t){
 const previous=[globalThis.document,globalThis.window,globalThis.Image];
 class Element extends EventTarget{
  constructor(){super();this.classes=new Set();this.classList={toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name)};this.style={};this.dataset={};this.open=false;this.clientWidth=1000;this.clientHeight=700;}
  setAttribute(name,value){this[name]=value;}removeAttribute(name){delete this[name];this.removed=true;}
  getBoundingClientRect(){return {left:0,top:0,width:this.clientWidth,height:this.clientHeight};}
  showModal(){this.open=true;}
  close(){this.open=false;this.dispatchEvent(new Event('close'));}
  setPointerCapture(id){this.capture=id;}hasPointerCapture(id){return this.capture===id;}releasePointerCapture(){this.capture=null;}
 }
 const doc=new EventTarget(),nodes=new Map(),modes=[],sources=[],modeOptions=[];
 globalThis.document=doc;globalThis.window=new EventTarget();globalThis.Image=class{constructor(){sources.push(this);}};
 t.after(()=>{[globalThis.document,globalThis.window,globalThis.Image]=previous;});
 const elements=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};
 const inspector=createPaintingInspector({elements,catalog:{imageUrl:id=>'/preview/'+id,detailUrl:id=>'/detail/'+id},setMode:(mode,options)=>{modes.push(mode);modeOptions.push(options); }});
 t.after(()=>inspector.dispose());
 const load=(width=4000,height=2000)=>{Object.assign(elements('inspect-image'),{naturalWidth:width,naturalHeight:height});elements('inspect-image').dispatchEvent(new Event('load'));};
 const event=(id,type,data={})=>{const e=Object.assign(new Event(type,{cancelable:true}),data);elements(id).dispatchEvent(e);return e;};
 return {doc,elements,inspector,modes,modeOptions,sources,load,event};
}
const painting={id:'test',title:'Test',image:{}};
for(const [code,key]of [['Escape','Escape'],['KeyQ','й']])test('inspector consumes '+code+' and returns directly to play',t=>{
 const {doc,elements,inspector,modes,modeOptions}=fixture(t);
 inspector.open(painting);assert(elements('art-inspector').open);assert.deepEqual(modeOptions[0],{pauseMenu:false});
 let leaked=0;doc.addEventListener('keydown',()=>leaked++);
 const event=Object.assign(new Event('keydown',{cancelable:true}),{code,key});doc.dispatchEvent(event);
 assert(event.defaultPrevented);assert.equal(leaked,0);
 assert.deepEqual(modes,['pause','play']);assert(!elements('art-inspector').open);
 assert(elements('inspect-image').removed);
 inspector.open(painting);
 const cancel=new Event('cancel',{cancelable:true});elements('art-inspector').dispatchEvent(cancel);
 assert(cancel.defaultPrevented);assert.deepEqual(modes,['pause','play','pause','play']);
});

test('viewer zoom keeps the cursor point fixed, drags within the image bounds and resets to fit',t=>{
 const {elements,inspector,load,event}=fixture(t);inspector.open(painting);load();
 const viewport=elements('inspect-viewport'),image=elements('inspect-image');
 const pose=()=>image.style.transform.match(/translate\(([-\d.e]+)px,([-\d.e]+)px\) scale\(([-\d.e]+)\)/).slice(1).map(Number);
 const before=pose(),u=(750-before[0])/(4000*before[2]),v=(350-before[1])/(2000*before[2]);
 const wheel=event('inspect-viewport','wheel',{deltaY:-600,deltaMode:0,clientX:750,clientY:350});
 assert(wheel.defaultPrevented);assert(Number(viewport.dataset.zoom)>2);
 const after=pose();assert(Math.abs((750-after[0])/(4000*after[2])-u)<1e-8);assert(Math.abs((350-after[1])/(2000*after[2])-v)<1e-8);
 const x=Number(viewport.dataset.panX),y=Number(viewport.dataset.panY);
 event('inspect-viewport','pointerdown',{button:0,pointerId:1,clientX:600,clientY:350});
 event('inspect-viewport','pointermove',{pointerId:1,clientX:800,clientY:450});
 assert(Math.abs(Number(viewport.dataset.panX)-x-200)<1e-7);assert(Math.abs(Number(viewport.dataset.panY)-y-100)<1e-7);
 event('inspect-viewport','pointermove',{pointerId:1,clientX:100000,clientY:100000});
 const [tx,ty,scale]=pose();assert(tx<=1e-7&&ty<=1e-7);assert(tx+4000*scale>=1000-1e-7&&ty+2000*scale>=700-1e-7);
 event('inspect-viewport','pointerup',{pointerId:1});assert(!viewport.classes.has('dragging'));
 event('inspect-fit','click');assert.equal(Number(viewport.dataset.zoom),1);assert.equal(Number(viewport.dataset.panX),0);assert.equal(Number(viewport.dataset.panY),0);
 event('inspect-zoom','click');assert.equal(elements('inspect-scale').textContent,'100%');
 const level=viewport.dataset.zoom;load(8000,4000);assert.equal(viewport.dataset.zoom,level,'HD arrival preserves framing');
});

test('closing or reopening a viewer cancels old HD loads and resets its framing',t=>{
 const {elements,inspector,sources,load,event}=fixture(t);inspector.open(painting);load();event('inspect-plus','click');
 elements('art-inspector').close();assert.equal(sources[0].onload,null);
 inspector.open({...painting,id:'next'});load();
 assert.equal(elements('inspect-image').src,'/preview/next');assert.equal(Number(elements('inspect-viewport').dataset.zoom),1);
 sources[1].onload();assert.equal(elements('inspect-image').src,'/detail/next');
});
