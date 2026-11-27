import {frameDimensions,frameOrientation} from '../../catalog/painting-geometry.js';
export function wallRange(wall,settings){
 const margin=wall.hall==='center'?(settings.edgeMarginM??0):(settings.cornerMarginM??settings.edgeMarginM??0);
 return {min:Math.max(margin,wall.minAlong??0),max:Math.min(wall.length-margin,wall.maxAlong??wall.length)};
}
// Saved positions use wall coordinates in metres, independent of the scene's world transform.
export function placedSlot(slot,wall,along,y,settings,occupied) {
  const depth=settings.wallClearanceM+settings.frameDepthM/2;
  const halfH=frameDimensions(slot,settings).height/2,{min,max}=wallRange(wall,settings);
  if (![along,y].every(Number.isFinite) ||
      along-slot.width/2 < min-1e-7 || along+slot.width/2 > max+1e-7 ||
      y-halfH < settings.minBottomM-1e-7 || y+halfH > settings.maxTopM+1e-7) return null;
  const overlaps=occupied.some(s=>s.wall.id===wall.id && s.painting.id!==slot.painting.id &&
    Math.abs(along-s.along)<(slot.width+s.width)/2+settings.horizontalGapM-1e-7 &&
    Math.abs(y-s.y)<halfH+frameDimensions(s,settings).height/2+settings.verticalGapM-1e-7);
  if (overlaps) return null;
  // A mounted work belongs to its wall, not its former staging room or support.
  // Otherwise portal culling hides it while collision checks still see it.
  return {...slot,floorAngle:undefined,floorRoom:undefined,supportId:undefined,leanPitch:undefined,faceDown:false,trolley:false,
    wall,along,y,normal:wall.normal,
    x:wall.a.x+(wall.b.x-wall.a.x)*along/wall.length+depth*wall.normal.x,
    z:wall.a.z+(wall.b.z-wall.a.z)*along/wall.length+depth*wall.normal.z};
}

// Compare outer edges in wall coordinates. Equal frame borders cancel in the height difference.
export function adjacentLevel(slot,wall,x,y,hung) {
  let best=null,score=Infinity;
  for(const other of hung){
    if(other.wall.id!==wall.id)continue;
    const gap=Math.abs(other.along-x)-(other.width+slot.width)/2;
    if(gap<-.000001 || gap>.9)continue;
    const offset=(other.height-slot.height)/2;
    for(const level of [other.y-offset,other.y+offset,other.y]){
      const delta=Math.abs(level-y);
      if(delta>.12 || delta+gap*.015>=score)continue;
      best=level;score=delta+gap*.015;
    }
  }
  return best;
}

// Above and below a neighbour, snap its left edge, right edge or horizontal centre.
export function adjacentPosition(slot,wall,x,y,hung,frameWidth){
  const level=adjacentLevel(slot,wall,x,y,hung);
  if(level!==null)return {x,y:level};
  let best=null,score=Infinity;
  for(const other of hung){
    if(other.wall.id!==wall.id)continue;
    const gap=Math.abs(other.y-y)-(other.height+slot.height)/2-2*frameWidth;
    if(gap<-.000001 || gap>.9)continue;
    const offset=(other.width-slot.width)/2;
    for(const along of [other.along-offset,other.along+offset,other.along]){
      const delta=Math.abs(along-x);
      if(delta>.12 || delta+gap*.015>=score)continue;
      best={x:along,y};score=delta+gap*.015;
    }
  }
  return best;
}

export function accepts(wall,slot) {
  return wall.entrances?.includes(slot.destination.split('/')[0]) || (wall.themes ?? [wall.theme]).some(theme=>wall.hall+'/'+theme===slot.destination);
}

export function acceptsHall(slot,wall){
  return slot.painting.collection!=='keynlock' && slot.destination.split('/')[0]===wall.hall;
}

export {scatterFloor as floorSlots} from './floor-scatter.js';

export function wallAtRay(origin,dir,walls,wallHeight,maxDistance=10) {
  let hit=null;
  for (const wall of walls) {
    const n=wall.normal, dot=dir.x*n.x+dir.z*n.z;
    if(Math.abs(dot)<.001)continue;
    const distance=((wall.a.x-origin.x)*n.x+(wall.a.z-origin.z)*n.z)/dot;
    if(distance<=0 || distance>maxDistance || (hit && hit.distance<=distance))continue;
    const dx=origin.x+dir.x*distance-wall.a.x,dz=origin.z+dir.z*distance-wall.a.z;
    const along=(dx*(wall.b.x-wall.a.x)+dz*(wall.b.z-wall.a.z))/wall.length;
    const y=origin.y+dir.y*distance;
    if(along>=0 && along<=wall.length && y>=0 && y<=wallHeight)hit={wall,distance,along,y,front:dot<0};
  }
  return hit?.front ? hit : null;
}

// Intersect the solid outside dimensions, including the narrow side of a rail.
export function frameAtRay(origin,dir,slots,settings,reach,wallId) {
  let picked=null;
  for(const slot of slots){
    if(wallId && slot.wall.id!==wallId)continue;
    const x=origin.x-slot.x,y=origin.y-slot.y,z=origin.z-slot.z;
    // Reject remote frames cheaply before doing the three oriented slab tests.
    const rayT=Math.max(0,Math.min(reach,-(x*dir.x+y*dir.y+z*dir.z)));
    const h=frameDimensions(slot,settings).height;
    if((x+rayT*dir.x)**2+(y+rayT*dir.y)**2+(z+rayT*dir.z)**2 >
        (slot.width**2+h*h+(settings.frameDepthM*1.04)**2)*.25+1e-9)continue;
    const {c,s,cp,sp}=frameOrientation(slot);
    const along=x*s+z*c, rayAlong=dir.x*s+dir.z*c;
    let near=0,far=reach;
    function slab(p,v,half){
      if(Math.abs(v)<1e-8)return Math.abs(p)<=half;
      const a=(-half-p)/v,b=(half-p)/v;
      near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));
      return near<=far;
    }
    if(slab(x*c-z*s,dir.x*c-dir.z*s,slot.width/2) &&
       slab(y*cp+along*sp,dir.y*cp+rayAlong*sp,h/2) &&
       slab(along*cp-y*sp,rayAlong*cp-dir.y*sp,settings.frameDepthM*.52)){
      picked=slot;reach=near;
    }
  }
  return picked;
}


// A wall can shorten the reticle's reach, while placement uses its own range.
export function aimedFrameAtRay(origin,dir,slots,settings,wallDistance=Infinity){
  return frameAtRay(origin,dir,slots,settings,Math.min(settings.paintingAimReachM??5,wallDistance));
}
