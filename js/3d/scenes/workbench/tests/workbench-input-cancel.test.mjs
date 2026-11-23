import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {installWorkbenchInput} from '../public/js/workbench-input.js';

function fixture(){
  const originalWindow=globalThis.window;
  const windowHandlers=new Map(),canvasHandlers=new Map();
  const windowMock={
    addEventListener:(type,handler)=>windowHandlers.set(type,handler),
    removeEventListener:(type,handler)=>{if(windowHandlers.get(type)===handler)windowHandlers.delete(type);}
  };
  globalThis.window=windowMock;
  const captured=new Set(),released=[];
  const canvas={
    style:{cursor:'grab'},
    addEventListener:(type,handler)=>canvasHandlers.set(type,handler),
    removeEventListener:(type,handler)=>{if(canvasHandlers.get(type)===handler)canvasHandlers.delete(type);},
    setPointerCapture:id=>captured.add(id),
    hasPointerCapture:id=>captured.has(id),
    releasePointerCapture:id=>{captured.delete(id);released.push(id);},
    getBoundingClientRect:()=>({left:0,right:800,top:0,bottom:600})
  };
  const changes={endDrag:0,oiler:[],rag:[],filing:[]};
  let hit=null,active=true;
  const scene={
    hitTest:()=>hit,beginLooseDrag:()=>true,
    endLooseDrag:()=>{changes.endDrag++;},
    setOilerHeld:value=>changes.oiler.push(value),
    setWiping:value=>changes.rag.push(value),
    setFiling:value=>changes.filing.push(value),
    setShacklePull:()=>{},setRagContact:()=>{},setToolHeld:()=>{},
    setScrewdriverHeld:()=>{},setHoveredDetachable:()=>{},
    setGearHover:()=>{},setFilePointerActive:()=>{}
  };
  const state={mode:'assembly',heldTool:null,wiping:false,
    filing:false,spaceFiling:false,cameraDragging:false,testing:false};
  let detach;
  try{
    detach=installWorkbenchInput({canvas,state,scene,save:()=>{},toast:()=>{},
      measuredCuts:()=>[],inspectCurrentKey:()=>({brokenAt:-1}),
      selectCut:()=>{},renderCuts:()=>{},releaseCapture:id=>canvas.releasePointerCapture(id),
      inspectKeyButton:{click:()=>{}},onAssemblySelect:()=>{},onGearChange:()=>{},
      isActive:()=>active});
  }catch(error){if(originalWindow===undefined)delete globalThis.window;
    else globalThis.window=originalWindow;throw error;}
  return {
    canvas,state,changes,captured,released,
    setHit:value=>{hit=value;},
    setActive:value=>{active=Boolean(value);},
    pointerDown:id=>canvasHandlers.get('pointerdown')({
      button:0,pointerId:id,clientX:100,clientY:130,
      shiftKey:false,metaKey:false,ctrlKey:false,preventDefault:()=>{}
    }),
    blur:()=>windowHandlers.get('blur')(),
    detach,
    dispose:()=>{detach();if(originalWindow===undefined)delete globalThis.window;
      else globalThis.window=originalWindow;}
  };
}

test('suspending the embedded station releases an active detached screw',()=>{
  const x=fixture();
  try{
    x.setHit({kind:'loose',index:1,point:{}});
    x.pointerDown(7);
    assert.equal(x.captured.has(7),true);
    x.detach.cancel();
    assert.equal(x.changes.endDrag,1);
    assert.equal(x.captured.has(7),false);
    assert.deepEqual(x.released,[7]);
    assert.equal(x.state.cameraDragging,false);
    assert.equal(x.canvas.style.cursor,'grab');
    x.detach.cancel();
    assert.equal(x.changes.endDrag,1,'repeated cancellation is idempotent');
  }finally{x.dispose();}
});

test('window blur puts down the rag and stops filing without stuck input',()=>{
  const x=fixture();
  try{
    x.setHit({kind:'rag'});
    x.pointerDown(19);
    assert.equal(x.state.heldTool,'rag');
    assert.equal(x.state.wiping,true);
    assert.equal(x.captured.has(19),true);
    x.state.filing=true;x.state.spaceFiling=true;x.state.filingPointer=20;
    x.canvas.setPointerCapture(20);
    x.blur();
    assert.equal(x.state.heldTool,null);
    assert.equal(x.state.wiping,false);
    assert.equal(x.state.filing,false);
    assert.equal(x.state.spaceFiling,false);
    assert.equal(x.captured.size,0);
    assert.equal(x.changes.rag.at(-1),false);
    assert.equal(x.changes.filing.at(-1),false);
  }finally{x.dispose();}
});

test('inactive embedded workbench ignores attempts to begin a new pointer drag',()=>{
  const x=fixture();
  try{
    x.setActive(false);
    x.setHit({kind:'loose',index:0,point:{}});
    x.pointerDown(23);
    assert.equal(x.captured.size,0);
    assert.equal(x.changes.endDrag,0);
  }finally{x.dispose();}
});

test('host app cancels active gestures on mode change and hide',()=>{
  const app=readFileSync(new URL('../public/js/workbench-app.js',import.meta.url),'utf8');
  assert.ok(app.includes('detachControls?.cancel?.()'));
  assert.ok(app.includes('if(!foreground)detachControls?.cancel?.()'));
});
