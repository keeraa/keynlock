import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.js';
import {VISUAL_DEFAULTS} from '../config/runtime.js';
import {createPaintedRenderer} from '../src/rendering/painted-renderer.js';

test('painted lighting shares the contour draw and still works independently',()=>{
 let target=null;
 const renderer={
  capabilities:{maxSamples:2},info:{reset(){}},
  getPixelRatio:()=>1,getDrawingBufferSize:size=>size.set(32,24),
  getRenderTarget:()=>target,setRenderTarget:value=>{target=value;},
  render(){},readRenderTargetPixels(_target,_x,_y,_w,_h,pixels){pixels.fill(80);},
 };
 const painted=createPaintedRenderer(renderer,new THREE.Scene(),new THREE.PerspectiveCamera(),VISUAL_DEFAULTS);
 function expect(settings,passes){
  painted.setSettings({...VISUAL_DEFAULTS,...settings});
  painted.render();painted.render();
  assert.equal(painted.getPassCount(),passes);
  assert.equal(painted.getStatus().stages.toon,(settings.toonEnabled??VISUAL_DEFAULTS.toonEnabled)?'active':'off');
  assert.equal(target,null);
 }
 try{
  expect({},4);
  expect({toonEnabled:true},4);
  expect({toonEnabled:true,outlineEnabled:false,distanceBlurEnabled:false},2);
  expect({toonEnabled:false},4);
  expect({toonEnabled:false,outlineEnabled:false,distanceBlurEnabled:false},1);
 }finally{painted.dispose();}
});
