import {buildPedestrianNetwork} from './pedestrian-network.js';
import {bridgeProfiles,landscapeCellAllowed,sampleIndexedHillHeight,LANDSCAPE_BOUNDS} from '../path-builder/landscape-model.js';
import {bridgeLocal,bridgeWorld} from '../path-builder/bridge-frame.js';
import {bridgeCrossings,bridgeLanding,createBridgeRouting} from './bridge-routing.js';

// Pure, scene-independent planner for the interactive building/path laboratory.
// Model entrances are local to each building, and the same graph used by the
// full city is built from the resulting shared, intersection-aware segments.
export const PATH_BOUNDS=Object.freeze({minX:-LANDSCAPE_BOUNDS.width/2,maxX:LANDSCAPE_BOUNDS.width/2,
  minZ:-LANDSCAPE_BOUNDS.depth/2,maxZ:LANDSCAPE_BOUNDS.depth/2});
const STEP=1;
const EPS=.0001;
const ROAD_CLEARANCE=1.72;
const OCCUPANCY_CELL=24;
const key=(i,j)=>`${i},${j}`;
const same=(a,b)=>Math.abs(a[0]-b[0])<EPS&&Math.abs(a[1]-b[1])<EPS;

export function buildingFootprint(building){
  const c=Math.abs(Math.cos(building.rotation||0)),s=Math.abs(Math.sin(building.rotation||0));
  return {x:building.x,z:building.z,
    halfX:(building.width*c+building.depth*s)/2,
    halfZ:(building.depth*c+building.width*s)/2};
}

function buildingObstacleLookup(buildings){
  const buckets=new Map();
  const cell=(x,z)=>`${Math.floor(x/OCCUPANCY_CELL)},${Math.floor(z/OCCUPANCY_CELL)}`;
  for(const building of buildings){
    const lot=buildingFootprint(building);
    const minX=Math.floor((lot.x-lot.halfX-ROAD_CLEARANCE)/OCCUPANCY_CELL);
    const maxX=Math.floor((lot.x+lot.halfX+ROAD_CLEARANCE)/OCCUPANCY_CELL);
    const minZ=Math.floor((lot.z-lot.halfZ-ROAD_CLEARANCE)/OCCUPANCY_CELL);
    const maxZ=Math.floor((lot.z+lot.halfZ+ROAD_CLEARANCE)/OCCUPANCY_CELL);
    for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++){
      const token=`${x},${z}`;
      if(!buckets.has(token))buckets.set(token,[]);
      buckets.get(token).push({id:building.id,lot});
    }
  }
  return (x,z,except=null)=>(buckets.get(cell(x,z))||[]).some(({id,lot})=>id!==except&&
    Math.abs(x-lot.x)<lot.halfX+ROAD_CLEARANCE&&
    Math.abs(z-lot.z)<lot.halfZ+ROAD_CLEARANCE);
}

export function validateBuildingPlacement(candidate,buildings,{bounds=PATH_BOUNDS,margin=1.35}={}){
  const lot=buildingFootprint(candidate);
  if(lot.x-lot.halfX<bounds.minX+1.4||lot.x+lot.halfX>bounds.maxX-1.4||
    lot.z-lot.halfZ<bounds.minZ+1.4||lot.z+lot.halfZ>bounds.maxZ-1.4)
    return {valid:false,reason:'За границей участка'};
  for(const other of buildings){
    if(other.id===candidate.id)continue;
    const occupied=buildingFootprint(other);
    if(Math.abs(lot.x-occupied.x)<lot.halfX+occupied.halfX+margin&&
      Math.abs(lot.z-occupied.z)<lot.halfZ+occupied.halfZ+margin)
      return {valid:false,reason:'Слишком близко к другому зданию'};
  }
  return {valid:true,reason:''};
}

export function buildingEntrance(building){
  const angle=building.rotation||0,s=Math.sin(angle),c=Math.cos(angle);
  const local=building.pathAccess||{x:0,z:building.depth/2+.58};
  return {id:building.id,kind:building.kind||'house',
    x:building.x+local.x*c+local.z*s,
    z:building.z-local.x*s+local.z*c,
    forward:[Math.round(s),Math.round(c)]};
}

function compress(points){
  const clean=[];
  for(const point of points){
    if(clean.length&&same(clean.at(-1),point))continue;
    clean.push(point);
    while(clean.length>2){
      const a=clean.at(-3),b=clean.at(-2),c=clean.at(-1);
      if(Math.abs((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]))>EPS)break;
      clean.splice(clean.length-2,1);
    }
  }
  return clean;
}

