import test from 'node:test';
import assert from 'node:assert/strict';
import {installWorkbenchInput} from '../public/js/workbench-input.js';

const eventWith=(name,properties={})=>Object.assign(new Event(name,{cancelable:true}),properties);

test('mouse chooses the filing zone; Space holds the file; teardown removes listeners',()=>{
  const previousWindow=globalThis.window;
  const fakeWindow=new EventTarget();
  globalThis.window=fakeWindow;
  const canvas=new EventTarget();
  canvas.style={cursor:'grab'};
  let captured=-1,rotations=0,rendered=0;
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
    beginCameraPan:()=>true,moveCameraPan:()=>true,endCameraPan:()=>true,
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
    releaseCapture:()=>{},inspectKeyButton:{click:()=>{}}
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
    canvas.dispatchEvent(eventWith('pointerdown',{
      clientX:250,clientY:150,button:0,pointerId:4,metaKey:true,ctrlKey:false,
      shiftKey:false
    }));
    assert.equal(state.cameraDragging,true,
      'Cmd-drag takes control of the camera even in fixed overhead mode');
    canvas.dispatchEvent(eventWith('pointerup',{clientX:260,clientY:160,pointerId:4}));
    assert.equal(state.cameraDragging,false);
    fakeWindow.dispatchEvent(eventWith('keydown',{code:'Space'}));
    detach();
    fakeWindow.dispatchEvent(eventWith('keydown',{code:'Space'}));
    assert.equal(state.cameraDragging,false,'detached handler must not alter controls');
  }finally{
    detach();
    if(previousWindow===undefined)delete globalThis.window;
    else globalThis.window=previousWindow;
  }
});

test('assembled 3D parts detach under the mouse and the shackle responds to pulling',()=>{
  const previousWindow=globalThis.window;
  globalThis.window=new EventTarget();
  const canvas=new EventTarget();canvas.style={cursor:'grab'};
  canvas.setPointerCapture=()=>{};
  const actions=[];
  const selectedParts=[];
  const state={mode:'assembly',testing:false,heldTool:null,wiping:false,
    filing:false,spaceFiling:false,cameraDragging:false};
  const scene={
    hitTest:(x)=>x<100?{kind:'internal',id:'gear-0',point:{x:1,y:2,z:3}}:
      {kind:'shackle'},
    beginInternalDrag:(id,point)=>{actions.push(['grab',id,point.x]);return true;},
    interactionPlaneY:()=>.75,
    pointerToolPoint:(x,y,z)=>{actions.push(['project',z]);return {x,y,z};},
    moveLooseDrag:point=>actions.push(['move',point.x]),
    endLooseDrag:()=>actions.push(['release']),
    setShacklePull:(held,travel)=>actions.push(['shake',held,travel||0]),
    isAssemblyCameraLocked:()=>true,
    setRagContact:()=>{},setFilePointerActive:()=>{},setFiling:()=>{}
  };
  const detach=installWorkbenchInput({canvas,state,scene,save:()=>{},toast:()=>{},
    measuredCuts:()=>[],inspectCurrentKey:()=>({brokenAt:-1}),
    selectCut:()=>{},renderCuts:()=>{},releaseCapture:()=>{},
    inspectKeyButton:{click:()=>{}},
    onAssemblySelect:hit=>selectedParts.push(hit?.id||hit?.kind)});
  try{
    canvas.dispatchEvent(eventWith('pointerdown',{
      button:0,clientX:50,clientY:45,pointerId:9}));
    canvas.dispatchEvent(eventWith('pointermove',{
      clientX:70,clientY:55,pointerId:9}));
    canvas.dispatchEvent(eventWith('pointerup',{pointerId:9}));
    assert.deepEqual(actions.slice(0,4),[
      ['grab','gear-0',1],['project',.75],['move',70],['release']]);
    assert.equal(selectedParts[0],'gear-0',
      'a click passes the selected mechanism part to the right-hand panel');
    canvas.dispatchEvent(eventWith('pointerdown',{
      button:0,clientX:150,clientY:80,pointerId:10}));
    canvas.dispatchEvent(eventWith('pointermove',{
      clientX:160,clientY:95,pointerId:10}));
    canvas.dispatchEvent(eventWith('pointerup',{pointerId:10}));
    assert.deepEqual(actions.slice(-3),[
      ['shake',true,0],['shake',true,Math.hypot(10,15)],['shake',false,0]]);
    assert.equal(selectedParts[1],'shackle');
  }finally{
    detach();
    if(previousWindow===undefined)delete globalThis.window;
    else globalThis.window=previousWindow;
  }
});

