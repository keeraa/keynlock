// Shared, deterministic landscape for the WebGL terrain, 2D plan and A* roads.
// River paths are map-space polylines; hills are soft, editable height stamps.
// The city's fictional river/island outlines are shared by terrain, water
// painting and navigation; user-created streams add an editable layer.
import {KEYNLOCK_MAP_BOUNDS,KEYNLOCK_WATER_LEVEL,keynlockWaterNear,keynlockWaterChannelAt} from './keynlock-geography.js';
import {KEYNLOCK_FIXED_BRIDGES} from './keynlock-fixed-bridges.js';
import {bridgeLocal,BRIDGE_ROUTING_END_CLEARANCE,BRIDGE_ROUTING_SIDE_CLEARANCE,
  BRIDGE_ROAD_RAMP_LENGTH} from './bridge-frame.js';

// Physical world bounds; building sizes and existing local coordinates stay in metres.
export const LANDSCAPE_BOUNDS=KEYNLOCK_MAP_BOUNDS;
export const LANDSCAPE_LIMITS=Object.freeze({rivers:128,hills:4096,bridges:256,trees:600,channelBridges:24});
export const TREE_KINDS=Object.freeze(['oak','linden','maple']);
export const BRIDGE_BANK_OVERHANG=6.4;
export const RIVER_BANK_WIDTH=3.6;
export const EMPTY_LANDSCAPE=Object.freeze({rivers:[],hills:[],bridges:[],channelBridges:[],
  trees:[],autoBridgeOptOut:[],autoChannelOptOut:[]});
const clamp=(n,low,high)=>Math.max(low,Math.min(high,Number(n)||0));
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const fade=(a,b,value)=>smooth((value-a)/(b-a));
const pointOk=p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1]);
const boundPoint=p=>[clamp(p[0],-LANDSCAPE_BOUNDS.width/2+1,LANDSCAPE_BOUNDS.width/2-1),
  clamp(p[1],-LANDSCAPE_BOUNDS.depth/2+1,LANDSCAPE_BOUNDS.depth/2-1)];

