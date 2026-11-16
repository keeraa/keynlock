// Geometry caches and articulated primitives are scoped to a single scene.
export function createGeometryPrimitives({ THREE, RoundedBoxGeometry, addMesh, setDynamicBase, springMaterial }) {
  // Static primitives are immutable. Reusing their BufferGeometry saves GPU
  // uploads and memory without linking mesh transforms or materials together.
  const boxGeometryCache=new Map(),cylinderGeometryCache=new Map();
  const torusGeometryCache=new Map(),springGeometryCache=new Map();
  function cachedGeometry(cache,key,build){
    let geometry=cache.get(key);
    if(!geometry){geometry=build();cache.set(key,geometry);}
    return geometry;
  }
  function box(parent,w,h,d,x,y,z,mt,r=.05) {
    const bevel=r>0?Math.min(r,w/2-.001,h/2-.001,d/2-.001):0;
    const key=`${w}|${h}|${d}|${bevel}`;
    const g=cachedGeometry(boxGeometryCache,key,()=>bevel>0?
      new RoundedBoxGeometry(w,h,d,3,bevel):new THREE.BoxGeometry(w,h,d));
    return addMesh(parent,g,mt,[x,y,z]);
  }
  function cyl(parent,r,h,x,y,z,mt,axis='y',segments=40) {
    const g=cachedGeometry(cylinderGeometryCache,`${r}|${h}|${segments}`,
      ()=>new THREE.CylinderGeometry(r,r,h,segments,1,false));
    const m=addMesh(parent,g,mt,[x,y,z]);
    if(axis==='x')m.rotation.z=Math.PI/2;
    if(axis==='z')m.rotation.x=Math.PI/2;
    return m;
  }
  function finishPinUV(geometry,length,pinIndex){
    const positions=geometry.getAttribute('position');
    const uv=geometry.getAttribute('uv');
    const twist=[-.045,.026,-.071,.054,-.021,.086][pinIndex%6];
    const heightOffset=[-.012,.011,-.005,.015,.008,-.017][pinIndex%6];
    for(let i=0;i<uv.count;i++){
      const around=uv.getX(i);
      const along=THREE.MathUtils.clamp((positions.getY(i)+length/2)/length,0,1);
      // Seamless cylindrical projection: opposite 0°/360° vertices sample
      // identical texels. Individual offsets vary the scratches on each pin.
      const photoU=.5+.46*Math.sin(2*Math.PI*(around+twist));
      const photoV=THREE.MathUtils.clamp(.035+.93*along+heightOffset,.012,.988);
      uv.setXY(i,photoU,photoV);
    }
    uv.needsUpdate=true;
    return geometry;
  }
  function capsulePin(parent,length,r,x,y,z,mt,pinIndex=0) {
    // The visible lower key pin retains its rounded tip and photographic finish.
    const profile=[];
    for(let i=0;i<=10;i++){
      const a=-Math.PI/2+(Math.PI/2)*i/10;
      profile.push(new THREE.Vector2(r*Math.cos(a),-length/2+r+r*Math.sin(a)));
    }
    profile.push(new THREE.Vector2(r,length/2),new THREE.Vector2(0,length/2));
    const geometry=finishPinUV(new THREE.LatheGeometry(profile,40),length,pinIndex);
    return addMesh(parent,geometry,mt,[x,y,z]);
  }
  function driverPin(parent,length,r,x,y,z,mt,pinIndex=0){
    // Flat mating faces form a real shear split. The small edge chamfers
    // retain the silhouette of the original uninterrupted copper pin.
    const bevel=.009;
    const profile=[
      new THREE.Vector2(0,-length/2),
      new THREE.Vector2(r-bevel*.45,-length/2),
      new THREE.Vector2(r,-length/2+bevel),
      new THREE.Vector2(r,length/2-bevel),
      new THREE.Vector2(r-bevel*.45,length/2),
      new THREE.Vector2(0,length/2)
    ];
    const geometry=finishPinUV(new THREE.LatheGeometry(profile,40),length,pinIndex);
    return addMesh(parent,geometry,mt,[x,y,z]);
  }
  function ring(parent,r,tube,x,y,z,mt,axis='z') {
    const g=cachedGeometry(torusGeometryCache,`${r}|${tube}`,
      ()=>new THREE.TorusGeometry(r,tube,8,40));
    const m=addMesh(parent,g,mt,[x,y,z]);
    if(axis==='x')m.rotation.y=Math.PI/2;
    if(axis==='y')m.rotation.x=Math.PI/2;
    return m;
  }
  function rod(parent,a,b,r,mt,segments=16) {
    const p1=new THREE.Vector3(...a),p2=new THREE.Vector3(...b),d=new THREE.Vector3().subVectors(p2,p1);
    const m=addMesh(parent,new THREE.CylinderGeometry(r,r,d.length(),segments),mt,p1.clone().add(p2).multiplyScalar(.5).toArray());
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());
    return m;
  }
  const rodAxis=new THREE.Vector3(0,1,0);
  const rodDelta=new THREE.Vector3();
  function moveArticulatedRod(mesh,a,b) {
    rodDelta.subVectors(b,a);
    mesh.scale.y=rodDelta.length();
    mesh.quaternion.setFromUnitVectors(rodAxis,rodDelta.normalize());
    const base=mesh.userData.dynamicBase||
      (mesh.userData.dynamicBase=new THREE.Vector3());
    base.addVectors(a,b).multiplyScalar(.5);
  }
  function moveTelescopicRod(group,a,b){
    rodDelta.subVectors(b,a);
    const length=rodDelta.length();
    group.quaternion.setFromUnitVectors(rodAxis,rodDelta.normalize());
    setDynamicBase(group,(a.x+b.x)*.5,(a.y+b.y)*.5,(a.z+b.z)*.5);
    // Both metal tubes are rigid; only their overlap changes as the guide
    // travels between the gear slide and the cam follower.
    group.userData.outer.position.y=-length*.5+.19;
    group.userData.inner.position.y=length*.5-.19;
    group.userData.collar.position.y=-length*.5+.36;
    group.userData.camJoint.position.y=length*.5;
  }
  function makeSpring(parent, radius=.072, turns=7) {
    const g=cachedGeometry(springGeometryCache,`${radius}|${turns}`,()=>{
      const points=[];
      for(let i=0;i<=turns*16;i++) {
        const t=i/(turns*16),a=t*turns*Math.PI*2;
        points.push(new THREE.Vector3(Math.cos(a)*radius,t,Math.sin(a)*radius));
      }
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),turns*24,.020,8,false);
    });
    return addMesh(parent,g,springMaterial);
  }
  return { box, cyl, capsulePin, driverPin, ring, rod, moveArticulatedRod, moveTelescopicRod, makeSpring };
}
