import test from 'node:test';
import assert from 'node:assert/strict';
import {resetArchiveProgress} from '../src/persistence/new-game.js';
import {STORAGE_KEYS} from '../src/persistence/storage.js';

test('a new game clears the active run while preserving selection, settings and the other save',()=>{
 const {hanging,disposal,tutorial,player}=STORAGE_KEYS;
 const selection='keynlock-painting-archive-1500-v1';
 const data=new Map([[hanging,'{"work":{}}'],[disposal,'{"destroyed":["KNL-0001"]}'],[tutorial,'done'],
  [player,'{"limitFps":true}'],[selection,'{"included":{"work":false}}'],[hanging+'-debug','{"debugWork":{}}'],
  [hanging+'-free','{"freeWork":{}}'],[hanging+'-free-debug','{"debugFree":{}}']]);
 const storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
 assert.equal(resetArchiveProgress(storage),true);
 assert.deepEqual([data.get(hanging),data.get(disposal),data.get(tutorial)],['{}','{}','']);
 assert.equal(data.get(player),'{"limitFps":true}');
 assert.equal(data.get(selection),'{"included":{"work":false}}');
 assert.equal(data.get(hanging+'-debug'),'{"debugWork":{}}');
 assert.equal(data.get(hanging+'-free'),'{}');
 assert.equal(data.get(hanging+'-free-debug'),'{"debugFree":{}}');
 assert.equal(resetArchiveProgress(storage,true),true);
 assert.equal(data.get(hanging+'-debug'),'{}');
 assert.equal(data.get(hanging+'-free-debug'),'{}');
});

test('a failed reset rolls back earlier changes',()=>{
 const {hanging,disposal}=STORAGE_KEYS,data=new Map([[hanging,'{"work":{}}']]);
 const storage={
  getItem:key=>data.get(key)??null,
  setItem(key,value){if(key===disposal)throw Error('storage rejected write');data.set(key,value);},
  removeItem:key=>data.delete(key),
 };
 assert.equal(resetArchiveProgress(storage),false);
 assert.equal(data.get(hanging),'{"work":{}}');
});