function findGridPath(from,goals,{bounds,landscape,crossings,occupied}){
  const target=[...goals].map(item=>item.split(',').map(Number));
  if(!target.length)return null;
  const directions=[[1,0],[0,1],[-1,0],[0,-1]];
  const open=[],seen=new Map();
  // Crossings use the same Manhattan lower bound as regular lattice moves.
  // The heuristic limits rescans on dense layouts without skipping bridges.
  const goalBox={minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity};
  for(const [x,z] of target){goalBox.minX=Math.min(goalBox.minX,x);goalBox.maxX=Math.max(goalBox.maxX,x);
    goalBox.minZ=Math.min(goalBox.minZ,z);goalBox.maxZ=Math.max(goalBox.maxZ,z);}
  const heuristic=target.length<16?
    (i,j)=>target.reduce((best,[x,z])=>Math.min(best,Math.abs(i-x)+Math.abs(j-z)),Infinity):
    (i,j)=>Math.max(0,goalBox.minX-i,i-goalBox.maxX)+Math.max(0,goalBox.minZ-j,j-goalBox.maxZ);
  const push=node=>{
    open.push(node);let p=open.length-1;
    while(p>0){const parent=(p-1)>>1;if(open[parent].f<=node.f)break;
      open[p]=open[parent];p=parent;}
    open[p]=node;
  };
  const pop=()=>{
    const first=open[0],last=open.pop();
    if(open.length){let p=0;
      while(p*2+1<open.length){let child=p*2+1;
        if(child+1<open.length&&open[child+1].f<open[child].f)child++;
        if(last.f<=open[child].f)break;
        open[p]=open[child];p=child;}
      open[p]=last;
    }
    return first;
  };
  const start={i:from[0],j:from[1],d:-1,g:0,f:heuristic(...from),parent:null};
  push(start);seen.set(`${key(...from)},-1`,0);
  const minI=Math.ceil(bounds.minX/STEP),maxI=Math.floor(bounds.maxX/STEP);
  const minJ=Math.ceil(bounds.minZ/STEP),maxJ=Math.floor(bounds.maxZ/STEP);
  const closestGoal=target.reduce((best,[i,j])=>
    Math.min(best,Math.abs(i-from[0])+Math.abs(j-from[1])),Infinity);
  // Isolated buildings previously triggered 125K costly collision checks on
  // every mouse release. Allow a generous local detour, bounded by distance.
  const visitLimit=Math.min(125000,Math.max(12000,closestGoal*65));
  let visited=0;
  while(open.length&&visited++<visitLimit){
    const node=pop(),at=key(node.i,node.j);
    if(node.g>(seen.get(`${at},${node.d}`)??Infinity)+EPS)continue;
    if(goals.has(at)){
      const nodes=[];
      for(let current=node;current;current=current.parent)nodes.push(current);
      nodes.reverse();
      return {
        cells:nodes.map(({i,j})=>[i,j]),
        points:nodes.flatMap(({i,j,via})=>[...(via||[]),[i*STEP,j*STEP]]),
      };
    }
    const visit=(i,j,dir,cost,via)=>{
      const score=node.g+cost;
      const token=`${key(i,j)},${dir}`;
      if(score>=(seen.get(token)??Infinity)-EPS)return;
      seen.set(token,score);
      push({i,j,d:dir,g:score,f:score+heuristic(i,j),parent:node,via});
    };
    directions.forEach(([di,dj],dir)=>{
      const i=node.i+di,j=node.j+dj;
      if(i<minI||i>maxI||j<minJ||j>maxJ||occupied(i,j))return;
      const terrainCost=landscape?.hills?.length?Math.min(2.8,
        Math.abs(sampleIndexedHillHeight(landscape,i,j)-sampleIndexedHillHeight(landscape,node.i,node.j))*1.7):0;
      visit(i,j,dir,1+terrainCost+(node.d===-1||node.d===dir?0:.24));
    });
    // Crossings are explicit links between dry grid cells. The deck is
    // otherwise closed to A*, which would route through a parapet on a bend.
    for(const {cell:[i,j],points} of crossings.get(at)||[]){
      const cost=Math.abs(i-node.i)+Math.abs(j-node.j);
      visit(i,j,-1,cost,points);
    }
  }
  return null;
}

