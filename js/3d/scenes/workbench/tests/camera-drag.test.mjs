import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three-core.js';
import {createBenchPanController} from '../public/js/workshop-camera.js';
import {installWorkbenchInput} from '../public/js/workbench-input.js';

test('assembly pan follows the pointer on the tabletop without changing camera tilt',()=>{
  const canvas={getBoundingClientRect:()=>({left:0,top:0,width:1200,height:800})};
  const camera=new THREE.PerspectiveCamera(40,1.5,.04,100);
  camera.up.set(0,0,-1);
  const controls={target:new THREE.Vector3(.55,-1.5,-.5),update(){
    camera.lookAt(this.target);camera.updateMatrixWorld();
  }};
  camera.position.set(.55,9.3,3.4);controls.update();
  const pan=createBenchPanController({THREE,canvas,camera,controls,planeY:-1.5});
  const initialTarget=controls.target.clone();
  const initialOffset=camera.position.clone().sub(controls.target);

  const plane=new THREE.Plane(new THREE.Vector3(0,1,0),1.5);
  const ray=new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(470/600-1,1-400/400),camera);
  const grabbed=ray.ray.intersectPlane(plane,new THREE.Vector3()).clone();

  assert.equal(pan.begin(7,470,400),true);
  assert.equal(pan.begin(8,470,400),false,'a second pointer cannot steal the drag');
  assert.equal(pan.move(8,570,435),false);
  assert.equal(pan.move(7,570,435),true);
  assert.ok(controls.target.distanceTo(initialTarget)>.1,'camera target actually moved');
  assert.ok(camera.position.clone().sub(controls.target).distanceTo(initialOffset)<1e-6,
    'panning preserves the fixed camera angle and distance');
  assert.equal(controls.target.y,-1.5,'the camera pans along the workbench');
  const projected=grabbed.project(camera);
  assert.ok(Math.abs((projected.x+1)*600-570)<1e-4);
  assert.ok(Math.abs((1-projected.y)*400-435)<1e-4,
    'the grabbed tabletop point stays directly under the moving cursor');
  assert.equal(pan.end(7),true);
  assert.equal(pan.move(7,600,400),false,'the pan stops after release');
});

test('mouse gestures pan empty assembly and gear space while preserving part gestures',()=>{
  const previousWindow=globalThis.window;
  globalThis.window=new EventTarget();
  const canvas=new EventTarget();
  canvas.style={};
  const captured=new Set();
  canvas.setPointerCapture=id=>captured.add(id);
  canvas.hasPointerCapture=id=>captured.has(id);
  canvas.releasePointerCapture=id=>captured.delete(id);
  const event=(type,props={})=>{
    const e=new Event(type,{cancelable:true});
    Object.assign(e,{pointerId:1,button:0,buttons:1,clientX:150,clientY:200,
      shiftKey:false,ctrlKey:false,metaKey:false,...props});
    canvas.dispatchEvent(e);return e;
  };
  const calls=[];
  const state={mode:'assembly',heldTool:null,wiping:false,testing:false,
    filing:false,cameraDragging:false};
  let hit=null;
  const scene={
    hitTest:()=>hit,
    beginCameraPan:(...args)=>{calls.push(['begin',...args]);return true;},
    moveCameraPan:(...args)=>calls.push(['move',...args]),
    endCameraPan:id=>calls.push(['end',id]),
    setHoveredDetachable:()=>{},setGearHover:()=>{},
    canDetachPart:()=>({allowed:true}),
    beginInspectionRotation:()=> 'lock',
    rotateInspection:()=>calls.push(['rotate']),
    endInspectionRotation:()=>{}
  };
  const dispose=installWorkbenchInput({canvas,state,scene,save:()=>{},toast:()=>{},
    measuredCuts:()=>[],inspectCurrentKey:()=>({brokenAt:-1}),selectCut:()=>{},
    renderCuts:()=>{},releaseCapture:id=>canvas.releasePointerCapture(id),
    inspectKeyButton:{click(){}},onCameraUnlocked:()=>{}});
  try{
    assert.equal(event('pointerdown').defaultPrevented,true);
    assert.deepEqual(calls.at(-1),['begin',1,150,200]);
    assert.equal(state.cameraDragging,true);
    event('pointermove',{clientX:195,clientY:245});
    assert.deepEqual(calls.at(-1),['move',1,195,245]);
    event('pointerup');
    assert.deepEqual(calls.at(-1),['end',1]);
    assert.equal(state.cameraDragging,false);
    assert.equal(captured.size,0);

    hit={kind:'internal',id:'spring-0',point:new THREE.Vector3()};
    const before=calls.length;
    event('pointerdown',{pointerId:2});
    assert.equal(calls.length,before,'clicking a spring starts its own detachment');
    event('pointerup',{pointerId:2});
    event('pointerdown',{pointerId:3,shiftKey:true});
    assert.deepEqual(calls.at(-1),['begin',3,150,200],
      'Shift+LMB pans even when hovering an interactive part');
    event('pointercancel',{pointerId:3});

    state.mode='gears';hit=null;
    event('pointerdown',{pointerId:4});
    assert.deepEqual(calls.at(-1),['begin',4,150,200]);
    event('pointerup',{pointerId:4});
    event('pointerdown',{pointerId:5,button:2,buttons:2});
    event('pointermove',{pointerId:5,button:2,buttons:2,clientX:165});
    assert.deepEqual(calls.at(-1),['rotate'],
      'right drag still rotates the lock in gear mode');
    event('pointerup',{pointerId:5,button:2,buttons:0});
    event('pointerdown',{pointerId:6,button:1,buttons:4});
    assert.deepEqual(calls.at(-1),['begin',6,150,200],
      'middle mouse button also pans from anywhere');
    event('pointerup',{pointerId:6,button:1,buttons:0});
  }finally{
    dispose();
    if(previousWindow===undefined)delete globalThis.window;
    else globalThis.window=previousWindow;
  }
});

test('remounting while a camera gesture is active releases the captured pointer',()=>{
  const previousWindow=globalThis.window;
  globalThis.window=new EventTarget();
  const canvas=new EventTarget(),captured=new Set();
  canvas.style={};
  canvas.setPointerCapture=id=>captured.add(id);
  canvas.releasePointerCapture=id=>captured.delete(id);
  let ended=0;
  const state={mode:'assembly',testing:false,cameraDragging:false};
  const scene={beginCameraPan:()=>true,endCameraPan:()=>{ended++;}};
  const dispose=installWorkbenchInput({canvas,state,scene,save:()=>{},toast:()=>{},
    measuredCuts:()=>[],inspectCurrentKey:()=>({brokenAt:-1}),selectCut:()=>{},
    renderCuts:()=>{},releaseCapture:id=>canvas.releasePointerCapture(id),
    inspectKeyButton:{click(){}}});
  try{
    const event=new Event('pointerdown',{cancelable:true});
    Object.assign(event,{button:1,pointerId:42,clientX:100,clientY:120});
    canvas.dispatchEvent(event);
    assert.deepEqual([...captured],[42]);
    dispose();
    assert.equal(ended,1);
    assert.equal(captured.size,0);
    assert.equal(state.cameraDragging,false);
  }finally{
    if(previousWindow===undefined)delete globalThis.window;
    else globalThis.window=previousWindow;
  }
});