export function normalizeLandscape(value={}){
  const rivers=(Array.isArray(value.rivers)?value.rivers:[]).slice(0,LANDSCAPE_LIMITS.rivers)
    .map((river,i)=>({id:String(river.id||`river-${i}`).slice(0,60),
      width:clamp(river.width??7,4,48),depth:clamp(river.depth??2.8,.8,8),
      points:(Array.isArray(river.points)?river.points:[]).filter(pointOk)
        .slice(0,1600).map(boundPoint)}))
    .filter(river=>river.points.length>=2);
  const riverIds=new Set(rivers.map(r=>r.id));
  const hills=(Array.isArray(value.hills)?value.hills:[]).slice(0,LANDSCAPE_LIMITS.hills)
    .filter(h=>Number.isFinite(h.x)&&Number.isFinite(h.z))
    .map((hill,i)=>({id:String(hill.id||`hill-${i}`).slice(0,60),
      x:clamp(hill.x,-LANDSCAPE_BOUNDS.width/2+1,LANDSCAPE_BOUNDS.width/2-1),
      z:clamp(hill.z,-LANDSCAPE_BOUNDS.depth/2+1,LANDSCAPE_BOUNDS.depth/2-1),
      radius:clamp(hill.radius??12,5,60),height:clamp(hill.height??2.8,.5,14)}));
  const bridges=(Array.isArray(value.bridges)?value.bridges:[]).slice(0,LANDSCAPE_LIMITS.bridges)
    .filter(bridge=>riverIds.has(bridge.riverId))
    .map((bridge,i)=>({id:String(bridge.id||`bridge-${i}`).slice(0,60),
      riverId:bridge.riverId,t:clamp(bridge.t??.5,0,1),...(bridge.auto?{auto:true}:{})}));
  const autoBridgeOptOut=(Array.isArray(value.autoBridgeOptOut)?value.autoBridgeOptOut:[])
    .map(String).filter(id=>riverIds.has(id)).slice(0,LANDSCAPE_LIMITS.rivers);
  const channelBridges=(Array.isArray(value.channelBridges)?value.channelBridges:[])
    .slice(0,LANDSCAPE_LIMITS.channelBridges)
    .filter(bridge=>Number.isFinite(bridge.x)&&Number.isFinite(bridge.z)&&
      Number.isFinite(bridge.dirX)&&Number.isFinite(bridge.dirZ))
    .map((bridge,i)=>{
      const length=Math.hypot(bridge.dirX,bridge.dirZ)||1;
      return {id:String(bridge.id||`channel-bridge-${i}`).slice(0,80),
        x:clamp(bridge.x,-LANDSCAPE_BOUNDS.width/2+5,LANDSCAPE_BOUNDS.width/2-5),
        z:clamp(bridge.z,-LANDSCAPE_BOUNDS.depth/2+5,LANDSCAPE_BOUNDS.depth/2-5),
        dirX:bridge.dirX/length,dirZ:bridge.dirZ/length,
        span:clamp(bridge.span??25,12,240),deckWidth:clamp(bridge.deckWidth??7,3.75,19),
        bankA:clamp(bridge.bankA??.18,-.2,10),bankB:clamp(bridge.bankB??.18,-.2,10),
        rise:clamp(bridge.rise??2,1,5),width:clamp(bridge.width??12,5,220),
        depth:clamp(bridge.depth??3,1,8),major:Boolean(bridge.major),auto:Boolean(bridge.auto),
        channel:true};
    });
  const autoChannelOptOut=(Array.isArray(value.autoChannelOptOut)?value.autoChannelOptOut:[])
    .filter(item=>Number.isFinite(item?.x)&&Number.isFinite(item?.z))
    .slice(0,LANDSCAPE_LIMITS.channelBridges)
    .map(item=>({x:clamp(item.x,-LANDSCAPE_BOUNDS.width/2,LANDSCAPE_BOUNDS.width/2),
      z:clamp(item.z,-LANDSCAPE_BOUNDS.depth/2,LANDSCAPE_BOUNDS.depth/2)}));
  const trees=(Array.isArray(value.trees)?value.trees:[]).slice(0,LANDSCAPE_LIMITS.trees)
    .filter(tree=>Number.isFinite(tree.x)&&Number.isFinite(tree.z)&&TREE_KINDS.includes(tree.kind))
    .map((tree,i)=>({id:String(tree.id||`tree-${i}`).slice(0,60),kind:tree.kind,
      x:clamp(tree.x,-LANDSCAPE_BOUNDS.width/2+4,LANDSCAPE_BOUNDS.width/2-4),
      z:clamp(tree.z,-LANDSCAPE_BOUNDS.depth/2+4,LANDSCAPE_BOUNDS.depth/2-4),
      size:clamp(tree.size??1,.75,1.35)}));
  return {rivers,hills,bridges,channelBridges,trees,autoBridgeOptOut,autoChannelOptOut};
}

// Three small, mixed groves surround the starter town. The placed trees
// remain independent terrain objects and can all be erased or relocated.
export function starterTrees(){
  const groves={
    oak:[[-75,-36],[-96,-27],[-75,-21],[-66,-36],[-88,-40],
      [92,10],[78,15],[74,27],[88,20],[64,26]],
    linden:[[-75,45],[-84,51],[-67,53],[-91,58],[-47,78],
      [58,-45],[68,-52],[79,-49],[64,-62]],
    maple:[[-61,-56],[-52,-64],[-43,-54],[-56,-43],
      [52,55],[62,61],[71,55],[55,73],[83,69]],
  };
  return Object.entries(groves).flatMap(([kind,points])=>points.map(([x,z],i)=>({
    id:`starter-${kind}-${i}`,kind,x,z,
    size:.86+(Math.abs(x*37+z*19+i*13)%19)/50,
  })));
}

export function sampleHillHeight(landscape,x,z){
  let height=0;
  for(const hill of landscape.hills||[]){
    const distance=Math.hypot(x-hill.x,z-hill.z);
    if(distance>=hill.radius)continue;
    height+=hill.height*(1-smooth(distance/hill.radius));
  }
  return Math.min(18,height);
}

