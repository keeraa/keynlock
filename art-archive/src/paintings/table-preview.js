import {aimedSupport,findDrop} from './floor-drop.js';

export function createTablePreview(THREE,layout,config,motion){
  const eye=new THREE.Vector3(),direction=new THREE.Vector3();
  const reach=config.paintings.placementReachM??6;
  let plan=null,fresh=false,lastFresh=-Infinity;

  function reset(){
    plan=null;fresh=false;lastFresh=-Infinity;
  }

  function update({origin,dir,carrying,floor,room,wallDistance,now}){
    const eyeDelta=eye.distanceToSquared(origin),directionDelta=direction.distanceToSquared(dir);
    if(fresh && eyeDelta<1e-6 && directionDelta<1e-8){
      lastFresh=now;
      return plan;
    }

    const previous=plan;
    plan=null;fresh=false;
    eye.copy(origin);direction.copy(dir);
    const support=aimedSupport(origin,dir,layout,config,wallDistance,reach);
    if(support?.kind==='table'){
      const slot=findDrop(carrying,origin,dir,room,layout,config,floor,wallDistance)
        ??findDrop(carrying,origin,dir,room,layout,config,[],wallDistance);
      if(slot?.supportId?.startsWith('table-')){
        // Validate the destination independently of the transient hand pose.
        const pose=motion.pose(slot);
        plan={slot,valid:!motion.blocked(slot,pose.position,pose.quaternion)};
        fresh=true;lastFresh=now;
      }
    }
    // Keep the last preview through small aim changes at the edge of a table.
    if(!plan && directionDelta<.002 && eyeDelta<.01 && now-lastFresh<140)plan=previous;
    return plan;
  }

  return {reset,update};
}
