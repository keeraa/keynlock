import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.js';
import { defaultDesign } from '../dist/js/key-data.js';
import { createKeyModel, disposeKeyModel } from '../dist/js/key-geometry.js';
import { createRustSoak, SOAK_SECONDS } from '../dist/js/rust-soak.js';

test('ржавчина: долгое замачивание, хлопья при подъёме, ключ возвращается на место', ()=>{
  const design={...defaultDesign(2),rustAmount:150};
  const scene=new THREE.Scene();
  const key=createKeyModel(design);
  key.rotation.set(-.96,0,0);
  scene.add(key);
  const sceneBefore=scene.children.length,keyBefore=key.children.length;
  const soak=createRustSoak({scene,keyGroup:key,design});
  let finished=false,flakesSeenAt=null,doneAt=null,t=0;
  const soakEnds=.55+.5+.6+.5+3.2;
  for(;t<SOAK_SECONDS+4&&!finished;t+=.05) {
    finished=soak.update(.05);
    const flakes=scene.children.filter(child=>child.geometry?.type==='PlaneGeometry').length;
    if(flakes&&flakesSeenAt===null)flakesSeenAt=t;
    if(soak.done&&doneAt===null)doneAt=t;
  }
  assert.ok(finished&&soak.done);
  assert.ok(SOAK_SECONDS>7,'замачивание длится заметное время');
  assert.ok(flakesSeenAt>soakEnds,`хлопья появляются только при подъёме (${flakesSeenAt})`);
  assert.ok(doneAt>flakesSeenAt);
  soak.dispose();
  assert.equal(key.position.length(),0);
  assert.equal(scene.children.length,sceneBefore);
  assert.equal(key.children.length,keyBefore);
  disposeKeyModel(key);
});
