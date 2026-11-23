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
