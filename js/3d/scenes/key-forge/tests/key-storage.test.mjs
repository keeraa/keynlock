import test from 'node:test';
import assert from 'node:assert/strict';
import { KEY_TEMPLATES, METALS, BROTHERHOOD_KEYS, defaultDesign, fixedMetal, normalizeKeyDesign,
  createKeyModel, updateKeyPaint, disposeKeyModel, keyPreviewSvg, createInstancedKeyCollection,
  disposeInstancedKeyCollection } from '../dist/js/key-model.js';
import { parseCollection, loadCollection, persistCollection, STORAGE_KEY } from '../dist/js/key-storage.js';

test('один постоянный металл задан для каждой из десяти форм', () => {
  const expected=['mercury','tin','steel','brass','garden-green','lead','gold','graphite','copper','copper'];
  assert.equal(expected.length,KEY_TEMPLATES.length);
  for(let i=0;i<expected.length;i++) {
    assert.equal(fixedMetal(i),expected[i]);
    assert.equal(defaultDesign(i).metal,expected[i]);
    assert.ok(METALS.some(m=>m.id===expected[i]));
  }
  for(const binding of BROTHERHOOD_KEYS) {
    const index=KEY_TEMPLATES.findIndex(key=>key.id===binding.templateId);
    assert.equal(fixedMetal(index),binding.material);
  }
});

test('старые коллекции сохраняют форму и настройки, но принимают закреплённый металл', () => {
  const old=Array.from({length:10},(_,i)=>({...defaultDesign(i),metal:'enamel',teeth:7,rustAmount:145}));
  for(const entry of old){delete entry.broken;delete entry.breakAngle;}
  old[3].dirtAmount=45;
  old[8].rustAmount=undefined;
  old[8].dirtAmount=undefined;
  const migrated=parseCollection(JSON.stringify(old));
  assert.equal(migrated.length,10);
  for(let i=0;i<migrated.length;i++) {
    assert.equal(migrated[i].metal,fixedMetal(i));
    assert.equal(migrated[i].teeth,7);
  }
  assert.equal(migrated[8].rustAmount,0);
  assert.equal(migrated[8].dirtAmount,0);
  assert.equal(migrated[3].dirtAmount,100,'старое частичное покрытие стало полным');
  assert.equal(migrated[3].broken,false);
  assert.equal(migrated[3].breakAngle,70);
  assert.equal(migrated[2].rustAmount,145);
  assert.equal(normalizeKeyDesign({...old[2],metal:'gold'}).metal,'steel');
  assert.ok(parseCollection('{broken').every(value=>value===null));
  const memory={value:null,getItem(key){assert.equal(key,STORAGE_KEY);return this.value;},
    setItem(key,value){assert.equal(key,STORAGE_KEY);this.value=value;}};
  persistCollection(memory,migrated);
  assert.deepEqual(loadCollection(memory),migrated);
});

test('3D, изменение окраски, SVG и инстансы игнорируют чужой металл', () => {
  for(let i=0;i<KEY_TEMPLATES.length;i++) {
    const original=defaultDesign(i),changed={...original,metal:'enamel'};
    const model=createKeyModel(changed);
    const main=model.children.find(mesh=>mesh.userData.exportable===true);
    assert.equal(main.material,model.userData.materialCache.get(fixedMetal(i)));
    updateKeyPaint(model,{...changed,metal:'gold',rustAmount:150});
    assert.equal(main.material,model.userData.materialCache.get(fixedMetal(i)));
    const fixedSvg=keyPreviewSvg(original),changedSvg=keyPreviewSvg(changed);
    assert.equal(changedSvg,fixedSvg);
    disposeKeyModel(model);
  }
  const design=defaultDesign(2);
  const batch=createInstancedKeyCollection([{design},{design:{...design,metal:'gold'}}]);
  assert.equal(batch.userData.uniqueDesigns,1);
  assert.ok(batch.children.every(mesh=>mesh.count===2));
  disposeInstancedKeyCollection(batch);
});
