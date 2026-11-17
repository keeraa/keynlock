import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import * as THREE from '../vendor/three.js';
import {createCartoonFilter} from '../js/effects/cartoon-filter.js';
import {EDITOR_VISUAL_DEFAULTS,EDITOR_VISUAL_STORAGE_KEY,normalizeEditorVisualState} from '../js/effects/editor-visual.js';

assert.equal(EDITOR_VISUAL_STORAGE_KEY,'keynlock.editor.visual.v1');
assert.deepEqual(normalizeEditorVisualState(null),EDITOR_VISUAL_DEFAULTS);
const restored=normalizeEditorVisualState({toon:false,outline:true,outlineStrength:777,
  outlineWidth:2.3,bands:-6,exposure:'115',grain:null});
assert.deepEqual(restored,{...EDITOR_VISUAL_DEFAULTS,toon:false,
  outlineStrength:100,outlineWidth:2.5,bands:2,exposure:115});
assert.equal(normalizeEditorVisualState({toon:'off'}).toon,true,'Stored toggles must be boolean');

for(const [page,entry] of [
  ['house-builder','../js/buildings/house-editor.js'],
  ['street-lab','../js/street/street-editor.js'],
  ['landmark-lab','../js/landmarks/landmark-editor.js'],
]){
  const html=await readFile(new URL(`../${page}/index.html`,import.meta.url),'utf8');
  assert.match(html,/css\/editor-visual\.css/,`${page} misses the visual drawer stylesheet`);
  assert.match(html,/id="stageGrain"/,`${page} misses the paper grain layer`);
  const source=await readFile(new URL(entry,import.meta.url),'utf8');
  assert.match(source,/mountEditorVisual\(/,`${page} does not mount shared visual controls`);
  assert.match(source,page==='street-lab'?/createStreetScene\(canvas,\{onMetrics,onPick:renderPicked,visual\}\)/:/visual\.(render|connect)\(/,
    `${page} does not use the shared cartoon renderer`);
}
const street=await readFile(new URL('../js/street/street-scene.js',import.meta.url),'utf8');
assert.match(street,/visual\?\.connect\(/);
assert.match(street,/visual\?\.resize\(/);
assert.match(street,/visual\?\.dispose\(/);
assert.ok((await stat(new URL('../css/editor-visual.css',import.meta.url))).size>2000);

// Exercise the same city filter in both unfiltered and illustrated modes
// without requiring a GPU in the build/test environment.
const camera=new THREE.PerspectiveCamera(40,1,.1,500);
const scene=new THREE.Scene();
let target=null,draws=0;
const renderer={
  info:{render:{calls:3,triangles:12}},
  getPixelRatio:()=>1,
  getRenderTarget:()=>target,
  setRenderTarget:next=>{target=next;},
  render:()=>{draws++;},
};
const filter=createCartoonFilter({THREE,renderer,scene,camera});
filter.resize(256,128);
assert.deepEqual(filter.render(),{calls:3,triangles:12});
assert.equal(draws,1);
filter.setOptions({toon:true,toonStrength:.8,bands:4});
const toonFrame=filter.render();
assert.equal(toonFrame.sceneTriangles,12);
assert.equal(toonFrame.calls,4);
assert.equal(draws,3);
filter.setOptions({toon:false,outline:true,outlineStrength:.7,outlineWidth:1});
const outlinedFrame=filter.render();
assert.equal(outlinedFrame.sceneTriangles,12);
assert.equal(outlinedFrame.calls,7);
assert.equal(draws,6);
assert.equal(renderer.getRenderTarget(),null);
filter.dispose();
console.log('Shared KEYNLOCK cartoon filter, settings persistence and all three editor integrations OK');
