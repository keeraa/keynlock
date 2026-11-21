import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.js';
import {createPavingSurface,PAVING_BASE_COLOR,PAVING_MAP,PAVING_STONE_SIZE} from '../js/path-builder/paving-art.js';
import {createPathPainter} from '../js/path-builder/path-painter.js';
import {WATER_CUTOUT_THRESHOLD} from '../js/path-builder/water-bed-cutout.js';

// Canvas protocol smoke test: the painter also runs in browsers without WebGL.
// Recording contexts catch undefined canvas calls and mask state leaks.
class TestContext{
  strokes=0;draws=0;patterns=0;curves=0;lineWidths=[];clips=0;fills=[];
  waterCutouts=0;bridgeCutouts=0;states=[];
  reads=0;writes=0;sampleAlpha=255;globalCompositeOperation='source-over';
  beginPath(){}
  closePath(){}
  save(){this.states.push(this.globalCompositeOperation);}
  restore(){this.globalCompositeOperation=this.states.pop()||'source-over';}
  translate(){}
  rotate(){}
  arc(){}
  clip(){this.clips++;}
  moveTo(){}
  lineTo(){}
  quadraticCurveTo(){this.curves++;}
  stroke(){this.strokes++;this.lineWidths.push(this.lineWidth);}
  fill(){}
  fillRect(){this.fills.push(this.fillStyle);
    if(this.globalCompositeOperation==='destination-out')this.bridgeCutouts++;}
  getImageData(){this.reads++;return {data:Uint8ClampedArray.from([73,71,71,this.sampleAlpha])};}
  putImageData(image){this.writes++;this.lastPixels=Array.from(image.data);}
  clearRect(){}
  drawImage(){this.draws++;
    if(this.globalCompositeOperation==='destination-out')this.waterCutouts++;}
  createRadialGradient(){return {addColorStop(){}};}
  createLinearGradient(){return {addColorStop(){}};}
  createPattern(){this.patterns++;return {setTransform:matrix=>{this.patternMatrix=matrix;}};}
}
const canvases=[];
const originalDocument=globalThis.document;
const originalDOMMatrix=globalThis.DOMMatrix;
globalThis.DOMMatrix=class {constructor(values){this.values=values;}};
globalThis.document={createElement(tag){
  assert.equal(tag,'canvas');
  const canvas={width:0,height:0,context:new TestContext(),
    getContext(type){assert.equal(type,'2d');return this.context;}};
  canvases.push(canvas);return canvas;
}};
try{
  const paving=createPavingSurface();
  assert.equal(paving.canvas.width,PAVING_MAP.width*PAVING_MAP.pixelsPerMetre);
  assert.equal(paving.canvas.height,PAVING_MAP.depth*PAVING_MAP.pixelsPerMetre);
  assert.equal(canvases.length,5,'Paving caches final, previous, progress, mask and cobble atlases');
  assert.equal(canvases[3].context.patterns,1,'Stone mosaic is cached across repaints');
  assert.equal(PAVING_STONE_SIZE.widthMetres,2/3,'Cobbles retain their pre-expansion physical width');
  assert.equal(PAVING_STONE_SIZE.heightMetres,.6,'Cobbles retain their pre-expansion physical height');
  assert.equal(PAVING_STONE_SIZE.tileMetres,30,'Small painted tile repeats every 30 world metres');
  assert.ok(Math.abs(PAVING_STONE_SIZE.patternScale-PAVING_MAP.pixelsPerMetre/12)<.00001);
  assert.ok(Math.abs(canvases[3].context.patternMatrix.values[0]-PAVING_MAP.pixelsPerMetre/12)<.00001,
    'The tile shrinks with atlas resolution instead of becoming a 6-metre slab');
  canvases[3].context.sampleAlpha=110;
  paving.setPaths([{id:'a',width:.87,p:[[0,0],[9,0],[9,8]]}],{animate:false});
  const strokeCount=canvases[0].context.strokes;
  assert.deepEqual(paving.setPaths([{id:'changed-id',width:.87,p:[[0,0],[9,0],[9,8]]}],{
    animate:false,landscape:{rivers:[],trees:[{x:200,z:20}]} }),
  {finalChanged:false,beforeChanged:false,progressChanged:false},
  'Tree edits and regenerated path arrays must not repaint unchanged paving');
  assert.equal(canvases[0].context.strokes,strokeCount,
    'Identical street geometry reuses cached full-map canvas');
  assert.equal(canvases[3].context.fills.at(-1),PAVING_BASE_COLOR,
    'GPU paving uses neutral mortar undercoat rather than leaving white gaps');
  assert.deepEqual(canvases[2].context.lastPixels.slice(0,2),[73,110],
    'Green stores partial road coverage from mask alpha without altering red arrival');
  assert.ok(canvases[0].context.strokes>=3,'Curbs and mortar must be painted');
  assert.ok(canvases[0].context.curves>0,'Sharp corners should have smooth radii');
  assert.ok(canvases[0].context.draws>=1,'Masked cobbles must cover the road');
  assert.equal(canvases[3].context.globalCompositeOperation,'source-over',
    'Mask compositing must reset before any later redraw');
  paving.setPaths([], {animate:false,forecourts:[{x:0,z:0,width:6,depth:4,rotation:0}]});
  assert.ok(canvases[0].context.draws>=4,'A forecourt must be rendered without connecting paths');
  paving.setPaths([
    {id:'a',width:.87,p:[[0,0],[9,0],[9,8]]},
    {id:'b',width:1.08,p:[[9,8],[18,8]]},
  ],{animate:true});
  assert.equal(paving.isAnimating(),true,'New road segments activate reveal animation');
  const strokesBeforeFrame=canvases[0].context.strokes;
  const maskBeforeFrame=canvases[3].context.strokes;
  assert.ok(canvases[2].context.strokes>0,'A grayscale path-arrival atlas is generated once');
  assert.equal(paving.update(performance.now()+250),true);
  assert.ok(paving.getProgress()>0.015&&paving.getProgress()<1);
  assert.equal(canvases[0].context.strokes,strokesBeforeFrame,
    'GPU animation must never repaint the expensive cobblestone sheet');
  assert.equal(canvases[3].context.strokes,maskBeforeFrame,
    'GPU animation must never regenerate cobblestone masks');
  assert.equal(paving.update(performance.now()+1000),true);
  assert.equal(paving.isAnimating(),false);
  assert.equal(paving.update(performance.now()+1200),false,
    'Finished emergence must stop repainting on every frame');
  paving.setStyle('street');
  assert.ok(canvases[2].context.writes>=4,
    'Switching styles also refreshes the stone-coverage texture');
  const streetWidth=canvases[0].context.lineWidths.at(-1);
  paving.setStyle('walk');
  const walkWidth=canvases[0].context.lineWidths.at(-1);
  assert.ok(streetWidth>walkWidth,'City roads must be visibly wider than pedestrian paths');
  paving.setStyle('auto');
  assert.ok(canvases[0].context.draws>=4,'Switching paving types should redraw the surface');

  const fallback=createPavingSurface({useCanvasAnimation:true});
  const fallbackPreview=canvases[8].context,finalFallback=canvases[5].context;
  fallback.setPaths([{id:'preview',p:[[0,0],[9,0],[9,8]]}],{animate:true});
  assert.equal(typeof canvases[9].context.fills.at(-1),'object',
    'Canvas-only fallback still paints its own repeated stones');
  const paintedStrokes=finalFallback.strokes;
  assert.equal(fallback.update(performance.now()+420),true);
  assert.ok(fallbackPreview.clips>0,'2D fallback reveals cached images through a narrow path clip');
  assert.equal(finalFallback.strokes,paintedStrokes,
    '2D frames must reuse the complete road painting without costly regeneration');

  const fakeScene={add(mesh){this.mesh=mesh;},remove(mesh){assert.equal(mesh,this.mesh);}};
  const painter=createPathPainter(THREE,fakeScene);
  const staticMaterial=painter.mesh.material;
  assert.equal(staticMaterial.isShaderMaterial,true,'Static streets sample a sharp tiled pigment texture');
  assert.match(staticMaterial.fragmentShader,/uStones/);
  assert.match(staticMaterial.fragmentShader,/paintPaving/);
  assert.match(staticMaterial.fragmentShader,/texture2D\(uReveal,vUv\)\.g/,
    'Shader uses coverage data, not a brittle near-white color threshold');
  assert.equal(staticMaterial.uniforms.uBasePigment.value.getHexString(),PAVING_BASE_COLOR.slice(1));
  assert.equal(staticMaterial.uniforms.uStones.value.wrapS,THREE.RepeatWrapping);
  assert.equal(staticMaterial.uniforms.uStones.value.wrapT,THREE.RepeatWrapping);
  assert.equal(staticMaterial.uniforms.uStones.value.image.width,360,
    'Stone tile is small; no higher-resolution full-city atlas is allocated');
  assert.ok(Math.abs(staticMaterial.uniforms.uStoneRepeats.value.x-PAVING_MAP.width/30)<.001);
  assert.ok(Math.abs(staticMaterial.uniforms.uStoneRepeats.value.y-PAVING_MAP.depth/30)<.001);
  painter.setPaths([{id:'gpu-road',p:[[0,0],[10,0]]}],{animate:true,forecourts:[]});
  const noOpUpload=painter.mesh.material.uniforms.uFinal.value.version;
  const noOpCoverage=painter.mesh.material.uniforms.uReveal.value.version;
  painter.setPaths([{id:'same-route',p:[[0,0],[10,0]]}],{animate:true,forecourts:[]});
  assert.equal(painter.mesh.material.uniforms.uFinal.value.version,noOpUpload,
    'Unchanged roads cause no full atlas upload');
  assert.equal(painter.mesh.material.uniforms.uReveal.value.version,noOpCoverage,
    'Unchanged roads cause no coverage atlas upload');
  assert.equal(painter.mesh.material.isShaderMaterial,true,'GPU mode uses a reveal shader during animation');
  const animated=painter.mesh.material;
  const uploadVersion=animated.uniforms.uFinal.value.version;
  painter.update(performance.now()+330);
  assert.ok(animated.uniforms.uProgress.value>0.015,'Reveal advances through a float uniform');
  assert.equal(animated.uniforms.uFinal.value.version,uploadVersion,
    'WebGL road animation must not trigger per-frame full-atlas texture uploads');
  assert.equal(animated.uniforms.uReveal,staticMaterial.uniforms.uReveal,
    'Static and animated shaders share the same road coverage mask');
  painter.update(performance.now()+1000);
  assert.equal(painter.mesh.material,staticMaterial,
    'Finished road animation switches back to the cheap static stone shader');
  painter.dispose();

  const waterTexture=new THREE.Texture();
  const maskedPainter=createPathPainter(THREE,fakeScene,{waterMaskTexture:waterTexture});
  const maskedRoad=maskedPainter.mesh.material;
  assert.equal(maskedRoad.defines.USE_WATER_MASK,1,
    'The 3D road renderer must clip every visible river pixel');
  assert.equal(maskedRoad.uniforms.uWaterMask.value,waterTexture);
  assert.match(maskedRoad.fragmentShader,
    new RegExp(`texture2D\\(uWaterMask,vUv\\)\\.a > ${WATER_CUTOUT_THRESHOLD}`),
    'Water clipping uses the exact same threshold as the river surface');
  maskedPainter.dispose();waterTexture.dispose();

  const sharedWaterMask={width:800,height:550};
  const bridgePaving=createPavingSurface({waterMaskCanvas:sharedWaterMask});
  const cutoutCanvas=canvases.at(-5).context;
  bridgePaving.setPaths([{id:'to-river',width:6,p:[[0,0],[40,0]]}],{
    animate:false,bridges:[{id:'stone-span',x:20,z:0,span:12,deckWidth:4,
      dirX:0,dirZ:1}],
  });
  assert.ok(cutoutCanvas.waterCutouts>0,
    'All paving layers are erased wherever the shared water atlas has alpha');
  assert.ok(cutoutCanvas.bridgeCutouts>0,
    'The whole bridge deck remains free of overlaid road geometry');
  assert.equal(cutoutCanvas.globalCompositeOperation,'source-over',
    'Cutouts must not leak destination-out into later road repaints');
  const previousCutouts=cutoutCanvas.waterCutouts;
  bridgePaving.refreshWaterMask();
  assert.ok(cutoutCanvas.waterCutouts>previousCutouts,
    'Async reference-water loading repaints existing roads without another edit');
  bridgePaving.dispose();
  console.log('Shared gouache paving: continuous stone atlas, mask, kerbs and animation OK');
}finally{
  if(originalDocument===undefined)delete globalThis.document;
  else globalThis.document=originalDocument;
  if(originalDOMMatrix===undefined)delete globalThis.DOMMatrix;
  else globalThis.DOMMatrix=originalDOMMatrix;
}