test('clicking screws picks the driver automatically and stows it after the fourth click',()=>{
  const previousWindow=globalThis.window;
  globalThis.window=new EventTarget();
  const canvas=new EventTarget();canvas.style={cursor:'default'};
  const actions=[];
  const state={mode:'assembly',testing:false,heldTool:null,wiping:false,
    filing:false,spaceFiling:false,cameraDragging:false};
  let remaining=4;
  const scene={
    hitTest:x=>({kind:'screw',index:Math.floor(x/100)}),
    unscrewCorner:index=>{actions.push(['unscrew',index]);remaining--;return true;},
    remainingScrews:()=>remaining,
    setScrewdriverHeld:value=>actions.push(['driver',value]),
    stowScrewdriver:()=>actions.push(['stow']),
    setToolHeld:value=>actions.push(['tool',value]),
    isAssemblyCameraLocked:()=>true,
    setRagContact:()=>{},setFilePointerActive:()=>{},setFiling:()=>{}
  };
  const detach=installWorkbenchInput({canvas,state,scene,save:()=>{},toast:()=>{},
    measuredCuts:()=>[],inspectCurrentKey:()=>({brokenAt:-1}),
    selectCut:()=>{},renderCuts:()=>{},releaseCapture:()=>{},
    inspectKeyButton:{click:()=>{}}});
  try{
    for(let i=0;i<4;i++)canvas.dispatchEvent(eventWith('pointerdown',
      {button:0,clientX:i*100,clientY:40,pointerId:i+1}));
    assert.deepEqual(actions,[['driver',true],['tool',true],
      ['unscrew',0],['unscrew',1],['unscrew',2],['unscrew',3],
      ['stow'],['tool',false]]);
    assert.equal(state.heldTool,null);
  }finally{
    detach();
    if(previousWindow===undefined)delete globalThis.window;
    else globalThis.window=previousWindow;
  }
});

test('rag raises dust only during a held click, releasing stops cleaning',()=>{
  const previousWindow=globalThis.window;
  globalThis.window=new EventTarget();
  const canvas=new EventTarget();canvas.style={cursor:'default'};
  let captured=null;
  canvas.setPointerCapture=id=>{captured=id;};
  const actions=[];
  const state={mode:'assembly',testing:false,heldTool:null,wiping:false,
    filing:false,spaceFiling:false,cameraDragging:false,dustPointer:null};
  const scene={
    hitTest:x=>x<100?{kind:'rag'}:{kind:'dust',uv:{x:.4,y:.7}},
    setWiping:value=>actions.push(['held',value]),
    captureRagGrip:()=>actions.push(['grip']),
    setToolHeld:value=>actions.push(['tool',value]),
    wipeDust:(uv,contact)=>actions.push(['wipe',uv.x,contact]),
    puffDust:()=>actions.push(['puff']),
    setRagContact:contact=>actions.push(['contact',contact]),
    moveHeldTool:()=>{},pointerToolPoint:()=>({x:0,y:0,z:0}),
    isAssemblyCameraLocked:()=>true,
    setFilePointerActive:()=>{},setFiling:()=>{}
  };
  const detach=installWorkbenchInput({canvas,state,scene,save:()=>{},toast:()=>{},
    measuredCuts:()=>[],inspectCurrentKey:()=>({brokenAt:-1}),
    selectCut:()=>{},renderCuts:()=>{},releaseCapture:()=>{},
    inspectKeyButton:{click:()=>{}}});
  try{
    canvas.dispatchEvent(eventWith('pointermove',{clientX:60,clientY:80,
      pointerId:4,buttons:0}));
    assert.ok(!actions.some(action=>action[0]==='wipe'));
    canvas.dispatchEvent(eventWith('pointerdown',{clientX:60,clientY:80,
      pointerId:4,button:0}));
    assert.equal(captured,4);
    assert.equal(state.wiping,true);
    assert.equal(actions.filter(action=>action[0]==='wipe').length,0,
      'grasping the cloth alone does not clean the lock');
    canvas.dispatchEvent(eventWith('pointermove',{clientX:140,clientY:90,
      pointerId:4,buttons:1}));
    assert.equal(actions.filter(action=>action[0]==='puff').length,1);
    canvas.dispatchEvent(eventWith('pointermove',{clientX:150,clientY:100,
      pointerId:4,buttons:1}));
    assert.equal(actions.filter(action=>action[0]==='wipe').length,2);
    canvas.dispatchEvent(eventWith('pointerup',{pointerId:4}));
    assert.equal(state.wiping,false);
    assert.equal(state.heldTool,null);
    assert.deepEqual(actions.slice(-3),[
      ['contact',false],['held',false],['tool',false]]);
    canvas.dispatchEvent(eventWith('pointermove',{clientX:155,clientY:100,
      pointerId:4,buttons:0}));
    assert.equal(actions.filter(action=>action[0]==='wipe').length,2);
  }finally{
    detach();
    if(previousWindow===undefined)delete globalThis.window;
    else globalThis.window=previousWindow;
  }
});

