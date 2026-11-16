import { resolveDistrictProfile } from './district-profiles.js';
import { generateDistrictHouseConfig, STREET_SCHEMA_VERSION } from './street-generator.js';
import { estimateResidentCapacity } from './resident-capacity.js';
import {
  roundRoad,roadNodeId,pathLength,pointOnPath,closestPointOnPath,
  orientedRect,segmentCorridor,convexOverlap,
} from './road-geometry.js';

const rng=seed=>{let s=(seed>>>0)||1;return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);};
const pt=point=>point.map(roundRoad);

// A winding historic town: junction coordinates are shared across streets,
// while the intermediate bends move with the district's character and seed.
function streetSkeleton(district,seed,profile) {
  const random=rng((seed>>>0)^0xd51b394a);
  const bendiness={old:1.15,port:1.25,bohemian:1.2,arts:.93,industrial:1.05,upper:.77,palace:.72}[district]||1;
  const move=(x,z,strength=1)=>pt([x+(random()-.5)*4*strength*bendiness,
    z+(random()-.5)*3.5*strength*bendiness]);
  const m1=move(0,-17,.5),m2=move(10,25,.5);
  const a1=move(39,-12,.55),a2=move(39,19,.55);
  const common={surface:profile.surface};
  return [
    {id:'main',kind:'main',width:profile.roadWidth,walkWidth:profile.sidewalkWidth,...common,
      path:[move(-23,-71),move(-18,-58),move(-13,-43),move(-7,-29),m1,move(3,-3),move(6,12),m2,move(16,41),move(12,57),move(7,71)]},
    {id:'market',kind:'cross',width:roundRoad(profile.roadWidth*.78),walkWidth:roundRoad(profile.sidewalkWidth*.83),...common,
      path:[move(-68,-36),move(-51,-32),move(-35,-28),move(-16,-23),m1,move(19,-15),move(30,-13),a1,move(53,-7),move(68,-9)]},
    {id:'north',kind:'cross',width:roundRoad(profile.roadWidth*.72),walkWidth:roundRoad(profile.sidewalkWidth*.83),...common,
      path:[move(-68,43),move(-51,40),move(-31,38),move(-13,34),m2,move(24,23),a2,move(53,15),move(69,10)]},
    {id:'alley',kind:'alley',width:Math.max(2.8,roundRoad(profile.roadWidth*.47)),walkWidth:.65,...common,
      path:[a1,move(43,-2),move(41,9),a2]},
  ];
}

function roadGraph(lines){
  const nodes=new Map(),edges=[];
  for(const line of lines){
    for(const point of line.path){
      const id=roadNodeId(point);
      if(!nodes.has(id))nodes.set(id,{id,x:point[0],z:point[1],roads:new Set()});
      nodes.get(id).roads.add(line.id);
    }
    for(let i=1;i<line.path.length;i++){
      const a=line.path[i-1],b=line.path[i];
      edges.push({id:`${line.id}-${i}`,roadId:line.id,from:roadNodeId(a),to:roadNodeId(b),
        p:[a,b],width:line.width,walkWidth:line.walkWidth,surface:line.surface,kind:line.kind});
    }
  }
  const resultNodes=[...nodes.values()].map(node=>({...node,roads:[...node.roads]}));
  return {lines,edges,nodes:resultNodes,junctions:resultNodes.filter(node=>node.roads.length>1)};
}

function offsetTowardRoad(point,target,road){
  const perp=[-point.tangent[1],point.tangent[0]];
  const sign=(perp[0]*(target[0]-point.x)+perp[1]*(target[1]-point.z))<0?-1:1;
  const away=road.width/2+road.walkWidth*.65;
  return pt([point.x+sign*perp[0]*away,point.z+sign*perp[1]*away]);
}

