import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.js';
import { KEY_TEMPLATES, defaultDesign } from '../dist/js/key-data.js';
import { createKeyModel, disposeKeyModel } from '../dist/js/key-geometry.js';
import { mudBlobLayout, washMudBlobs, mudGeometry } from '../dist/js/key-mud.js';
import { createMudWash, WASH_SECONDS } from '../dist/js/mud-wash.js';

test('грязь: комки на головке, стержне и зубцах плюс крошки', ()=>{
  for(let i=0;i<10;i++) for(const broken of [false,true]) {
    const design={...defaultDesign(i),dirtAmount:100,broken};
    const blobs=mudBlobLayout(KEY_TEMPLATES[i],design);
    for(const kind of ['bow','shaft','bit','crumb']) assert.ok(blobs.some(b=>b.kind===kind),`${kind} · форма ${i}`);
    assert.ok(blobs.every(b=>['x','y','rx','ry'].every(k=>Number.isFinite(b[k]))));
    const triangles=mudGeometry(KEY_TEMPLATES[i],design).index.count/3;
    assert.ok(triangles>100&&triangles<2000,`форма ${i}: ${triangles}`);
  }
});

test('при отмывании крошки уходят первыми, а в конце грязи не остаётся', ()=>{
  const blobs=mudBlobLayout(KEY_TEMPLATES[0],{...defaultDesign(0),dirtAmount:100});
  const half=washMudBlobs(blobs,()=>.6);
  assert.ok(!half.some(b=>b.kind==='crumb'));
  assert.ok(half.some(b=>b.kind==='bow'));
  assert.equal(washMudBlobs(blobs,()=>1).length,0);
});

test('двойное окунание: часть грязи отваливается после первого, ключ блестит и возвращается', ()=>{
  const design={...defaultDesign(3),dirtAmount:100};
  const scene=new THREE.Scene();
  const key=createKeyModel(design);
  key.rotation.set(-.96,0,0);
  scene.add(key);
  const sceneBefore=scene.children.length,keyBefore=key.children.length;
  const wash=createMudWash({scene,keyGroup:key,design});
  assert.ok(scene.children.length>sceneBefore,'корыто добавлено в сцену');
  const mud=()=>key.children.find(mesh=>mesh.userData.exportable===false&&mesh.geometry.hasAttribute('color'));
  const vertices=()=>mud().geometry.getAttribute('position').count;
  const start=vertices();
  let finished=false,maxHeight=0,afterFirstDip=null,sawChunks=false;
  for(let t=0;t<WASH_SECONDS+4&&!finished;t+=.05) {
    finished=wash.update(.05);
    maxHeight=Math.max(maxHeight,key.position.length());
    if(scene.children.some(child=>child.geometry?.type==='IcosahedronGeometry'))sawChunks=true;
    // Between the two dips (pause step) part of the mud is gone.
    if(afterFirstDip===null&&t>.55+.5+.6+.45+1.1+.5+.1)afterFirstDip=vertices();
  }
  assert.ok(finished&&wash.done);
  assert.ok(sawChunks,'комки падают в воду после первого окунания');
  assert.ok(afterFirstDip>0&&afterFirstDip<start,`после первого окунания грязи меньше (${afterFirstDip} из ${start})`);
  assert.equal(vertices(),0,'грязь смыта полностью');
  assert.ok(maxHeight>.4,'ключ поднимается над водой между окунаниями');
  wash.dispose();
  assert.equal(key.position.length(),0,'ключ вернулся на место');
  assert.equal(scene.children.length,sceneBefore);
  assert.equal(key.children.length,keyBefore,'звёздочки блеска убраны');
  disposeKeyModel(key);
});
