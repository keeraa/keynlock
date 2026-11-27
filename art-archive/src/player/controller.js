import {PLAYER_DEFAULTS} from '../../config/runtime.js';
export function createPlayerController({THREE,camera,navigation,config}){
 const initialPitch=config.camera?.initialPitch??0;
 const state={yaw:0,pitch:initialPitch,floorY:0,sensitivity:PLAYER_DEFAULTS.sensitivity,lastPointer:null,edge:{x:0,y:0,until:0}};
 const held=new Set();
 function turn(dx,dy){const speed=state.sensitivity*.000145;state.yaw-=dx*speed;state.pitch=THREE.MathUtils.clamp(state.pitch-dy*speed,-1.31,1.27);}
 function clearInput(){held.clear();state.lastPointer=null;state.edge.until=0;}
 function update(dt,now,playing){
  if(playing){
   const movement=navigation.move(camera.position,held,state.yaw,dt,state.floorY);state.floorY=movement.floorY;
   const eye=config.building.floorElevation+PLAYER_DEFAULTS.eyeHeight+state.floorY;
   camera.position.y+=(eye-camera.position.y)*(-Math.expm1(-15*dt));
   if(now<state.edge.until){state.yaw-=state.edge.x*1.6*dt;state.pitch=THREE.MathUtils.clamp(state.pitch-state.edge.y*1.3*dt,-1.31,1.27);}
  }
  camera.rotation.set(state.pitch,state.yaw,0,'YXZ');
 }
 return {state,held,turn,clearInput,update,level(){state.pitch=0;},reset(){camera.position.set(PLAYER_DEFAULTS.spawn.x,config.building.floorElevation+PLAYER_DEFAULTS.eyeHeight,PLAYER_DEFAULTS.spawn.z);state.floorY=0;state.yaw=0;state.pitch=initialPitch;clearInput();}};
}
