/** Small position-based cloth solver for a hand-held rag.
 * Verlet particles, structural/shear/bend constraints, gravity and collisions.
 * The central grip follows the pointer; the remaining vertices retain inertia.
 */
export function createClothSimulation({THREE,geometry,columns=16,rows=12}){
  const position=geometry.attributes.position;
  const original=position.array.slice();
  const particles=[];
  const constraints=[];
  const countX=columns+1,countY=rows+1;
  const id=(x,y)=>y*countX+x;
  for(let y=0;y<countY;y++)for(let x=0;x<countX;x++){
    const i=id(x,y),origin=new THREE.Vector3(original[i*3],original[i*3+1],0);
    particles.push({position:origin.clone(),previous:origin.clone(),origin,
      pinned:Math.abs(x-columns/2)<=1&&Math.abs(y-rows/2)<=1});
  }
  function join(a,b,stiffness=1){
    const distance=particles[a].origin.distanceTo(particles[b].origin);
    constraints.push({a,b,distance,stiffness});
  }
  for(let y=0;y<countY;y++)for(let x=0;x<countX;x++){
    if(x<columns)join(id(x,y),id(x+1,y));
    if(y<rows)join(id(x,y),id(x,y+1));
    if(x<columns&&y<rows){join(id(x,y),id(x+1,y+1),.72);
      join(id(x+1,y),id(x,y+1),.72);}
    if(x+2<=columns)join(id(x,y),id(x+2,y),.28);
    if(y+2<=rows)join(id(x,y),id(x,y+2),.28);
  }
  const acceleration=new THREE.Vector3(),delta=new THREE.Vector3();
  const current=new THREE.Vector3();
  let elapsed=0;
  function settle(){
    // Once laid down, the rag keeps small natural folds without continuing
    // Verlet micro-motions (which made a released cloth dance on the table).
    for(let i=0;i<particles.length;i++){
      const p=particles[i],x=p.origin.x,y=p.origin.y;
      const fold=Math.sin(x*17+y*4)*.012+Math.cos(y*20-x*6)*.009;
      p.position.set(x,y,-.023+fold);
      p.previous.copy(p.position);
      position.setXYZ(i,p.position.x,p.position.y,p.position.z);
    }
    position.needsUpdate=true;geometry.computeVertexNormals();
  }
  function update(dt,{velocityX=0,velocityY=0,contact=false,held=false,collisionHeight=null}={}){
    const step=Math.min(.032,Math.max(.008,dt));elapsed+=step;
    const gravity=held?-.21:-.58;
    const wind=held?.028:.007;
    for(const particle of particles){
      if(particle.pinned){
        particle.position.set(particle.origin.x,particle.origin.y,contact?-.012:.055);
        if(collisionHeight)particle.position.z=Math.max(particle.position.z,
          collisionHeight(particle.position.x,particle.position.y));
        particle.previous.copy(particle.position);continue;
      }
      current.copy(particle.position);
      const vx=(particle.position.x-particle.previous.x)*.958;
      const vy=(particle.position.y-particle.previous.y)*.958;
      const vz=(particle.position.z-particle.previous.z)*.955;
      const flutter=Math.sin(particle.origin.x*17+particle.origin.y*12+elapsed*6);
      acceleration.set(-velocityX*.035+wind*flutter,-velocityY*.035,gravity);
      // Avoid allocating one Vector3 per particle on every animation frame.
      particle.position.x+=vx;
      particle.position.y+=vy;
      particle.position.z+=vz;
      particle.position.addScaledVector(acceleration,step*step*60);
      particle.previous.copy(current);
    }
    for(let iteration=0;iteration<6;iteration++){
      for(const link of constraints){
        const a=particles[link.a],b=particles[link.b];
        delta.subVectors(b.position,a.position);
        const distance=delta.length();if(distance<1e-6)continue;
        const correction=(distance-link.distance)/distance*.5*link.stiffness;
        if(!a.pinned)a.position.addScaledVector(delta,correction);
        if(!b.pinned)b.position.addScaledVector(delta,-correction);
      }
      for(const particle of particles){
        if(particle.pinned)continue;
        // Height is evaluated for every fabric vertex, including over edges.
        const floor=collisionHeight?collisionHeight(particle.position.x,particle.position.y):
          (contact?-.052:-.065);
        particle.position.z=Math.max(floor,particle.position.z);
        particle.position.x=Math.max(-.65,Math.min(.65,particle.position.x));
        particle.position.y=Math.max(-.48,Math.min(.48,particle.position.y));
      }
    }
    for(let i=0;i<particles.length;i++){
      const p=particles[i].position;position.setXYZ(i,p.x,p.y,p.z);
    }
    position.needsUpdate=true;geometry.computeVertexNormals();
  }
  return {update,settle,particleCount:particles.length,constraintCount:constraints.length};
}
