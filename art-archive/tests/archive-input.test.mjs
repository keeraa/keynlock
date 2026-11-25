import test from 'node:test';
import assert from 'node:assert/strict';
import {bindPlayerInput} from '../src/player/bind-input.js';

test('F inspects on a tap, hides once at two seconds, and cancels when the target changes',t=>{
 const window=new EventTarget(),document=new EventTarget(),canvas=new EventTarget();
 document.querySelector=()=>null;
 t.mock.method(performance,'now',()=>now);
 const saved=[globalThis.window,globalThis.document,globalThis.Element];
 Object.assign(globalThis,{window,document,Element:class Element{}});
 t.after(()=>{[globalThis.window,globalThis.document,globalThis.Element]=saved;});
 let now=1000,id='first',opened=0,hidden=0;
 const zoom=[],progress={hidden:true,value:0};
 const input=bindPlayerInput({canvas,player:{held:new Set(),zoom:value=>zoom.push(value)},getMode:()=>'play',lock:{},
  hideProgress:progress,actions:{aimedId:()=>id,inspect(){opened++;},exclude(){hidden++;}}});
 t.after(()=>input.dispose());
 const key=type=>window.dispatchEvent(Object.assign(new Event(type),{code:'KeyF',key:'а'}));
 key('keydown');now+=230;key('keyup');
 assert.equal(opened,1);
 key('keydown');now+=1000;input.update(now);assert.equal(progress.value,.5);
 now+=999;input.update(now);assert.equal(hidden,0);
 now++;input.update(now);key('keyup');
 assert.equal(hidden,1);assert.equal(opened,1);assert.equal(progress.hidden,true);
 key('keydown');id='second';now+=2100;input.update(now);key('keyup');
 assert.equal(hidden,1);assert.equal(opened,1);
 const pointer=(target,type)=>target.dispatchEvent(Object.assign(new Event(type),{button:2}));
 pointer(canvas,'pointerdown');pointer(window,'pointerup');
 assert.deepEqual(zoom,[true,false]);
});
