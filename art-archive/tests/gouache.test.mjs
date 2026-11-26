import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.js';
import {createGouache} from '../src/paintings/gouache.js';

test('switching finishes shares both maps and late arrivals never revert the selection', () => {
  const requests = new Map();
  class Loader {
    load(url, done) {
      const texture = new THREE.Texture();
      const key = new URL(url).pathname.split('/').pop();
      assert(!requests.has(key));
      requests.set(key, {texture, done});
      return texture;
    }
  }
  const finish = createGouache({...THREE, TextureLoader: Loader});
  const shaders = [new THREE.MeshBasicMaterial(), new THREE.MeshStandardMaterial()].map(material => {
    const shader = {uniforms:{}, vertexShader:'', fragmentShader:''};
    finish.apply(material).onBeforeCompile(shader);
    return shader.uniforms;
  });
  assert.equal(shaders[0].archivePigmentEnabled.value,false);
  assert(shaders.every(s=>s.archiveEasyMode.value===true));
  finish.setEasyMode(false);
  assert(shaders.every(s=>s.archiveEasyMode.value===false));
  finish.setStyle('walnut');
  finish.setStyle('oak');
  for (const kind of ['wood','pigment']) requests.get('oak-'+kind+'.webp').done();
  for (const kind of ['pigment','wood']) requests.get('walnut-'+kind+'.webp').done();
  for (const u of shaders) assert.equal(u.archiveWood.value, requests.get('oak-wood.webp').texture);
  finish.setStyle('walnut');
  assert.equal(shaders[0].archivePigment.value, requests.get('walnut-pigment.webp').texture);
  finish.setPigment(true);
  assert(shaders.every(s=>s.archivePigmentEnabled.value));
  let disposed = 0;
  for (const {texture} of requests.values()) texture.addEventListener('dispose',()=>disposed++);
  finish.dispose();
  assert.equal(disposed,4);
});

test('mixed finishes share three wood pairs and wait for every map before rendering',()=>{
 const requests=new Map();
 class Loader{load(url,done){const texture=new THREE.Texture();requests.set(new URL(url).pathname.split('/').pop(),{texture,done});return texture;}}
 const finish=createGouache({...THREE,TextureLoader:Loader}),shader={uniforms:{},vertexShader:'',fragmentShader:''};
 finish.apply(new THREE.MeshBasicMaterial()).onBeforeCompile(shader);finish.setStyle('mixed');
 const u=shader.uniforms;assert(u.archiveMixed.value);assert.equal(requests.size,6);
 const entries=[...requests.values()];for(const entry of entries.slice(0,-1))entry.done();assert.equal(u.archiveReady.value,false);
 entries.at(-1).done();assert(u.archiveReady.value);
 assert.equal(u.archiveOak.value,requests.get('oak-wood.webp').texture);assert.equal(u.archiveEbony.value,requests.get('ebony-wood.webp').texture);
 finish.setStyle('oak');finish.setStyle('mixed');assert.equal(requests.size,6,'switching never duplicates the shared maps');
 let disposed=0;for(const {texture} of requests.values())texture.addEventListener('dispose',()=>disposed++);
 finish.dispose();assert.equal(disposed,6);
});
