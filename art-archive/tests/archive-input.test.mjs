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

test('a short E press still commits when automatic wall preview starts between keydown and keyup',t=>{
 const window=new EventTarget(),document=new EventTarget(),canvas=new EventTarget();document.querySelector=()=>null;
 const saved=[globalThis.window,globalThis.document,globalThis.Element];Object.assign(globalThis,{window,document,Element:class Element{}});
 t.after(()=>{[globalThis.window,globalThis.document,globalThis.Element]=saved;});
 let canRaise=true,commits=0;
 const input=bindPlayerInput({canvas,player:{held:new Set(),zoom(){}},getMode:()=>'play',lock:{},hideProgress:{},
  actions:{wallPick:()=>null,canRaise:()=>canRaise,interact(){commits++;},raise(){}}});t.after(()=>input.dispose());
 const key=type=>window.dispatchEvent(Object.assign(new Event(type),{code:'KeyE',key:'e'}));
 key('keydown');canRaise=false;key('keyup');assert.equal(commits,1,'preview entering its placing phase must not swallow this input');
});

test('RMB pointer dragging turns the actual inspection camera, with no doubled compatibility mouse events',async t=>{
 const THREE=await import('../vendor/three.js'),{createPlayerController}=await import('../src/player/controller.js');
 const window=new EventTarget(),document=new EventTarget(),canvas=new EventTarget();document.querySelector=()=>null;
 const saved=[globalThis.window,globalThis.document,globalThis.Element,globalThis.innerWidth,globalThis.innerHeight];
 Object.assign(globalThis,{window,document,Element:class Element{},innerWidth:1000,innerHeight:800});
 t.after(()=>{[globalThis.window,globalThis.document,globalThis.Element,globalThis.innerWidth,globalThis.innerHeight]=saved;});
 const camera=new THREE.PerspectiveCamera(73,1.5);camera.position.set(0,9.78,20);
 const player=createPlayerController({THREE,camera,config:{building:{floorElevation:8}},navigation:{obstacleRevision:0,move:(p,h,y,d,f)=>({floorY:f})}});
 let locked=false,requests=0,now=1000;
 const target={position:new THREE.Vector3(1,9.4,18),height:2.5};
 const input=bindPlayerInput({canvas,player,getMode:()=>'play',lock:{locked:()=>locked,request(){requests++;}},hideProgress:{},
  actions:{inspect(value){player.lookAtCarry(value?target:null);return true;},raise(){}}});t.after(()=>input.dispose());
 const advance=()=>{for(let i=0;i<90;i++){now+=16;player.update(.016,now,true);}};
 const move=(type,x,y,dx,dy)=>{const event=Object.assign(new Event(type),{clientX:x,clientY:y,movementX:dx,movementY:dy,buttons:2});document.dispatchEvent(event);return event;};
 canvas.dispatchEvent(Object.assign(new Event('pointerdown',{cancelable:true}),{button:2}));assert.equal(requests,1);
 advance();move('pointermove',600,400,0,0);const before=camera.rotation.y;
 const pointer=move('pointermove',760,450,160,50);
 const compatibility=Object.assign(new Event('mousemove'),{clientX:760,clientY:450,movementX:160,movementY:50});
 Object.defineProperty(compatibility,'timeStamp',{value:pointer.timeStamp});document.dispatchEvent(compatibility);
 advance();const speed=player.state.sensitivity*.000145;
 assert(Math.abs(camera.rotation.y-before+160*speed)<.001,'drag rotates once, not zero or twice');assert.equal(player.state.yaw,0);
 locked=true;const prior=camera.rotation.y;move('pointermove',760,450,40,-20);advance();
 assert(Math.abs(camera.rotation.y-prior+40*speed)<.001,'pointer-lock drag also remains responsive');
 window.dispatchEvent(Object.assign(new Event('pointerup'),{button:2}));advance();assert(Math.abs(camera.rotation.y)<.001);
});


test('Q and Cyrillic Й open the separate viewer once, without stealing F or RMB',t=>{
 const saved=[globalThis.window,globalThis.document,globalThis.Element];
 const window=new EventTarget(),document=new EventTarget(),canvas=new EventTarget();document.querySelector=()=>null;
 Object.assign(globalThis,{window,document,Element:class{}});t.after(()=>{[globalThis.window,globalThis.document,globalThis.Element]=saved;});
 let opened=0;
 const input=bindPlayerInput({canvas,player:{held:new Set(),zoom(){}},hideProgress:{},getMode:()=>'play',lock:{},actions:{raise(){},openPainting(){opened++;}}});
 t.after(()=>input.dispose());
 const key=repeat=>window.dispatchEvent(Object.assign(new Event('keydown',{cancelable:true}),{code:'KeyQ',key:'й',repeat}));
 key(false);key(true);assert.equal(opened,1);
 document.querySelector=()=>({open:true});key(false);assert.equal(opened,1,'a modal consumes the opening shortcut');
});
