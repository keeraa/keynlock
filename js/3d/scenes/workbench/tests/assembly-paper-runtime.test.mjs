import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three.js';
import {createAssemblyMechanism} from '../public/js/assembly-scene.js';

test('the physical paper switches between the actual pin and five-gear layouts',()=>{
  const previousDocument=globalThis.document,previousImage=globalThis.Image;
  const previousLoader=THREE.TextureLoader.prototype.load;
  const drawings=[];
  const gradient=()=>({addColorStop(){}});
  const context=new Proxy({
    drawImage(){},createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),
    createLinearGradient:gradient,createRadialGradient:gradient,
    getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4)})
  },{get(target,key){return key in target?target[key]:()=>{};}});
  globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>context})};
  globalThis.Image=class {
    set src(value){
      drawings.push(decodeURIComponent(value.split(',')[1]));
      this.onload?.();
    }
  };
  THREE.TextureLoader.prototype.load=()=>new THREE.Texture();
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),hitObjects=[];
  const addMesh=(parent,geometry,material,position)=>{
    const mesh=new THREE.Mesh(geometry,material);
    if(position)mesh.position.set(...position);
    parent.add(mesh);return mesh;
  };
  let assembly;
  try{
    assembly=createAssemblyMechanism({scene,camera,addMesh,hitObjects});
    assembly.setAssemblyDesign('extended',{},[2,0,3,1]);
    assert.equal(drawings.length,1);
    assert.match(drawings[0],/data-drawing-mode="pins"/);
    assert.match(drawings[0],/35 СЪЁМНЫХ УЗЛОВ/);
    assembly.setGearMode(true);
    assert.equal(drawings.length,2);
    assert.match(drawings[1],/data-drawing-mode="gears"/);
    assert.equal((drawings[1].match(/data-gear-teeth=/g)||[]).length,5);
    assembly.setGearMode(false);
    assert.equal(drawings.length,3);
    assert.match(drawings[2],/data-drawing-mode="pins"/);
    assert.equal(drawings[2],drawings[0],'pin order and housing reference are restored');
    assembly.setGearMode(false);
    assert.equal(drawings.length,3,'an unchanged paper is not redrawn');
  }finally{
    assembly?.dispose();
    THREE.TextureLoader.prototype.load=previousLoader;
    if(previousDocument===undefined)delete globalThis.document;
    else globalThis.document=previousDocument;
    if(previousImage===undefined)delete globalThis.Image;
    else globalThis.Image=previousImage;
  }
});
