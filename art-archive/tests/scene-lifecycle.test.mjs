import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from '../vendor/three.js';
import {createArchiveScene} from '../src/scene/create-scene.js';
const config=JSON.parse(await fs.readFile(new URL('../config/scene.json',import.meta.url)));
test('the public scene can be mounted twice with a shared engine and frees visible resources exactly once',()=>{
 const originalDocument=globalThis.document,loads=[];
 globalThis.document={createElement:()=>({getContext:()=>({createLinearGradient:()=>({addColorStop(){}}),fillRect(){},strokeRect(){},fillText(){}})})};
 const engine={...THREE,TextureLoader:class {load(url){loads.push(url);return new THREE.Texture();}}};
 try{
  for(let run=0;run<2;run++){
   const world=createArchiveScene({THREE:engine,config,cloudSettings:{enabled:false},translate:value=>'Test '+value});
   const resources=new Set([world.scene.background]);
   world.scene.traverse(object=>{if(object.geometry)resources.add(object.geometry);for(const material of object.material?(Array.isArray(object.material)?object.material:[object.material]):[]){resources.add(material);if(material.map)resources.add(material.map);}});
   const counts=new Map();for(const resource of resources)resource.addEventListener('dispose',()=>counts.set(resource,(counts.get(resource)||0)+1));
   assert.equal(world.camera.fov,73);assert.equal(world.layout.halls.length,6);world.building.refreshLanguage();world.building.setCutaway(true);
   world.dispose();world.dispose();assert.equal(world.scene.children.length,0);
   for(const resource of resources)assert.equal(counts.get(resource),1,resource.type||'geometry');
  }
  const firstMount=loads.slice(0,loads.length/2);
  assert.deepEqual(loads.slice(firstMount.length),firstMount);
  assert.equal(new Set(firstMount).size,firstMount.length);
  assert(firstMount.some(url=>url.endsWith('/gouache-lair-door.webp')));
 }finally{globalThis.document=originalDocument;}
});
