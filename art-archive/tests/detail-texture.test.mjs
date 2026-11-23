import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.js';
import {createPaintingObject,PaintingTexturePool} from '../catalog/three-painting.js';

const painting = {id:'sample', placement:{hall:'test',wall:'test'}, image:{widthPx:490,heightPx:229}};

test('detail arrives progressively, is shared between two views and released on departure', async()=>{
  const pool = new PaintingTexturePool(), loads = [];
  let resolve;
  const low = new THREE.Texture({width:490,height:229}), high = new THREE.Texture({width:1920,height:899});
  let disposals = 0;
  high.addEventListener('dispose',()=>disposals++);
  const loader = {loadAsync(url) {
    loads.push(url);
    return url==='low' ? Promise.resolve(low) : new Promise(r=>{resolve=r;});
  }};
  const make = ()=>createPaintingObject({THREE,painting,imageUrl:'low',detailUrl:'high',pool,loader});
  const [a,b] = await Promise.all([make(),make()]);
  const ma = a.object.getObjectByName('canvas:sample').material;
  const jobs = [a.setDetail(true),b.setDetail(true)];
  assert.equal(ma.map,low);
  b.dispose();
  await Promise.resolve();
  resolve(high);
  await Promise.all(jobs);
  assert.deepEqual(loads,['low','high']);
  assert.equal(ma.map,high);
  assert.equal(disposals,0);
  a.setDetail(false);
  assert.equal(ma.map,low);
  await Promise.resolve();
  assert.equal(disposals,1);
  a.dispose();
  assert.equal(pool.entries.size,0);
});

test('unavailable remote detail keeps the offline reproduction visible and avoids a retry each frame',async()=>{
  const pool=new PaintingTexturePool(),low=new THREE.Texture();
  let attempts=0;
  const loader={async loadAsync(url) { if(url==='low')return low; attempts++; throw new Error('unavailable'); }};
  const view=await createPaintingObject({THREE,painting,imageUrl:'low',detailUrl:'remote',pool,loader});
  await view.setDetail(true);await view.setDetail(true);
  assert.equal(attempts,1);assert.equal(view.object.getObjectByName('canvas:sample').material.map,low);
  view.dispose();assert.equal(pool.entries.size,0);
});

test('batched wooden rails retain the outside dimensions, depth and open canvas aperture',async()=>{
  const loader={loadAsync:async()=>new THREE.Texture()};
  const artwork={...painting,physicalSizeM:{width:2,height:1}};
  const view=await createPaintingObject({THREE,painting:artwork,imageUrl:'preview',loader,
    frameWidthM:.07,frameDepthM:.05});
  const frame=view.object.getObjectByName('frame:sample');
  assert.ok(frame.isMesh);
  const box=new THREE.Box3().setFromObject(frame);
  const size=box.getSize(new THREE.Vector3());
  assert.ok(size.distanceTo(new THREE.Vector3(2.14,1.14,.05))<1e-6);
  const ray=new THREE.Raycaster(new THREE.Vector3(0,0,1),new THREE.Vector3(0,0,-1));
  assert.equal(ray.intersectObject(frame).length,0);
  for (const [x,y] of [[1.035,0],[-1.035,0],[0,.535],[0,-.535]]) {
    ray.ray.origin.set(x,y,1);
    assert.ok(ray.intersectObject(frame).length>0);
  }
  view.dispose();
});

test('recent detail reuses its GPU texture; budget eviction and disposal release each texture once',async()=>{
  const pool=new PaintingTexturePool({idleBytes:200});
  const loads=[],released=[];
  const get=url=>pool.acquire(url,()=>{
    loads.push(url);
    const map=new THREE.Texture({width:4,height:4}); // 84 bytes with mipmaps
    map.addEventListener('dispose',()=>released.push(url));
    return map;
  });
  const a=await get('a');pool.release('a',a);
  const b=await get('b');pool.release('b',b);
  assert.equal(await get('a'),a);pool.release('a',a);
  const c=await get('c');pool.release('c',c);
  assert.deepEqual(loads,['a','b','c']);assert.deepEqual(released,['b']);
  assert.equal(pool.idleBytes,168);
  pool.disposeAll();assert.equal(pool.idleBytes,0);assert.deepEqual(released,['b','a','c']);
});

test('idle deadline frees a texture but never one that is in use again',async()=>{
  const pool=new PaintingTexturePool({idleBytes:1000,idleMs:5});
  const texture=new THREE.Texture({width:4,height:4});
  let freed=0;texture.addEventListener('dispose',()=>freed++);
  await pool.acquire('a',()=>texture);pool.release('a',texture);
  await pool.acquire('a',()=>assert.fail());await new Promise(done=>setTimeout(done,15));
  assert.equal(freed,0);pool.release('a',texture);
  await new Promise(done=>setTimeout(done,15));assert.equal(freed,1);assert.equal(pool.idle.size,0);
});
