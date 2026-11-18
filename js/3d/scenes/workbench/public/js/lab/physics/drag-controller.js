// Reusable rigid-object pointer drag with an exact local grab offset.
// Suitable for screws, covers and future movable workbench parts.
export function createDragController({THREE,toLocal,bounds,onMove,onRelease}){
  let active=null;
  function begin(object,point,data){
    const contact=point?toLocal(point):object.position;
    active={object,data,last:object.position.clone(),velocity:new THREE.Vector3(),
      offset:object.position.clone().sub(contact),
      initial:object.position.clone(),target:null,elapsed:0,
      smoothTime:Math.max(0,data.smoothTime||0)};
    if(data.extraction){
      const {axis,distance,exitZ,duration}=data.extraction;
      const midway=active.initial.clone().addScaledVector(axis,distance);
      const end=midway.clone();end.z=Math.max(midway.z,exitZ);
      active.extraction={midway,end,duration:Math.max(.15,duration||.5),
        elapsed:0,releasePending:false};
    }
    // Preserve the precise contact point and initial height. No movement (or
    // physics impulse) takes place until the pointer actually moves.
    return true;
  }
  function move(point){
    if(!active||!point)return false;
    const local=toLocal(point),offset=active.offset;
    const target=new THREE.Vector3(
      Math.max(bounds.x[0],Math.min(bounds.x[1],local.x+offset.x)),
      Math.max(bounds.y[0],Math.min(bounds.y[1],local.y+offset.y)),
      Math.max(active.data.minimumZ??-Infinity,local.z+offset.z));
    // An occupied part of the tabletop can be higher than the table itself.
    // The clearance is evaluated under the part's full footprint, not merely
    // under its cursor, so lids cannot intersect the housing while dragging.
    if(active.data.minimumZAt)
      target.z=Math.max(target.z,active.data.minimumZAt(target.x,target.y),
        active.last.z);
    active.target=target;
    // A spring must first follow its drilled bore, all the way through the
    // open upper mouth. Only once it clears the metal may it lift or move
    // sideways toward the pointer.
    if(active.extraction)return true;
    if(!active.smoothTime)applyPosition(target,1/60);
    else{
      // Clear the surrounding metal before easing sideways out of the slot.
      // This prevents the cover from ever passing through the lock body.
      const current=active.object.position;
      const clearance=active.data.minimumZAt?.(current.x,current.y)??-Infinity;
      current.z=Math.max(current.z,target.z,clearance);
      active.initial.z=current.z;active.last.z=current.z;
    }
    return true;
  }
  function applyPosition(target,dt){
    const previous=active.object.position.clone();
    active.object.position.copy(target);
    active.velocity.subVectors(active.object.position,previous)
      .divideScalar(Math.max(dt,.008)).clampLength(0,1.6);
    active.last.copy(active.object.position);
    onMove?.(active);
  }
  function update(dt){
    if(!active)return false;
    const step=Math.min(.05,Math.max(0,dt));
    if(active.extraction){
      const extraction=active.extraction;
      extraction.elapsed=Math.min(extraction.duration,extraction.elapsed+step);
      const phase=extraction.elapsed/extraction.duration;
      const boreFraction=.68;
      const ease=t=>t*t*(3-2*t);
      const next=phase<boreFraction?
        active.initial.clone().lerp(extraction.midway,ease(phase/boreFraction)):
        extraction.midway.clone().lerp(extraction.end,
          ease((phase-boreFraction)/(1-boreFraction)));
      applyPosition(next,step);
      if(phase<1)return true;
      active.initial.copy(extraction.end);
      active.elapsed=0;
      active.extraction=null;
      if(extraction.releasePending){finishRelease();return true;}
    }
    if(!active?.target||!active.smoothTime)return false;
    active.elapsed+=step;
    const phase=Math.min(1,active.elapsed/active.smoothTime);
    const ease=phase*phase*(3-2*phase);
    const next=phase<=1?active.initial.clone().lerp(active.target,ease):
      active.object.position.clone().lerp(active.target,1-Math.exp(-22*step));
    applyPosition(next,step);
    return true;
  }
  function finishRelease(){
    if(!active)return false;
    // The contact proxy reactivates on release; it must not begin embedded in
    // the housing if a particularly fast gesture ended mid-transition.
    if(active.target&&active.data.minimumZAt){
      const point=active.object.position;
      point.z=Math.max(point.z,active.data.minimumZAt(point.x,point.y));
    }
    onRelease?.(active);
    active=null;
    return true;
  }
  function end(){
    if(!active)return false;
    if(active.extraction){
      // Finish the physical withdrawal even when the mouse is released early.
      active.extraction.releasePending=true;
      return true;
    }
    return finishRelease();
  }
  function reset(){active=null;}
  const isDragging=data=>active?.data.id===data;
  return {begin,move,update,end,reset,isDragging};
}
