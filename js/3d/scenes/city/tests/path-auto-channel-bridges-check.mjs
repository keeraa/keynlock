import assert from 'node:assert/strict';
import {addAutomaticChannelBridges} from '../js/path-builder/auto-channel-bridges.js';
import {createLandscapeSampler,normalizeLandscape,landscapeEraseTarget} from '../js/path-builder/landscape-model.js';
import {keynlockWaterAt,KEYNLOCK_WATER_LEVEL} from '../js/path-builder/keynlock-geography.js';
import {planBuildingPaths} from '../js/navigation/path-layout.js';

// KEYNLOCK keeps the approved reference coastline; the clock tower is on the
// opposite bank. Unlike painted rivers, those channels have no river stroke.
const town={id:'town-house',kind:'house',x:15,z:0,width:8,depth:8,
  pathAccess:{x:0,z:4.5}};
const neighbor={id:'neighbor',kind:'house',x:15,z:18,width:8,depth:8,
  pathAccess:{x:0,z:4.5}};
const tower={id:'clock-tower',kind:'landmark',x:85,z:0,width:12,depth:10,
  pathAccess:{x:0,z:5.5}};
assert.equal(keynlockWaterAt(55,0),true,'The reference river separates the tower');
assert.equal(keynlockWaterAt(town.x,town.z),false);
assert.equal(keynlockWaterAt(tower.x,tower.z),false);

const buildings=[town,neighbor,tower];
const initial=normalizeLandscape({});
const bridged=addAutomaticChannelBridges(initial,buildings);
assert.equal(bridged.channelBridges.length,1,'Reference water receives one crossing');
const bridge=bridged.channelBridges[0];
assert.ok(bridge.major&&bridge.deckWidth>=8,'Town crossings are monumental and broad');
assert.ok(bridge.span>bridge.width+10,'Each bridge has real landfall overlap');
assert.ok(keynlockWaterAt(bridge.x,bridge.z),'Bridge spans actual reference water');
assert.equal(addAutomaticChannelBridges(bridged,buildings),bridged,
  'Rebuilding the plan does not duplicate the crossing');
const oldSkew=normalizeLandscape({...bridged,channelBridges:[{
  ...bridge,dirX:1,dirZ:0,span:bridge.span+16,
}]});
const realigned=addAutomaticChannelBridges(oldSkew,buildings);
assert.ok(Math.abs(realigned.channelBridges[0].dirZ-bridge.dirZ)<.001,
  'Saved skewed automatic bridges are realigned to the nearest dry banks');
const nearTower=realigned.channelBridges[0];
assert.equal(keynlockWaterAt(nearTower.x-nearTower.dirX*nearTower.span/2,
  nearTower.z-nearTower.dirZ*nearTower.span/2),false);
assert.equal(keynlockWaterAt(nearTower.x+nearTower.dirX*nearTower.span/2,
  nearTower.z+nearTower.dirZ*nearTower.span/2),false,
  'Both ends of an automatic bridge rest on the ground');
for(const sign of [-1,1])for(const across of [-.5,.5]){
  const x=nearTower.x+sign*nearTower.dirX*nearTower.span/2-
    nearTower.dirZ*nearTower.deckWidth*across;
  const z=nearTower.z+sign*nearTower.dirZ*nearTower.span/2+
    nearTower.dirX*nearTower.deckWidth*across;
  assert.equal(keynlockWaterAt(x,z),false,
    'The full width of each masonry bridge foot rests on dry land');
}

const layout=planBuildingPaths(buildings,{landscape:bridged});
assert.equal(layout.connected,3,'The tower and the town are connected across the bridge');
const approach=layout.paths.find(path=>path.id.startsWith('bridge-access-')&&path.width>=6);
assert.ok(approach,
  'A broad city street is routed from the large bridge to the nearest settlement');
const [deckMouth,straightLanding]=approach.p;
const across=([x,z])=>-(x-bridge.x)*bridge.dirZ+(z-bridge.z)*bridge.dirX;
assert.ok(Math.abs(across(deckMouth))<.02&&Math.abs(across(straightLanding))<.02,
  'The road begins directly on the bridge axis, not off its side');
assert.ok(Math.hypot(straightLanding[0]-deckMouth[0],
  straightLanding[1]-deckMouth[1])>=8,
  'The road stays straight across the bridgehead before its first turn');
assert.equal(landscapeEraseTarget(bridged,bridge.x,bridge.z)?.type,'bridge',
  'A new bridge remains erasable');
const without=normalizeLandscape({...bridged,channelBridges:[],
  autoChannelOptOut:[{x:bridge.x,z:bridge.z}]});
assert.equal(addAutomaticChannelBridges(without,buildings),without,
  'Erasing a bridge prevents it immediately reappearing');

const sampler=createLandscapeSampler(bridged);
assert.ok(sampler.heightAt(55,0)<KEYNLOCK_WATER_LEVEL-1.5,
  'The deepened river floor lies well below the visible water surface');
assert.ok(sampler.heightAt(15,0)>KEYNLOCK_WATER_LEVEL,'Dry land is above the water surface');
console.log('Reference rivers: automatic clock-tower bridge, town approach and deeper water OK');