// Spatial buckets avoid scanning thousands of hills and every river segment
// for EACH terrain vertex or A* step on the shared world.
const CELL=24;
const cellId=(x,z)=>`${Math.floor(x/CELL)},${Math.floor(z/CELL)}`;
const lookupCache=new WeakMap();
function bucketItems(items,extent){
  const buckets=new Map();
  for(const item of items){
    const [minX,maxX,minZ,maxZ]=extent(item);
    for(let ix=Math.floor(minX/CELL);ix<=Math.floor(maxX/CELL);ix++)
      for(let iz=Math.floor(minZ/CELL);iz<=Math.floor(maxZ/CELL);iz++){
        const id=`${ix},${iz}`;
        if(!buckets.has(id))buckets.set(id,[]);
        buckets.get(id).push(item);
      }
  }
  return (x,z)=>buckets.get(cellId(x,z))||[];
}
function terrainLookups(landscape){
  const hills=bucketItems(landscape.hills,h=>[h.x-h.radius,h.x+h.radius,h.z-h.radius,h.z+h.radius]);
  const segments=[];
  for(const river of landscape.rivers)for(let i=1;i<river.points.length;i++){
    const a=river.points[i-1],b=river.points[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
    if(len<.001)continue;
    segments.push({river,ax:a[0],az:a[1],dx,dz,len,buffer:river.width/2+RIVER_BANK_WIDTH});
  }
  const rivers=bucketItems(segments,s=>[
    Math.min(s.ax,s.ax+s.dx)-s.buffer,Math.max(s.ax,s.ax+s.dx)+s.buffer,
    Math.min(s.az,s.az+s.dz)-s.buffer,Math.max(s.az,s.az+s.dz)+s.buffer]);
  const hillAt=(x,z)=>{
    let h=0;
    for(const hill of hills(x,z)){
      const distance=Math.hypot(x-hill.x,z-hill.z);
      if(distance<hill.radius)h+=hill.height*(1-smooth(distance/hill.radius));
    }
    return Math.min(18,h);
  };
  const riverAt=(x,z)=>{
    let best=null;
    for(const s of rivers(x,z)){
      const t=clamp(((x-s.ax)*s.dx+(z-s.az)*s.dz)/(s.len*s.len),0,1);
      const distance=Math.hypot(x-s.ax-s.dx*t,z-s.az-s.dz*t);
      if(!best||distance<best.distance)best={river:s.river,distance};
    }
    return best;
  };
  const channelAt=(x,z)=>{
    let bed=0,fade=0;
    for(const s of rivers(x,z)){
      const t=clamp(((x-s.ax)*s.dx+(z-s.az)*s.dz)/(s.len*s.len),0,1);
      const distance=Math.hypot(x-s.ax-s.dx*t,z-s.az-s.dz*t);
      if(distance>=s.buffer)continue;
      const channel=riverChannel({river:s.river,distance});
      // A confluence is ONE excavated channel. Use the deepest river bed
      // and the strongest bank falloff instead of switching nearest strokes.
      bed=Math.max(bed,channel.bed);fade=Math.max(fade,channel.fade);
    }
    return {bed,fade};
  };
  const riverContains=(x,z,extra=0)=>{
    for(const s of rivers(x,z)){
      const t=clamp(((x-s.ax)*s.dx+(z-s.az)*s.dz)/(s.len*s.len),0,1);
      if(Math.hypot(x-s.ax-s.dx*t,z-s.az-s.dz*t)<s.river.width/2+extra)return true;
    }
    return false;
  };
  return {hillAt,riverAt,channelAt,riverContains};
}
function indexedLookups(landscape){
  let result=lookupCache.get(landscape);
  if(!result){result=terrainLookups(landscape);lookupCache.set(landscape,result);}
  return result;
}
export function sampleIndexedHillHeight(landscape,x,z){
  return indexedLookups(landscape).hillAt(x,z);
}

export function nearestRiver(landscape,x,z){
  let best=null;
  for(const river of landscape.rivers||[]){
    let before=0;
    for(let i=1;i<river.points.length;i++){
      const a=river.points[i-1],b=river.points[i],dx=b[0]-a[0],dz=b[1]-a[1];
      const length=Math.hypot(dx,dz);
      if(length<.001)continue;
      const t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(length*length),0,1);
      const px=a[0]+dx*t,pz=a[1]+dz*t,distance=Math.hypot(x-px,z-pz);
      if(!best||distance<best.distance)best={river,distance,x:px,z:pz,
        dirX:dx/length,dirZ:dz/length,segment:i-1,along:before+length*t};
      before+=length;
    }
  }
  return best;
}

export function riverAtFraction(river,t){
  const segments=[];let total=0;
  for(let i=1;i<river.points.length;i++){
    const a=river.points[i-1],b=river.points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(length<.001)continue;
    segments.push({a,b,length});total+=length;
  }
  if(!segments.length)return null;
  let remaining=total*clamp(t,0,1);
  for(const {a,b,length} of segments){
    if(remaining<=length){const f=remaining/length;
      return {x:a[0]+(b[0]-a[0])*f,z:a[1]+(b[1]-a[1])*f,
        tangentX:(b[0]-a[0])/length,tangentZ:(b[1]-a[1])/length};}
    remaining-=length;
  }
  const {a,b,length}=segments.at(-1);
  return {x:b[0],z:b[1],tangentX:(b[0]-a[0])/length,tangentZ:(b[1]-a[1])/length};
}

