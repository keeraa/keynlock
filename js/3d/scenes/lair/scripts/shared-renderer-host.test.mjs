import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createSharedRendererHost} from '../src/rendering/shared-renderer-host.js';
import {createCartoonFilter} from '@keynlock/atelier/room-assets';

test('original workshops share one GPU renderer, clip to their UI stage and restore the room',()=>{
  const records=[];
  const renderer={
    outputColorSpace:THREE.SRGBColorSpace,toneMapping:1,toneMappingExposure:1.1,
    shadowMap:{enabled:true,type:1,autoUpdate:true,needsUpdate:false},
    info:{autoReset:true},autoClear:true,
    color:new THREE.Color('#18201c'),alpha:1,
    viewport:new THREE.Vector4(0,0,1200,800),scissor:new THREE.Vector4(0,0,1200,800),
    scissorTest:false,renderTarget:null,
    getPixelRatio(){return 1;},
    getClearColor(target){return target.copy(this.color);},
    getClearAlpha(){return this.alpha;},
    setClearColor(color,alpha){this.color.set(color);this.alpha=alpha;},
    getViewport(target){return target.copy(this.viewport);},
    getScissor(target){return target.copy(this.scissor);},
    setViewport(...values){this.viewport.copy(values[0]?.isVector4?values[0]:new THREE.Vector4(...values));},
    setScissor(...values){this.scissor.copy(values[0]?.isVector4?values[0]:new THREE.Vector4(...values));},
    setScissorTest(enabled){this.scissorTest=enabled;},
    getScissorTest(){return this.scissorTest;},
    getDrawingBufferSize(target){return target.set(1200,800);},
    getRenderTarget(){return this.renderTarget;},
    setRenderTarget(target){this.renderTarget=target;},
    clear(){records.push({type:'clear',scissor:this.scissor.clone(),enabled:this.scissorTest});},
    clearDepth(){records.push({type:'depth',scissor:this.scissor.clone(),enabled:this.scissorTest});},
    render(scene,camera){records.push({type:'render',scene,camera,viewport:this.viewport.clone(),enabled:this.scissorTest});},
  };
  const canvas={width:1200,height:800,clientWidth:1200,clientHeight:800,
    getBoundingClientRect:()=>({left:0,top:0,width:1200,height:800})};
  const localCanvas={width:300,height:150,clientWidth:500,clientHeight:400,
    isConnected:true,style:{},
    ownerDocument:{defaultView:{frameElement:{getBoundingClientRect:()=>({left:50,top:50})}}},
    getBoundingClientRect:()=>({left:0,top:0,width:500,height:400})};
  const host=createSharedRendererHost({renderer,canvas});
  const original=host.createRenderer('atelier',localCanvas);
  assert.equal(original.domElement,localCanvas);
  assert.equal(typeof original.getPixelRatio,'function','the Atelier expects a WebGLRenderer method');
  assert.equal(original.getPixelRatio(),1);
  original.setPixelRatio(1.5);
  assert.equal(original.getPixelRatio(),1.5,'pixel ratio must stay in sync with local renderer settings');
  original.setSize(500,400,false);
  assert.deepEqual([localCanvas.width,localCanvas.height],[750,600]);
  assert.deepEqual(original.getSize(new THREE.Vector2()).toArray(),[500,400]);
  assert.deepEqual(original.getDrawingBufferSize(new THREE.Vector2()).toArray(),[750,600]);
  const atelierFilter=createCartoonFilter({THREE,renderer:original,scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera()});
  assert.doesNotThrow(()=>atelierFilter.setOptions({backgroundBlur:.72}),
    'Atelier postprocessing must initialize through the shared renderer proxy');
  atelierFilter.dispose();
  assert.equal(canvas.width,1200);
  original.render(new THREE.Scene(),new THREE.Camera());
  assert.equal(records.some(record=>record.type==='render'),false,'inactive workshops cannot draw');

  host.activate('atelier');
  original.toneMappingExposure=1.45;
  original.autoClear=false;
  const scene=new THREE.Scene(),camera=new THREE.Camera();
  original.render(scene,camera);
  const pass=records.find(record=>record.type==='render');
  assert.equal(pass.scene,scene);
  assert.deepEqual(pass.viewport.toArray(),[50,350,500,400]);
  assert.equal(pass.enabled,true);
  assert.deepEqual(renderer.viewport.toArray(),[0,0,1200,800]);
  original.clearDepth();
  assert.equal(records.at(-1).enabled,true);
  host.deactivate('atelier');
  assert.equal(renderer.autoClear,true);
  assert.equal(renderer.toneMappingExposure,1.1);
  host.activate('atelier');
  assert.equal(renderer.autoClear,false,'restored workshop keeps its original composer settings');
  assert.equal(renderer.toneMappingExposure,1.45);
  host.deactivate('atelier');
});
