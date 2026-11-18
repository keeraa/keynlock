// Short-lived, softly painted motes rise from the exact contact on the lock.
// A single shared texture keeps successive bursts inexpensive.
export function createDustParticles({THREE,root,document,random=Math.random}){
  const textureCanvas=document.createElement('canvas');
  textureCanvas.width=32;textureCanvas.height=32;
  const context=textureCanvas.getContext('2d');
  const gradient=context.createRadialGradient(16,16,1,16,16,16);
  gradient.addColorStop(0,'rgba(250,229,180,.95)');
  gradient.addColorStop(.35,'rgba(233,214,179,.67)');
  gradient.addColorStop(1,'rgba(204,177,137,0)');
  context.fillStyle=gradient;context.fillRect(0,0,32,32);
  const texture=new THREE.CanvasTexture(textureCanvas);
  const bursts=[];
  function disposeBurst(burst){
    root.remove(burst.points);
    burst.points.geometry.dispose();burst.points.material.dispose();
  }
  function emit(x,y,z,force=1){
    if(bursts.length>=8)disposeBurst(bursts.shift());
    const count=Math.round(22+Math.min(1,force)*22);
    const positions=new Float32Array(count*3);
    const velocities=new Float32Array(count*3);
    for(let i=0;i<count;i++){
      const angle=random()*Math.PI*2;
      const spread=(.12+Math.sqrt(random())*.23)*(.65+force*.4);
      const v=i*3;
      positions[v]=x+Math.cos(angle)*spread;
      positions[v+1]=y+Math.sin(angle)*spread;
      positions[v+2]=z+random()*.08;
      const movement=.12+random()*.26;
      velocities[v]=Math.cos(angle)*movement;
      velocities[v+1]=Math.sin(angle)*movement;
      velocities[v+2]=.25+random()*.53;
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    const material=new THREE.PointsMaterial({map:texture,color:0xe6d6ad,
      transparent:true,opacity:.88,size:.13,depthWrite:false,sizeAttenuation:true});
    const points=new THREE.Points(geometry,material);
    points.renderOrder=18;points.frustumCulled=false;root.add(points);
    bursts.push({points,positions,velocities,age:0,lifetime:.62+random()*.28});
  }
  function update(dt){
    for(let i=bursts.length-1;i>=0;i--){
      const burst=bursts[i];burst.age+=dt;
      if(burst.age>=burst.lifetime){disposeBurst(burst);bursts.splice(i,1);continue;}
      for(let j=0;j<burst.positions.length;j+=3){
        burst.positions[j]+=burst.velocities[j]*dt;
        burst.positions[j+1]+=burst.velocities[j+1]*dt;
        burst.positions[j+2]+=burst.velocities[j+2]*dt;
        burst.velocities[j]*=.989;burst.velocities[j+1]*=.989;
      }
      burst.points.geometry.attributes.position.needsUpdate=true;
      const progress=burst.age/burst.lifetime;
      burst.points.material.opacity=.88*(1-progress)*(1-progress);
    }
  }
  return {emit,update,dispose(){for(const burst of bursts)disposeBurst(burst);
    bursts.length=0;texture.dispose();}};
}