/** A seeded street block whose layout follows uneven, historically plausible roads. */
export function generateQuarterPlan(district='old',seed=1129,overrides={}){
  const profile=resolveDistrictProfile(district,overrides);
  const rand=rng((Number(seed)>>>0)^0x4b1c239d);
  const lines=streetSkeleton(district,Number(seed)>>>0,profile);
  const roads=roadGraph(lines);

  // The courtyard is an irregular five-sided space, enclosed by crooked lots.
  const courtyard={id:'inner-court',x:21.5,z:3.8,
    polygon:[[13,-4],[27,-6],[30,3],[26,13],[15,11]],surface:'paving',
    entrances:[[14.1,4],[29.4,4]]};
  const west=courtyard.entrances[0],east=courtyard.entrances[1];
  const mainApproach=closestPointOnPath(lines[0].path,...west);
  const alleyApproach=closestPointOnPath(lines[3].path,...east);
  const mainEnd=offsetTowardRoad(mainApproach,west,lines[0]);
  const alleyEnd=offsetTowardRoad(alleyApproach,east,lines[3]);
  const walkways=[
    {id:'court-west',kind:'courtyard',p:[mainEnd,west],width:1.55},
    {id:'court-through',kind:'courtyard',p:[west,[21,3.9],east],width:1.65},
    {id:'court-east',kind:'courtyard',p:[east,alleyEnd],width:1.55},
  ];
  const roadExclusions=roads.edges.map(edge=>segmentCorridor(edge.p[0],edge.p[1],edge.width/2+edge.walkWidth));
  const walkExclusions=walkways.flatMap(walk=>walk.p.slice(1).map((b,i)=>segmentCorridor(walk.p[i],b,walk.width/2+1)));
  const occupied=[],houses=[];
  const limits={main:11,market:10,north:9,alley:5};
  for(const road of lines){
    const total=pathLength(road.path);
    for(const side of [-1,1]) {
      let count=0,cursor=4.5+rand()*3;
      const quota=Math.ceil(limits[road.id]/2);
      while(cursor<total-5&&count<quota&&houses.length<29) {
        const config=generateDistrictHouseConfig(rand,profile);
        const width=config.width,depth=config.depth,location=pointOnPath(road.path,cursor+width/2);
        const [tx,tz]=location.tangent,away=[-tz*side,tx*side];
        const setback=profile.setback[0]+rand()*(profile.setback[1]-profile.setback[0]);
        const d=road.width/2+road.walkWidth+setback+depth/2+.17;
        const x=roundRoad(location.x+away[0]*d),z=roundRoad(location.z+away[1]*d);
        const rotation=roundRoad(Math.atan2(-away[0],-away[1]));
        const footprint=orientedRect(x,z,[tx,tz],away,width,depth).map(pt);
        const junctionClear=roads.junctions.every(node=>Math.hypot(location.x-node.x,location.z-node.z)>road.width*.58+width/2);
        const free=cursor+width+3<total&&junctionClear&&
          !roadExclusions.some(p=>convexOverlap(footprint,p,.1))&&
          !occupied.some(p=>convexOverlap(footprint,p,.25))&&
          !convexOverlap(footprint,courtyard.polygon,1.15)&&
          !walkExclusions.some(p=>convexOverlap(footprint,p,.15));
        if(free){
          const id=`${district}-${road.id}-${side<0?'l':'r'}-${String(count+1).padStart(2,'0')}`;
          houses.push({id,roadId:road.id,side,index:count,x,z,rotation,config,
            footprint,frontage:width,setback:roundRoad(setback)});
          occupied.push(footprint);
          const front=pt([x-away[0]*depth/2,z-away[1]*depth/2]);
          const end=pt([location.x+away[0]*(road.width/2+road.walkWidth*.68),
            location.z+away[1]*(road.width/2+road.walkWidth*.68)]);
          walkways.push({id:`access-${id}`,p:[front,end],width:.8,kind:'entrance'});
          count++;
        }
        cursor+=width+(.45+rand()*.92)*profile.gapScale;
      }
    }
  }

  const lamps=[];
  for(const road of lines){
    const spacing=profile.lampSpacing*(road.kind==='alley'?1.45:1);
    const total=pathLength(road.path);
    let index=0;
    for(let u=spacing*.54;u<total-spacing*.38;u+=spacing) {
      const p=pointOnPath(road.path,u);
      if(roads.junctions.some(node=>Math.hypot(p.x-node.x,p.z-node.z)<road.width*.83+1))continue;
      const side=index++%2?1:-1,normal=[-p.tangent[1]*side,p.tangent[0]*side];
      const offset=road.width/2+road.walkWidth*.76;
      lamps.push({id:`lamp-${road.id}-${index}`,roadId:road.id,side,
        x:roundRoad(p.x+normal[0]*offset),z:roundRoad(p.z+normal[1]*offset),style:profile.lampStyle});
    }
  }
  return {
    schema:'keynlock.quarter',version:STREET_SCHEMA_VERSION,mode:'quarter',district,seed:Number(seed)>>>0,
    profile,road:{width:profile.roadWidth,length:roundRoad(pathLength(lines[0].path)),surface:profile.surface},
    sidewalks:{width:profile.sidewalkWidth,elevation:.22},roads,courtyard,walkways,houses,lamps,
    stats:{houses:houses.length,lamps:lamps.length,residents:estimateResidentCapacity(houses,district),
      streets:lines.length,junctions:roads.junctions.length,
      paths:walkways.length,minFloors:Math.min(...houses.map(h=>h.config.floors)),
      maxFloors:Math.max(...houses.map(h=>h.config.floors))},
  };
}
