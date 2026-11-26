import test from 'node:test';
import assert from 'node:assert/strict';
import {bindPlayerInput} from '../src/player/bind-input.js';

test('F only excludes on a deliberate hold; RMB inspects until release and cancels on a mode reset',t=>{
 const window=new EventTarget(),document=new EventTarget(),canvas=new EventTarget();
 document.querySelector=()=>null;
 t.mock.method(performance,'now',()=>now);
 const saved=[globalThis.window,globalThis.document,globalThis.Element];
 Object.assign(globalThis,{window,document,Element:class Element{}});
 t.after(()=>{[globalThis.window,globalThis.document,globalThis.Element]=saved;});
 let now=1000,id='first',hidden=0;const inspections=[];
 const zoom=[],progress={hidden:true,value:0};
 const input=bindPlayerInput({canvas,player:{held:new Set(),zoom:value=>zoom.push(value)},getMode:()=>'play',lock:{},
  hideProgress:progress,actions:{aimedId:()=>id,inspect(value){inspections.push(value);},raise(){},exclude(){hidden++;}}});
 t.after(()=>input.dispose());
 const key=type=>window.dispatchEvent(Object.assign(new Event(type),{code:'KeyF',key:'а'}));
 key('keydown');now+=230;key('keyup');
 assert.deepEqual(inspections,[]);
 key('keydown');now+=1000;input.update(now);assert.equal(progress.value,.5);
 now+=999;input.update(now);assert.equal(hidden,0);
 now++;input.update(now);key('keyup');
 assert.equal(hidden,1);assert.deepEqual(inspections,[]);assert.equal(progress.hidden,true);
 key('keydown');id='second';now+=2100;input.update(now);key('keyup');
 assert.equal(hidden,1);assert.deepEqual(inspections,[]);
 const pointer=(target,type)=>target.dispatchEvent(Object.assign(new Event(type),{button:2}));
 pointer(canvas,'pointerdown');assert.deepEqual(inspections,[true]);pointer(window,'pointerup');
 assert.deepEqual(inspections,[true,false],'release ends inspection');
 pointer(canvas,'pointerdown');input.resetGesture();assert.deepEqual(inspections,[true,false,true,false],'pause and plan transitions release inspection');
 assert.deepEqual(zoom,[false],'reset clears any aimed-camera zoom');
});