test('cover and internal parts detach only after dragging, then release onto the table',()=>{
  const previousWindow=globalThis.window;
  globalThis.window=new EventTarget();
  const canvas=new EventTarget();canvas.style={cursor:'default'};
  canvas.setPointerCapture=()=>{};
  const actions=[];
  let kind='cover';
  const state={mode:'assembly',testing:false,heldTool:null,wiping:false,
    filing:false,spaceFiling:false,cameraDragging:false};
  const scene={
    hitTest:()=>({kind,point:{x:.3,y:.2,z:.8},id:'gear-0'}),
    canRemoveCover:()=>true,
    beginLooseDrag:(id,point)=>{actions.push(['cover',id,point.x]);return true;},
    beginInternalDrag:(id,point)=>{actions.push(['internal',id,point.x]);return true;},
    moveLooseDrag:point=>actions.push(['move',point.x]),
    endLooseDrag:()=>actions.push(['drop']),
    pointerToolPoint:x=>({x}),interactionPlaneY:()=>.8,
    setHoveredDetachable:()=>{},isAssemblyCameraLocked:()=>true,
    setFilePointerActive:()=>{},setRagContact:()=>{},setFiling:()=>{}
  };
  const detach=installWorkbenchInput({canvas,state,scene,save:()=>{},toast:()=>{},
    measuredCuts:()=>[],inspectCurrentKey:()=>({brokenAt:-1}),
    selectCut:()=>{},renderCuts:()=>{},releaseCapture:()=>{},
    inspectKeyButton:{click:()=>{}}});
  const press=(id,x)=>canvas.dispatchEvent(eventWith('pointerdown',{
    pointerId:id,button:0,clientX:x,clientY:40}));
  const drag=(id,x)=>canvas.dispatchEvent(eventWith('pointermove',{
    pointerId:id,buttons:1,clientX:x,clientY:40}));
  const release=id=>canvas.dispatchEvent(eventWith('pointerup',{pointerId:id}));
  try{
    press(1,80);release(1);
    assert.deepEqual(actions,[],'plain click leaves cover installed');
    press(2,80);drag(2,83);
    assert.deepEqual(actions,[],'tiny cursor wobble does not detach cover');
    drag(2,94);release(2);
    assert.deepEqual(actions,[['cover','cover',.3],['move',94],['drop']]);
    kind='internal';
    press(3,130);release(3);
    assert.equal(actions.length,3,'clicking gear does not remove it');
    press(4,130);drag(4,141);release(4);
    assert.deepEqual(actions.slice(-3),[['internal','gear-0',.3],['move',141],['drop']]);
  }finally{
    detach();
    if(previousWindow===undefined)delete globalThis.window;
    else globalThis.window=previousWindow;
  }
});

