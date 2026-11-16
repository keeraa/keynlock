import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.js';
import { createHouseModel } from '../js/buildings/house-model.js';
import { batchHouseGeometry } from '../js/buildings/house-batch.js';
import { fadeEase,isolateHouseFade,HOUSE_LOD_FADE_MS } from '../js/street/street-lod-fade.js';

const first=createHouseModel(THREE,{floors:3,windowStyle:'arched',balcony:true},{detail:'low'});
const second=createHouseModel(THREE,{floors:3,windowStyle:'arched',balcony:true},{detail:'medium'});
batchHouseGeometry(THREE,first.group);batchHouseGeometry(THREE,second.group);
const firstMeshes=[],secondMeshes=[];
first.group.traverse(mesh=>{if(mesh.isMesh)firstMeshes.push(mesh);});
second.group.traverse(mesh=>{if(mesh.isMesh)secondMeshes.push(mesh);});
const oldMaterials=firstMeshes.map(mesh=>mesh.material);
const newMaterials=secondMeshes.map(mesh=>mesh.material);
const fade=isolateHouseFade(first.group,0,12);
const outgoingFade=isolateHouseFade(second.group,1,11);
firstMeshes.forEach((mesh,i)=>{
  if(mesh.userData.houseInvariant){
    assert.equal(mesh.material,oldMaterials[i],'Permanent geometry must preserve its material');
  }else{
    assert.notEqual(mesh.material,oldMaterials[i],'Transition materials must be isolated');
    assert(mesh.material.transparent&&!mesh.material.depthWrite);
    assert.equal(mesh.material.opacity,0);
  }
});
secondMeshes.forEach((mesh,i)=>{
  if(!mesh.userData.houseInvariant){
    assert.notEqual(mesh.material,newMaterials[i],'Outgoing house must have isolated fade materials');
    assert.equal(mesh.renderOrder,11);
  }
});
fade.setOpacity(.6);
outgoingFade.setOpacity(.4);
firstMeshes.forEach((mesh,i)=>assert(Math.abs(mesh.material.opacity-oldMaterials[i].opacity*(mesh.userData.houseInvariant?1:.6))<.0001));
secondMeshes.forEach((mesh,i)=>assert(Math.abs(mesh.material.opacity-newMaterials[i].opacity*(mesh.userData.houseInvariant?1:.4))<.0001));
fade.release();fade.release();outgoingFade.release();outgoingFade.release();
firstMeshes.forEach((mesh,i)=>assert.equal(mesh.material,oldMaterials[i]));
secondMeshes.forEach((mesh,i)=>assert.equal(mesh.material,newMaterials[i]));

const fixed=first.group.userData.shellMaterials;
const fixedMeshes=firstMeshes.filter(mesh=>mesh.userData.houseInvariant||fixed.includes(mesh.material));
const detailMeshes=firstMeshes.filter(mesh=>!fixedMeshes.includes(mesh));
assert(fixedMeshes.length>=2&&detailMeshes.length>0,'The shell and the details are separate batches');
const shellFade=isolateHouseFade(first.group,0,12,{fixedMaterials:fixed,showFixed:false});
fixedMeshes.forEach(mesh=>{
  assert.equal(mesh.visible,false,'Outgoing opaque facade must be hidden');
  assert.equal(mesh.material,oldMaterials[firstMeshes.indexOf(mesh)],'Do not clone stable paint maps');
});
detailMeshes.forEach(mesh=>assert.equal(mesh.material.opacity,0));
shellFade.release();
fixedMeshes.forEach(mesh=>assert.equal(mesh.visible,true));
firstMeshes.forEach((mesh,i)=>assert.equal(mesh.material,oldMaterials[i]));
const invariant=firstMeshes.filter(mesh=>mesh.userData.houseInvariant);
assert(invariant.length>=4,'Roof, base and stable geometry must be invariant');
const ditherFade=isolateHouseFade(first.group,0,9,{
  fixedMaterials:fixed,showFixed:true,dither:true,
});
invariant.forEach(mesh=>assert(mesh.visible,'An opaque permanent shell must remain visible at zero detail opacity'));
const fading=firstMeshes.filter(mesh=>!mesh.userData.houseInvariant&&!fixed.includes(oldMaterials[firstMeshes.indexOf(mesh)]));
assert(fading.length>0);
fading.forEach(mesh=>{
  assert(!mesh.visible,'Details are initially hidden');
  assert(mesh.material.alphaHash,'Details must fade with depth-tested screen-door transparency');
  assert(!mesh.material.transparent&&mesh.material.depthWrite);
});
ditherFade.setOpacity(.43);
fading.forEach(mesh=>{
  assert(mesh.visible,'Partial details should appear gradually');
  assert(Math.abs(mesh.material.opacity-oldMaterials[firstMeshes.indexOf(mesh)].opacity*.43)<.0001);
});
ditherFade.setOpacity(0);
fading.forEach(mesh=>assert(!mesh.visible));
ditherFade.release();
firstMeshes.forEach((mesh,i)=>{
  assert.equal(mesh.material,oldMaterials[i]);
  assert(mesh.visible,'Fade cleanup must restore visibility');
});
assert.equal(fadeEase(0),0);assert.equal(fadeEase(.5),.5);assert.equal(fadeEase(1),1);
assert(HOUSE_LOD_FADE_MS>=500&&HOUSE_LOD_FADE_MS<=1000);
first.dispose();second.dispose();
console.log('LOD fade: independent temporary materials, smooth curve, cleanup and restoration OK');
