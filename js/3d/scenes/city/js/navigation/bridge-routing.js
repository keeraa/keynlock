import {landscapeCellAllowed} from '../path-builder/landscape-model.js';
import {
  bridgeLocal,bridgeRoadPortal,bridgeWorld,
  BRIDGE_ROAD_RAMP_LENGTH,BRIDGE_ROUTING_END_CLEARANCE,BRIDGE_ROUTING_SIDE_CLEARANCE,
} from '../path-builder/bridge-frame.js';

const CELL=32;
const bucketKey=(x,z)=>`${Math.floor(x/CELL)},${Math.floor(z/CELL)}`;

export function createBridgeRouting(profiles){
  const buckets=new Map();
  for(const bridge of profiles){
    const halfSpan=bridge.span/2+BRIDGE_ROUTING_END_CLEARANCE;
    const halfWidth=bridge.deckWidth/2+BRIDGE_ROUTING_SIDE_CLEARANCE;
    const dx=Math.abs(bridge.dirX)*halfSpan+Math.abs(bridge.dirZ)*halfWidth;
    const dz=Math.abs(bridge.dirZ)*halfSpan+Math.abs(bridge.dirX)*halfWidth;
    const footprint={bridge,halfSpan,halfWidth};
    for(let z=Math.floor((bridge.z-dz)/CELL);z<=Math.floor((bridge.z+dz)/CELL);z++){
      for(let x=Math.floor((bridge.x-dx)/CELL);x<=Math.floor((bridge.x+dx)/CELL);x++){
        const key=`${x},${z}`;
        if(!buckets.has(key))buckets.set(key,[]);
        buckets.get(key).push(footprint);
      }
    }
  }
  return (x,z)=>buckets.get(bucketKey(x,z))?.some(({bridge,halfSpan,halfWidth})=>{
    const {along,across}=bridgeLocal(bridge,x,z);
    return Math.abs(along)<halfSpan&&Math.abs(across)<halfWidth;
  })??false;
}

export function bridgeLanding(bridge,side,runouts,{bounds,landscape,occupied,blockedByBuilding}){
  const deck=bridgeRoadPortal(bridge,side);
  const end=bridgeWorld(bridge,side*bridge.span/2);
  const usable=([x,z])=>!blockedByBuilding(x,z)&&landscapeCellAllowed(landscape,x,z,[bridge]);
  const segmentUsable=(from,to)=>{
    const steps=Math.max(1,Math.ceil(Math.hypot(to[0]-from[0],to[1]-from[1])/.5));
    for(let step=0;step<=steps;step++){
      const t=step/steps;
      if(!usable([from[0]+(to[0]-from[0])*t,from[1]+(to[1]-from[1])*t]))return false;
    }
    return true;
  };
  for(const runout of runouts){
    const axial=bridgeWorld(bridge,side*(bridge.span/2+runout));
    const cell=axial.map(Math.round);
    if(cell[0]<bounds.minX||cell[0]>bounds.maxX||cell[1]<bounds.minZ||cell[1]>bounds.maxZ||
      occupied(...cell))continue;
    if(segmentUsable(end,axial)&&segmentUsable(axial,cell))return {cell,axial,deck};
  }
  return null;
}

export function bridgeCrossings(profiles,options){
  const edges=new Map();
  const add=(from,to)=>{
    const key=from.cell.join(',');
    if(!edges.has(key))edges.set(key,[]);
    edges.get(key).push({cell:to.cell,points:[from.axial,from.deck,to.deck,to.axial]});
  };
  for(const bridge of profiles){
    const runouts=[BRIDGE_ROAD_RAMP_LENGTH,2,1.4];
    const left=bridgeLanding(bridge,-1,runouts,options);
    const right=bridgeLanding(bridge,1,runouts,options);
    if(left&&right){
      add(left,right);
      add(right,left);
    }
  }
  return edges;
}
