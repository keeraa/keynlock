import {trolleyDimensions} from './trolley-model.js';
import {TOP_RAIL_GAP} from '../architecture/stair-profile.js';

// Computes the desired pose only. Swept collisions and animation are applied by
// the caller. The returned pose is reused: copy it before retaining a snapshot.
export function createCarryPose(THREE,world,config,motion){
 const target=new THREE.Object3D(),settings=config.paintings;
 const result={position:target.position,quaternion:target.quaternion,trolley:false,stair:false};
 return function resolve(slot,large,hall,origin,dir,raised,inspectHeavy=false){
    let stairCarry=false;
    result.trolley=large;
    const fy=config.building.floorElevation;
    const eye=world.camera,stair=config.building.stair,radius=Math.hypot(eye.position.x,eye.position.z);
    // Keep the long edge along the flight, independent of where the player looks.
    // The usual low, sideways hand pose cannot fit between the curved railings.
    const angle=Math.atan2(eye.position.x,eye.position.z);
    const entrance=stair&&angle>-TOP_RAIL_GAP&&angle<stair.topLandingAngle+.3;
    stairCarry=!large&&!raised&&stair&&(radius<stair.openingRadius+.45||entrance&&radius<stair.openingRadius+1.6);
    result.stair=Boolean(stairCarry);
    if(stairCarry){
      // At the mouth the path runs radially; turn progressively with the bend.
      const bend=angle < -TOP_RAIL_GAP?angle+Math.PI*2:angle;
      const progress=Math.max(0,Math.min(1,bend/.9));
      const turn=(1-progress)*Math.PI/2;
      target.rotation.set(0,angle+turn,0,'YXZ');
      target.position.copy(eye.position);target.position.y-=.12;
      const outward=.2*(1-progress);
      target.position.x+=Math.sin(angle)*outward+Math.sin(angle+turn)*.28;
      target.position.z+=Math.cos(angle)*outward+Math.cos(angle+turn)*.28;
      result.trolley=false;return result;
    }
    if(!large || raised){
      const eye=world.camera;
      result.trolley=false;
      target.quaternion.copy(eye.quaternion);
      target.rotateX(raised?0:-.58);
      const tan=Math.tan(eye.fov*Math.PI/360);
      if(raised){
        const distance=Math.max(.65,(slot.height+2*settings.frameWidthM)/(1.7*tan),slot.width/(1.7*tan*eye.aspect));
        target.position.set(0,0,-distance).applyQuaternion(eye.quaternion).add(eye.position);
        return result;
      }
      target.position.set(.35+slot.width*.26,-.32-slot.height*.38,-.72-slot.width*.3)
        .applyQuaternion(eye.quaternion).add(eye.position);
      return result;
    }
    const layout=world.layout;
    // Park ahead, upright and facing the player even when the pickup ray points down.
    const yaw=world.carryYaw?.()??Math.atan2(-dir.x,-dir.z);
    const halfWidth=slot.width/2,baseTurn=.65,pull=.30;
    const closeOffsetAngle=Math.asin(Math.min(.94,Math.sin(baseTurn)+pull/slot.width));
    // Position and rotation are independent: retain the close centre and rotate
    // around it until the far vertical edge is straight ahead.
    const distance=.45+Math.sin(baseTurn)*halfWidth-pull/2;
    const side=.35+(Math.cos(baseTurn)-Math.cos(closeOffsetAngle))*halfWidth;
    const turn=Math.acos(Math.min(1,side/halfWidth));
    let cartYaw=yaw-turn;
    let x=origin.x-Math.sin(yaw)*distance+Math.cos(yaw)*side;
    let z=origin.z-Math.cos(yaw)*distance-Math.sin(yaw)*side;
    if(hall){
      const p=layout.local(hall,x,z),angle=cartYaw-hall.angle;
      const clamp=(v,lo,hi)=>lo>hi?(lo+hi)/2:Math.max(lo,Math.min(hi,v));
      const across=Math.abs(Math.cos(angle))*halfWidth+.32;
      const along=Math.abs(Math.sin(angle))*halfWidth+.32;
      ({x,z}=layout.world(hall,clamp(p.x,-hall.width/2+across,hall.width/2-across),
        clamp(p.z,hall.start+along,hall.start+hall.length-along)));
    }
    const pose={x,z,cartYaw};
    const y=fy+trolleyDimensions(slot,settings).centerHeight;
    if(inspectHeavy){
      const facing=Math.atan2(eye.position.x-pose.x,eye.position.z-pose.z);
      const position=new THREE.Vector3(pose.x,y,pose.z);
      const rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),facing);
      if(!motion.blocked(slot,position,rotation))pose.cartYaw=facing;
    }
    target.rotation.set(0,pose.cartYaw,0);target.position.set(pose.x,y,pose.z);
    return result;

 };
}
