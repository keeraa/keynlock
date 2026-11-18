import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWearProfile} from '../public/js/key-wear.js';
import {STORAGE_KEY,restoreWorkbenchState,snapshotWorkbenchState,
  loadWorkbenchState,saveWorkbenchState,resetBlankState} from '../public/js/workbench-state.js';

function oldSave(){
  const wear=emptyWearProfile();wear[20]=.018;
  return {
    difficulty:4,targets:[.19,.05,.26,.12],pinOrder:[2,0,3,1],
    signature:'original',serial:7,cuts:[.12,.04,.21,.10],wear,
    installed:{'core-0':'core-0','pin-0':'pin-2','pin-1':'pin-0'},
    blueprint:true,keyMethod:'soap',fileOrientation:'top'
  };
}

test('old save restores its exact four-tooth profile and fitted parts',()=>{
  const saved=oldSave();
  const state=restoreWorkbenchState(saved);
  assert.deepEqual(state.targets,saved.targets);
  assert.deepEqual(state.pinOrder,saved.pinOrder);
  assert.deepEqual(state.cuts,saved.cuts);
  assert.deepEqual(state.wear,saved.wear);
  assert.deepEqual(state.installed,saved.installed);
  assert.equal(state.keyMethod,'soap');
  assert.equal(state.fileOrientation,'top');
  assert.equal(state.assemblyCameraLocked,true);
  assert.equal(state.blueprint,true);
  assert.equal(state.serial,7);
  assert.equal(state.mode,'assembly');
  assert.equal(state.filing,false);
});

test('fixed overhead camera is on by default and its switch is persisted',()=>{
  const cameraFree=restoreWorkbenchState({...oldSave(),assemblyCameraLocked:false});
  assert.equal(cameraFree.assemblyCameraLocked,false);
  assert.equal(snapshotWorkbenchState(cameraFree).assemblyCameraLocked,false);
  assert.equal(restoreWorkbenchState({...oldSave(),assemblyCameraLocked:true}).assemblyCameraLocked,true);
});

test('saved eight-tooth blanks restore without changing the four-pin code',()=>{
  const saved={...oldSave(),difficulty:8,
    targets:[.05,.12,.19,.26,.08,.15,.22,.29],
    cuts:[.03,.10,.17,.24,.05,.12,.20,.27]};
  const state=restoreWorkbenchState(saved);
  assert.equal(state.difficulty,8);
  assert.deepEqual(state.targets,saved.targets);
  assert.deepEqual(state.cuts,saved.cuts);
  assert.deepEqual(state.pinOrder,[2,0,3,1]);
  assert.deepEqual(state.installed,saved.installed);
});

test('corrupt blueprint regenerates safely and does not inherit its old cuts',()=>{
  const bad={...oldSave(),pinOrder:[1,1,1,1]};
  const state=restoreWorkbenchState(bad);
  assert.equal(state.difficulty,4);
  assert.equal(new Set(state.pinOrder).size,4);
  assert.deepEqual(state.cuts,[0,0,0,0]);
  assert.ok(state.wear.every(value=>value===0));
  assert.deepEqual(state.installed,{});
  assert.equal(state.blueprint,false);
  assert.equal(restoreWorkbenchState({...oldSave(),targets:[0,.1,.2,.3]}).cuts[0],0);
  assert.equal(restoreWorkbenchState(null).difficulty,4);
});

test('invalid placements and duplicates are discarded without changing valid work',()=>{
  const state=restoreWorkbenchState({...oldSave(),
    cuts:[Number.NaN,-1,12,.10],
    installed:{'pin-0':'pin-2','pin-1':'pin-2','spring-0':'gear-0',
      'core-0':'core-0',unknown:'pin-0'}
  });
  assert.deepEqual(state.cuts,[0,0,.6,.10]);
  assert.deepEqual(state.installed,{'pin-0':'pin-2','core-0':'core-0'});
});

test('saving and loading use the same storage key and preserve progress',()=>{
  const saved=new Map();
  const storage={
    getItem:key=>saved.get(key)??null,
    setItem:(key,value)=>saved.set(key,value)
  };
  const original=restoreWorkbenchState(oldSave());
  assert.equal(saveWorkbenchState(original,storage),true);
  assert.deepEqual(JSON.parse(saved.get(STORAGE_KEY)),snapshotWorkbenchState(original));
  assert.deepEqual(snapshotWorkbenchState(loadWorkbenchState(storage)),
    snapshotWorkbenchState(original));
  assert.equal(loadWorkbenchState({getItem:()=>'{broken json'}).difficulty,4);
  assert.equal(saveWorkbenchState(original,{setItem:()=>{throw Error('blocked');}}),false);
});

test('new blank resets only gameplay state and retains manual tool settings',()=>{
  const state=restoreWorkbenchState(oldSave());
  state.activeCut=3;state.selectedPart='pin-2';state.drag={id:'pin-2'};
  resetBlankState(state,6);
  assert.equal(state.difficulty,6);
  assert.equal(state.serial,8);
  assert.equal(state.targets.length,6);
  assert.deepEqual(state.cuts,[0,0,0,0,0,0]);
  assert.ok(state.wear.every(value=>value===0));
  assert.deepEqual(state.installed,{});
  assert.equal(state.blueprint,false);
  assert.equal(state.activeCut,0);
  assert.equal(state.selectedPart,null);
  assert.equal(state.drag,null);
  assert.equal(state.keyMethod,'soap');
  assert.equal(state.fileOrientation,'top');
});
