import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three-core.js';
import {createWorkshopMaterials,populateWorkshopRoom,
  WORKBENCH_TOP_Y} from '../public/js/workshop-room.js';

test('key and lock share the same painted materials and texture sources',()=>{
  const loaded=[];
  class StubLoader{
    load(path){loaded.push(path);return new THREE.Texture();}
  }
  const mat=createWorkshopMaterials({...THREE,TextureLoader:StubLoader});
  assert.deepEqual(loaded,[
    './assets/painted-gear.webp','./assets/painted-pin.webp',
    './assets/painted-brass.webp','./assets/painted-steel.webp'
  ]);
  assert.equal(mat.brass.map,mat.steel.map);
  assert.equal(mat.key.map,mat.copper.map);
  assert.equal(mat.key.side,THREE.DoubleSide);
  assert.equal(mat.marker.transparent,true);
  assert.equal(mat.hit.opacity,0);
  const textures=new Set(Object.values(mat).map(m=>m.map).filter(Boolean));
  for(const material of Object.values(mat))material.dispose();
  for(const texture of textures)texture.dispose();
});

test('room geometry and warm lighting keep their original arrangement',()=>{
  const room=new THREE.Scene();
  const parts=[];
  const shapes={
    box:(parent,...args)=>{parts.push(['box',parent,args]);return {castShadow:true};},
    cyl:(parent,...args)=>{parts.push(['cyl',parent,args]);return {castShadow:true};}
  };
  populateWorkshopRoom(THREE,room,shapes,{
    woodTop:{},wood:{},dark2:{},copper:{},dark:{}
  });
  assert.ok(Math.abs(WORKBENCH_TOP_Y+1.65)<1e-12);
  assert.equal(parts.filter(([type])=>type==='box').length,8);
  assert.equal(parts.filter(([type])=>type==='cyl').length,3);
  const lights=room.children.filter(object=>object.isLight);
  assert.equal(lights.length,4);
  assert.equal(lights.filter(light=>light.castShadow).length,1);
  const lamp=room.children.find(object=>object.isGroup);
  assert.deepEqual(lamp.position.toArray(),[-3.95,2.34,-1.65]);
});