function riverChannel(near){
  if(!near)return {bed:0,fade:0};
  const half=near.river.width/2,d=near.distance;
  const edgeBed=-KEYNLOCK_WATER_LEVEL+.22;
  const depth=Math.max(near.river.depth??2.8,edgeBed+.5);
  // Lower the bed gradually toward the center and blend an earthy sloped
  // bank outside the water. The water itself remains at a common level.
  if(d<=half){const centre=1-smooth(d/half);
    return {bed:edgeBed+(depth-edgeBed)*centre,fade:1};}
  const bank=1-smooth((d-half)/RIVER_BANK_WIDTH);
  return {bed:edgeBed*bank,fade:bank};
}

export function buildingPadHeight(landscape,building){
  return sampleHillHeight(landscape,building.x,building.z);
}

function localFootprint(building,x,z){
  const dx=x-building.x,dz=z-building.z,angle=building.rotation||0;
  const c=Math.cos(angle),s=Math.sin(angle);
  return {x:c*dx-s*dz,z:s*dx+c*dz};
}

export function createLandscapeSampler(input,buildings=[]){
  const landscape=normalizeLandscape(input);
  const bridges=bridgeProfiles(landscape);
  const lookups=indexedLookups(landscape);
  const pads=buildings.filter(b=>Number.isFinite(b.width)&&Number.isFinite(b.depth))
    .map(b=>({...b,pad:lookups.hillAt(b.x,b.z)}));
  const nearPads=bucketItems(pads,b=>{
    const radius=Math.hypot(b.width,b.depth)/2+3;
    return [b.x-radius,b.x+radius,b.z-radius,b.z+radius];
  });
  const plainHeight=(x,z)=>{
    const hills=lookups.hillAt(x,z),river=lookups.channelAt(x,z),coast=keynlockWaterChannelAt(x,z);
    return hills*(1-Math.max(river.fade,coast.fade))-Math.max(river.bed,coast.bed);
  };
  function heightAt(x,z){
    let h=plainHeight(x,z);
    for(const building of nearPads(x,z)){
      const p=localFootprint(building,x,z);
      const distance=Math.max(Math.abs(p.x)-building.width/2,Math.abs(p.z)-building.depth/2,0);
      if(distance>2.15)continue;
      const blend=1-smooth(distance/2.15);
      h+=(building.pad-h)*blend;
    }
    return h;
  }
  function roadHeightAt(x,z){
    let h=heightAt(x,z);
    for(const bridge of bridges){
      const {along,across}=bridgeLocal(bridge,x,z);
      if(Math.abs(along)>bridge.span/2+BRIDGE_ROAD_RAMP_LENGTH||
        Math.abs(across)>bridge.deckWidth/2+.45)continue;
      const approach=1-smooth(Math.max(0,Math.abs(along)-bridge.span/2)/BRIDGE_ROAD_RAMP_LENGTH);
      h+=(Math.max(h,bridgeDeckHeight(bridge,along))-h)*approach;
    }
    return h;
  }
  return {landscape,bridges,heightAt,roadHeightAt,plainHeight,
    hillHeightAt:lookups.hillAt,
    riverAt:(x,z)=>nearestRiver(landscape,x,z)};
}

export function bridgeDeckHeight(bridge,along){
  const t=clamp(along/bridge.span+.5,0,1);
  return bridge.bankA*(1-t)+bridge.bankB*t+bridge.rise*4*t*(1-t);
}

export function bridgeProfiles(landscape){
  const profiles=[...(landscape.channelBridges||[])];
  for(const bridge of landscape.bridges||[]){
    const river=landscape.rivers.find(r=>r.id===bridge.riverId);
    if(!river)continue;
    const at=riverAtFraction(river,bridge.t);
    if(!at)continue;
    const dirX=-at.tangentZ,dirZ=at.tangentX,span=river.width+BRIDGE_BANK_OVERHANG,half=span/2;
    const bankA=sampleHillHeight(landscape,at.x-dirX*half,at.z-dirZ*half)+.12;
    const bankB=sampleHillHeight(landscape,at.x+dirX*half,at.z+dirZ*half)+.12;
    profiles.push({...bridge,x:at.x,z:at.z,dirX,dirZ,span,deckWidth:3.75,
      bankA,bankB,rise:Math.min(3.5,1.3+span*.065),width:river.width,depth:river.depth});
  }
  return [...profiles,...KEYNLOCK_FIXED_BRIDGES];
}

