// A single height contract drives both the rendered treads and player movement.
export function stairTreads(stair){
 const {steps,depth,sweep,topLandingAngle:start}=stair;
 return Array.from({length:steps},(_,index)=>({index,
  a:start+(sweep-start)*index/steps,
  b:start+(sweep-start)*(index+1)/steps,
  y:index===0?0:-depth*index/(steps-1),
 }));
}
export function stairHeight(stair,angle){
 if(angle<=stair.topLandingAngle)return 0;
 const t=(angle-stair.topLandingAngle)/(stair.sweep-stair.topLandingAngle);
 const index=Math.max(0,Math.min(stair.steps-1,Math.floor(t*stair.steps)));
 return index===0?0:-stair.depth*index/(stair.steps-1);
}

export const TOP_RAIL_GAP=.34;
export const LOWER_WALL_RADIUS=5.5;
export const stairPoint=(radius,angle,y)=>({x:Math.sin(angle)*radius,z:Math.cos(angle)*radius,y});

export function lowerDoor(stair){
 const radius=LOWER_WALL_RADIUS-.53;
 const angle=stair.sweep+Math.acos((stair.innerRadius+stair.outerRadius)/2/radius);
 return {...stairPoint(radius,angle,-stair.depth),angle};
}

export function topGuardPaths(stair){
 const radius=stair.openingRadius+.19,inner=stair.innerRadius+.10,outer=stair.outerRadius-.14;
 const treads=stairTreads(stair).slice(0,-1);
 const flight=(r,first)=>treads.slice(first).map(t=>stairPoint(r,(t.a+t.b)/2,t.y+.98));
 const innerFlight=flight(inner,0),outerFlight=flight(outer,2);
 const ring=Array.from({length:43},(_,i)=>stairPoint(radius,TOP_RAIL_GAP+i/42*(2*Math.PI-2*TOP_RAIL_GAP),.98));
 const landing=[ring.at(-1),...Array.from({length:5},(_,i)=>
  stairPoint(radius+(inner-radius)*(i+1)/5,-.275,.98))];
 const firstAngle=(treads[0].a+treads[0].b)/2;
 const innerBridge=Array.from({length:6},(_,i)=>
  stairPoint(inner,-.275+(firstAngle+.275)*i/5,.98));
 const outerJoin=[ring[0],stairPoint(stair.openingRadius-.05,.39,.95),outerFlight[0]];
 return {ring,landing,outerJoin,innerBridge,outerFlight,innerFlight};
}

export function guardSegments(paths){
 return paths.flatMap(points=>points.slice(1).map((b,i)=>[points[i],b]));
}
