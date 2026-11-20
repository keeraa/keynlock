import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.js';
import { defaultDesign, createKeyPlacementMatrix, createInstancedKeyCollection,
  getKeyInstance, keyInstanceFromIntersection, selectKeyInstance, moveKeyInstance,
  setKeyInstanceRust, removeKeyInstance, disposeInstancedKeyCollection,
  preloadKeyTextures } from '../dist/js/key-model.js';

test('1000 разных степеней ржавчины объединяются по форме и сохраняют оттенок экземпляра',()=>{
  const entries=Array.from({length:1000},(_,i)=>({
    id:'archive-'+i,
    design:{...defaultDesign(i%10),rustAmount:(i*41)%201},
    placement:{mode:i%3===0?'hang':'floor',position:[(i%40)*5,2,Math.floor(i/40)*5],yaw:i*.17},
  }));
  const hall=createInstancedKeyCollection(entries);
  assert.equal(hall.userData.keyCount,1000);
  assert.equal(hall.userData.uniqueDesigns,10);
  assert.equal(hall.userData.drawCalls,10,'ржавчина не должна добавлять новые draw calls');
  const metal=hall.children.find(m=>m.userData.templateId==='brotherhood');
  const paint=metal.geometry.getAttribute('instanceKeyPaint');
  assert.ok(paint.isInstancedBufferAttribute);
  assert.equal(paint.count,100);
  assert.notEqual(paint.getX(0),paint.getX(1));
  assert.notEqual(paint.getZ(0),paint.getZ(1),'узоры ржавчины должны различаться');
  const sample=getKeyInstance(hall,'archive-29');
  assert.equal(sample.id,'archive-29');
  assert.equal(sample.templateId,'brotherhood');
  assert.ok(sample.matrix.equals(createKeyPlacementMatrix(entries[29].design,entries[29].placement)));
  disposeInstancedKeyCollection(hall);
  assert.equal(hall.children.length,0);
});

test('выбор, перенос и удаление по id не нарушают карты instanceId и границы инстансов',()=>{
  const hall=createInstancedKeyCollection([
    {id:'a',template:0,position:[0,0,0]},
    {id:'b',template:0,position:[4,0,0]},
    {id:'c',template:0,position:[8,0,0]},
    {id:'dirty',design:{...defaultDesign(0),dirtAmount:100},position:[12,0,0]},
  ]);
  const cleanMesh=hall.children.find(m=>m.userData.exportable&&m.count===3);
  assert.equal(keyInstanceFromIntersection({object:cleanMesh,instanceId:1}).id,'b');
  assert.equal(selectKeyInstance(hall,'b').id,'b');
  assert.equal(hall.userData.selectedKeyId,'b');
  const moved=moveKeyInstance(hall,'b',[29,1,4]);
  assert.deepEqual(moved.matrix.elements.slice(12,15),[29,1,4]);
  assert.ok(cleanMesh.boundingSphere.center.x>4,'границы не обновились после переноса');
  assert.equal(setKeyInstanceRust(hall,'b',200).design.rustAmount,200);
  assert.equal(cleanMesh.geometry.getAttribute('instanceKeyPaint').getX(1),2);
  assert.equal(removeKeyInstance(hall,'b'),true);
  assert.equal(hall.userData.selectedKeyId,null);
  assert.equal(hall.userData.keyCount,3);
  assert.equal(cleanMesh.count,2);
  assert.equal(keyInstanceFromIntersection({object:cleanMesh,instanceId:1}).id,'c',
    'последний инстанс должен занять освобождённый индекс');
  assert.equal(getKeyInstance(hall,'c').instanceId,1);
  assert.equal(removeKeyInstance(hall,'dirty'),true);
  assert.equal(hall.userData.drawCalls,1,'пустая партия удаляется с GPU');
  assert.equal(removeKeyInstance(hall,'missing'),false);
  assert.equal(keyInstanceFromIntersection({object:cleanMesh,instanceId:999}),null);
  disposeInstancedKeyCollection(hall);
  assert.equal(hall.userData.keyCount,0);
});

test('луч Raycaster определяет конкретный инстанс, включая переднюю сторону металла',()=>{
  const hall=createInstancedKeyCollection([
    {id:'left',template:2,position:[0,0,0]},
    {id:'right',template:2,position:[9,0,0]},
  ]);
  hall.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(new THREE.Vector3(7.45,.30,5),new THREE.Vector3(0,0,-1));
  const hit=ray.intersectObjects(hall.children,false)[0];
  assert.ok(hit,'луч должен попасть в металл второй головки');
  assert.equal(keyInstanceFromIntersection(hit)?.id,'right');
  disposeInstancedKeyCollection(hall);
});

test('внешний API отклоняет дубли id и некорректные значения',async()=>{
  assert.throws(()=>createInstancedKeyCollection([{id:'a',template:0},{id:'a',template:1}]),RangeError);
  assert.throws(()=>createInstancedKeyCollection([{template:45}]),RangeError);
  const hall=createInstancedKeyCollection([{id:'key',template:0}]);
  assert.throws(()=>moveKeyInstance(hall,'key',[Infinity,0,0]),TypeError);
  assert.throws(()=>setKeyInstanceRust(hall,'key',NaN),TypeError);
  assert.deepEqual(await preloadKeyTextures(),[],'Node без DOM не загружает растры');
  disposeInstancedKeyCollection(hall);
  const withoutShadows=createInstancedKeyCollection([{template:0}],{castShadow:false});
  assert.equal(withoutShadows.userData.shadowCasterBatches,0);
  assert.ok(withoutShadows.children.every(mesh=>mesh.castShadow===false));
  disposeInstancedKeyCollection(withoutShadows);
});
