import {PLAYER_DEFAULTS} from '../../config/runtime.js';
export function createPlayerController({THREE,camera,navigation,config}){
 const baseFov=camera.fov;
 let targetFov=baseFov;
 const initialPitch=config.camera?.initialPitch??0;
 const state={yaw:0,pitch:initialPitch,floorY:0,sensitivity:PLAYER_DEFAULTS.sensitivity,lastPointer:null,edge:{x:0,y:0,until:0}};
 const held=new Set();
 let checkedRevision=-1,inspection=null,headYaw=0,headPitch=0,headMouseYaw=0,headMousePitch=0;
 const wrap=value=>Math.atan2(Math.sin(value),Math.cos(value));
 function turn(dx,dy){
  const speed=state.sensitivity*.000145;
  if(inspection){headMouseYaw-=dx*speed;headMousePitch-=dy*speed;return;}
  state.yaw-=dx*speed;state.pitch=THREE.MathUtils.clamp(state.pitch-dy*speed,-1.31,1.27);
 }
 function clearInput(){held.clear();state.lastPointer=null;state.edge.until=0;}
 function resolvePosition(clearance){
  if(checkedRevision===navigation.obstacleRevision)return;
  checkedRevision=navigation.obstacleRevision;
  const safe=navigation.safePosition?.(camera.position.x,camera.position.z,state.floorY,clearance);
  if(!safe)return;
  const changed=camera.position.x!==safe.x||camera.position.z!==safe.z||state.floorY!==safe.floorY;
  state.floorY=safe.floorY;
  if(changed)camera.position.set(safe.x,config.building.floorElevation+PLAYER_DEFAULTS.eyeHeight+safe.floorY,safe.z);
 }
 function update(dt,now,playing,canSprint=true){
  if(camera.fov!==targetFov){
   camera.fov+=(targetFov-camera.fov)*(-Math.expm1(-7*dt));
   if(Math.abs(camera.fov-targetFov)<.002)camera.fov=targetFov;
   camera.updateProjectionMatrix();
  }
  let distance=0;
  if(playing){
   resolvePosition();
   const {x,z}=camera.position;
   const movement=navigation.move(camera.position,held,state.yaw,dt,state.floorY,canSprint);state.floorY=movement.floorY;
   distance=Math.hypot(camera.position.x-x,camera.position.z-z);
   const eye=config.building.floorElevation+PLAYER_DEFAULTS.eyeHeight+state.floorY;
   camera.position.y+=(eye-camera.position.y)*(-Math.expm1(-15*dt));
   if(now<state.edge.until)turn(state.edge.x*1.6*dt/(state.sensitivity*.000145),state.edge.y*1.3*dt/(state.sensitivity*.000145));
  }
  let targetYaw=0,targetPitch=0;
  if(inspection){
   const p=inspection.position,dx=camera.position.x-p.x,dz=camera.position.z-p.z;
   targetYaw=wrap(Math.atan2(dx,dz)-state.yaw)+headMouseYaw;
   targetPitch=Math.atan2(p.y-inspection.height*.16-camera.position.y,Math.max(.01,Math.hypot(dx,dz)))-state.pitch+headMousePitch;
  }
  const blend=1-Math.exp(-10*dt);
  headYaw+=wrap(targetYaw-headYaw)*blend;headPitch+=(targetPitch-headPitch)*blend;
  camera.rotation.set(THREE.MathUtils.clamp(state.pitch+headPitch,-1.31,1.27),state.yaw+headYaw,0,'YXZ');
  return distance;
 }
 function zoom(value){targetFov=value ? baseFov*.62 : baseFov;}
 return {state,held,turn,clearInput,update,zoom,lookAtCarry(target){inspection=target;headMouseYaw=headMousePitch=0;state.edge.until=0;},prepareView(){resolvePosition(.85);},level(){state.pitch=0;},reset(){inspection=null;headYaw=headPitch=headMouseYaw=headMousePitch=0;checkedRevision=-1;camera.position.set(PLAYER_DEFAULTS.spawn.x,config.building.floorElevation+PLAYER_DEFAULTS.eyeHeight,PLAYER_DEFAULTS.spawn.z);state.floorY=0;state.yaw=0;state.pitch=initialPitch;clearInput();}};
}
