import test from 'node:test';
import assert from 'node:assert/strict';
import { paintings } from '@keynlock/atelier/src/atelier-config.js';
import { applyRestorationStamp } from '@keynlock/atelier/src/restoration-operations.js';
import { paintingSeed } from '@keynlock/atelier/src/restoration-sessions.js';
import { calculateColorAccuracy } from '@keynlock/atelier/src/restoration-feedback.js';
import { getPaintingLore } from '@keynlock/atelier/src/lore/painting-lore.js';

const removedPaintingIds = [
  'kameyama', 'sun-moon-peaks', 'yokkaichi', 'mishima', 'water-lilies',
  'woman-parasol', 'school-of-athens', 'garden-earthly-delights', 'rococo-reader',
  'ghent-altarpiece', 'rococo-breakfast', 'welcoming-governor', 'royal-procession',
  'korean-beauty', 'lotus-dragonflies', 'journey-sichuan', 'birds-flowers',
  'kangxi-southern-tour', 'nomad-flute', 'surrender-breda',
];

test('the curated Lair has 160 paintings without the twenty removed works', () => {
  assert.equal(paintings.length, 160);
  assert.equal(new Set(paintings.map(art => art.id)).size, paintings.length);
  const activeIds = new Set(paintings.map(art => art.id));
  for (const id of removedPaintingIds) assert.ok(!activeIds.has(id), `${id} was removed`);
  assert.equal(paintingSeed('starry-night'), paintingSeed('starry-night'));
  assert.notEqual(paintingSeed('starry-night'), paintingSeed('mona-lisa'));
});

test('every retained work has its original Atelier description and ban reason', () => {
  for (const art of paintings) {
    const lore = getPaintingLore(art.id);
    assert.ok(lore?.description, `Atelier description for ${art.id}`);
    assert.ok(lore?.banReason, `Atelier ban reason for ${art.id}`);
  }
});

test('all five restoration tools reuse the original operations', () => {
  const events = [];
  const layers = Object.fromEntries(['dust','dirt','cracks','loss','varnish','uvSource','scan']
    .map(key => [key, { getImageData: () => ({ data: [0,0,0,255] }), key }]));
  function apply(tool) {
    const changed = new Set();
    const affected=applyRestorationStamp({tool,x:50,y:50,width:100,height:100,strength:.6,
      layers,changed,erase:(layer)=>events.push(layer.key),markUV:()=>events.push('scan')});
    return {changed,affected};
  }
  assert.equal(apply('brush').affected,true);
  assert.equal(apply('swab').affected,true);
  assert.equal(apply('uv').changed.has('uv'),true);
  assert.equal(apply('reagent').changed.has('varnish'),true);
  assert.equal(apply('retouch').changed.has('loss'),true);
  assert.deepEqual([...new Set(events)].sort(),['cracks','dirt','dust','loss','scan','uvSource','varnish']);
});

test('color recovery is still scored by the original atelier rule', () => {
  const art=paintings[0];
  const adjusted={hue:-art.hue,saturation:100/art.saturation,brightness:100/art.brightness};
  assert.equal(calculateColorAccuracy(art,adjusted),100);
  assert.ok(calculateColorAccuracy(art,{hue:0,saturation:100,brightness:100})<=100);
});
