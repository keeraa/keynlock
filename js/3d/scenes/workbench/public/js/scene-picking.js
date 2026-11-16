import {BREAK_CUT,keyPickIndexAt} from './logic.js';

// One raycaster owns the screen-to-scene conversion for both work surfaces.
// The file and the pointer must resolve against the same key face.
export function createScenePicking({THREE,canvas,camera,blankRoot,keyRoot,
  assemblyRoot,hitObjects,getLayout,getCuts}){
  const raycaster=new THREE.Raycaster();
  const ndc=new THREE.Vector2();
  const keyFacePlane=new THREE.Plane();
  const keyFacePoint=new THREE.Vector3(),keyFaceNormal=new THREE.Vector3();
  const projectedKeyPoint=new THREE.Vector3(),cameraAtKey=new THREE.Vector3();
  const dragPlane=new THREE.Plane(new THREE.Vector3(0,0,1),-.78);

  function normalizedPointer(clientX,clientY){
    const rect=canvas.getBoundingClientRect();
    ndc.set(((clientX-rect.left)/rect.width)*2-1,
      -((clientY-rect.top)/rect.height)*2+1);
    raycaster.setFromCamera(ndc,camera);
  }
  function projectPointerToKey(){
    blankRoot.updateWorldMatrix(true,false);
    cameraAtKey.copy(camera.position);blankRoot.worldToLocal(cameraAtKey);
    const surfaceZ=cameraAtKey.z>=.055?.112:.004;
    keyFacePoint.set(0,0,surfaceZ);blankRoot.localToWorld(keyFacePoint);
    keyFaceNormal.set(0,0,1).transformDirection(blankRoot.matrixWorld);
    keyFacePlane.setFromNormalAndCoplanarPoint(keyFaceNormal,keyFacePoint);
    if(!raycaster.ray.intersectPlane(keyFacePlane,projectedKeyPoint))return null;
    return blankRoot.worldToLocal(projectedKeyPoint);
  }
  function keyPointer(clientX,clientY){
    normalizedPointer(clientX,clientY);
    const point=projectPointerToKey();
    return point?{point,back:cameraAtKey.z<.055}:null;
  }
  function hitTest(clientX,clientY,preferSlot=false){
    normalizedPointer(clientX,clientY);
    if(keyRoot.visible){
      const point=projectPointerToKey();
      if(!point)return null;
      const index=keyPickIndexAt(point.x,point.y,getLayout());
      return index>=0&&!getCuts().some(v=>v>=BREAK_CUT)?{kind:'cut',index}:null;
    }
    const hits=raycaster.intersectObjects(
      hitObjects.filter(object=>object.visible&&object.parent?.visible!==false),false);
    const slotHit=preferSlot?hits.find(hit=>hit.object.userData.kind==='slot'):null;
    const hit=slotHit||hits.find(hit=>
      hit.object.userData.kind==='part'||hit.object.userData.kind==='slot');
    return hit?.object.userData||null;
  }
  function pointerPoint(clientX,clientY){
    normalizedPointer(clientX,clientY);
    const out=new THREE.Vector3();
    raycaster.ray.intersectPlane(dragPlane,out);
    out.sub(assemblyRoot.position);
    return out;
  }
  return {keyPointer,hitTest,pointerPoint};
}
