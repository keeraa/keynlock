import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('assembly keeps its blueprint and removes the nonphysical inventory',()=>{
  const page=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  const scene=readFileSync(new URL('../public/js/assembly-scene.js',import.meta.url),'utf8');
  assert.doesNotMatch(page,/id="manualIllustration"|id="manualInstruction"|id="partsFilter"/);
  assert.doesNotMatch(page,/class="manual-card"/);
  assert.match(scene,/const paper=addMesh/);
  assert.match(scene,/createLaboratoryLockVisual/);
  assert.doesNotMatch(scene,/addPart\(|addSocket\(|looseHomes|decoyIds|legacyVisuals/);
  assert.doesNotMatch(page,/id="assemblyCount"|id="partSelection"|id="runTest"/);
  assert.match(page,/id="assemblyCameraFixed"[^>]*checked/);
  assert.match(page,/ЛКМ по свободному месту — сдвинуть камеру/);
  assert.match(page,/Shift \/ Ctrl \/ ⌘ \+ ЛКМ/);
});
