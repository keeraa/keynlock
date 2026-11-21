import assert from 'node:assert/strict';
import {createPathLayoutService} from '../js/navigation/path-layout-service.js';
import {createRoadRecalculation} from '../js/path-builder/road-recalculation.js';
import {planBuildingPaths} from '../js/navigation/path-layout.js';

const houses=[{id:'a',kind:'house',x:0,z:0,width:8,depth:8},
  {id:'b',kind:'house',x:22,z:0,width:8,depth:8}];
const workers=[];
const factory=()=>{
  const worker={terminated:false,request:null,onmessage:null,onerror:null,
    postMessage(message){this.request=message;},terminate(){this.terminated=true;}};
  workers.push(worker);return worker;
};
const service=createPathLayoutService({workerFactory:factory});
const obsolete=service.plan(houses,{landscape:null});
assert.equal(workers[0].request.buildings.length,2);
const latest=service.plan([...houses,{id:'c',kind:'house',x:44,z:0,width:8,depth:8}]);
assert.equal(await obsolete,null,'Outdated A* jobs resolve as cancelled');
assert.equal(workers[0].terminated,true,'Old worker computation is terminated');
const newest=workers[1],data=newest.request;
const expected=planBuildingPaths(data.buildings,{landscape:data.landscape,bounds:data.bounds});
newest.onmessage({data:{id:data.id,layout:{...expected,network:{
  nodes:expected.network.nodes,edges:expected.network.edges,anchors:expected.network.anchors}}}});
const received=await latest;
assert.deepEqual(received.paths,expected.paths,'Worker result preserves routes');
assert.equal(received.network.nodes.length,expected.network.nodes.length);
assert.equal(typeof received.network.findRoute,'undefined',
  'Transferred network contains only structured-cloneable data');
service.dispose();
assert.equal(workers[1].terminated,true,'Worker is released when editor closes');

const fallback=createPathLayoutService({workerFactory(){throw Error('Worker blocked');}});
const offline=await fallback.plan(houses);
assert.equal(offline.connected,2,'Unsupported workers retain the synchronous planner');
fallback.dispose();

const failedWorkers=[];
let fallbackError=new Error('Fallback failed');
const recovering=createPathLayoutService({
  workerFactory(){
    const worker=factory();
    failedWorkers.push(worker);
    return worker;
  },
  fallback(buildings,options){
    if(fallbackError)throw fallbackError;
    return planBuildingPaths(buildings,options);
  },
});
const statuses=[],applied=[];
const failure=fallbackError;
const roads=createRoadRecalculation({
  planner:recovering,
  apply:(layout,options)=>applied.push({layout,options}),
  onStatusChange:({status,error})=>{
    statuses.push(status);
    if(status==='error')assert.equal(error,failure);
  },
});
const oldRun=roads.recalculate(houses,{});
const currentRun=roads.recalculate(houses,{});
failedWorkers[1].onerror();
await Promise.all([oldRun,currentRun]);
assert.deepEqual(statuses,['pending','pending','error']);
assert.equal(applied.length,0,'Cancelled and failed calculations do not update the map');
fallbackError=null;
await roads.recalculate(houses,{animate:true,save:true});
assert.deepEqual(statuses.slice(-2),['pending','ready']);
assert.equal(applied[0].layout.connected,2);
assert.deepEqual(applied[0].options,{animate:true,save:true});
roads.dispose();

// Run the actual worker message handler in an isolated simulated scope.
const oldSelf=globalThis.self,posted=[];
globalThis.self={postMessage(message){posted.push(message);}};
await import('../js/navigation/path-layout-worker.js');
globalThis.self.onmessage({data:{id:33,buildings:houses,landscape:null}});
assert.equal(posted[0].id,33);
assert.equal(posted[0].layout.connected,2);
assert.doesNotThrow(()=>structuredClone(posted[0].layout));
globalThis.self=oldSelf;
console.log('Async path planning: cancellation, latest routes, worker transfer and fallback OK');
