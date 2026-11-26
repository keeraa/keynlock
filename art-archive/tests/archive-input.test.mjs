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

test('held RMB allows mouse look in locked and unlocked modes without a jump on release',t=>{
 const window=new EventTarget(),document=new EventTarget(),canvas=new EventTarget();document.querySelector=()=>null;
 const saved=[globalThis.window,globalThis.document,globalThis.Element,globalThis.innerWidth,globalThis.innerHeight];Object.assign(globalThis,{window,document,Element:class Element{},innerWidth:1000,innerHeight:800});
 t.after(()=>{[globalThis.window,globalThis.document,globalThis.Element,globalThis.innerWidth,globalThis.innerHeight]=saved;});
 const state={lastPointer:{x:10,y:10},edge:{until:100000}},turns=[];
 let locked=true,levels=0;
 const input=bindPlayerInput({canvas,player:{state,held:new Set(),turn:(...delta)=>turns.push(delta),level(){levels++;},zoom(){}},getMode:()=>'play',lock:{locked:()=>locked},
  hideProgress:{},actions:{inspect:()=>true,raise(){}}});t.after(()=>input.dispose());
 const mouse=(x,y)=>document.dispatchEvent(Object.assign(new Event('mousemove'),{movementX:x,movementY:y,clientX:x,clientY:y}));
 mouse(3,4);assert.deepEqual(turns,[[3,4]]);
 canvas.dispatchEvent(Object.assign(new Event('pointerdown'),{button:2}));assert.equal(state.edge.until,0);
 mouse(50,60);window.dispatchEvent(Object.assign(new Event('keydown'),{code:'KeyL',key:'l'}));
 assert.deepEqual(turns[1],[50,60]);assert.equal(levels,1);
 locked=false;mouse(500,600);mouse(502,603);assert.deepEqual(turns[2],[2,3]);
 window.dispatchEvent(Object.assign(new Event('pointerup'),{button:2}));
 mouse(501,601);assert.equal(turns.length,3,'first pointer after release only resets its origin');
 mouse(503,604);assert.deepEqual(turns[3],[2,3]);
});
