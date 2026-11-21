import {planBuildingPaths} from './path-layout.js';

const createWorker=()=>new Worker(new URL('./path-layout-worker.js',import.meta.url),
  {type:'module'});

// Latest request wins: undo/redo or multiple house drops cancel stale A* jobs
// instead of waiting for the old graph to finish. A synchronous fallback is
// retained for browsers that cannot start module workers.
export function createPathLayoutService({workerFactory=createWorker,
  fallback=planBuildingPaths}={}){
  let worker=null,active=null,closed=false,workerUnsupported=false,nextId=0;
  const stopWorker=()=>{worker?.terminate();worker=null;};
  const cancel=()=>{
    if(active){active.resolve(null);active=null;stopWorker();}
  };
  const plan=(buildings,{landscape=null,bounds}={})=>{
    if(closed)return Promise.resolve(null);
    cancel();
    const fallbackPlan=()=>Promise.resolve().then(()=>fallback(buildings,{landscape,bounds}));
    if(workerUnsupported)return fallbackPlan();
    try{if(!worker)worker=workerFactory();}
    catch{workerUnsupported=true;return fallbackPlan();}
    const id=++nextId;
    return new Promise((resolve,reject)=>{
      active={id,resolve};
      const fail=()=>{
        if(active?.id!==id)return;
        active=null;stopWorker();workerUnsupported=true;
        fallbackPlan().then(resolve,reject);
      };
      worker.onmessage=({data})=>{
        if(!active||active.id!==id||data?.id!==id)return;
        if(data.error){fail();return;}
        active=null;resolve(data.layout);
      };
      worker.onerror=fail;
      try{worker.postMessage({id,buildings,landscape,bounds});}
      catch{fail();}
    });
  };
  return {plan,dispose(){closed=true;cancel();stopWorker();}};
}
