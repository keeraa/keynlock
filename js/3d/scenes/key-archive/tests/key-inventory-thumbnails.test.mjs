import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as THREE from '../dist/vendor/three.js';
import { createPaintedInstanceGeometry, setKeyInstanceFinish } from '../dist/js/key-instance-finish.js';
import { thumbnailCacheKey } from '../dist/js/key-thumbnails.js';

test('all condition variants reuse one metal mesh with independent per-key paint', () => {
  const metal=new THREE.BoxGeometry(1,2,.12);
  const painted=createPaintedInstanceGeometry(metal,3);
  assert.equal(painted.getAttribute('position'),metal.getAttribute('position'));
  assert.equal(painted.getAttribute('normal'),metal.getAttribute('normal'));
  assert.equal(painted.getAttribute('uv'),metal.getAttribute('uv'));
  assert.equal(painted.index,metal.index);
  const mesh=new THREE.InstancedMesh(painted,new THREE.MeshStandardMaterial(),3);
  const base={id:'123',type:0,variation:0,mud:false,rust:false};
  setKeyInstanceFinish(mesh,0,base);
  setKeyInstanceFinish(mesh,1,{...base,id:'124',mud:true});
  setKeyInstanceFinish(mesh,2,{...base,id:'125',rust:true},1.6);
  const paint=painted.getAttribute('instanceKeyPaint');
  assert.equal(paint.getX(0),0);
  assert.equal(paint.getY(0),0);
  assert.equal(paint.getY(1),1);
  assert.ok(Math.abs(paint.getX(2)-1.6)<.000001);
  assert.notEqual(paint.getZ(1),paint.getZ(2));
  setKeyInstanceFinish(mesh,1,{...base,id:'124',mud:false});
  assert.equal(paint.getY(1),0,'bathing removes Forge dirt without new geometry');
});

test('inventory uses cached 3D photographs and removes the archive patina overlay', () => {
  const key={id:'k1',type:8,variation:2,mud:false,rust:true,broken:false};
  assert.notEqual(thumbnailCacheKey(key),thumbnailCacheKey({...key,rust:false}));
  assert.notEqual(thumbnailCacheKey(key),thumbnailCacheKey({...key,broken:true}));
  assert.equal(thumbnailCacheKey(key),thumbnailCacheKey({...key}));
  const hud=readFileSync(new URL('../dist/js/archive-hud.js',import.meta.url),'utf8');
  const thumbnail=readFileSync(new URL('../dist/js/key-thumbnails.js',import.meta.url),'utf8');
  const world=readFileSync(new URL('../dist/js/world.js',import.meta.url),'utf8');
  const fallback=readFileSync(new URL('../dist/js/fallback-world.js',import.meta.url),'utf8');
  assert.match(hud,/slot-thumbnail/);
  assert.match(hud,/inventoryImages\.size > 48/);
  assert.match(world,/captureKeyThumbnail/);
  assert.match(thumbnail,/renderer\.readRenderTargetPixels/);
  assert.match(thumbnail,/disposeKeySceneModel\(model\)/);
  assert.doesNotMatch(world,/mudPaint|rustPaint|mudHalo|conditionTint|key-patina/);
  assert.doesNotMatch(fallback,/key-patina|getPatinaTexture/);
});
