import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  KEYNLOCK_MAP_BOUNDS,
  KEYNLOCK_WATER_MASK_URL,
  KEYNLOCK_SHORE_WASH_URL,
  keynlockWaterAt,
  keynlockWaterNear,
  keynlockWaterChannelAt,
  keynlockCoastCrossesTile,
} from '../js/path-builder/keynlock-geography.js';
import {
  SPB_MAP_BOUNDS,
  SPB_WATER_MASK_URL,
  SPB_SHORE_WASH_URL,
  spbWaterAt,
  spbWaterNear,
  spbWaterChannelAt,
  spbCoastCrossesTile,
} from '../js/path-builder/spb-water-layout.js';
import {LANDSCAPE_BOUNDS} from '../js/path-builder/landscape-model.js';
import {KEYNLOCK_FIXED_BRIDGES,fixedBridgeWaterAt,
  paintFixedBridgeWater} from '../js/path-builder/keynlock-fixed-bridges.js';

// Keep the approved shoreline, island shapes and scale exactly unchanged.
assert.strictEqual(KEYNLOCK_MAP_BOUNDS,SPB_MAP_BOUNDS);
assert.strictEqual(LANDSCAPE_BOUNDS,KEYNLOCK_MAP_BOUNDS);
assert.strictEqual(KEYNLOCK_WATER_MASK_URL,SPB_WATER_MASK_URL);
assert.strictEqual(KEYNLOCK_SHORE_WASH_URL,SPB_SHORE_WASH_URL);
assert.equal(KEYNLOCK_FIXED_BRIDGES.length,5);
for(const bridge of KEYNLOCK_FIXED_BRIDGES){
  assert.ok(bridge.fixed);
  assert.ok(bridge.span>100,'All major river crossings have full-size decks');
  assert.ok(bridge.deckWidth>=17,'The bridge deck is wide enough for a city street');
  assert.equal(spbWaterAt(bridge.x,bridge.z),false,
    `${bridge.id} used to be a dry strip across the river`);
  assert.equal(fixedBridgeWaterAt(bridge.x,bridge.z),true);
  for(const side of [-1,1]){
    const x=bridge.x+side*bridge.dirX*(bridge.span/2-bridge.landApproachLength/2);
    const z=bridge.z+side*bridge.dirZ*(bridge.span/2-bridge.landApproachLength/2);
    assert.equal(fixedBridgeWaterAt(x,z),false,
      `${bridge.id} must preserve dry ground under both bridge abutments`);
    assert.equal(spbWaterAt(x,z),false,
      `${bridge.id} has a dry reference road for both land approaches`);
  }
  assert.equal(keynlockWaterAt(bridge.x,bridge.z),true,
    `${bridge.id} must have open water under its deck`);
  assert.ok(keynlockWaterNear(bridge.x,bridge.z,2));
  assert.ok(keynlockWaterChannelAt(bridge.x,bridge.z).bed>.1);
  assert.equal(typeof keynlockCoastCrossesTile(bridge.x,bridge.z,8),'boolean');
}
assert.equal(keynlockWaterAt(0,500),spbWaterAt(0,500),
  'The rest of the coastline retains the original reference geometry');

const operations=[];
const ctx={save(){},restore(){},translate(...args){operations.push(['translate',...args]);},
  rotate(){},fillRect(...args){operations.push(['fillRect',...args]);}};
paintFixedBridgeWater(ctx,{worldWidth:LANDSCAPE_BOUNDS.width,
  worldDepth:LANDSCAPE_BOUNDS.depth,ppm:1});
assert.equal(operations.filter(([name])=>name==='fillRect').length,5,
  'Each permanent bridge must be painted as one connected underwater opening');

const html=readFileSync(new URL('../path-builder/index.html',import.meta.url),'utf8');
const editor=readFileSync(new URL('../js/path-builder/editor.js',import.meta.url),'utf8');
assert.match(html,/Реки, протоки и острова Кийенлока/);
assert.doesNotMatch(html,/Петербург|Нев[аы]/);
assert.doesNotMatch(editor,/Нева и каналы/);

console.log('KEYNLOCK geography: same approved outline, fictional world labels OK');
