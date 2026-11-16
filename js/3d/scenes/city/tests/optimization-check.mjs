import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import * as THREE from '../vendor/three-core.js';
import {createReflectionGate} from '../js/water.js';

const outlines=readFileSync(resolve('js/effects/cartoon-filter.js'),'utf8');
assert.ok(outlines.includes('object.isSprite'),
  'Soft lantern halos must be excluded from the normal pass to avoid rectangular black outlines');

// The mirror updates instantly as the camera changes, then settles to 30 fps.
const gate=createReflectionGate(THREE);
const camera=new THREE.OrthographicCamera(-10,10,10,-10,.1,100);
camera.position.set(10,20,30);
camera.updateProjectionMatrix();
assert.equal(gate.shouldRender(camera,0),true,'The first reflection must render');
assert.equal(gate.shouldRender(camera,16),false,'A static view should reuse the mirror texture');
assert.equal(gate.shouldRender(camera,33),true,'Moving ships still need frequent reflection updates');
camera.position.x+=.1;
assert.equal(gate.shouldRender(camera,34),true,'Camera translation should immediately update reflection');
camera.zoom=1.25;camera.updateProjectionMatrix();
assert.equal(gate.shouldRender(camera,35),true,'Camera zoom should immediately update reflection');
camera.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),.2);
assert.equal(gate.shouldRender(camera,36),true,'Camera rotation should immediately update reflection');
gate.invalidate();
assert.equal(gate.shouldRender(camera,37),true,'Lighting changes should refresh reflection');

// Stand-in 2D context keeps this test independent of browser and WebGL.
let textureDraws=0;
const draw=()=>{};
const ctx={fillRect:draw,save:draw,restore:draw,translate:draw,rotate:draw,
  beginPath:draw,ellipse:draw,fill:draw,moveTo:draw,quadraticCurveTo:draw,stroke:draw};
globalThis.document={createElement(tag){
  assert.equal(tag,'canvas');textureDraws++;
  return {width:0,height:0,getContext:()=>ctx};
}};
const materialsSource=readFileSync(resolve('js/materials.js'),'utf8')
  .replace("from 'three'",`from "${pathToFileURL(resolve('vendor/three-core.js')).href}"`);
const {CityMaterials}=await import(`data:text/javascript;base64,${Buffer.from(materialsSource).toString('base64')}`);
const cityMats=new CityMaterials();
const keys=['land','roofNeutral','stone','plaster','greenery'];
const meshes=Object.fromEntries(keys.map(key=>[key,cityMats.get(key)]));
const initialMaps=Object.fromEntries(keys.map(key=>[key,meshes[key].map]));
assert.equal(textureDraws,keys.length);
cityMats.configure({paintMaterial:50});
assert.equal(textureDraws,keys.length,'Adjusting roughness must not repaint texture canvases');
assert.ok(keys.every(key=>meshes[key].map===initialMaps[key]));
assert.ok(meshes.land.roughness<.96,'Material finish should still update');
cityMats.configure({roof:'jade'});
assert.equal(textureDraws,keys.length+1,'Roof color should only repaint roof texture');
assert.notEqual(meshes.roofNeutral.map,initialMaps.roofNeutral);
assert.equal(meshes.land.map,initialMaps.land);
cityMats.configure({wall:'cool'});
assert.equal(textureDraws,keys.length+3,'Wall color should only repaint the two wall textures');
assert.notEqual(meshes.stone.map,initialMaps.stone);
assert.notEqual(meshes.plaster.map,initialMaps.plaster);
assert.equal(meshes.greenery.map,initialMaps.greenery);
cityMats.configure({roof:'jade',wall:'cool'});
assert.equal(textureDraws,keys.length+3,'Unchanged options should be free');
cityMats.configure({paintStrength:83});
assert.equal(textureDraws,keys.length*2+3,'Paint strength should repaint each active material');
cityMats.configure({paint:false});
assert.ok(keys.every(key=>meshes[key].map===null));
const drawingsBeforeDisabled=textureDraws;
cityMats.configure({paintStrength:60,paintDetail:4});
assert.equal(textureDraws,drawingsBeforeDisabled,'Disabled paints should not allocate textures');
cityMats.configure({paint:true});
assert.equal(textureDraws,drawingsBeforeDisabled+keys.length);
cityMats.dispose();
delete globalThis.document;
console.log('Optimization: cached shadows, adaptive reflections, selective textures');