function makeEntry(building,bounds,landAllowed,blockedByBuilding){
  const door=buildingEntrance(building),footprint=buildingFootprint(building);
  const [fx,fz]=door.forward;
  const face=fx?footprint.halfX:footprint.halfZ;
  const distance=(door.x-building.x)*fx+(door.z-building.z)*fz;
  const clearDistance=Math.max(distance,face)+1.65;
  const behind=[door.x+fx*(clearDistance-distance),door.z+fz*(clearDistance-distance)];
  const occupied=(i,j)=>blockedByBuilding(i*STEP,j*STEP);
  // A grid node can be free while the approach to it cuts through another
  // building. Check the complete doorway-to-road connector as well.
  const clearApproach=points=>points.slice(1).every((end,index)=>{
    const start=points[index];
    const steps=Math.max(1,Math.ceil(Math.hypot(end[0]-start[0],end[1]-start[1])/.25));
    for(let t=0;t<=steps;t++){
      const x=start[0]+(end[0]-start[0])*t/steps;
      const z=start[1]+(end[1]-start[1])*t/steps;
      if(!landAllowed(x,z)||
        blockedByBuilding(x,z,building.id))return false;
    }
    return true;
  });
  let portal=null;
  for(let advance=0;advance<=7&&!portal;advance++)for(const side of [0,1,-1,2,-2]){
    const px=behind[0]+fx*advance-fz*side,pz=behind[1]+fz*advance+fx*side;
    const i=Math.round(px/STEP),j=Math.round(pz/STEP);
    if(i<bounds.minX+1||i>bounds.maxX-1||j<bounds.minZ+1||j>bounds.maxZ-1||occupied(i,j)||
      !landAllowed(i,j))continue;
    const snapped=[i*STEP,j*STEP];
    const reach=fx?[snapped[0],door.z]:[door.x,snapped[1]];
    if(!clearApproach([[door.x,door.z],reach,snapped]))continue;
    portal=[i,j];break;
  }
  if(!portal)return null;
  const snapped=[portal[0]*STEP,portal[1]*STEP];
  // First segment must leave through the real doorway/steps, not a side wall.
  const reach=fx?[snapped[0],door.z]:[door.x,snapped[1]];
  return {door,portal,connector:compress([[door.x,door.z],reach,snapped])};
}

function makeForecourt(building,all,bounds){
  if(building.kind!=='landmark')return null;
  const door=buildingEntrance(building);
  const [fx,fz]=door.forward;
  const depth=Math.min(6.2,Math.max(3.7,building.depth*.30));
  const width=Math.min(13,Math.max(5.5,building.width*.65));
  for(const scale of [1,.85,.7,.55]){
    const court={id:`forecourt-${building.id}`,x:door.x+fx*(depth*scale/2-.16),
      z:door.z+fz*(depth*scale/2-.16),width:width*scale,depth:depth*scale,
      rotation:building.rotation||0,kind:building.type||'landmark'};
    const area=buildingFootprint(court);
    if(area.x-area.halfX<bounds.minX+.7||area.x+area.halfX>bounds.maxX-.7||
      area.z-area.halfZ<bounds.minZ+.7||area.z+area.halfZ>bounds.maxZ-.7)continue;
    if(all.some(other=>{
      if(other.id===building.id)return false;
      const lot=buildingFootprint(other);
      return Math.abs(area.x-lot.x)<area.halfX+lot.halfX+.2&&
        Math.abs(area.z-lot.z)<area.halfZ+lot.halfZ+.2;
    }))continue;
    return court;
  }
  return null;
}

function majorBridgeApproaches(bridges,buildings,entries,options){
  const {landscape}=options;
  if(!landscape||!entries.some(Boolean))return [];
  const result=[];
  for(const bridge of bridges){
    if(!bridge.fixed&&!bridge.major&&bridge.span<55)continue;
    const alternatives=[];
    for(const [index,entry] of entries.entries()){
      if(!entry)continue;
      const building=buildings[index];
      const {along}=bridgeLocal(bridge,building.x,building.z);
      const side=along<0?-1:1;
      const [endX,endZ]=bridgeWorld(bridge,side*(bridge.span/2+3));
      const distance=Math.hypot(building.x-endX,building.z-endZ);
      if(distance>240||Math.abs(along)<bridge.span/2-8)continue;
      const neighbors=buildings.filter(other=>other.id!==building.id&&
        Math.hypot(other.x-building.x,other.z-building.z)<70).length;
      alternatives.push({entry,side,distance,score:distance-Math.min(5,neighbors)*28});
    }
    alternatives.sort((a,b)=>a.score-b.score);
    for(const candidate of alternatives.slice(0,6)){
      const {entry,side}=candidate;
      // A straight axial landing must continue past the stone abutment before
      // A* can turn toward the settlement. Starting A* 1 m from the bridge
      // let the first right-angle turn put the whole road beside its entrance.
      const preferred=Math.max(9,Math.min(15,bridge.deckWidth*.85));
      const landing=bridgeLanding(bridge,side,[preferred,Math.max(6,preferred*.75),5,3],options);
      if(!landing)continue;
      const route=findGridPath(landing.cell,new Set([key(...entry.portal)]),options);
      if(!route)continue;
      result.push({id:`bridge-access-${bridge.id}`,kind:'street',pavingType:'street',
        width:6.2,p:compress([landing.deck,landing.axial,...route.points,
          ...entry.connector.slice().reverse()])});
      break;
    }
  }
  return result;
}

