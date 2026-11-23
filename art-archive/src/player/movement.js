import {stairHeight} from '../architecture/stair-profile.js';
import {PLAYER_DEFAULTS} from '../../config/runtime.js';
import {createPaintingCollisions} from './painting-collisions.js';
import {furnitureBounds} from '../architecture/furniture-bounds.js';
export const EYE_HEIGHT=PLAYER_DEFAULTS.eyeHeight;
const TAU=Math.PI*2;
export function createNavigation(config,layout){
 const paintings=createPaintingCollisions(config.paintings??{},EYE_HEIGHT);
 const furniture=furnitureBounds(layout,config.paintings??{});
 const setPaintingObstacles=slots=>paintings.setSlots([...furniture,...slots]);
 setPaintingObstacles([]);
 const {stair:s}=config.building;
 function floorAt(x,z,currentY=0){
  const radius=Math.hypot(x,z),angle=(Math.atan2(x,z)+TAU)%TAU;
  // Heights match the physical treads; only eye motion is smoothed.
  if(radius>=s.innerRadius+.21&&radius<=s.outerRadius-.13&&angle<=s.sweep+.07){
   const y=stairHeight(s,Math.min(angle,s.sweep));
   if(Math.abs(y-currentY)<.46)return y;
  }
  // Entrance bridges the short radial gap between the guardrail and first tread.
  if(radius>=s.innerRadius+.21&&radius<s.openingRadius+.4&&(angle<=s.topLandingAngle||angle>TAU-.28)&&currentY>-.4)return 0;
  if(currentY>-.46&&radius>=s.openingRadius+.25&&layout.walkable(x,z))return 0;
  if(currentY<-s.depth+.44&&radius<5.16&&!(Math.abs(x)<1.5&&z<-4.8))return -s.depth;
  return null;
 }
 function move(position,held,yaw,dt,floorY){
  const f=Number(held.has('w')||held.has('arrowup'))-Number(held.has('s')||held.has('arrowdown'));
  const r=Number(held.has('d')||held.has('arrowright'))-Number(held.has('a')||held.has('arrowleft'));
  const length=Math.hypot(f,r);if(!length)return {floorY,moving:false};
  const speed=held.has('shift')?7.4:4.4,distance=speed*Math.min(dt,.04)/length;
  const dx=(-Math.sin(yaw)*f+Math.cos(yaw)*r)*distance,dz=(-Math.cos(yaw)*f-Math.sin(yaw)*r)*distance;
  // Substeps prevent cutting through railings or skipping a narrow doorway at low FPS.
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.065));
  for(let i=0;i<steps;i++){
   const nextX=floorAt(position.x+dx/steps,position.z,floorY);
   if(nextX!==null && !paintings.blocked(position.x+dx/steps,position.z,nextX)){position.x+=dx/steps;floorY=nextX;}
   const nextZ=floorAt(position.x,position.z+dz/steps,floorY);
   if(nextZ!==null && !paintings.blocked(position.x,position.z+dz/steps,nextZ)){position.z+=dz/steps;floorY=nextZ;}
  }
  return {floorY,moving:true};
 }
 return {floorAt,move,setPaintingObstacles};
}