test('gear-mode pointer flow oils a wheel, turns the chain, and returns to assembly',()=>{
  const previousWindow=globalThis.window;
  globalThis.window=new EventTarget();
  const canvas=new EventTarget(),captured=new Set();
  canvas.style={cursor:'grab'};
  canvas.setPointerCapture=id=>captured.add(id);
  canvas.releasePointerCapture=id=>captured.delete(id);
  let hovered={kind:'oilCan'};
  const actions=[],notifications=[];
  let updates=0;
  const state={mode:'gears',testing:false,heldTool:null,wiping:false,
    filing:false,cameraDragging:false};
  const scene={
    hitTest:()=>hovered,
    setOilerHeld:held=>actions.push(['held',held]),
    setGearHover:hit=>actions.push(['hover',hit?.kind]),
    pointerToolPoint:()=>({x:0,y:0,z:0}),interactionPlaneY:()=>0,
    moveOiler:()=>actions.push(['move-oiler']),
    oilPart:hit=>{actions.push(['oil',hit.index]);return true;},
    turnGear:value=>{actions.push(['turn',value]);return {open:value>0};},
    beginCameraPan:()=>true,endCameraPan:()=>actions.push(['end-pan']),
    setHoveredDetachable:()=>{}
  };
  const dispose=installWorkbenchInput({canvas,state,scene,save:()=>{},
    toast:message=>notifications.push(message),measuredCuts:()=>[],
    inspectCurrentKey:()=>({brokenAt:-1}),selectCut:()=>{},renderCuts:()=>{},
    releaseCapture:id=>canvas.releasePointerCapture(id),
    inspectKeyButton:{click(){}},onGearChange:()=>updates++});
  const fire=(type,properties={})=>canvas.dispatchEvent(eventWith(type,{
    pointerId:6,button:0,buttons:1,clientX:100,clientY:100,
    shiftKey:false,metaKey:false,ctrlKey:false,...properties}));
  try{
    fire('pointerdown');
    assert.equal(state.heldTool,'oiler');
    hovered={kind:'gearWheel',index:2};
    fire('pointermove',{clientX:110});
    fire('pointerdown');
    assert.ok(actions.some(call=>call[0]==='move-oiler'));
    assert.ok(actions.some(call=>call[0]==='oil'&&call[1]===2));
    assert.equal(state.heldTool,'oiler');
    globalThis.window.dispatchEvent(eventWith('keydown',{code:'Escape'}));
    assert.equal(state.heldTool,null);
    assert.deepEqual(actions.filter(call=>call[0]==='held'),
      [['held',true],['held',false]]);
    hovered={kind:'gearWheel',index:0};
    fire('pointerdown');
    assert.equal(captured.has(6),true);
    fire('pointermove',{clientX:160});
    fire('pointerup',{buttons:0});
    assert.equal(captured.size,0);
    assert.ok(actions.some(call=>call[0]==='turn'&&call[1]>0));
    assert.ok(notifications.some(message=>/освободил дужку/.test(message)));
    assert.ok(updates>=3,'oil pickup, lubrication, release, and turning refresh UI');
    hovered=null;state.mode='assembly';
    fire('pointerdown',{pointerId:7});
    assert.equal(state.cameraDragging,true);
    fire('pointerup',{pointerId:7});
    assert.equal(state.cameraDragging,false);
    assert.equal(captured.size,0);
  }finally{
    dispose();
    if(previousWindow===undefined)delete globalThis.window;
    else globalThis.window=previousWindow;
  }
});

