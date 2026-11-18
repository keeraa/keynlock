// Screen-space hit boxes for small 3D parts. A projected box is reused until
// its mesh, geometry, camera or viewport changes. This keeps the forgiving
// 19px hit margin without projecting eight vertices on every pointer event.
export function createProjectedBoundsCache({THREE,camera}){
  const entries=new WeakMap();
  const previousView=new THREE.Matrix4();
  const previousProjection=new THREE.Matrix4();
  const corner=new THREE.Vector3();
  const center=new THREE.Vector3();
  let viewRevision=0,lastWidth=-1,lastHeight=-1;

  function get(object,rect){
    if(rect.width!==lastWidth||rect.height!==lastHeight||
      !previousView.equals(camera.matrixWorld)||
      !previousProjection.equals(camera.projectionMatrix)){
      lastWidth=rect.width;lastHeight=rect.height;
      previousView.copy(camera.matrixWorld);
      previousProjection.copy(camera.projectionMatrix);
      viewRevision++;
    }
    object.updateWorldMatrix(true,false);
    const geometry=object.geometry;
    const positionVersion=geometry.attributes?.position?.version??0;
    const cached=entries.get(object);
    if(cached?.viewRevision===viewRevision&&cached.geometry===geometry&&
      cached.positionVersion===positionVersion&&cached.world.equals(object.matrixWorld))
      return cached.bounds;

    if(!geometry.boundingBox||cached?.geometry===geometry&&
      cached.positionVersion!==positionVersion)geometry.computeBoundingBox();
    const box=geometry.boundingBox;
    let bounds=null;
    if(box&&!box.isEmpty()){
      let xMin=Infinity,xMax=-Infinity,yMin=Infinity,yMax=-Infinity;
      for(const bx of [box.min.x,box.max.x]){
        for(const by of [box.min.y,box.max.y]){
          for(const bz of [box.min.z,box.max.z]){
            corner.set(bx,by,bz).applyMatrix4(object.matrixWorld).project(camera);
            if(corner.z< -1||corner.z>1)continue;
            const px=(corner.x+1)*rect.width/2;
            const py=(1-corner.y)*rect.height/2;
            xMin=Math.min(xMin,px);xMax=Math.max(xMax,px);
            yMin=Math.min(yMin,py);yMax=Math.max(yMax,py);
          }
        }
      }
      if(xMin!==Infinity){
        center.copy(box.min).add(box.max).multiplyScalar(.5).applyMatrix4(object.matrixWorld);
        bounds={xMin,xMax,yMin,yMax,center:center.clone()};
      }
    }
    entries.set(object,{viewRevision,geometry,positionVersion,
      world:object.matrixWorld.clone(),bounds});
    return bounds;
  }
  return {get};
}
