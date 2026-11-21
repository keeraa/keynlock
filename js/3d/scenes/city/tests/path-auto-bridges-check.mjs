import assert from 'node:assert/strict';
import {addAutomaticRiverBridges} from '../js/path-builder/auto-bridges.js';
import {bridgeAt,bridgeProfiles,normalizeLandscape} from '../js/path-builder/landscape-model.js';
import {planBuildingPaths} from '../js/navigation/path-layout.js';

const river={id:'river-cut',width:9,depth:3,points:[[300,200],[300,350],[305,500]]};
const landscape=normalizeLandscape({rivers:[river]});
const opposite=[{id:'west',x:265,z:370},{id:'east',x:335,z:372}];
const generated=addAutomaticRiverBridges(landscape,opposite);
assert.equal(generated.bridges.length,1,'Opposite-bank houses get a crossing without manual bridge tool');
assert.equal(generated.bridges[0].auto,true);
const bridge=bridgeProfiles(generated).find(b=>b.riverId==='river-cut');
assert.ok(bridge&&bridge.span>=river.width,'Automatic bridge spans the excavated river');
const connected=planBuildingPaths(opposite.map(b=>({...b,width:8,depth:7,
  rotation:0,kind:'house',pathAccess:{x:0,z:4}})),{landscape:generated});
assert.equal(connected.connected,2,'The pedestrian router can traverse the newly generated bridge');
assert.ok(connected.paths.some(path=>path.p.slice(1).some((end,i)=>{
  const start=path.p[i],length=Math.hypot(end[0]-start[0],end[1]-start[1]);
  return Array.from({length:Math.ceil(length*2)+1},(_,j)=>j/Math.ceil(length*2)).some(t=>
    bridgeAt(generated,start[0]+(end[0]-start[0])*t,start[1]+(end[1]-start[1])*t)?.id===bridge.id);
})),
'A pedestrian path crosses at the generated bridge location');
assert.strictEqual(addAutomaticRiverBridges(generated,opposite),generated,
  'Repeated routing does not duplicate or rebuild existing auto bridges');
assert.strictEqual(addAutomaticRiverBridges(landscape,[{id:'west',x:265,z:370}]),landscape,
  'One building is insufficient to infer a needed crossing');
const sameBank=addAutomaticRiverBridges(landscape,[{id:'a',x:265,z:365},{id:'b',x:280,z:366}]);
assert.equal(sameBank.bridges.length,0,'Buildings on the same bank need no bridge');
const existing=normalizeLandscape({...landscape,bridges:[{id:'manual',riverId:'river-cut',t:.5}]});
assert.strictEqual(addAutomaticRiverBridges(existing,opposite),existing,
  'Manual bridge on the river is retained without automatic duplicates');
const erased=normalizeLandscape({...landscape,autoBridgeOptOut:['river-cut']});
assert.strictEqual(addAutomaticRiverBridges(erased,opposite),erased,
  'Erasing an automatic bridge preserves the deliberate absence after reload');
console.log('Automatic river bridges: house pairs, orientation and deduplication OK');
