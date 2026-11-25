import {PLAYER_DEFAULTS} from '../../config/runtime.js';
export function createPlayerController({THREE,camera,navigation,config}){
 const baseFov=camera.fov;
 const initialPitch=config.camera?.initialPitch??0;
 const state={yaw:0,pitch:initialPitch,floorY:0,sensitivity:PLAYER_DEFAULTS.sensitivity,lastPointer:null,edge:{x:0,y:0,until:0}};
 const held=new Set();
 let checkedRevision=-1;
 function turn(dx,dy){const speed=state.sensitivity*.000145;state.yaw-=dx*speed;state.pitch=THREE.MathUtils.clamp(state.pitch-dy*speed,-1.31,1.27);}
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
  let distance=0;
  if(playing){
   resolvePosition();
   const {x,z}=camera.position;
   const movement=navigation.move(camera.position,held,state.yaw,dt,state.floorY,canSprint);state.floorY=movement.floorY;
   distance=Math.hypot(camera.position.x-x,camera.position.z-z);
   const eye=config.building.floorElevation+PLAYER_DEFAULTS.eyeHeight+state.floorY;
   camera.position.y+=(eye-camera.position.y)*(-Math.expm1(-15*dt));
   if(now<state.edge.until){state.yaw-=state.edge.x*1.6*dt;state.pitch=THREE.MathUtils.clamp(state.pitch-state.edge.y*1.3*dt,-1.31,1.27);}
  }
  camera.rotation.set(state.pitch,state.yaw,0,'YXZ');
  return distance;
 }
 function zoom(value){camera.fov=value ? baseFov*.62 : baseFov;camera.updateProjectionMatrix();}
 return {state,held,turn,clearInput,update,zoom,prepareView(){resolvePosition(.85);},level(){state.pitch=0;},reset(){checkedRevision=-1;camera.position.set(PLAYER_DEFAULTS.spawn.x,config.building.floorElevation+PLAYER_DEFAULTS.eyeHeight,PLAYER_DEFAULTS.spawn.z);state.floorY=0;state.yaw=0;state.pitch=initialPitch;clearInput();}};
}
