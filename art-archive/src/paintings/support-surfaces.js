import {footprintCorners,footprintsOverlap} from '../../catalog/painting-geometry.js';
import {stairTreads} from '../architecture/stair-profile.js';
export function tableFootprint(table){
 const c=Math.cos(table.angle),s=Math.sin(table.angle);
 return {x:table.x,z:table.z,u:{x:c,z:-s},v:{x:s,z:c},w:table.width/2,h:table.depth/2};
}
export function specialSupport(r,slot,layout,config){
 const points=footprintCorners(r),stair=config.building.stair;
 if(slot.y<-.2 || slot.supportId?.startsWith('step-')){
  for(const tread of stairTreads(stair)){
   if(points.every(p=>{const radius=Math.hypot(p.x,p.z),a=(Math.atan2(p.x,p.z)+Math.PI*2)%(Math.PI*2);
    return radius>=stair.innerRadius+.06&&radius<=stair.outerRadius-.05&&a>=tread.a+.003&&a<=tread.b-.003;}))
    return {y:tread.y,room:'center',id:'step-'+tread.index};
  }
  if(slot.y<-stair.depth+.4 && points.every(p=>Math.hypot(p.x,p.z)<5.0 && Math.hypot(p.x,p.z)>stair.innerRadius+.12))
   return {y:-stair.depth,room:'center',id:'lower-landing'};
  return null;
 }
 for(const table of layout.storageTables??[]){
  const b=tableFootprint(table);
  if(!footprintsOverlap(r,b,.015))continue;
  if(slot.trolleyBase)return null;
  const fits=points.every(p=>Math.abs((p.x-b.x)*b.u.x+(p.z-b.z)*b.u.z)<=b.w-.025&&Math.abs((p.x-b.x)*b.v.x+(p.z-b.z)*b.v.z)<=b.h-.025);
  return fits?{y:table.y,room:'center',id:table.id}:null;
 }
 return undefined;
}
export function supportingLevels(layout,config){
 return [...(layout.storageTables??[]).map(t=>t.y),...stairTreads(config.building.stair).map(t=>t.y),-config.building.stair.depth];
}