test('disposing during a tool drag releases every captured pointer and ends the gesture',()=>{
  const previousWindow=globalThis.window;
  globalThis.window=new EventTarget();
  const cases=[
    {name:'gear wheel',mode:'gears',hit:{kind:'gearWheel',index:0}},
    {name:'rag',mode:'assembly',hit:{kind:'rag'}},
    {name:'waiting cover',mode:'assembly',hit:{kind:'cover'}},
    {name:'loose screw',mode:'assembly',hit:{kind:'loose',index:0}},
    {name:'shackle',mode:'assembly',hit:{kind:'shackle'}},
    {name:'filing',mode:'key',hit:{kind:'cut',index:0}}
  ];
  try{
    for(const item of cases){
      const canvas=new EventTarget(),captured=new Set(),cleanup=[];
      canvas.style={cursor:'grab'};
      canvas.setPointerCapture=id=>captured.add(id);
      canvas.releasePointerCapture=id=>captured.delete(id);
      const state={mode:item.mode,testing:false,heldTool:null,wiping:false,
        filing:false,spaceFiling:false,cameraDragging:false,activeCut:0,
        cuts:[0],targets:[.3],warnedOvercut:[false],difficulty:1};
      const scene={hitTest:()=>item.hit,canRemoveCover:()=>true,
        beginLooseDrag:()=>true,endLooseDrag:()=>cleanup.push('loose'),
        canDetachPart:()=>({allowed:false}),setShacklePull:value=>{
          if(!value)cleanup.push('shackle');},
        setRagContact:value=>{if(!value)cleanup.push('rag');},
        setWiping:()=>{},setToolHeld:()=>{},setFiling:()=>{},
        setFilePointer:()=>{},setFilePointerActive:()=>{},setCuts:()=>{}};
      const dispose=installWorkbenchInput({canvas,state,scene,save:()=>{},toast:()=>{},
        measuredCuts:()=>[],inspectCurrentKey:()=>({brokenAt:-1}),
        selectCut:()=>{},renderCuts:()=>{},
        releaseCapture:id=>canvas.releasePointerCapture(id),inspectKeyButton:{click(){}}});
      canvas.dispatchEvent(eventWith('pointerdown',{
        pointerId:15,button:0,buttons:1,clientX:100,clientY:100,
        shiftKey:false,ctrlKey:false,metaKey:false}));
      assert.equal(captured.has(15),true,item.name);
      dispose();
      assert.equal(captured.size,0,`${item.name}: capture must be released`);
      assert.equal(state.filing,false,`${item.name}: active filing must stop`);
      if(item.name==='loose screw')assert.ok(cleanup.includes('loose'));
      if(item.name==='shackle')assert.ok(cleanup.includes('shackle'));
      if(item.name==='rag')assert.ok(cleanup.includes('rag'));
    }
  }finally{
    if(previousWindow===undefined)delete globalThis.window;
    else globalThis.window=previousWindow;
  }
});

test('right drag spins a loose part or orbits the lock without grabbing it',()=>{
  const previousWindow=globalThis.window;
  globalThis.window=new EventTarget();
  const canvas=new EventTarget();canvas.style={cursor:'default'};
  canvas.setPointerCapture=()=>{};
  const state={mode:'assembly',testing:false,heldTool:null,wiping:false,
    filing:false,spaceFiling:false,cameraDragging:false};
  const actions=[];
  let hit={kind:'loose',index:'part:gear-0'};
  const scene={
    hitTest:()=>hit,
    beginInspectionRotation:value=>value?.kind==='loose'?'part':'lock',
    rotateInspection:(kind,dx,dy)=>actions.push(['rotate',kind,dx,dy]),
    endInspectionRotation:kind=>actions.push(['end',kind]),
    setHoveredDetachable:()=>{},setFilePointerActive:()=>{},setRagContact:()=>{},
    setFiling:()=>{},isAssemblyCameraLocked:()=>true
  };
  const detach=installWorkbenchInput({canvas,state,scene,save:()=>{},toast:()=>{},
    measuredCuts:()=>[],inspectCurrentKey:()=>({brokenAt:-1}),
    selectCut:()=>{},renderCuts:()=>{},releaseCapture:()=>{},
    inspectKeyButton:{click:()=>{}},onCameraUnlocked:()=>actions.push(['unlock'])});
  try{
    canvas.dispatchEvent(eventWith('pointerdown',{
      button:2,pointerId:5,clientX:80,clientY:70}));
    canvas.dispatchEvent(eventWith('pointermove',{
      pointerId:5,buttons:2,clientX:100,clientY:62}));
    canvas.dispatchEvent(eventWith('pointerup',{pointerId:5}));
    assert.deepEqual(actions,[['rotate','part',20,-8],['end','part']]);
    hit={kind:'internal',id:'core-0'};
    canvas.dispatchEvent(eventWith('pointerdown',{
      button:2,pointerId:6,clientX:120,clientY:90}));
    canvas.dispatchEvent(eventWith('pointermove',{
      pointerId:6,buttons:2,clientX:130,clientY:105}));
    canvas.dispatchEvent(eventWith('pointerup',{pointerId:6}));
    assert.deepEqual(actions.slice(2),[
      ['unlock'],['rotate','lock',10,15],['end','lock']]);
  }finally{
    detach();
    if(previousWindow===undefined)delete globalThis.window;
    else globalThis.window=previousWindow;
  }
});
