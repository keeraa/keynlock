import {frameDimensions,frameFootprint,footprintExtent,footprintsOverlap} from '../../catalog/painting-geometry.js';
import {LOWER_WALL_RADIUS,stairTreads} from '../architecture/stair-profile.js';
import {PLAYER_DEFAULTS} from '../../config/runtime.js';
import {floorSupport} from './floor-drop.js';

const cache=new WeakMap();
function random(seed){let x=seed>>>0;return ()=>{x+=0x6d2b79f5;let t=x;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
function hash(text){let h=2166136261;for(const c of text)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
export function tutorialWork(slots,settings){
 if(slots.length<24)return null;
 const candidates=slots.filter(slot=>{
  const {width,height}=frameDimensions(slot,settings);
  return Math.min(width,height)>=.36 && Math.max(width,height)<=.76 &&
    slot.wall.hall!=='center' && slot.painting.collection!=='keynlock';
 });
 return candidates.find(slot=>slot.painting.id==='ART-1815')
  ??candidates.find(slot=>slot.painting.titleRu?.length<=30)??candidates[0];
}
export function tutorialWorks(slots,settings){
 const first=tutorialWork(slots,settings);
 if(!first)return [];
 const candidates=slots.filter(slot=>{
  const {width,height}=frameDimensions(slot,settings);
  return slot!==first && slot.wall.hall!=='center' && slot.painting.collection!=='keynlock' &&
   Math.min(width,height)>=.36 && Math.max(width,height)<=.76;
 });
 const second=candidates.find(slot=>slot.wall.hall!==first.wall.hall);
 const wrong=candidates.find(slot=>slot!==second);
 return [first,second,wrong].filter(Boolean);
}
// All initial frames have independent, supported poses. No lanes, towers or piles.
export function scatterFloor(slots,layout,config){
 const saved=cache.get(slots);if(saved?.layout===layout&&saved.config===config&&saved.seed===(config.paintings.scatterSeed??1122))return saved.slots.map(s=>({...s}));
 const settings=config.paintings,rng=random(hash(slots.map(s=>s.painting.id).join(','))^(settings.scatterSeed??1122));
 const pending=slots.map(slot=>({slot,...frameDimensions(slot,settings)})).sort((a,b)=>b.width*b.height-a.width*a.height);
 const staged=[],buckets=new Map(),cell=3,assigned=new Set(),seen=new Set();
 const xAxis={x:1,z:0},zAxis={x:0,z:1};
 function keys(rect,room){
  const dx=footprintExtent(rect,xAxis)+.025,dz=footprintExtent(rect,zAxis)+.025,out=[];
  const minZ=Math.floor((rect.z-dz)/cell),maxZ=Math.floor((rect.z+dz)/cell);
  for(let x=Math.floor((rect.x-dx)/cell);x<=Math.floor((rect.x+dx)/cell);x++)
   for(let z=minZ;z<=maxZ;z++)out.push(room+'/'+x+','+z);
  return out;
 }
 const spawn=PLAYER_DEFAULTS.spawn;
 function commit(slot,point,angle,y=0,leanPitch=0,faceUp=false){
  const p={...slot,...point,y,floorAngle:angle,leanPitch,
   faceDown:!faceUp&&!leanPitch&&hash(slot.painting.id+'/back/'+(settings.scatterSeed??1122))%100<28,trolley:false};
  const rect=frameFootprint(p,settings),support=floorSupport(p,layout,config,rect);
  const {width,height}=slot.painting.physicalSizeM;
  if(y===0&&Math.max(width,height)>=settings.hoistFromM&&
     Math.hypot(point.x-spawn.x,point.z-spawn.z)<2.6+Math.hypot(rect.w,rect.h))return false;
  // Tables are reserved for player storage, never automatic staging.
  if(!support || support.id.startsWith('table-'))return false;
  if(support.id==='lower-landing'){
   const across=Math.max(0,Math.abs(rect.x*rect.u.x+rect.z*rect.u.z)-rect.w);
   const along=Math.max(0,Math.abs(rect.x*rect.v.x+rect.z*rect.v.z)-rect.h);
   if(Math.hypot(across,along)<config.building.stair.outerRadius+.10)return false;
  }
  const index=keys(rect,support.id);seen.clear();
  for(const key of index)for(const other of buckets.get(key)??[]){if(seen.has(other))continue;seen.add(other);if(footprintsOverlap(rect,other,.025))return false;}
  for(const key of index){if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(rect);}
  const rise=leanPitch?frameDimensions(p,settings).height*Math.cos(leanPitch)+settings.frameDepthM*Math.abs(Math.sin(leanPitch)):settings.frameDepthM;
  staged.push({...p,y:support.y+rise/2,supportId:support.id,floorRoom:support.room});assigned.add(slot.painting.id);return true;
 }
 for(const [index,tutorial]of tutorialWorks(slots,settings).entries()){
  for(const [x,z]of [[.36,1.35],[index===2?-.65:.36,index===2?1.35:2.4],[-.65,2.4],[.95,3.4],[-.95,3.4]]){
   if(commit(tutorial,{x:spawn.x+x,z:spawn.z-z},0,0,0,true))break;
  }
 }
 if(slots.length>=24){
  const small=[...pending].reverse();let step=0;
  const treads=stairTreads(config.building.stair).filter(t=>t.index>=4&&t.index%4===0);
  for(const {slot,width,height} of small){
   if(step>=treads.length)break;
   if(assigned.has(slot.painting.id))continue;
   if(Math.min(width,height)>.285||Math.max(width,height)>.8)continue;
   const t=treads[step],a=(t.a+t.b)/2,r=config.building.stair.outerRadius-.43;
   if(commit(slot,{x:Math.sin(a)*r,z:Math.cos(a)*r},a+(width>=height?-Math.PI/2:0),t.y))step++;
  }
  const lowerY=-config.building.stair.depth,leanPitch=-.22;
  const leanDistance=height=>(height*Math.sin(-leanPitch)+settings.frameDepthM*Math.cos(leanPitch))/2;
  const clearOfDoor=(x,z)=>[layout.lowerDoor,layout.disposalStation].every(item=>!item||Math.hypot(x-item.x,z-item.z)>1.65);
  let lowerLeaning=0;
  for(const {slot,width,height} of pending){
   if(lowerLeaning===7)break;
   if(assigned.has(slot.painting.id)||height<.7||height>1.85||width>1.55)continue;
   for(let i=0;i<45;i++){
    const a=rng()*Math.PI*2,r=LOWER_WALL_RADIUS-leanDistance(height)-width*width/(8*LOWER_WALL_RADIUS)-.055;
    const x=Math.sin(a)*r,z=Math.cos(a)*r;
    if(clearOfDoor(x,z)&&commit(slot,{x,z,normal:{x:-Math.sin(a),z:-Math.cos(a)}},undefined,lowerY,leanPitch)){
     lowerLeaning++;break;
    }
   }
  }
  for(const [min,max,count] of [[1.08,2.15,8],[.32,1.08,12]]){
   let lower=0;
   for(const {slot,width,height} of pending){
    if(lower===count)break;
    if(assigned.has(slot.painting.id)||Math.max(width,height)<min||Math.max(width,height)>max)continue;
    for(let i=0;i<70;i++){
     const a=rng()*Math.PI*2,r=3.3+rng()*1.13,x=Math.sin(a)*r,z=Math.cos(a)*r;
     if(clearOfDoor(x,z)&&commit(slot,{x,z},a+(rng()-.5)*2,lowerY)){lower++;break;}
    }
   }
  }
  for(const hall of layout.halls)for(const side of [-1,1]){
   const work=pending.find(({slot,width,height})=>!assigned.has(slot.painting.id)&&width>.52&&width<1.4&&height>1.08&&height<1.6);
   if(!work)break;
   const z=hall.start+2+rng()*(hall.length-4);
   const point=layout.world(hall,side*(hall.width/2-.155-leanDistance(work.height)),z);
   commit(work.slot,{...point,normal:layout.world(hall,-side,0)},undefined,0,leanPitch);
  }
 }
 for(const {slot,width,height} of pending){
  if(assigned.has(slot.painting.id))continue;
  let placed=false;
  for(let attempt=0;attempt<2500&&!placed;attempt++){
   if(slots.length>=24 && rng()<.18){const a=rng()*Math.PI*2,r=7+rng()*(config.building.radius-7.5);placed=commit(slot,{x:Math.sin(a)*r,z:Math.cos(a)*r},rng()*Math.PI*2);}
   else {
    const h=slots.length<24?(layout.halls.find(h=>h.id===slot.wall.hall)??layout.halls[0]):layout.halls[Math.floor(rng()*layout.halls.length)];
    const angle=h.angle+(width>=height?Math.PI/2:0)+(rng()-.5)*(Math.max(width,height)>2?.35:Math.PI*2);
    placed=commit(slot,layout.world(h,(rng()-.5)*(h.width-.55),h.start+.3+rng()*(h.length-.6)),angle);
   }
  }
  if(!placed){
   search:for(const h of layout.halls)for(const turn of [0,Math.PI/2])for(let z=h.start+.3;z<h.start+h.length-.3;z+=.25)for(let x=-h.width/2+.3;x<h.width/2-.3;x+=.25)
    if(commit(slot,layout.world(h,x,z),h.angle+turn)){placed=true;break search;}
  }
  if(!placed)throw Error('No non-overlapping staging surface for '+slot.painting.id);
 }
 cache.set(slots,{layout,config,seed:settings.scatterSeed??1122,slots:staged});return staged.map(s=>({...s}));
}
