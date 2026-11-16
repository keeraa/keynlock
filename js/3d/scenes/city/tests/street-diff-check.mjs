import assert from 'node:assert/strict';
import { generateStreetPlan } from '../js/street/street-generator.js';
import { diffStreetPlans } from '../js/street/street-diff.js';

const first=generateStreetPlan('industrial',123);
const same=diffStreetPlans(first,generateStreetPlan('industrial',123));
assert(!same.roadChanged && !same.lampsChanged);
assert.deepEqual([same.added.length,same.changed.length,same.moved.length,same.removed.length],[0,0,0,0]);
assert.equal(same.unchanged.length,10);

const lamps=diffStreetPlans(first,generateStreetPlan('industrial',123,{lampStyle:'gas'}));
assert.equal(lamps.lampsChanged,true);
assert.equal(lamps.roadChanged,false);
assert.equal(lamps.unchanged.length,10);

const road=diffStreetPlans(first,generateStreetPlan('industrial',123,{roadWidth:11}));
assert.equal(road.roadChanged,true);
assert.equal(road.lampsChanged,true);
assert.equal(road.moved.length,10);
assert.equal(road.changed.length,0);

const facade=diffStreetPlans(first,generateStreetPlan('industrial',123,{walls:['#aabbcc']}));
assert.equal(facade.roadChanged,false);
assert.equal(facade.lampsChanged,false);
assert(facade.changed.length>0);

const initial=diffStreetPlans(null,first);
assert.equal(initial.added.length,10);
assert(initial.roadChanged && initial.lampsChanged);
assert.equal(first.road.surface,'cobble');
console.log('Street diff: lamp, road, position and house changes isolated; industrial cobblestones OK');
