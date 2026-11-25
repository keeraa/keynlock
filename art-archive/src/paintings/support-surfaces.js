import {supportTables} from '../architecture/storage-layout.js';
import {frameFootprint,footprintExtent,footprintCorners,footprintsOverlap} from '../../catalog/painting-geometry.js';
import {stairTreads} from '../architecture/stair-profile.js';
export function tableFootprint(table){
 const c=Math.cos(table.angle),s=Math.sin(table.angle);
 return {x:table.x,z:table.z,u:{x:c,z:-s},v:{x:s,z:c},w:table.width/2,h:table.depth/2};
}
export function specialSupport(r,slot,layout,config){
 const stair=config.building.stair;
 for(const table of supportTables(layout)){
  if(slot.y<(table.floorY??0)-.2 || slot.y>table.y+.5)continue;
  const b=tableFootprint(table);
  if(!footprintsOverlap(r,b,.015))continue;
  if(slot.trolleyBase)return null;
  const fits=footprintCorners(r).every(p=>Math.abs((p.x-b.x)*b.u.x+(p.z-b.z)*b.u.z)<=b.w-.025&&Math.abs((p.x-b.x)*b.v.x+(p.z-b.z)*b.v.z)<=b.h-.025);
  return fits?{y:table.y,room:'center',id:table.id}:null;
 }
 if(slot.y>=-.2 && (layout.rotundaFurniture??[]).some(piece=>piece.kind!=='table'&&overlapsFurniture(piece)))return null;

 if(slot.y<-.2 || slot.supportId?.startsWith('step-')){
  const points=footprintCorners(r);
  for(const tread of stairTreads(stair)){
   if(points.every(p=>{const radius=Math.hypot(p.x,p.z),a=(Math.atan2(p.x,p.z)+Math.PI*2)%(Math.PI*2);
    return radius>=stair.innerRadius+.06&&radius<=stair.outerRadius-.05&&a>=tread.a+.003&&a<=tread.b-.003;}))
    return {y:tread.y,room:'center',id:'step-'+tread.index};
  }
  if(slot.y<-stair.depth+.4 && points.every(p=>Math.hypot(p.x,p.z)<5.0 && Math.hypot(p.x,p.z)>stair.innerRadius+.12))
   return {y:-stair.depth,room:'center',id:'lower-landing'};
  return null;
 }
 return undefined;
 function overlapsFurniture(piece){return footprintsOverlap(r,tableFootprint(piece),.015);}
}
export function supportingLevels(layout,config){
 return [...supportTables(layout).map(t=>t.y),...stairTreads(config.building.stair).map(t=>t.y),-config.building.stair.depth];
}

// A painting laid on a narrow table may need a quarter turn even when the
// camera approaches diagonally. Align with the table, with the bottom toward the player.
export function tableDropPoses(pose,layout,settings,viewer=null){
 const table=supportTables(layout).find(t=>{
  const b=tableFootprint(t),dx=pose.x-b.x,dz=pose.z-b.z;
  return Math.abs(pose.y-t.y)<.5 && Math.abs(dx*b.u.x+dz*b.u.z)<=b.w && Math.abs(dx*b.v.x+dz*b.v.z)<=b.h;
 });
 if(!table)return [pose];
 const b=tableFootprint(table),orientations=[];
 const vx=viewer?viewer.x-b.x:Math.sin(pose.floorAngle),vz=viewer?viewer.z-b.z:Math.cos(pose.floorAngle);
 for(const angle of [table.angle,table.angle+Math.PI/2,table.angle+Math.PI,table.angle-Math.PI/2]){
  const candidate={...pose,floorAngle:angle},r=frameFootprint(candidate,settings);
  const maxX=b.w-.025-footprintExtent(r,b.u),maxZ=b.h-.025-footprintExtent(r,b.v);
  if(maxX<0 || maxZ<0)continue;
  const facing=(Math.sin(angle)*vx+Math.cos(angle)*vz)/Math.max(.0001,Math.hypot(vx,vz));
  orientations.push({candidate,maxX,maxZ,facing});
 }
 // Fix the readable orientation before searching positions. A moving candidate
 // centre must never pull the preview to a corner to improve its facing score.
 const best=orientations.sort((a,b)=>b.facing-a.facing)[0];
 if(!best)return [];
 const {candidate,maxX,maxZ}=best,dx=pose.x-b.x,dz=pose.z-b.z;
 const x=Math.max(-maxX,Math.min(maxX,dx*b.u.x+dz*b.u.z));
 const z=Math.max(-maxZ,Math.min(maxZ,dx*b.v.x+dz*b.v.z));
 const poses=[];
 // Only a small alignment aid near the reticle, never an automatic jump to
 // another edge of the table when the aimed position is occupied.
 for(const ox of [0,-.08,.08,-.16,.16])for(const oz of [0,-.08,.08,-.16,.16]){
  const px=Math.max(-maxX,Math.min(maxX,x+ox)),pz=Math.max(-maxZ,Math.min(maxZ,z+oz));
  poses.push({pose:{...candidate,x:b.x+px*b.u.x+pz*b.v.x,z:b.z+px*b.u.z+pz*b.v.z},score:(px-x)**2+(pz-z)**2});
 }
 return poses.sort((a,b)=>a.score-b.score).map(p=>p.pose);
}
