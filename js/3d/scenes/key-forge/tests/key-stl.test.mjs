import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultDesign, createKeyModel, disposeKeyModel } from '../dist/js/key-model.js';
import { modelToSTL } from '../dist/js/key-stl.js';

test('STL после рефакторинга содержит замкнутую основу без декоративной грязи', async () => {
  for(const index of [0,3,9]) {
    const solid=createKeyModel(defaultDesign(index));
    const dirty=createKeyModel({...defaultDesign(index),dirtAmount:100});
    const cleanBlob=modelToSTL(solid),dirtyBlob=modelToSTL(dirty);
    const buffer=await cleanBlob.arrayBuffer();
    const view=new DataView(buffer);
    const triangles=view.getUint32(80,true);
    assert.ok(triangles>0);
    assert.equal(buffer.byteLength,84+triangles*50);
    assert.equal(dirtyBlob.size,cleanBlob.size);
    for(const key of [solid,dirty])disposeKeyModel(key);
  }
});

test('надломленный ключ экспортируется одним замкнутым контуром без слоя грязи', async () => {
  for(const index of [0,5,9]) {
    const design={...defaultDesign(index),broken:true,breakAngle:80};
    const snapped=createKeyModel(design);
    const dirty=createKeyModel({...design,dirtAmount:100});
    const cleanBlob=modelToSTL(snapped),dirtyBlob=modelToSTL(dirty);
    assert.equal(cleanBlob.size,dirtyBlob.size);
    const bytes=await cleanBlob.arrayBuffer();
    assert.equal(bytes.byteLength,84+new DataView(bytes).getUint32(80,true)*50);
    assert.ok(cleanBlob.size>84);
    disposeKeyModel(snapped);disposeKeyModel(dirty);
  }
});
