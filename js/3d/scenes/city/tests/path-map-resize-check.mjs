import assert from 'node:assert/strict';
import {migrateSavedBuildings,migrateSavedLandscape} from '../js/path-builder/map-resize-migration.js';
import {LANDSCAPE_BOUNDS} from '../js/path-builder/landscape-model.js';

const legacy={version:1,buildings:[
  {id:'town',x:-30,z:18},
  {id:'far-palace',x:2000,z:1100},
]};
const moved=migrateSavedBuildings(legacy);
assert.deepEqual([moved[0].x,moved[0].z],[-30,18],
  'Central buildings keep their spacing and physical size');
assert.deepEqual([moved[1].x,moved[1].z],[1250,687.5],
  'Remote buildings remain inside the smaller map instead of being discarded');
assert.deepEqual([legacy.buildings[1].x,legacy.buildings[1].z],[2000,1100],
  'Migration leaves the original saved data untouched');

const landscape={version:1,trees:[{id:'a',x:2000,z:1000}],
  hills:[{id:'h',x:20,z:20},{id:'far',x:-2000,z:-1300}],
  rivers:[{id:'r',points:[[0,-1200],[1600,-1200]]}]};
const map=migrateSavedLandscape(landscape);
assert.deepEqual([map.trees[0].x,map.trees[0].z],[1250,625]);
assert.deepEqual([map.hills[0].x,map.hills[0].z],[20,20]);
assert.deepEqual([map.hills[1].x,map.hills[1].z],[-1250,-812.5]);
assert.deepEqual(map.rivers[0].points,[[0,-750],[1000,-750]],
  'Outlying rivers retain their shape instead of being clipped at the new border');
assert.equal(landscape.rivers[0].points[1][0],1600);

const current={version:1,mapBounds:LANDSCAPE_BOUNDS,buildings:[{x:1290,z:875}]};
assert.deepEqual(migrateSavedBuildings(current),current.buildings,
  'Newly saved maps are never migrated twice');
console.log('Map resize: remote saved buildings, streams, hills and trees retained without repeated migration');
