import {targetGuideSegments} from './logic.js';
import {keyBladeFaceZ} from './key-blade.js';
import {machinedTopAtX} from './key-wear.js';

// The guide is visible only in the assisted mode. Keep a stale hidden guide
// until the player returns to that mode, then rebuild it exactly once.
export function shouldRebuildTargetGuide(method,intact,signature,previous){
  return method==='guided'&&intact&&signature!==previous;
}

export function targetGuideGeometry(THREE,cuts,targets,layout,face='front',wear=[]){
  const points=[];
  const zOffset=face==='front'?.0015:-.0015;
  const at=(a,b,t)=>{
    const x=THREE.MathUtils.lerp(a[0],b[0],t);
    const y=THREE.MathUtils.lerp(a[1],b[1],t);
    return new THREE.Vector3(x,y,keyBladeFaceZ(x,y,face)+zOffset);
  };
  for(const [a,b] of targetGuideSegments(cuts,targets,layout)){
    const steps=Math.max(2,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.025));
    for(let i=1;i<=steps;i++){
      const first=at(a,b,(i-1)/steps),last=at(a,b,i/steps);
      if(machinedTopAtX(cuts,layout,wear,first.x)>=first.y-.001&&
        machinedTopAtX(cuts,layout,wear,last.x)>=last.y-.001)
        points.push(first,last);
    }
  }
  return new THREE.BufferGeometry().setFromPoints(points);
}
