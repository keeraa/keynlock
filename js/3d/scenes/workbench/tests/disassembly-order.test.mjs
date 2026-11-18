import test from 'node:test';
import assert from 'node:assert/strict';
import {disassemblyBlocker,disassemblyPrerequisites,nextDisassemblyStep} from
  '../public/js/lab/mechanisms/disassembly-order.js';

test('springs are held by their driver pins and the upper retaining bar',()=>{
  const removed=new Set();
  assert.equal(disassemblyBlocker('spring-0',removed),'верхний штифт №1');
  assert.equal(disassemblyBlocker('driver-0',removed),'верхнюю планку штифтов');
  removed.add('cover-0');
  assert.equal(disassemblyBlocker('driver-0',removed),null);
  assert.equal(disassemblyBlocker('spring-0',removed),'верхний штифт №1');
  removed.add('driver-0');
  assert.equal(disassemblyBlocker('spring-0',removed),null);
  assert.deepEqual(disassemblyPrerequisites('spring-3'),['driver-3']);
});

test('the shackle unlocks only after its cam and locking bolt are removed',()=>{
  const removed=new Set();
  assert.equal(disassemblyBlocker('cam-0',removed),'соединительный вал');
  removed.add('rod-0');
  assert.equal(disassemblyBlocker('cam-0',removed),null);
  removed.add('cam-0');
  assert.equal(disassemblyBlocker('shackle-0',removed),'запирающий ригель');
  removed.add('bolt-0');
  assert.equal(disassemblyBlocker('shackle-0',removed),null);
  assert.equal(disassemblyBlocker('collar-0',removed),'дужку замка');
  removed.add('shackle-0');
  assert.equal(disassemblyBlocker('collar-0',removed),null);
  assert.equal(disassemblyBlocker('core-0',removed),'стопорную скобу цилиндра №1');
  assert.deepEqual(disassemblyPrerequisites('core-0'),['rod-0','clip-0','clip-1']);
  assert.equal(disassemblyBlocker('fastener-2',removed),null,
    'the post and ring are one removable fitting');
  assert.deepEqual(disassemblyPrerequisites('frame-0'),
    ['fastener-0','fastener-1','fastener-2','fastener-3']);
});

test('next-step guidance points to an actually reachable small part',()=>{
  const removed=new Set();
  assert.equal(nextDisassemblyStep(removed).id,'cover-0');
  removed.add('cover-0');
  assert.equal(nextDisassemblyStep(removed).id,'driver-0');
  for(let i=0;i<4;i++)removed.add(`driver-${i}`);
  assert.equal(nextDisassemblyStep(removed).id,'spring-0');
  removed.add('spring-0');
  assert.equal(nextDisassemblyStep(removed).id,'spring-1');
  assert.ok(!disassemblyPrerequisites('rear-0').length);
});
