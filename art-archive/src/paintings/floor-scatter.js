import {frameDimensions,frameFootprint,footprintCorners,footprintsOverlap} from '../../catalog/painting-geometry.js';
import {stairTreads} from '../architecture/stair-profile.js';
import {floorSupport} from './floor-drop.js';

const cache=new WeakMap();
function random(seed){let x=seed>>>0;return ()=>{x+=0x6d2b79f5;let t=x;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
function hash(text){let h=2166136261;for(const c of text)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
// All initial frames have independent, supported poses. No lanes, towers or piles.
export function scatterFloor(slots,layout,config){
 const saved=cache.get(slots);if(saved?.layout===layout&&saved.seed===(config.paintings.scatterSeed??1122))return saved.slots.map(s=>({...s}));
 const settings=config.paintings,rng=random(hash(slots.map(s=>s.painting.id).join(','))^(settings.scatterSeed??1122));
 const pending=[...slots].sort((a,b)=>{const x=frameDimensions(a,settings),y=frameDimensions(b,settings);return y.width*y.height-x.width*x.height;});
 const staged=[],buckets=new Map(),cell=3,assigned=new Set();
 function keys(rect,room){const p=footprintCorners(rect),xs=p.map(p=>p.x),zs=p.map(p=>p.z),out=[];
  for(let x=Math.floor((Math.min(...xs)-.025)/cell);x<=Math.floor((Math.max(...xs)+.025)/cell);x++)for(let z=Math.floor((Math.min(...zs)-.025)/cell);z<=Math.floor((Math.max(...zs)+.025)/cell);z++)out.push(room+'/'+x+','+z);return out;}
 function commit(slot,point,angle,y=0){
  const p={...slot,...point,y,floorAngle:angle,faceDown:hash(slot.painting.id+'/back/'+(settings.scatterSeed??1122))%100<28,trolley:false};
  const support=floorSupport(p,layout,config);if(!support)return false;
  const rect=frameFootprint(p,settings),index=keys(rect,support.id),seen=new Set();
  for(const key of index)for(const other of buckets.get(key)??[]){if(seen.has(other))continue;seen.add(other);if(footprintsOverlap(rect,other,.025))return false;}
  for(const key of index){if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(rect);}
  staged.push({...p,y:support.y+settings.frameDepthM/2,supportId:support.id,floorRoom:support.room});assigned.add(slot.painting.id);return true;
 }
 if(slots.length>=24){
  const small=[...pending].reverse();let step=0;
  const treads=stairTreads(config.building.stair).filter(t=>t.index>=4&&t.index%4===0);
  for(const slot of small){
   if(step>=treads.length)break;
   const size=frameDimensions(slot,settings);if(Math.min(size.width,size.height)>.285||Math.max(size.width,size.height)>.8)continue;
   const t=treads[step],a=(t.a+t.b)/2,r=config.building.stair.outerRadius-.43;
   if(commit(slot,{x:Math.sin(a)*r,z:Math.cos(a)*r},a+(size.width>=size.height?-Math.PI/2:0),t.y))step++;
  }
  let lower=0;
  for(const slot of small){if(lower>=12)break;if(assigned.has(slot.painting.id))continue;
   const size=frameDimensions(slot,settings);if(Math.max(size.width,size.height)>1.0)continue;
   for(let i=0;i<80;i++){const a=rng()*Math.PI*2,r=2.8+rng()*1.5;if(commit(slot,{x:Math.sin(a)*r,z:Math.cos(a)*r},rng()*Math.PI*2,-config.building.stair.depth)){lower++;break;}}
  }
  for(const table of layout.storageTables??[]){let count=0;
   for(const slot of small){if(count>=3)break;if(assigned.has(slot.painting.id))continue;const size=frameDimensions(slot,settings);if(Math.max(size.width,size.height)>1.1)continue;
    for(let i=0;i<25;i++){const dx=(rng()-.5)*(table.width-.4),dz=(rng()-.5)*(table.depth-.2),c=Math.cos(table.angle),s=Math.sin(table.angle);
     if(commit(slot,{x:table.x+c*dx+s*dz,z:table.z-s*dx+c*dz},table.angle+(rng()-.5)*.8,table.y)){count++;break;}}
   }
  }
 }
 for(const slot of pending){
  if(assigned.has(slot.painting.id))continue;
  const size=frameDimensions(slot,settings);let placed=false;
  for(let attempt=0;attempt<2500&&!placed;attempt++){
   if(slots.length>=24 && rng()<.18){const a=rng()*Math.PI*2,r=7+rng()*(config.building.radius-7.5);placed=commit(slot,{x:Math.sin(a)*r,z:Math.cos(a)*r},rng()*Math.PI*2);}
   else {
    const h=slots.length<24?(layout.halls.find(h=>h.id===slot.wall.hall)??layout.halls[0]):layout.halls[Math.floor(rng()*layout.halls.length)];
    const angle=h.angle+(size.width>=size.height?Math.PI/2:0)+(rng()-.5)*(Math.max(size.width,size.height)>2?.35:Math.PI*2);
    placed=commit(slot,layout.world(h,(rng()-.5)*(h.width-.55),h.start+.3+rng()*(h.length-.6)),angle);
   }
  }
  if(!placed){
   search:for(const h of layout.halls)for(const turn of [0,Math.PI/2])for(let z=h.start+.3;z<h.start+h.length-.3;z+=.25)for(let x=-h.width/2+.3;x<h.width/2-.3;x+=.25)
    if(commit(slot,layout.world(h,x,z),h.angle+turn)){placed=true;break search;}
  }
  if(!placed)throw Error('No non-overlapping staging surface for '+slot.painting.id);
 }
 cache.set(slots,{layout,seed:settings.scatterSeed??1122,slots:staged});return staged.map(s=>({...s}));
}
