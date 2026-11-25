// All distances are metres; the archive's local floor is y=0 (world floor +8m).
import {storageTables,disposalReceiver} from './storage-layout.js';
import {lowerDoor} from './stair-profile.js';
import {placeRotundaFurniture} from './rotunda-furniture.js';
export function makeLayout(config) {
  const {radius:r,wingLength:l,wingWidth:w}=config.building;
  if(config.halls.length<3 || config.halls.length>10) throw Error('Нужно от 3 до 10 крыльев');
  const entryClearance=config.building.entrancePaintingClearance??.45;
  const ringRadius=r-.08;
  const start=Math.sqrt(ringRadius**2-(w/2)**2);
  const halls=config.halls.map((h,i)=>({...h,angle:i*Math.PI*2/config.halls.length,start,length:l,width:w,rug:{start,end:start+l-.15,width:2.15}}));
  const world=(h,x,z)=>({x:Math.cos(h.angle)*x+Math.sin(h.angle)*z,z:-Math.sin(h.angle)*x+Math.cos(h.angle)*z});
  const local=(h,x,z)=>({x:Math.cos(h.angle)*x-Math.sin(h.angle)*z,z:Math.sin(h.angle)*x+Math.cos(h.angle)*z});
  const inWing=(x,z,margin=0)=>halls.some(h=>{const p=local(h,x,z);return Math.abs(p.x)<=w/2-margin&&p.z>=start-margin&&p.z<=start+l-margin;});
  const perimeter=halls.flatMap(h=>[-1,1].map(side=>world(h,side*w/2,start))).sort((a,b)=>Math.atan2(a.z,a.x)-Math.atan2(b.z,b.x));
  const inCenter=(x,z,margin=0)=>perimeter.every((a,i)=>{const b=perimeter[(i+1)%perimeter.length],dx=b.x-a.x,dz=b.z-a.z;return (dx*(z-a.z)-dz*(x-a.x))/Math.hypot(dx,dz)>=margin-1e-6;});
  const walkable=(x,z)=>inCenter(x,z,.28)||inWing(x,z,.28);
  const walls=[];
  // Thematic zones split the two long walls; stable IDs survive title changes.
  for(const h of halls) for(const side of [-1,1]) {
    if (!h.walls?.length) continue; // A gallery may be built before its collection is chosen.
    const zones=h.walls.filter((_,i)=>i%2===(side===-1?0:1));
    if(!zones.length) zones.push(h.walls[0]);
    zones.forEach(([theme,title],i)=>{
      const legacyAlongShift = i===0 ? .88 : 0;
      const a=world(h,side*(w/2-.14),start+1+i*(l-2)/zones.length-legacyAlongShift);
      const b=world(h,side*(w/2-.14),start+1+(i+1)*(l-2)/zones.length);
      walls.push({id:`${h.id}/${side}/${theme}`,hall:h.id,theme,title,a,b,length:Math.hypot(b.x-a.x,b.z-a.z),legacyAlongShift,minAlong:Math.max(0,start+entryClearance-local(h,a.x,a.z).z),normal:world(h,-side,0)});
    });
  }
  for (const h of halls) {
    if (!h.walls?.length) continue;
    const half = w/2-.34, end = h.start+l-.15;
    walls.push({id:h.id+'/end',hall:h.id,theme:'end',themes:h.walls.map(([id])=>id),
      title:'Торцевая стена',a:world(h,-half,end),b:world(h,half,end),length:2*half,
      normal:world(h,0,-1),centerComposition:true});
  }
  // One flat hanging wall between each pair of entrances: no split V-shaped panels.
  const centerSegments=halls.map((h,i)=>{
    const next=halls[(i+1)%halls.length],a=world(h,w/2,start),b=world(next,-w/2,start);
    const length=Math.hypot(b.x-a.x,b.z-a.z),mid={x:(a.x+b.x)/2,z:(a.z+b.z)/2},n=Math.hypot(mid.x,mid.z);
    return {id:`center/${i}`,a,b,length,entrances:[h.id,next.id],normal:{x:-mid.x/n,z:-mid.z/n}};
  });
  for(const s of centerSegments){
    const face = p => ({x:p.x+.15*s.normal.x, z:p.z+.15*s.normal.z});
    walls.push({...s,a:face(s.a),b:face(s.b),minAlong:.16,maxAlong:s.length-.16,centerComposition:true,hall:'center',theme:'master',title:'Мировые шедевры'});
  }
  // Manual hanging follows the actual plaster faces, including the space across theme divisions.
  const hangingWalls=walls.filter(w=>w.hall==='center');
  for(const h of halls){
    const half=w/2-.14, end=start+l-.15;
    for(const side of [-1,1]){
      hangingWalls.push({id:h.id+'/side/'+side,hall:h.id,a:world(h,side*half,start),
        b:world(h,side*half,end),normal:world(h,-side,0),length:end-start,minAlong:entryClearance});
    }
    hangingWalls.push({id:h.id+'/end',hall:h.id,a:world(h,-half,end),b:world(h,half,end),
      normal:world(h,0,-1),length:half*2});
  }
  const rotundaFurniture=placeRotundaFurniture(config.building.rotundaFurniture??[],walls.filter(w=>w.hall==='center'));
  return {halls,walls,hangingWalls,centerSegments,perimeter,ringRadius,world,local,inWing,inCenter,walkable,rotundaFurniture,
    storageTables:storageTables(config),disposalStation:disposalReceiver(config),lowerDoor:lowerDoor(config.building.stair)};
}
