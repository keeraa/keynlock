import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../dist/vendor/three.js';
import { KEY_TYPES, createInitialState, validateState } from '../dist/js/rules.js';
import { KEY_TEMPLATES, METALS } from '../dist/js/key-data.js';
import { ARCHIVE_TO_FORGE, archiveDesign, createForgeKeyProvider } from '../dist/js/key-forge-adapter.js';
import { createKeyModel } from '../dist/js/key-geometry.js';
import { joinedKeyShape, holesFor } from '../dist/js/key-shapes.js';

const source = JSON.parse(readFileSync(new URL('../dist/assets/key-design-profiles.json',import.meta.url),'utf8'));
const expected = ['cellar','tower','archive','clock','astral',
  'forge','alchemy','garden','palace','brotherhood'];

test('all clean and broken forge keys extrude one continuous bow-and-shaft silhouette', () => {
  for(let index=0;index<KEY_TEMPLATES.length;index++) {
    for(const broken of [false,true]) {
      const design={...archiveDesign(ARCHIVE_TO_FORGE.indexOf(KEY_TEMPLATES[index].id)),broken};
      const template=KEY_TEMPLATES[design.template];
      const shape=joinedKeyShape(template,design);
      assert.equal(shape.holes.length,holesFor(template.bow).length);
      assert.ok(shape.getPoints().length>20,'silhouette includes the bow and blade');
      const model=createKeyModel(design);
      assert.equal(model.children.length,1,`seam-free solid ${template.id} broken=${broken}`);
      assert.ok(model.children[0].geometry.getAttribute('position').count>30);
    }
  }
  const adapter=readFileSync(new URL('../dist/js/key-forge-adapter.js',import.meta.url),'utf8');
  assert.match(adapter,/joinedKeyShape\(template, design\)\.extractPoints\(12\)/,
    '2D thumbnails also share the unbroken outline');
});

test('all ten archive slots have stable one-to-one forge identities and locked metals', () => {
  assert.deepEqual(ARCHIVE_TO_FORGE,expected);
  assert.equal(new Set(ARCHIVE_TO_FORGE).size,10);
  assert.equal(source.schema,1);
  assert.equal(source.profiles.length,10);
  for(let i=0;i<10;i++) {
    const profile=archiveDesign(i,source.profiles);
    assert.equal(KEY_TEMPLATES[profile.template].id,expected[i]);
    assert.equal(profile.metal,KEY_TEMPLATES[profile.template].metal);
    assert.ok(METALS.some(metal=>metal.id===profile.metal));
    assert.equal(typeof KEY_TYPES[i].name,'string');
  }
});

test('the forge provider reuses twenty 3D shapes, preserves holes and points teeth down', () => {
  const provider=createForgeKeyProvider(source.profiles);
  let totalTriangles=0;
  for(let i=0;i<10;i++) {
    const geometry=provider.getGeometry(i);
    const broken=provider.getGeometry(i,{broken:true});
    assert.equal(provider.getGeometry(i),geometry,'one cached mesh per intact family');
    assert.equal(provider.getGeometry(i,{broken:true}),broken,'one cached mesh per fractured family');
    for(const mesh of [geometry,broken]) {
      assert.equal(mesh.isBufferGeometry,true);
      assert.ok(mesh.getAttribute('position').count>30);
      assert.ok(mesh.getAttribute('normal').count>30);
      assert.ok(mesh.getAttribute('uv').count>30);
      mesh.computeBoundingBox();
      const span=mesh.boundingBox.max.y-mesh.boundingBox.min.y;
      assert.ok(span>.55&&span<1.4,`unexpected family length ${span}`);
      if(mesh===geometry)assert.ok(Math.abs(span-1.18)<.0001);
      assert.ok(mesh.boundingBox.min.z>=.0139,'resting key does not enter the floor');
      totalTriangles+=(mesh.index?.count??mesh.getAttribute('position').count)/3;
    }
    assert.notEqual(geometry,broken);
    const group=provider.createModel(i,{broken:false,scale:.455});
    assert.equal(group.children.length,1,'one draw call for the held key');
    assert.ok(group.children[0].isInstancedMesh,'held keys use the same per-key Forge pigment');
    assert.equal(group.children[0].geometry.getAttribute('position'),geometry.getAttribute('position'),
      'snapshot model shares the original metal vertex buffer');
    assert.equal(group.children[0].geometry.getAttribute('instanceKeyPaint').count,1);
    assert.equal(group.scale.x,.455);
    assert.equal(provider.getFallbackHeadPoints(i).length>2,true);
    assert.equal(provider.getMetal(i),KEY_TEMPLATES[archiveDesign(i).template].metal);
  }
  assert.ok(totalTriangles<25000,`unexpectedly dense geometry: ${totalTriangles}`);
  const hall=new THREE.Scene();
  for(let i=0;i<10;i++) {
    hall.add(new THREE.InstancedMesh(provider.getGeometry(i),new THREE.MeshBasicMaterial(),96));
    hall.add(new THREE.InstancedMesh(provider.getGeometry(i,{broken:true}),new THREE.MeshBasicMaterial(),4));
  }
  assert.equal(hall.children.length,20,'the room keeps only twenty instanced geometry batches');
});

