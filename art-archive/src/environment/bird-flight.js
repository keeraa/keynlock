// Smooth steering towards changing destinations, with an independent altitude for each bird.
export function createBirdFlight(THREE,index,domeTop,random=Math.random){
  const position=new THREE.Vector3(Math.sin(index*2.4)*10,domeTop+2+index,Math.cos(index*2.4)*10);
  const target=new THREE.Vector3(),velocity=new THREE.Vector3();
  let heading=index*2.4,climb=0,remaining=0,bank=0,pitch=0;
  const wrap=angle=>Math.atan2(Math.sin(angle),Math.cos(angle));
  function destination(){
    // Cross the sky above the rotunda, changing both travel distance and altitude.
    const angle=heading+(random()-.5)*Math.PI*1.8;
    const distance=10+random()*15;
    target.set(position.x+Math.sin(angle)*distance,domeTop+1.8+random()*7,position.z+Math.cos(angle)*distance);
    const radius=Math.hypot(target.x,target.z);
    if(radius>23){target.x*=23/radius;target.z*=23/radius;}
    remaining=5+random()*5;
  }
  function update(dt,gliding){
    if(dt<=0)return {position,heading,bank,pitch,climb};
    remaining-=dt;
    if(remaining<=0 || Math.hypot(target.x-position.x,target.z-position.z)<3)destination();
    // Once near the edge, steer back towards the inner sky before choosing another destination.
    const radius=Math.hypot(position.x,position.z);
    const x=radius>25?-position.x:target.x-position.x;
    const z=radius>25?-position.z:target.z-position.z;
    const turn=wrap(Math.atan2(x,z)-heading);
    const change=Math.max(-.7*dt,Math.min(.7*dt,turn));
    heading+=change;
    const speed=gliding?3.5:3;
    const desiredClimb=Math.max(-1.3,Math.min(1.3,(target.y-position.y)*.6));
    climb+=(desiredClimb-climb)*(1-Math.exp(-1.6*dt));
    velocity.set(Math.sin(heading)*speed,climb,Math.cos(heading)*speed);
    position.addScaledVector(velocity,dt);
    bank+=(-Math.max(-.5,Math.min(.5,change/dt*.65))-bank)*(1-Math.exp(-3*dt));
    pitch+=(Math.atan2(climb,speed)-pitch)*(1-Math.exp(-3*dt));
    return {position,heading,bank,pitch,climb};
  }
  return {update,resume(point,yaw,slope=0,roll=0){position.copy(point);heading=yaw;climb=Math.tan(slope)*3;bank=roll;pitch=slope;remaining=0;}};
}
