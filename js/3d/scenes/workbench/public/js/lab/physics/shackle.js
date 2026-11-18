// Deterministic substep contact solver for the released U-shaped shackle.
import { SHACKLE_RADIUS } from '../geometry/shackle.js';
export function createShacklePhysics({THREE,shackleCurve,shacklePivot,restoreLockingBalls}) {
  // Free shackle rigid body. Gravity, impulses, angular momentum and contact
  // friction are resolved independently of the unlock animation.
  const shackleRest=new THREE.Vector3(1.52,-.64,.025);
  const shackleCOM=new THREE.Vector3(.50,.64,0);
  const shackleContacts=shackleCurve.getPoints(40).map(v=>v.sub(shackleCOM));
  for(const y of [0,1.28])shackleContacts.push(new THREE.Vector3(-.34,y,0).sub(shackleCOM));
  const shackleBody={released:false,position:new THREE.Vector3(),velocity:new THREE.Vector3(),
    quaternion:new THREE.Quaternion(),angularVelocity:new THREE.Vector3(),
    shaking:0,sleepTime:0,sleeping:false};
  // Solid steel: substantial rotational inertia, little rebound on the table,
  // and enough contact friction to stop the bar sliding and rattling.
  const floorLevel=-2.13,shackleRadius=SHACKLE_RADIUS;
  const shackleMass=2.8,shackleInertia=1.65;
  const restitution=.035,friction=.88;
  const contactLinearDamping=.976,contactAngularDamping=.968;
  const worldUp=new THREE.Vector3(0,1,0);
  const contactLever=new THREE.Vector3(),contactVelocity=new THREE.Vector3();
  const contactImpulse=new THREE.Vector3(),tangent=new THREE.Vector3();
  const activeLever=new THREE.Vector3(),rotationScratch=new THREE.Vector3();
  const angularAxis=new THREE.Vector3(),rotationStep=new THREE.Quaternion();
  const rotatedCOM=new THREE.Vector3();
  function restoreShackle(){
    shackleBody.released=false;shackleBody.shaking=0;
    shackleBody.sleepTime=0;shackleBody.sleeping=false;
    shackleBody.velocity.set(0,0,0);shackleBody.angularVelocity.set(0,0,0);
    shackleBody.quaternion.identity();
    shacklePivot.userData.dynamicBase=shackleRest.clone();
    shacklePivot.rotation.set(0,0,0);
    restoreLockingBalls();
  }
  function releaseShackle(pivotPosition,angle){
    shackleBody.released=true;
    shackleBody.sleepTime=0;shackleBody.sleeping=false;
    shackleBody.quaternion.setFromAxisAngle(new THREE.Vector3(0,0,1),angle);
    shackleBody.position.copy(shackleCOM).applyQuaternion(shackleBody.quaternion).add(pivotPosition);
    // A decisive sideways roll prevents the heavy U-bar from balancing on
    // one leg for a long time after the first contact with the tabletop.
    shackleBody.velocity.set(.14,-.98,.06);
    shackleBody.angularVelocity.set(1.6,-.27,-.59);
  }
  function stepShacklePhysics(frameDt){
    if(!shackleBody.released||shackleBody.sleeping)return;
    // Fixed-size substeps keep the small contact solver stable at low frame rates.
    const steps=Math.max(1,Math.ceil(frameDt/(1/120))),dt=frameDt/steps;
    for(let step=0;step<steps;step++){
      shackleBody.velocity.y-=9.81*dt;
      shackleBody.position.addScaledVector(shackleBody.velocity,dt);
      const spin=shackleBody.angularVelocity.length();
      if(spin>1e-5){
        rotationStep.setFromAxisAngle(angularAxis.copy(shackleBody.angularVelocity).multiplyScalar(1/spin),spin*dt);
        shackleBody.quaternion.premultiply(rotationStep).normalize();
      }
      // Find the deepest point on the curved steel arc or either leg.
      let deepest=0,hasContact=false;
      for(const local of shackleContacts){
        contactLever.copy(local).applyQuaternion(shackleBody.quaternion);
        const penetration=floorLevel-(shackleBody.position.y+contactLever.y-shackleRadius);
        if(penetration>deepest){deepest=penetration;activeLever.copy(contactLever);hasContact=true;}
      }
      if(hasContact){
        shackleBody.position.y+=deepest;
        contactVelocity.copy(shackleBody.angularVelocity).cross(activeLever).add(shackleBody.velocity);
        if(contactVelocity.y<0){
          const normalMass=1/shackleMass+rotationScratch.copy(activeLever).cross(worldUp).lengthSq()/shackleInertia;
          const normalJ=-((1+restitution)*contactVelocity.y)/normalMass;
          contactImpulse.copy(worldUp).multiplyScalar(normalJ);
          shackleBody.velocity.addScaledVector(contactImpulse,1/shackleMass);
          shackleBody.angularVelocity.addScaledVector(rotationScratch.copy(activeLever).cross(contactImpulse),1/shackleInertia);
          contactVelocity.copy(shackleBody.angularVelocity).cross(activeLever).add(shackleBody.velocity);
          tangent.set(contactVelocity.x,0,contactVelocity.z);
          if(tangent.lengthSq()>1e-9){
            tangent.normalize();
            const frictionMass=1/shackleMass+rotationScratch.copy(activeLever).cross(tangent).lengthSq()/shackleInertia;
            const frictionJ=Math.min(contactVelocity.dot(tangent)/frictionMass,friction*normalJ);
            contactImpulse.copy(tangent).multiplyScalar(-frictionJ);
            shackleBody.velocity.addScaledVector(contactImpulse,1/shackleMass);
            shackleBody.angularVelocity.addScaledVector(rotationScratch.copy(activeLever).cross(contactImpulse),1/shackleInertia);
          }
        }
        shackleBody.velocity.x*=contactLinearDamping;
        shackleBody.velocity.z*=contactLinearDamping;
        shackleBody.angularVelocity.multiplyScalar(contactAngularDamping);
      }
      shackleBody.velocity.multiplyScalar(.9993);
      shackleBody.angularVelocity.multiplyScalar(.9982);
      // Tiny vertical corrections are unavoidable in a discrete contact solver.
      // Allow a near-resting steel bar to sleep instead of trembling forever.
      const floorSlideSq=shackleBody.velocity.x**2+shackleBody.velocity.z**2;
      if(hasContact&&Math.abs(shackleBody.velocity.y)<.18&&
          floorSlideSq<.008&&shackleBody.angularVelocity.lengthSq()<.028){
        shackleBody.sleepTime+=dt;
        if(shackleBody.sleepTime>.38){
          shackleBody.velocity.set(0,0,0);shackleBody.angularVelocity.set(0,0,0);
          shackleBody.sleeping=true;break;
        }
      }else shackleBody.sleepTime=0;
    }
    rotatedCOM.copy(shackleCOM).applyQuaternion(shackleBody.quaternion);
    shacklePivot.userData.dynamicBase.copy(shackleBody.position).sub(rotatedCOM);
    shacklePivot.quaternion.copy(shackleBody.quaternion);
  }

  return {shackleBody,restoreShackle,releaseShackle,stepShacklePhysics};
}
