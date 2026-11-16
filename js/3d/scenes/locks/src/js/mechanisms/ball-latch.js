// Two captive balls coupled to the cam release; the bores are concealed by the shell.
export function createBallLatch({THREE,depthRatio,root,addMesh,mat,tag,parts,setDynamicBase}) {
  // The two balls are captive in transverse pockets. At the groove they
  // touch the reduced-radius steel without penetrating it; the turning cam
  // retracts them into the housing before the shackle can move.
  // The original open half-cylinder looked like a floating rectangular frame
  // around each sphere in the cutaway. Do not render that nonfunctional guide.
  const balls=[],ballSeatX=1.395,ballSeatZ=.355,ballRetract=.16;
  for(const sign of [-1,1]){
    const holder=new THREE.Group();holder.position.set(ballSeatX,sign*.64,ballSeatZ);
    holder.scale.z=1/depthRatio;root.add(holder);
    const ball=addMesh(holder,new THREE.SphereGeometry(.137,28,20),mat.chromed);
    tag(ball,'Запирающий шарик','При повороте кулачка отходит от канавки дужки в направляющий карман.');
    parts.push({obj:holder,base:holder.position.clone(),
      dir:new THREE.Vector3(.30,sign*1.28,1.56).normalize(),distance:.94});
    holder.userData.dynamicBase=holder.position.clone();
    balls.push({holder,sign});
  }
  function restoreLockingBalls(){
    for(const {holder,sign} of balls){
      setDynamicBase(holder,ballSeatX,sign*.64,ballSeatZ);
      holder.position.set(ballSeatX,sign*.64,ballSeatZ);
      holder.rotation.set(0,0,0);
    }
  }
  function updateLockingBalls(latchReleased){
    for(const {holder,sign} of balls){
      setDynamicBase(holder,ballSeatX,sign*(.64+ballRetract*latchReleased),ballSeatZ);
    }
  }
  return {restoreLockingBalls,updateLockingBalls};
}
