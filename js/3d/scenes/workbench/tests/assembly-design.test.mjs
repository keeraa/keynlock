import test from 'node:test';
import assert from 'node:assert/strict';
import {PIN_ORDER,TARGET_CUTS,SLOT_TYPES,checkSocket} from '../public/js/logic.js';
import {EXTENDED_SLOTS,ALL_ASSEMBLY_SLOTS,DEFAULT_FREE_DESIGN,normalizeFreeDesign,
  swapPinCode,freeKeySignature,targetsForDesign,requiredAssemblySlots,
  assemblyStepsFor,inspectConfiguredAssembly} from '../public/js/assembly-design.js';
import {restoreWorkbenchState,snapshotWorkbenchState} from '../public/js/workbench-state.js';
import {manualIllustration} from '../public/js/manual.js';

function installedFor(order){
  const installed={};
  for(let i=0;i<4;i++){
    installed[`pin-${i}`]=`pin-${order[i]}`;
    installed[`spring-${i}`]=`spring-${i}`;
  }
  for(const id of ['core-0','gear-0','gear-1','cam-0','cover-0'])installed[id]=id;
  return installed;
}

test('extended mechanism has five genuine additional snap-in parts',()=>{
  assert.equal(SLOT_TYPES.length,13);
  assert.equal(EXTENDED_SLOTS.length,5);
  assert.equal(ALL_ASSEMBLY_SLOTS.length,18);
  assert.equal(requiredAssemblySlots('classic').length,13);
  assert.equal(requiredAssemblySlots('extended').length,18);
  assert.equal(assemblyStepsFor('extended').length,7);
  assert.deepEqual(requiredAssemblySlots('free',{...DEFAULT_FREE_DESIGN,reinforced:false}),SLOT_TYPES);
  assert.equal(requiredAssemblySlots('free',DEFAULT_FREE_DESIGN).length,18);
  assert.equal(checkSocket('washer-0','washer-1'),true);
  assert.equal(checkSocket('clip-0','cam-0'),false);
  assert.equal(checkSocket('rod-0','bolt-0'),false);
  assert.equal(checkSocket('bolt-0','bolt-0'),true);
});

test('extended assembly requires both washers, clip, rod and sliding bolt to run',()=>{
  const installed=installedFor(PIN_ORDER);
  const standard=inspectConfiguredAssembly(installed,TARGET_CUTS,TARGET_CUTS,PIN_ORDER);
  assert.equal(standard.success,true);
  const incomplete=inspectConfiguredAssembly(installed,TARGET_CUTS,TARGET_CUTS,PIN_ORDER,'extended');
  assert.equal(incomplete.complete,false);
  assert.deepEqual(incomplete.missing,EXTENDED_SLOTS);
  for(const id of EXTENDED_SLOTS)installed[id]=id;
  assert.equal(inspectConfiguredAssembly(installed,TARGET_CUTS,TARGET_CUTS,PIN_ORDER,'extended').success,true);
  installed['washer-0']='washer-1';
  delete installed['washer-1'];
  assert.equal(inspectConfiguredAssembly(installed,TARGET_CUTS,TARGET_CUTS,PIN_ORDER,'extended').success,false);
});

test('free designer swaps physical pins and makes its own valid key target',()=>{
  const reversed=swapPinCode(DEFAULT_FREE_DESIGN,0,1);
  assert.deepEqual(reversed.order,[1,0,3,2]);
  assert.deepEqual(DEFAULT_FREE_DESIGN.order,[2,0,3,1]);
  assert.equal(new Set(reversed.order).size,4);
  assert.deepEqual(normalizeFreeDesign({order:[0,0,0,0],ratio:'anything'}).order,[2,0,3,1]);
  assert.deepEqual(targetsForDesign([.01,.01,.01,.01,.22,.30],reversed),
    [.12,.05,.26,.19,.22,.30]);
  assert.equal(freeKeySignature({...reversed,ratio:'16:12',reinforced:false}),freeKeySignature(reversed),
    'changing transmission does not require recutting an otherwise valid key');
  const targets=targetsForDesign([0,0,0,0],reversed);
  const installed=installedFor(reversed.order);
  const noKey=inspectConfiguredAssembly(installed,targets,targets,PIN_ORDER,'free',
    {...reversed,reinforced:false},'');
  assert.equal(noKey.keyBlueprintMissing,true);
  assert.equal(noKey.success,false);
  const valid=inspectConfiguredAssembly(installed,targets,targets,PIN_ORDER,'free',
    {...reversed,reinforced:false},freeKeySignature(reversed));
  assert.equal(valid.success,true);
  assert.equal(inspectConfiguredAssembly(installed,targets,targets,PIN_ORDER,'free',
    {...DEFAULT_FREE_DESIGN,reinforced:false},freeKeySignature(DEFAULT_FREE_DESIGN)).success,false,
    'changing channel code requires a different physical pin arrangement');
});

test('saved custom drawings and add-on installations restore without losing classic saves',()=>{
  const design={order:[3,2,1,0],ratio:'16:12',reinforced:true};
  const targets=targetsForDesign(TARGET_CUTS,design);
  const stored={difficulty:4,targets,pinOrder:[...design.order],signature:'3210',
    serial:12,cuts:[0,0,0,0],assemblyVariant:'free',freeDesign:design,
    freeKeyBlueprint:freeKeySignature(design),
    installed:{...installedFor(design.order),...Object.fromEntries(EXTENDED_SLOTS.map(id=>[id,id]))}};
  const state=restoreWorkbenchState(stored);
  assert.equal(state.assemblyVariant,'free');
  assert.deepEqual(state.freeDesign,design);
  assert.equal(state.freeKeyBlueprint,freeKeySignature(design));
  assert.equal(Object.keys(state.installed).length,18);
  assert.equal(snapshotWorkbenchState(state).assemblyVariant,'free');
  const invalid=restoreWorkbenchState({...stored,targets:TARGET_CUTS});
  assert.equal(invalid.freeKeyBlueprint,'');
});

test('the assembly sheet adapts to extended parts and reversed gearing',()=>{
  const basic=manualIllustration(PIN_ORDER);
  const expanded=manualIllustration([1,0,3,2],{ratio:'16:12',hardware:true});
  assert.match(basic,/13 ДЕТАЛЕЙ/);
  assert.match(expanded,/18 ДЕТАЛЕЙ/);
  assert.match(expanded,/16:12/);
  assert.match(expanded,/СТ/);
  assert.ok(expanded.length>basic.length);
});
