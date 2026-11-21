import assert from 'node:assert/strict';
import {MAX_BUILDINGS,loadBuildings,saveBuildings,loadGround,saveGround,
  loadLandscape,saveLandscape,loadPavingMode,savePavingMode} from '../js/path-builder/editor-storage.js';
import {LANDSCAPE_BOUNDS} from '../js/path-builder/landscape-model.js';

const values=new Map();
const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
const initial=()=>[{id:'fallback',type:'house',x:2,z:3}];
assert.deepEqual(loadBuildings(initial,storage),initial(),'New maps retain their demo buildings');
assert.equal(loadLandscape(storage).checkInitialGroves,true,'New maps seed starter trees');
assert.ok(loadLandscape(storage).landscape.trees.length>20);

values.set('keynlock.path-builder.v1',JSON.stringify({version:1,buildings:[
  {id:'old-house',type:'house',x:16,z:-12},
  {id:'far-church',type:'church',x:2000,z:1000},
  {id:'invalid-type',type:'missing',x:8,z:8},null,
]}));
const migrated=loadBuildings(initial,storage);
assert.equal(migrated.length,2,'Corrupted entries and unsupported buildings are ignored');
assert.deepEqual([migrated[0].x,migrated[0].z],[16,-12]);
assert.deepEqual([migrated[1].x,migrated[1].z],[1250,625]);
saveBuildings(migrated,storage);
const saved=JSON.parse(values.get('keynlock.path-builder.v1'));
assert.deepEqual(saved.mapBounds,LANDSCAPE_BOUNDS,'Saves record new world dimensions');
assert.deepEqual(loadBuildings(initial,storage),migrated,'A migrated building is never scaled twice');
assert.equal(MAX_BUILDINGS,300);

values.set('keynlock.path-builder.landscape.v1',JSON.stringify({version:1,
  trees:[],rivers:[{id:'stream',width:7,points:[[0,0],[20,0]]}],hills:[],bridges:[]}));
const cleared=loadLandscape(storage);
assert.equal(cleared.checkInitialGroves,false,'Player-cleared groves stay empty');
assert.deepEqual(cleared.landscape.trees,[]);
saveLandscape(cleared.landscape,storage);
assert.deepEqual(JSON.parse(values.get('keynlock.path-builder.landscape.v1')).mapBounds,LANDSCAPE_BOUNDS);
assert.equal(loadLandscape(storage).landscape.rivers.length,1);

values.set('keynlock.path-builder.landscape.v1',JSON.stringify({version:1,trees:[
  {id:'starter-oak-1',kind:'oak',x:-84,z:-27,size:1},
]}));
const oldTree=loadLandscape(storage).landscape.trees[0];
assert.equal(oldTree.x,-96,'Old starter oak moves to dry ground once');
saveLandscape(loadLandscape(storage).landscape,storage);
assert.equal(loadLandscape(storage).landscape.trees[0].x,-96);

saveGround({district:'old',grass:42},storage);
assert.equal(loadGround(storage).grass,42);
savePavingMode('street',storage);
assert.equal(loadPavingMode(storage),'street');
savePavingMode('invalid',storage);
assert.equal(loadPavingMode(storage),null);

values.set('keynlock.path-builder.v1','{broken json');
assert.deepEqual(loadBuildings(initial,storage),initial(),'Bad JSON restores the demo safely');
console.log('Editor persistence: migrations, old groves, invalid data and settings OK');
