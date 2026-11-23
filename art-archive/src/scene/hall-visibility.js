// Every route between windowless wings crosses the rotunda. A wing can appear
// only through its doorway and, from inside another wing, the observer's doorway.
export function createHallVisibility(THREE, layout, building) {
  const margin = .65, lead = 2.5;
  const {floorElevation,height} = building;
  const portals = layout.halls.map(hall=>{
    const half = hall.width/2+margin;
    const a = layout.world(hall,-half,hall.start), b = layout.world(hall,half,hall.start);
    const box = new THREE.Box3(
      new THREE.Vector3(Math.min(a.x,b.x)-margin,floorElevation-margin,Math.min(a.z,b.z)-margin),
      new THREE.Vector3(Math.max(a.x,b.x)+margin,floorElevation+height+margin,Math.max(a.z,b.z)+margin)
    );
    return {hall,a,b,box};
  });
  // Cache both ends of every destination doorway in each source wing's coordinates.
  const destinations = new Map(layout.halls.map(h=>[h,portals.map(({a,b})=>[
    layout.local(h,a.x,a.z),layout.local(h,b.x,b.z),
  ])]));
  const frustum = new THREE.Frustum(), matrix = new THREE.Matrix4();
  const visible = new Set();
  function throughExit(hall,eye,ends) {
    const depth = eye.z-hall.start-lead;
    if (depth<=0) return true;
    const [a,b] = ends;
    if (Math.max(a.z,b.z)>=hall.start) return true;
    const project = p=>eye.x+(p.x-eye.x)*depth/(depth+hall.start-p.z);
    const left=project(a), right=project(b), half=hall.width/2+margin;
    return Math.min(left,right)<=half && Math.max(left,right)>=-half;
  }
  function update(camera,showAll=false) {
    visible.clear();
    visible.add('center');
    const eye=camera.position;
    if (showAll || eye.y>floorElevation+height || eye.y<floorElevation-.1) {
      for (const {hall} of portals) visible.add(hall.id);
      return;
    }
    camera.updateWorldMatrix(true,false);
    frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    let source, localEye;
    for (const {hall} of portals) {
      const p=layout.local(hall,eye.x,eye.z);
      if (p.z>=hall.start && p.z<=hall.start+hall.length && Math.abs(p.x)<=hall.width/2) {
        source=hall; localEye=p; break;
      }
    }
    for (const [i,{hall,box}] of portals.entries()) {
      if (hall===source || (frustum.intersectsBox(box) &&
          (!source || throughExit(source,localEye,destinations.get(source)[i])))) visible.add(hall.id);
    }
  }
  for (const {hall} of portals) visible.add(hall.id);
  visible.add('center');
  return {visible,update};
}