test('Forge mud crust and random rust paint are shared across floor, hand, and baths', () => {
  const provider=createForgeKeyProvider(source.profiles);
  for(let type=0;type<10;type++) {
    assert.ok(provider.getCrustGeometry(type).getAttribute('position').count>0,
      `Forge crust missing for family ${type}`);
  }
  const key={id:'key-21',type:3,variation:1,mud:true,rust:true};
  const metal=provider.getGeometry(key.type);
  const crust=provider.getCrustGeometry(key.type);
  assert.equal(provider.getCrustGeometry(key.type),crust);
  assert.ok(crust.getAttribute('position').count>0);
  assert.equal(crust.getAttribute('color').itemSize,3);
  assert.equal(provider.getCrustMaterial().transparent,false);
  assert.ok(provider.getRustStrength(key.type)>=1.35);
  const heavyProfiles=source.profiles.map(profile => profile.id==='clock'
    ? {...profile,rustAmount:200} : profile);
  assert.ok(createForgeKeyProvider(heavyProfiles).getRustStrength(key.type)>
    provider.getRustStrength(key.type),'saved Forge rust slider controls archive intensity');
  metal.computeBoundingBox();crust.computeBoundingBox();
  assert.ok(crust.boundingBox.max.x>metal.boundingBox.max.x ||
    crust.boundingBox.min.x<metal.boundingBox.min.x ||
    crust.boundingBox.max.y>metal.boundingBox.max.y ||
    crust.boundingBox.min.y<metal.boundingBox.min.y,
  'crust extends outside the authentic key silhouette');

  const held=provider.createModel(key.type,key);
  assert.equal(held.children.length,2,'Forge mud clods are a separate solid layer');
  assert.equal(held.children[1].geometry,crust);
  const attribute=held.children[0].geometry.getAttribute('instanceKeyPaint');
  assert.ok(attribute.getX(0)>1);
  assert.equal(attribute.getY(0),0,'mud is clod geometry, not a stain on the metal');
  assert.ok(attribute.getZ(0)>0);
  assert.equal(provider.createModel(key.type,{...key,mud:false,rust:false}).children.length,1);
  provider.disposeModel(held);
  assert.equal(provider.getGeometry(key.type),metal,'model cleanup keeps shared geometry');
});

test('editor profile changes alter geometry without changing saved key identities', () => {
  const override=source.profiles.map(profile=>profile.id==='palace'
    ? {...profile,headSize:130,shaftLength:3.05,teeth:7,metal:'copper',template:9} : profile);
  const regular=createForgeKeyProvider(source.profiles);
  const custom=createForgeKeyProvider(override);
  assert.notEqual(
    regular.getGeometry(8).getAttribute('position').array.length,
    custom.getGeometry(8).getAttribute('position').array.length,
  );
  const oldLength=regular.getGeometry(8).boundingBox.max.y-
    regular.getGeometry(8).boundingBox.min.y;
  const newLength=custom.getGeometry(8).boundingBox.max.y-
    custom.getGeometry(8).boundingBox.min.y;
  assert.ok(newLength>oldLength,'editor shaft length must affect actual game size');
  assert.equal(archiveDesign(8,override).template,KEY_TEMPLATES.findIndex(t=>t.id==='palace'));
  assert.equal(archiveDesign(8,override).metal,'gold');
  const saved=createInitialState();
  assert.equal(validateState(saved),true);
  assert.equal(saved.keys.filter(key=>key.type===8).length,100);
  assert.equal(saved.keys.filter(key=>key.broken).length,40);
});