export function planBuildingPaths(buildings,{bounds=PATH_BOUNDS,landscape=null}={}){
  const valid=buildings.filter((b,i)=>buildings.slice(0,i).every(other=>other.id!==b.id));
  const profiles=landscape?bridgeProfiles(landscape):[];
  const blockedByBuilding=buildingObstacleLookup(valid);
  const onBridge=createBridgeRouting(profiles);
  const landAllowed=(x,z)=>!landscape||
    (!onBridge(x,z)&&landscapeCellAllowed(landscape,x,z,[]));
  const entries=valid.map(building=>makeEntry(building,bounds,landAllowed,blockedByBuilding));
  const paths=[],networkCells=new Set(),anchors=entries.filter(Boolean).map(e=>({id:e.door.id,kind:e.door.kind,x:e.door.x,z:e.door.z}));
  const plazas=valid.map(building=>makeForecourt(building,valid,bounds)).filter(Boolean);
  const blockedCache=new Map();
  const occupied=(i,j)=>{
    const token=key(i,j);
    if(blockedCache.has(token))return blockedCache.get(token);
    const blocked=!landAllowed(i*STEP,j*STEP)||blockedByBuilding(i*STEP,j*STEP);
    blockedCache.set(token,blocked);return blocked;
  };
  const options={bounds,landscape,occupied,blockedByBuilding};
  options.crossings=bridgeCrossings(profiles,options);
  const ready=entries.filter(Boolean);
  const pending=[...ready];
  if(pending.length>1){
    // Find the first *reachable* pair, rather than treating the first two
    // buildings as a compulsory seed. Newly reached streets then help others.
    seed:for(let i=0;i<pending.length;i++)for(let j=i+1;j<pending.length;j++){
      const first=pending[i],second=pending[j];
      const route=findGridPath(first.portal,new Set([key(...second.portal)]),options);
      if(!route)continue;
      route.cells.forEach(cell=>networkCells.add(key(...cell)));
      const landmark=first.door.kind==='landmark'||second.door.kind==='landmark';
      paths.push({id:`walk-${first.door.id}-${second.door.id}`,kind:'path',
        pavingType:landmark?'street':'walk',width:landmark?1.42:.88,
        p:compress([...first.connector,...route.points,
          ...second.connector.slice().reverse()])});
      pending.splice(j,1);pending.splice(i,1);
      break seed;
    }
    // Retry remaining entrances after each addition: a route inaccessible
    // from the original seed may be reachable from another branch.
    let progress=true;
    while(networkCells.size&&pending.length&&progress){
      progress=false;
      for(let i=0;i<pending.length;i++){
        const entry=pending[i];
        const route=findGridPath(entry.portal,networkCells,options);
        if(!route)continue;
        route.cells.forEach(cell=>networkCells.add(key(...cell)));
        const landmark=entry.door.kind==='landmark';
        paths.push({id:`walk-${entry.door.id}`,kind:'path',
          pavingType:landmark?'street':'walk',width:landmark?1.42:.88,
          p:compress([...entry.connector,...route.points])});
        pending.splice(i--,1);progress=true;
      }
    }
  }
  paths.push(...majorBridgeApproaches(profiles,valid,entries,options));
  const failures=entries.filter(e=>!e).length+(ready.length>1?pending.length:0);
  const network=buildPedestrianNetwork({paths,anchors});
  const origin=network.anchors[0]?.nodeId;
  const reached=new Set(),frontier=origin===null||origin===undefined?[]:[origin];
  while(frontier.length){
    const node=frontier.pop();if(reached.has(node))continue;
    reached.add(node);
    for(const edgeId of network.nodes[node].edges){
      const edge=network.edges[edgeId];
      frontier.push(edge.from===node?edge.to:edge.from);
    }
  }
  const connected=network.anchors.filter(anchor=>reached.has(anchor.nodeId)).length;
  const length=paths.reduce((sum,path)=>sum+path.p.slice(1).reduce((n,b,i)=>n+Math.hypot(b[0]-path.p[i][0],b[1]-path.p[i][1]),0),0);
  return {paths,plazas,anchors,network,length,connected,failures,
    junctions:network.nodes.filter(node=>node.edges.length>=3).length};
}
