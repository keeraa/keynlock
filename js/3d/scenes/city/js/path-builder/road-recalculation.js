import {createPathLayoutService} from '../navigation/path-layout-service.js';

export function createRoadRecalculation({
  planner=createPathLayoutService(),
  apply,
  onStatusChange,
}){
  let revision=0;
  let status='idle';

  function setStatus(next,error){
    status=next;
    onStatusChange({status,error});
  }

  async function recalculate(buildings,{landscape,animate,save}){
    const request=++revision;
    setStatus('pending');
    try{
      const layout=await planner.plan(buildings,{landscape});
      if(request!==revision)return;
      if(layout===null){
        setStatus('idle');
        return;
      }
      apply(layout,{animate,save});
    }catch(error){
      if(request!==revision)return;
      setStatus('error',error);
      return;
    }
    setStatus('ready');
  }

  return {
    get status(){return status;},
    recalculate,
    dispose(){
      revision++;
      planner.dispose();
    },
  };
}
