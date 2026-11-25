import {LOWER_WALL_RADIUS,TOP_RAIL_GAP,guardSegments,lowerDoor,stairHeight,topGuardPaths} from '../architecture/stair-profile.js';
import {PLAYER_DEFAULTS} from '../../config/runtime.js';
import {createPaintingCollisions} from './painting-collisions.js';
import {furnitureBounds} from '../architecture/furniture-bounds.js';
export const EYE_HEIGHT=PLAYER_DEFAULTS.eyeHeight;
const TAU=Math.PI*2;
export function createNavigation(config,layout){
 const paintings=createPaintingCollisions(config.paintings??{},EYE_HEIGHT);
 const furniture=furnitureBounds(layout,config.paintings??{});
 let obstacleRevision=0;
 const setPaintingObstacles=slots=>{paintings.setSlots([...furniture,...slots]);obstacleRevision++;};
 setPaintingObstacles([]);
 const {stair:s}=config.building;
 const door=layout.lowerDoor??lowerDoor(s),sin=Math.sin(door.angle),cos=Math.cos(door.angle);
 const rails=guardSegments(Object.values(topGuardPaths(s))).map(([a,b])=>{
  const dx=b.x-a.x,dz=b.z-a.z,lengthSq=dx*dx+dz*dz;
  return {a,b,dx,dz,lengthSq};
 });
 function progress({a,dx,dz,lengthSq},x,z){
  return Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/lengthSq));
 }
 function distance({a,dx,dz},x,z,t){return (x-a.x-t*dx)**2+(z-a.z-t*dz)**2;}
 function hitsGuard(x,z,nx,nz,y,nextY){
  if(Math.hypot(nx,nz)>s.openingRadius+.45)return false;
  return rails.some(rail=>{
   const t=progress(rail,nx,nz),next=distance(rail,nx,nz,t);
   if(next>=.23**2)return false;
   const railTop=rail.a.y+(rail.b.y-rail.a.y)*t;
   return Math.min(y,nextY)<railTop+.05 && Math.max(y,nextY)+EYE_HEIGHT>railTop-1.13 &&
    next<distance(rail,x,z,progress(rail,x,z))-1e-8;
  });
 }
 function floorAt(x,z,currentY=0){
  const radius=Math.hypot(x,z),angle=(Math.atan2(x,z)+TAU)%TAU;
  // Heights match the physical treads; only eye motion is smoothed.
  if(radius>=s.innerRadius+.21&&radius<=s.outerRadius-.13&&angle<=s.sweep+.07){
   const y=stairHeight(s,Math.min(angle,s.sweep));
   if(Math.abs(y-currentY)<.46)return y;
  }
  // Entrance bridges the short radial gap between the guardrail and first tread.
  if(radius>=s.innerRadius+.21&&radius<s.openingRadius+.4&&(angle<=s.topLandingAngle||angle>TAU-TOP_RAIL_GAP)&&currentY>-.4)return 0;
  if(currentY>-.46&&radius>=s.openingRadius+.25&&layout.walkable(x,z))return 0;
  const across=(x-door.x)*cos-(z-door.z)*sin,forward=(x-door.x)*sin+(z-door.z)*cos;
  if(currentY<-s.depth+.44 && radius>s.innerRadius+.10 && radius<LOWER_WALL_RADIUS-.34 &&
      !(Math.abs(across)<1.49&&forward>-.27)){
   // A player on the lower floor may go under the high treads if their head clears.
   if(angle>=s.topLandingAngle && angle<s.sweep && radius<s.outerRadius+.17 &&
      stairHeight(s,angle)>-s.depth+.12 && stairHeight(s,angle)-.15<-s.depth+EYE_HEIGHT+.08)return null;
   return -s.depth;
  }
  return null;
 }
 function safePosition(x,z,floorY,clearance){
  const clear=(px,pz)=>{
   const y=floorAt(px,pz,floorY);
   return y!==null && !paintings.blocked(px,pz,y,clearance) && !rails.some(rail=>{
    const t=progress(rail,px,pz),top=rail.a.y+(rail.b.y-rail.a.y)*t;
    return y<top+.05 && y+EYE_HEIGHT>top-1.13 && distance(rail,px,pz,t)<.30**2;
   }) ? {x:px,z:pz,floorY:y} : null;
  };
  const current=clear(x,z);
  if(current)return current;
  for(let r=.24;r<=6;r+=.24){
   const samples=Math.max(12,Math.ceil(2*Math.PI*r/.23));
   for(let i=0;i<samples;i++){
    const angle=2*Math.PI*i/samples;
    const candidate=clear(x+r*Math.cos(angle),z+r*Math.sin(angle));
    if(candidate)return candidate;
   }
  }
  return clearance===undefined?null:safePosition(x,z,floorY);
 }
 function move(position,held,yaw,dt,floorY,canSprint=true){
  const f=Number(held.has('w')||held.has('arrowup'))-Number(held.has('s')||held.has('arrowdown'));
  const r=Number(held.has('d')||held.has('arrowright'))-Number(held.has('a')||held.has('arrowleft'));
  const length=Math.hypot(f,r);if(!length)return {floorY,moving:false};
  const speed=canSprint&&held.has('shift')?7.4:4.4,distance=speed*Math.min(dt,.04)/length;
  const dx=(-Math.sin(yaw)*f+Math.cos(yaw)*r)*distance,dz=(-Math.cos(yaw)*f-Math.sin(yaw)*r)*distance;
  // Substeps prevent cutting through railings or skipping a narrow doorway at low FPS.
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.065));
  for(let i=0;i<steps;i++){
   const x=position.x+dx/steps,nextX=floorAt(x,position.z,floorY);
   if(nextX!==null && !hitsGuard(position.x,position.z,x,position.z,floorY,nextX) && !paintings.blocked(x,position.z,nextX)){position.x=x;floorY=nextX;}
   const z=position.z+dz/steps,nextZ=floorAt(position.x,z,floorY);
   if(nextZ!==null && !hitsGuard(position.x,position.z,position.x,z,floorY,nextZ) && !paintings.blocked(position.x,z,nextZ)){position.z=z;floorY=nextZ;}
  }
  return {floorY,moving:true};
 }
 return {floorAt,move,safePosition,setPaintingObstacles,get obstacleRevision(){return obstacleRevision;}};
}
