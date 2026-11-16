import test from 'node:test';
import assert from 'node:assert/strict';
import {installWorkbenchInput} from '../public/js/workbench-input.js';
import {partName} from '../public/js/assembly-panel.js';

const eventWith=(name,properties={})=>Object.assign(new Event(name,{cancelable:true}),properties);

test('assembly panel exposes part labels to the game controller',()=>{
  assert.equal(partName('core-0'),'Сердцевина');
  assert.equal(partName('pin-2'),'Кодовый штифт III');
  assert.equal(partName('gear-1'),'Шестерня · 16 зубьев');
});

test('mouse chooses the filing zone; Space holds the file; teardown removes listeners',()=>{
  const previousWindow=globalThis.window;
  const fakeWindow=new EventTarget();
  globalThis.window=fakeWindow;
  const canvas=new EventTarget();
  canvas.style={cursor:'grab'};
  let captured=-1,tests=0,rotations=0,rendered=0;
  const filingChanges=[];
  canvas.setPointerCapture=id=>{captured=id;};
  canvas.getBoundingClientRect=()=>({left:0,top:0,right:600,bottom:400});
  const state={
    mode:'key',testing:false,keyMethod:'guided',difficulty:4,
    activeCut:0,cuts:[0,0,0,0],targets:[.2,.25,.3,.35],
    warnedOvercut:[false,false,false,false],filing:false,spaceFiling:false,
    selectedPart:null,installed:{},drag:null,cameraDragging:false
  };
  const scene={
    hitTest:()=>({kind:'cut',index:2}),
    setFilePointer:()=>{},setFilePointerActive:()=>{},
    setFiling:value=>filingChanges.push(value),
    setCuts:()=>{},setSelectedPart:()=>{},updateInstalled:()=>{},
    fileStrokePixels:()=>0,filingContact:()=>-1,filingPulse:()=>{},filingChips:()=>{},
    rotateFile:()=>{rotations++;}
  };
  const detach=installWorkbenchInput({
    canvas,state,scene,save:()=>{},toast:()=>{},measuredCuts:()=>state.cuts,
    inspectCurrentKey:()=>({brokenAt:-1}),
    selectCut:index=>{state.activeCut=index;},renderCuts:()=>{rendered++;},
    renderSelection:()=>{},removePart:()=>{},placement:()=>{},
    testMechanism:()=>{tests++;},releaseCapture:()=>{},inspectKeyButton:{click:()=>{}}
  });
  try{
    canvas.dispatchEvent(eventWith('pointermove',{clientX:250,clientY:150,buttons:0}));
    assert.equal(state.activeCut,2);
    assert.equal(canvas.style.cursor,'crosshair');
    assert.ok(rendered>0);

    canvas.dispatchEvent(eventWith('pointerdown',{
      clientX:250,clientY:150,button:0,pointerId:3,shiftKey:false,metaKey:false,ctrlKey:false
    }));
    assert.equal(state.filing,true);
    assert.equal(captured,3);
    canvas.dispatchEvent(eventWith('pointerup',{clientX:250,clientY:150,pointerId:3}));
    assert.equal(state.filing,false);

    fakeWindow.dispatchEvent(eventWith('keydown',{code:'Space',repeat:false}));
    assert.equal(state.spaceFiling,true);
    assert.equal(filingChanges.at(-1),true);
    fakeWindow.dispatchEvent(eventWith('keyup',{code:'Space'}));
    assert.equal(state.spaceFiling,false);
    assert.equal(filingChanges.at(-1),false);
    fakeWindow.dispatchEvent(eventWith('keydown',{code:'KeyQ'}));
    assert.equal(rotations,1);

    state.mode='assembly';
    fakeWindow.dispatchEvent(eventWith('keydown',{code:'Space'}));
    assert.equal(tests,1);
    detach();
    fakeWindow.dispatchEvent(eventWith('keydown',{code:'Space'}));
    assert.equal(tests,1,'detached handler must not react to keyboard events');
  }finally{
    detach();
    if(previousWindow===undefined)delete globalThis.window;
    else globalThis.window=previousWindow;
  }
});
