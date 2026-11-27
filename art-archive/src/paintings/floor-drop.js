// Oriented frame footprints, in metres. The same contact calculation is used for
// initial piles, restored positions, and paintings dropped during play.
import {frameFootprint,footprintExtent as extent,footprintsOverlap as overlaps,footprintCorners as corners} from '../../catalog/painting-geometry.js';
import {trolleyDimensions} from './trolley-model.js';
import {specialSupport,supportingLevels} from './support-surfaces.js';
const footprint=(p,frame)=>frameFootprint(p,{frameWidthM:frame,frameDepthM:0});
function ground(r,hall,layout,config){
  if(!hall){
    if(!corners(r).every(p=>layout.inCenter(p.x,p.z)))return null;
    const dx=Math.max(0,Math.abs(r.x*r.u.x+r.z*r.u.z)-r.w);
    const dz=Math.max(0,Math.abs(r.x*r.v.x+r.z*r.v.z)-r.h);
    return Math.hypot(dx,dz)>=config.building.stair.openingRadius+.12?0:null;
  }
  const pts=corners(r).map(p=>layout.local(hall,p.x,p.z));
  if(!pts.every(p=>Math.abs(p.x)<=hall.width/2-.24 && p.z>=hall.start && p.z<=hall.start+hall.length-.26))return null;
  const rug=(width,x)=>footprint({...layout.world(hall,x,hall.start+hall.length/2),width,height:hall.length-1.6,floorAngle:hall.angle},0);
  if(overlaps(r,rug(.035,-1.09)) || overlaps(r,rug(.035,1.09)))return .047;
  return overlaps(r,rug(2.15,0)) ? .0325 : 0;
}
export function floorSupport(slot,layout,config){
  const r=footprint(slot,config.paintings.frameWidthM),special=specialSupport(r,slot,layout,config);
  if(special!==undefined)return special;
  const hall=layout.halls.find(h=>{
    const p=layout.local(h,slot.x,slot.z);
    return Math.abs(p.x)<=h.width/2 && p.z>=h.start && p.z<=h.start+h.length;
  });
  const y=ground(r,hall,layout,config);
  return y===null?null:{y,room:hall?.id??'center',id:'floor/'+(hall?.id??'center')};
}
function safeFloor(slot,layout,config){
  if(floorSupport(slot,layout,config))return slot;
  // Repair unsafe old saves around the stair opening using the nearest supported floor.
  for(let radius=.5;radius<=30;radius+=.5)for(let i=0;i<32;i++){
    const angle=i*Math.PI/16;
    const candidate={...slot,x:slot.x+Math.cos(angle)*radius,z:slot.z+Math.sin(angle)*radius};
    const support=floorSupport(candidate,layout,config);
    if(support)return {...candidate,floorRoom:support.room};
  }
  throw Error('No supporting floor for '+slot.painting.id);
}
const roomOf=s=>s.floorRoom??s.wall.hall;
// Trolleys stand upright. A staged floor painting's angle and stack height must
// never leak into a restored cart; its wheels, rather than the canvas, touch the floor.
export function settleTrolley(slot,layout,config){
  const frame=config.paintings.frameWidthM,cart=trolleyDimensions(slot,config.paintings);
  const yaw=Math.atan2(slot.normal.x,slot.normal.z);
  const base=safeFloor({...slot,trolley:false,trolleyBase:true,width:cart.width,
    height:cart.depth-2*frame,floorAngle:yaw},layout,config);
  const support=floorSupport(base,layout,config);
  return {...slot,x:base.x,z:base.z,y:support.y+cart.centerHeight,
    trolley:true,floorAngle:undefined,floorRoom:support.room};
}
export function settleFloor(slots,layout,config,restored=[]){
  const {frameWidthM:frame,frameDepthM:depth}=config.paintings;
  const piles=new Map();
  const byHeight=(a,b)=>a.y-b.y;
  return [...slots.sort(byHeight),...restored.sort(byHeight)].map(original=>{
    const p=safeFloor(original,layout,config);
    const support=floorSupport(p,layout,config),room=roomOf(p),key=room+'/'+support.id,r=footprint(p,frame),pile=piles.get(key)??[];
    let top=support.y;
    for(const item of pile)if(overlaps(r,item.r))top=Math.max(top,item.top);
    pile.push({r,top:top+depth});piles.set(key,pile);
    return {...p,y:top+depth/2,supportId:support.id,floorRoom:support.room};
  });
}
export function covered(slot,floor,settings){
  const r=footprint(slot,settings.frameWidthM);
  return floor.some(p=>roomOf(p)===roomOf(slot)&&p.y>slot.y+.001&&p.y<=slot.y+settings.frameDepthM+.001&&overlaps(r,footprint(p,settings.frameWidthM)));
}
export function findDrop(slot,origin,dir,room,layout,config,floor,wallDistance=Infinity){
  const {frameWidthM:frame,frameDepthM:depth}=config.paintings;
  if(origin.y<-config.building.stair.depth+.5)return null;
  const horizontal=Math.hypot(dir.x,dir.z),yaw=Math.atan2(-dir.x,-dir.z);
  const pose={...slot,floorAngle:yaw,floorRoom:room};
  const others=floor.filter(p=>p.painting.id!==slot.painting.id && p.floorAngle!==undefined && p.y-depth/2<origin.y);
  // Intersect the reticle with each possible supporting height, nearest first.
  const levels=[...new Set([...others.map(p=>p.y+depth/2),...supportingLevels(layout,config),.047,.0325,0])].sort((a,b)=>b-a);
  for(const level of levels){
    const downward=dir.y<-.015;
    const t=downward?(level-origin.y)/dir.y:(slot.height/2+frame+.65)/Math.max(horizontal,.0001);
    if(t<0 || t>=wallDistance || t>Math.max(12,config.building.wingLength))continue;
    pose.x=origin.x+dir.x*t;pose.z=origin.z+dir.z*t;
    pose.y=level+depth/2;
    if(level<0 && origin.y>0){const topT=-origin.y/dir.y,x=origin.x+dir.x*topT,z=origin.z+dir.z*topT;if(Math.hypot(x,z)>config.building.stair.openingRadius)continue;}
    const hall=layout.halls.find(h=>{
      const p=layout.local(h,pose.x,pose.z);
      return Math.abs(p.x)<=h.width/2 && p.z>=h.start && p.z<=h.start+h.length;
    });
    pose.floorRoom=hall?.id??'center';
    const r=footprint(pose,frame);
    const support=floorSupport(pose,layout,config);
    if(!support)continue;
    let surface=support.y;pose.floorRoom=support.room;pose.supportId=support.id;
    let supported=true;
    for(const p of others){
      if(roomOf(p)!==pose.floorRoom)continue;
      const b=footprint(p,frame);
      if(!overlaps(r,b))continue;
      const top=p.y+depth/2;
      if(top>surface+.0001){surface=top;supported=false;}
      if(Math.abs(top-surface)<.0001 && [b.u,b.v].every(n=>Math.abs((r.x-b.x)*n.x+(r.z-b.z)*n.z)<=extent(b,n)+.0001))supported=true;
    }
    if(supported && Math.abs(surface-level)<.0001)return {...pose,y:surface+depth/2};
  }
  return null;
}

