import {PLAYER_DEFAULTS} from '../../config/runtime.js';
import {supportHeightAt} from '../architecture/support-height.js';
import {stairTreads} from '../architecture/stair-profile.js';
// The curator must arrive on the same storey as the work, not look through a floor.
export function paintingLocation(slot,layout,config,camera){
 const fy=config.building.floorElevation,eye=PLAYER_DEFAULTS.eyeHeight;
 const floor=Number.isFinite(slot.floorAngle),halfFov=Math.tan(camera.fov*Math.PI/360);
 let floorY=0,distance=floor?2.3:Math.min(config.building.wingWidth*.75,
  Math.max(2.1,slot.width/(2*halfFov*camera.aspect)+.5,slot.height/(2*halfFov)+.5,slot.y-1.2));
 let normal=slot.normal;
 if(floor){
  const hall=layout.halls.find(h=>h.id===(slot.floorRoom??slot.wall.hall));
  const side=hall&&Math.sign(layout.local(hall,slot.x,slot.z).x),radius=Math.hypot(slot.x,slot.z)||1;
  normal=hall?layout.world(hall,-side||1,0):{x:-slot.x/radius,z:-slot.z/radius};
 }
 let x=slot.x+normal.x*distance,z=slot.z+normal.z*distance;
 if(floor&&slot.y<-.1){
  floorY=supportHeightAt(slot.x,slot.z,slot.y,config);
  const tread=stairTreads(config.building.stair).find(t=>'step-'+t.index===slot.supportId);
  if(tread){
   const a=(tread.a+tread.b)/2,r=(config.building.stair.innerRadius+config.building.stair.outerRadius)/2;
   x=Math.sin(a)*r;z=Math.cos(a)*r;floorY=tread.y;
  }else{
   const radius=Math.hypot(slot.x,slot.z)||1,r=Math.min(4.7,Math.max(1.5,radius+.8));
   x=slot.x/radius*r;z=slot.z/radius*r;
  }
  distance=Math.max(.01,Math.hypot(x-slot.x,z-slot.z));
 }
 const y=fy+floorY+eye;
 return {x,y,z,floorY,yaw:Math.atan2(x-slot.x,z-slot.z),pitch:Math.atan2(fy+slot.y-y,distance)};
}
