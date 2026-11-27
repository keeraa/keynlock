// Cubic segments share their velocity at the join. Only landing ends at zero speed.
export function createBirdRoute(THREE,points,velocities,durations){
  const curves=durations.map((duration,i)=>new THREE.CubicBezierCurve3(
    points[i].clone(),
    points[i].clone().addScaledVector(velocities[i],duration/3),
    points[i+1].clone().addScaledVector(velocities[i+1],-duration/3),
    points[i+1].clone()));
  const direction=new THREE.Vector3();
  const duration=durations.reduce((sum,d)=>sum+d,0);
  return {duration,sample(elapsed,position){
    let index=0,t=Math.max(0,elapsed);
    while(index<durations.length-1 && t>durations[index])t-=durations[index++];
    const fraction=Math.min(1,t/durations[index]);
    curves[index].getPoint(fraction,position);
    curves[index].getTangent(Math.min(.99999,fraction),direction);
    return {direction,finished:elapsed>=duration};
  }};
}
