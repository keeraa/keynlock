import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultDesign, normalizeKeyDesign } from '../dist/js/key-data.js';
import { createKeyModel, disposeKeyModel } from '../dist/js/key-geometry.js';
import { keyPreviewSvg } from '../dist/js/key-svg.js';
import { parseCollection } from '../dist/js/key-storage.js';
import { waxBlobLayout, waxGeometry } from '../dist/js/key-wax.js';
import { bladeSections } from '../dist/js/key-shapes.js';
import { KEY_TEMPLATES } from '../dist/js/key-data.js';

function meshCount(group) {
  let count=0;
  group.traverse(object=>{if(object.isMesh)count++;});
  return count;
}

test('воск выключен по умолчанию и нормализуется в выкл. / 100%', ()=>{
  assert.equal(defaultDesign(0).waxAmount,0);
  assert.equal(normalizeKeyDesign({...defaultDesign(0),waxAmount:30}).waxAmount,100);
  assert.equal(normalizeKeyDesign({...defaultDesign(0),waxAmount:undefined}).waxAmount,0);
});

test('старые коллекции без воска читаются и получают waxAmount 0', ()=>{
  const old=Array.from({length:10},(_,i)=>{const {waxAmount,...rest}=defaultDesign(i);return rest;});
  const parsed=parseCollection(JSON.stringify(old));
  assert.ok(parsed.every(design=>design&&design.waxAmount===0));
});

test('воск добавляет отдельный декоративный меш, не попадающий в STL', ()=>{
  for(let i=0;i<10;i++) {
    const plain=createKeyModel(defaultDesign(i));
    const waxed=createKeyModel({...defaultDesign(i),waxAmount:100});
    assert.equal(meshCount(waxed),meshCount(plain)+1,`форма ${i}`);
    const extras=[];
    waxed.traverse(object=>{if(object.isMesh&&object.userData.exportable===false)extras.push(object);});
    assert.equal(extras.length,1);
  }
});

test('воск закрывает зубцы, головку и стержень одним покрытием', ()=>{
  for(let i=0;i<10;i++) for(const broken of [false,true]) {
    const design={...defaultDesign(i),waxAmount:100,broken};
    const template=KEY_TEMPLATES[i];
    const blobs=waxBlobLayout(template,design);
    for(const kind of ['bow','shaft','bit','run']) assert.ok(blobs.some(b=>b.kind===kind),`${kind} · форма ${i}`);
    for(const blob of blobs) assert.ok(['x','y','rx','ry'].every(k=>Number.isFinite(blob[k])));
    const geometry=waxGeometry(template,design);
    const position=geometry.getAttribute('position');
    const triangles=geometry.index.count/3;
    assert.ok(triangles>200&&triangles<6000,`треугольников: ${triangles}`);
    // The coat rises above both faces of the metal.
    let top=-Infinity,bottom=Infinity;
    for(let v=0;v<position.count;v++){top=Math.max(top,position.getZ(v));bottom=Math.min(bottom,position.getZ(v));}
    assert.ok(top>design.thickness/100&&bottom<0);
  }
});

test('у целого ключа все зубцы под воском', ()=>{
  for(let i=0;i<10;i++) {
    const design={...defaultDesign(i),waxAmount:100};
    const template=KEY_TEMPLATES[i];
    const blobs=waxBlobLayout(template,design).filter(b=>b.kind==='bit');
    const end=Math.max(...bladeSections(template,design)[0].map(p=>p[0]));
    const covered=x=>blobs.some(b=>Math.abs(x-b.x)<b.rx*.9);
    for(let x=end-.35;x<=end-.02;x+=.03) assert.ok(covered(x),`форма ${i}, x=${x.toFixed(2)}`);
  }
});

test('2D-просмотр рисует воск поверх ключа', ()=>{
  for(let i=0;i<10;i++) {
    const svg=keyPreviewSvg({...defaultDesign(i),waxAmount:100});
    assert.match(svg,/class="wax"/);
    assert.doesNotMatch(keyPreviewSvg(defaultDesign(i)),/class="wax"/);
  }
});

test('при таянии воск убывает и полностью исчезает', async ()=>{
  const { meltWaxBlobs } = await import('../dist/js/key-wax.js');
  for(let i=0;i<10;i++) {
    const design={...defaultDesign(i),waxAmount:100};
    const template=KEY_TEMPLATES[i];
    const blobs=waxBlobLayout(template,design);
    const triangles=progress=>waxGeometry(template,design,{
      blobs:meltWaxBlobs(blobs,()=>progress),heightScale:1-.55*progress}).index?.count??0;
    assert.equal(meltWaxBlobs(blobs,()=>0).length,blobs.length);
    assert.ok(triangles(.7)<triangles(0),`форма ${i}`);
    assert.equal(meltWaxBlobs(blobs,()=>1).length,0);
    assert.equal(waxGeometry(template,design,{blobs:[]}).getAttribute('position').count,0);
  }
});

test('после растапливания воск исчезает полностью и ключ блестит', async ()=>{
  const THREE=await import('../dist/vendor/three.js');
  const { createWaxMelt } = await import('../dist/js/wax-melt.js');
  const design={...defaultDesign(0),waxAmount:100};
  const scene=new THREE.Scene();
  const key=createKeyModel(design);
  key.rotation.set(-.96,0,0);
  scene.add(key);
  const before=key.children.length;
  const melt=createWaxMelt({scene,keyGroup:key,design});
  let finished=false,sawStars=false,waxLeft=null;
  for(let t=0;t<12&&!finished;t+=.05) {
    finished=melt.update(.05);
    if(melt.melted&&waxLeft===null) {
      const wax=key.children.find(mesh=>mesh.userData.exportable===false&&mesh.geometry.hasAttribute('color'));
      waxLeft=wax.geometry.index?.count??0;
    }
    if(key.children.length>before)sawStars=true;
  }
  assert.ok(finished);
  assert.equal(waxLeft,0,'весь воск растаял');
  assert.ok(sawStars,'на чистом ключе появляются звёздочки блеска');
  melt.dispose();
  assert.equal(key.children.length,before);
  disposeKeyModel(key);
});
