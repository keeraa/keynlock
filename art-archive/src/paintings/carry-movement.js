import {frameDimensions} from '../../catalog/painting-geometry.js';
import {PLAYER_DEFAULTS} from '../../config/runtime.js';

// Limits player motion against the actual carried pose, including a stuck frame.
export function constrainCarryMovement(THREE,settings,motion,slot,pose,from,to,recovering=false){
    const reach=Math.max(2.8,slot.width/2+1.5);
    let allowed=1;
    if(to.distanceTo(pose.position)>reach&&to.distanceToSquared(pose.position)>from.distanceToSquared(pose.position)){
      let low=0,high=1;const point=new THREE.Vector3();
      for(let i=0;i<16;i++){
        const middle=(low+high)/2;point.lerpVectors(from,to,middle);
        if(point.distanceTo(pose.position)<=reach)low=middle;else high=middle;
      }
      allowed=low;
    }
    const delta=to.clone().sub(from);
    const stopped=recovering||motion.blocked(slot,pose.position,pose.quaternion);
    const frameAdvance=stopped?0:
      motion.advance(slot,pose,{position:pose.position.clone().add(delta),quaternion:pose.quaternion});
    if(!stopped)allowed=Math.min(allowed,frameAdvance);
    if(frameAdvance>=allowed)return allowed;
    // Once the frame stops at an obstacle, the player must stop at its actual
    // volume too. Test the remaining relative movement, including pickup/recovery.
    const size=frameDimensions(slot,settings),inverse=pose.quaternion.clone().invert(),radius=.28;
    const local=from.clone().sub(pose.position).applyQuaternion(inverse);
    const vertical=new THREE.Vector3(0,1,0).applyQuaternion(inverse);
    const relative=delta.clone().applyQuaternion(inverse);
    function clearance(t){
      const center=local.clone().addScaledVector(relative,Math.max(0,t-frameAdvance));
      const sdf=h=>{
        const x=Math.abs(center.x+vertical.x*h)-size.width/2;
        const y=Math.abs(center.y+vertical.y*h)-size.height/2;
        const z=Math.abs(center.z+vertical.z*h)-size.depth/2;
        return Math.hypot(Math.max(0,x),Math.max(0,y),Math.max(0,z))+Math.min(0,Math.max(x,y,z));
      };
      let low=-PLAYER_DEFAULTS.eyeHeight+radius,high=0;
      for(let i=0;i<24;i++){
        const a=(2*low+high)/3,b=(low+2*high)/3;
        if(sdf(a)<sdf(b))high=b;else low=a;
      }
      return Math.min(sdf(low),sdf(high),sdf(-PLAYER_DEFAULTS.eyeHeight+radius),sdf(0))-radius;
    }
    const initial=clearance(0),steps=Math.max(1,Math.ceil(delta.length()/.04));
    let previous=0;
    for(let i=1;i<=steps;i++){
      const t=allowed*i/steps,gap=clearance(t);
      if(gap<Math.min(0,initial)-1e-6){
        let low=previous,high=t;
        for(let j=0;j<16;j++){const mid=(low+high)/2;if(clearance(mid)>=Math.min(0,initial)-1e-6)low=mid;else high=mid;}
        return low;
      }
      previous=t;
    }
    return allowed;
}
