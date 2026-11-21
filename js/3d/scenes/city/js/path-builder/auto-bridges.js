import {BRIDGE_BANK_OVERHANG,LANDSCAPE_BOUNDS,LANDSCAPE_LIMITS,
  findRiverForBridge,normalizeLandscape,riverAtFraction} from './landscape-model.js';

// Crossings are selected from the existing pedestrian network first. When a
// river predates the houses, use the shortest straight connection between two
// entrances. This works for arbitrary freehand strokes, without baking bridges
// into the old Saint Petersburg/KEYNLOCK reference coastline.
const cross=(ax,az,bx,bz)=>ax*bz-az*bx;
function segmentCrossing(a,b,c,d){
  const rx=b[0]-a[0],rz=b[1]-a[1],sx=d[0]-c[0],sz=d[1]-c[1];
  const denominator=cross(rx,rz,sx,sz);
  if(Math.abs(denominator)<1e-6)return null;
  const qx=c[0]-a[0],qz=c[1]-a[1];
  const t=cross(qx,qz,sx,sz)/denominator;
  const u=cross(qx,qz,rx,rz)/denominator;
  if(t<.025||t>.975||u<-1e-6||u>1+1e-6)return null;
  return {x:a[0]+rx*t,z:a[1]+rz*t,t,u};
}

function possibleCrossings(river,segments,landscape){
  let best=null;
  for(const {a,b,weight} of segments){
    const minX=Math.min(a[0],b[0]),maxX=Math.max(a[0],b[0]);
    const minZ=Math.min(a[1],b[1]),maxZ=Math.max(a[1],b[1]);
    for(let i=1;i<river.points.length;i++){
      const c=river.points[i-1],d=river.points[i];
      if(Math.max(c[0],d[0])<minX||Math.min(c[0],d[0])>maxX||
        Math.max(c[1],d[1])<minZ||Math.min(c[1],d[1])>maxZ)continue;
      const at=segmentCrossing(a,b,c,d);if(!at)continue;
      const crossing=findRiverForBridge(landscape,at.x,at.z);
      if(!crossing||crossing.riverId!==river.id||crossing.t<.018||crossing.t>.982)continue;
      const position=riverAtFraction(river,crossing.t);
      if(!position)continue;
      const score=weight+Math.hypot(at.x-(a[0]+b[0])/2,at.z-(a[1]+b[1])/2)*.01;
      if(!best||score<best.score)best={...crossing,score};
    }
  }
  return best;
}

function nearestBankCrossing(river,buildings){
  const total=river.points.slice(1).reduce((sum,b,i)=>sum+
    Math.hypot(b[0]-river.points[i][0],b[1]-river.points[i][1]),0);
  let distanceAlong=0,best=null;
  for(let i=1;i<river.points.length;i++){
    const c=river.points[i-1],d=river.points[i],dx=d[0]-c[0],dz=d[1]-c[1];
    const length=Math.hypot(dx,dz);if(length<.001)continue;
    const nearest=[[],[]];
    for(const building of buildings){
      const signed=cross(dx,dz,building.x-c[0],building.z-c[1]);
      if(Math.abs(signed)<.001)continue;
      const t=Math.max(0,Math.min(1,((building.x-c[0])*dx+
        (building.z-c[1])*dz)/(length*length)));
      const distance=Math.hypot(building.x-c[0]-dx*t,building.z-c[1]-dz*t);
      const list=nearest[signed>0?1:0];
      if(list.length<3||distance<list.at(-1).distance){
        list.push({building,distance});list.sort((a,b)=>a.distance-b.distance);
        if(list.length>3)list.pop();
      }
    }
    for(const left of nearest[0])for(const right of nearest[1]){
      const a=left.building,b=right.building;
      const hit=segmentCrossing([a.x,a.z],[b.x,b.z],c,d);
      if(!hit)continue;
      const t=(distanceAlong+length*hit.u)/total;
      if(t<.018||t>.982)continue;
      const half=(river.width+BRIDGE_BANK_OVERHANG)/2;
      const nx=-dz/length,nz=dx/length;
      if([-1,1].some(sign=>Math.abs(hit.x+sign*nx*half)>LANDSCAPE_BOUNDS.width/2-1.5||
        Math.abs(hit.z+sign*nz*half)>LANDSCAPE_BOUNDS.depth/2-1.5))continue;
      const score=Math.hypot(a.x-b.x,a.z-b.z)+
        (left.distance+right.distance)*.02;
      if(!best||score<best.score)best={riverId:river.id,t,score};
    }
    distanceAlong+=length;
  }
  return best;
}

export function addAutomaticRiverBridges(input,buildings=[],previousPaths=[]){
  const landscape=normalizeLandscape(input);
  if(buildings.length<2||!landscape.rivers.length)return input;
  const occupied=new Set(landscape.bridges.map(bridge=>bridge.riverId));
  for(const riverId of landscape.autoBridgeOptOut)occupied.add(riverId);
  const paths=[];
  for(const path of previousPaths){
    if(!Array.isArray(path.p))continue;
    for(let i=1;i<path.p.length;i++)paths.push({a:path.p[i-1],b:path.p[i],weight:-1000});
  }
  const additions=[];
  for(const river of landscape.rivers){
    if(occupied.has(river.id)||landscape.bridges.length+additions.length>=LANDSCAPE_LIMITS.bridges)continue;
    const suggestion=possibleCrossings(river,paths,landscape)||
      nearestBankCrossing(river,buildings);
    if(suggestion)additions.push({id:`automatic-${river.id}`,riverId:river.id,t:suggestion.t,auto:true});
  }
  if(!additions.length)return input;
  return normalizeLandscape({...landscape,bridges:[...landscape.bridges,...additions]});
}