export function bridgeAt(landscape,x,z,profiles=bridgeProfiles(landscape)){
  for(const bridge of profiles){
    const {along,across}=bridgeLocal(bridge,x,z);
    if(Math.abs(along)<bridge.span/2+BRIDGE_ROUTING_END_CLEARANCE&&
      Math.abs(across)<bridge.deckWidth/2+BRIDGE_ROUTING_SIDE_CLEARANCE)return bridge;
  }
  return null;
}

export function landscapeEraseTarget(landscape,x,z){
  // Allow for the 3D camera's ground projection under an elevated stone deck.
  // The full bridge, including parapets and approaches, takes precedence over
  // the water underneath it when using the landscape eraser.
  const bridge=bridgeProfiles(landscape).find(item=>{
    if(item.fixed)return false;
    const {along,across}=bridgeLocal(item,x,z);
    return Math.abs(along)<item.span/2+3.4&&Math.abs(across)<item.deckWidth/2+4.2;
  });
  if(bridge)return {type:'bridge',id:bridge.id};
  const tree=[...(landscape.trees||[])].reverse().find(t=>
    Math.hypot(t.x-x,t.z-z)<2.25*t.size);
  if(tree)return {type:'tree',id:tree.id};
  const hill=[...(landscape.hills||[])].reverse().find(h=>
    Math.hypot(h.x-x,h.z-z)<Math.min(9,h.radius*.6));
  if(hill)return {type:'hill',id:hill.id};
  const river=nearestRiver(landscape,x,z);
  if(river&&river.distance<river.river.width/2+RIVER_BANK_WIDTH)
    return {type:'river',id:river.river.id};
  return null;
}

export function treePlacementCheck(landscape,candidate,buildings=[],layout=null){
  const {x,z}=candidate;
  if(Math.abs(x)>LANDSCAPE_BOUNDS.width/2-5||Math.abs(z)>LANDSCAPE_BOUNDS.depth/2-5)
    return {valid:false,reason:'Слишком близко к границе карты'};
  if(indexedLookups(landscape).riverContains(x,z,2.5)||keynlockWaterNear(x,z,2.5)||bridgeAt(landscape,x,z))
    return {valid:false,reason:'Дерево попадает в реку или на мост'};
  for(const building of buildings){
    const local=localFootprint(building,x,z);
    const dx=Math.max(0,Math.abs(local.x)-building.width/2);
    const dz=Math.max(0,Math.abs(local.z)-building.depth/2);
    if(Math.hypot(dx,dz)<3)return {valid:false,reason:'Слишком близко к зданию'};
  }
  for(const tree of landscape.trees||[])if(Math.hypot(x-tree.x,z-tree.z)<(2.6+2.6*tree.size))
    return {valid:false,reason:'Слишком близко к другому дереву'};
  for(const path of layout?.paths||[])for(let i=1;i<path.p.length;i++){
    const a=path.p[i-1],b=path.p[i],dx=b[0]-a[0],dz=b[1]-a[1];
    const t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1),0,1);
    if(Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t)<2.3)
      return {valid:false,reason:'Оставь проход между деревом и дорожкой'};
  }
  return {valid:true,reason:''};
}

export function riverIntersectsTrees(river,trees=[]){
  for(const tree of trees)for(let i=1;i<river.points.length;i++){
    const a=river.points[i-1],b=river.points[i],dx=b[0]-a[0],dz=b[1]-a[1];
    const t=clamp(((tree.x-a[0])*dx+(tree.z-a[1])*dz)/(dx*dx+dz*dz||1),0,1);
    if(Math.hypot(tree.x-a[0]-dx*t,tree.z-a[1]-dz*t)<river.width/2+1.7)return true;
  }
  return false;
}

export function landscapeCellAllowed(landscape,x,z,profiles){
  if(!indexedLookups(landscape).riverContains(x,z,.35)&&!keynlockWaterNear(x,z,.35))return true;
  return Boolean(bridgeAt(landscape,x,z,profiles));
}

