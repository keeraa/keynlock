import test from 'node:test';
import assert from 'node:assert/strict';
import {CODE_LENGTH,CODE_LOCK_STORAGE_KEY,newCodeLock,restoreCodeLock,
  loadCodeLock,saveCodeLock,moveCodeWheel,testCodeLock} from '../public/js/code-lock-logic.js';

test('new code puzzle always starts with six digits and remains solvable',()=>{
  const state=newCodeLock(()=>.004321);
  assert.equal(state.secret,'004321');
  assert.deepEqual(state.digits,Array(CODE_LENGTH).fill(0));
  assert.equal(state.attempts,0);assert.equal(state.opened,false);
  assert.equal('history' in state,false);
});

test('six dials wrap independently at zero and nine',()=>{
  const state=newCodeLock(()=>.314159);
  assert.equal(moveCodeWheel(state,0,-1),true);
  assert.equal(state.digits[0],9);
  assert.equal(moveCodeWheel(state,0,1),true);
  assert.equal(state.digits[0],0);
  assert.equal(moveCodeWheel(state,5,17),true);
  assert.equal(state.digits[5],7);
  assert.equal(moveCodeWheel(state,6,1),false);
  assert.equal(moveCodeWheel(state,-1,1),false);
  assert.equal(moveCodeWheel(state,1,1.2),false);
});

test('checking a guess reports exact-position matches without recording guess history',()=>{
  const state=newCodeLock(()=>.123456);
  state.digits=[1,9,3,9,5,9];
  const result=testCodeLock(state);
  assert.deepEqual(result,{opened:false,matched:3,attempts:1});
  assert.equal('history' in state,false);
  assert.equal(moveCodeWheel(state,1,1),true);
  assert.equal(state.matched,null);
  assert.equal(state.attempts,1);
});

test('the sixth correct digit opens the box and freezes its combination',()=>{
  const state=newCodeLock(()=>.789012);
  state.digits=[7,8,9,0,1,2];
  assert.equal(testCodeLock(state).opened,true);
  assert.equal(moveCodeWheel(state,0,1),false);
  assert.deepEqual(testCodeLock(state),{opened:true,matched:6,attempts:1});
});

test('valid puzzle survives reload; damaged or forged state is discarded safely',()=>{
  const memory=new Map();
  const storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
  const state=newCodeLock(()=>.567890);state.digits=[5,6,7,8,9,0];
  testCodeLock(state);
  assert.equal(saveCodeLock(state,storage),true);
  assert.deepEqual(loadCodeLock(storage),state);
  assert.ok(memory.has(CODE_LOCK_STORAGE_KEY));
  assert.equal('history' in restoreCodeLock({...state,history:[{code:'000000',matched:0}]}),false);
  assert.equal(restoreCodeLock({...state,opened:true,digits:[0,0,0,0,0,0]}).opened,false);
  assert.equal(restoreCodeLock({...state,secret:'not-code'},()=>.123456).secret,'123456');
  assert.equal(loadCodeLock({getItem:()=>'{bad'},()=>.123456).secret,'123456');
  assert.equal(saveCodeLock(state,{setItem:()=>{throw Error('unavailable');}}),false);
});