// Only direct contact hides a canvas at every viewing angle. Partial overlap
// still blocks pickup, but must leave the exposed part of the image visible.
export function hiddenFloorFaces(slots,settings) {
  const rooms=new Map(),hidden=new Set();
  for (const slot of slots) {
    if (slot.floorAngle===undefined) continue;
    const id=roomOf(slot);
    if (!rooms.has(id)) rooms.set(id,[]);
    rooms.get(id).push({slot,outer:footprint(slot,settings.frameWidthM)});
  }
  for(const pile of rooms.values()) {
    pile.sort((a,b)=>a.slot.y-b.slot.y);
    for(let i=0;i<pile.length;i++){
      const {slot,outer}=pile[i];
      const canvas={...outer,w:slot.painting.physicalSizeM.width/2,h:slot.height/2};
      for(let j=i+1;j<pile.length;j++){
        const upper=pile[j], separation=upper.slot.y-slot.y-settings.frameDepthM;
        if(separation>.0001)break;
        if(separation<-.0001)continue;
        const cover=upper.outer;
        const inside=(axis,half)=>Math.abs((canvas.x-cover.x)*axis.x+(canvas.z-cover.z)*axis.z)
          +extent(canvas,axis)<=half-.001;
        if(inside(cover.u,cover.w)&&inside(cover.v,cover.h)){
          hidden.add(slot);break;
        }
      }
    }
  }
  return hidden;
}