export function landscapePlacementCheck(landscape,building){
  const a=building.width/2,b=building.depth/2;
  const samples=[[0,0],[-a,-b],[a,-b],[a,b],[-a,b],[-a,0],[a,0],[0,-b],[0,b]];
  const angle=building.rotation||0,c=Math.cos(angle),s=Math.sin(angle);
  let min=Infinity,max=-Infinity;
  for(const [u,v] of samples){
    const x=building.x+u*c+v*s,z=building.z-u*s+v*c;
    if(indexedLookups(landscape).riverContains(x,z,1.25)||keynlockWaterNear(x,z,1.25))
      return {valid:false,reason:'Фундамент попадает в русло реки'};
    const h=sampleHillHeight(landscape,x,z);
    min=Math.min(min,h);max=Math.max(max,h);
  }
  if(max-min>2.85)return {valid:false,reason:'Слишком крутой склон для фундамента'};
  for(const tree of landscape.trees||[]){
    const local=localFootprint(building,tree.x,tree.z);
    const dx=Math.max(0,Math.abs(local.x)-a),dz=Math.max(0,Math.abs(local.z)-b);
    if(Math.hypot(dx,dz)<2.7*tree.size)
      return {valid:false,reason:'Фундамент пересекает дерево'};
  }
  return {valid:true,reason:''};
}

function segmentCrossesRectangle(a,b,halfWidth,halfDepth){
  // Slab clipping detects crossings whose endpoints are both outside a house.
  let enter=0,exit=1;
  for(const [start,delta,half] of [[a.x,b.x-a.x,halfWidth],[a.z,b.z-a.z,halfDepth]]){
    if(Math.abs(delta)<1e-8){if(Math.abs(start)>half)return false;continue;}
    const first=(-half-start)/delta,last=(half-start)/delta;
    enter=Math.max(enter,Math.min(first,last));exit=Math.min(exit,Math.max(first,last));
    if(enter>exit)return false;
  }
  return true;
}

function pointSegmentDistanceSquared(point,a,b){
  const dx=b.x-a.x,dz=b.z-a.z;
  const t=clamp(((point.x-a.x)*dx+(point.z-a.z)*dz)/(dx*dx+dz*dz||1),0,1);
  return (point.x-a.x-dx*t)**2+(point.z-a.z-dz*t)**2;
}

export function riverIntersectsBuildings(landscape,river,buildings){
  const radiusSquared=(river.width/2+1.1)**2;
  for(const building of buildings){
    const halfWidth=building.width/2,halfDepth=building.depth/2;
    for(let i=1;i<river.points.length;i++){
      const a=localFootprint(building,...river.points[i-1]);
      const b=localFootprint(building,...river.points[i]);
      if(segmentCrossesRectangle(a,b,halfWidth,halfDepth))return true;
      // Exact rounded-bank clearance: closest point is an endpoint projected
      // onto the rectangle or one of its corners projected onto the stroke.
      for(const point of [a,b]){
        const dx=Math.max(0,Math.abs(point.x)-halfWidth);
        const dz=Math.max(0,Math.abs(point.z)-halfDepth);
        if(dx*dx+dz*dz<radiusSquared)return true;
      }
      for(const x of [-halfWidth,halfWidth])for(const z of [-halfDepth,halfDepth])
        if(pointSegmentDistanceSquared({x,z},a,b)<radiusSquared)return true;
    }
  }
  return false;
}

export function findRiverForBridge(landscape,x,z){
  const near=nearestRiver(landscape,x,z);
  if(!near||near.distance>near.river.width/2+1)return null;
  let length=0;
  for(let i=1;i<near.river.points.length;i++)length+=Math.hypot(
    near.river.points[i][0]-near.river.points[i-1][0],
    near.river.points[i][1]-near.river.points[i-1][1]);
  const t=clamp(near.along/Math.max(1,length),0,1);
  const at=riverAtFraction(near.river,t),half=(near.river.width+BRIDGE_BANK_OVERHANG)/2;
  const dirX=-at.tangentZ,dirZ=at.tangentX;
  if([-1,1].some(side=>Math.abs(at.x+dirX*half*side)>LANDSCAPE_BOUNDS.width/2-1.5||
    Math.abs(at.z+dirZ*half*side)>LANDSCAPE_BOUNDS.depth/2-1.5))return null;
  return {riverId:near.river.id,t};
}

export function exampleLandscape(){
  return normalizeLandscape({
    rivers:[{id:'example-river',width:7,points:[[-4,-44],[-2,-29],[1,-14],[-1,0],[2,16],[0,30],[4,44]]}],
    hills:[{id:'example-west-hill',x:-43,z:28,radius:18,height:2.9},
      {id:'example-east-hill',x:34,z:-27,radius:23,height:3.6}],
    bridges:[{id:'example-bridge',riverId:'example-river',t:.5}],
    trees:starterTrees(),
  });
}
