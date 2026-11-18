import {BREAK_CUT,keyPickIndexAt} from './logic.js';
import {createProjectedBoundsCache} from './scene-picking-bounds.js';

// One raycaster owns the screen-to-scene conversion for both work surfaces.
// The file and the pointer must resolve against the same key face.
export function createScenePicking({THREE,canvas,camera,blankRoot,keyRoot,
  assemblyRoot,hitObjects,getLayout,getCuts,canDetachPart,isGearMode=()=>false}){
  const raycaster=new THREE.Raycaster();
  const ndc=new THREE.Vector2();
  const keyFacePlane=new THREE.Plane();
  const keyFacePoint=new THREE.Vector3(),keyFaceNormal=new THREE.Vector3();
  const projectedKeyPoint=new THREE.Vector3(),cameraAtKey=new THREE.Vector3();
  const toolPlane=new THREE.Plane(new THREE.Vector3(0,1,0),1.50);
  const projectedBounds=createProjectedBoundsCache({THREE,camera});
  const visibleHits=[];
  const hitPadding=19;

  function visibleHitMeshes(){
    visibleHits.length=0;
    for(const object of hitObjects)if(isVisible(object))visibleHits.push(object);
    return visibleHits;
  }

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
  function isVisible(object){
    if(object.userData.pickable===false)return false;
    for(let node=object;node;node=node.parent)if(!node.visible)return false;
    return true;
  }
  // Tiny pins and springs receive a 19px screen-space margin. It surrounds
  // their visible geometry, without replacing the target with a giant box.
  function assistedAssemblyHit(clientX,clientY){
    const rect=canvas.getBoundingClientRect();
    const x=clientX-rect.left,y=clientY-rect.top;
    let best=null,bestScore=Infinity;
    for(const object of hitObjects){
      if(!isVisible(object)||!object.isMesh||!object.geometry)continue;
      const {kind,id,index}=object.userData;
      if(!['screw','loose','internal','shackle'].includes(kind))continue;
      if(kind==='internal'&&canDetachPart?.(id)?.allowed===false)continue;
      if(kind==='shackle'&&canDetachPart?.('shackle-0')?.allowed===false)continue;
      const bounds=projectedBounds.get(object,rect);
      if(!bounds)continue;
      const {xMin,xMax,yMin,yMax,center}=bounds;
      const dx=Math.max(xMin-x,0,x-xMax);
      const dy=Math.max(yMin-y,0,y-yMax);
      const distance=Math.hypot(dx,dy);
      if(distance>hitPadding)continue;
      // Prefer exact/nearer shapes and compact parts over a broad housing.
      const area=Math.max(1,(xMax-xMin)*(yMax-yMin));
      const score=distance+Math.sqrt(area)*.015;
      if(score>=bestScore)continue;
      bestScore=score;
      best={object,point:center.clone()};
    }
    return best;
  }
  function hitTest(clientX,clientY,preferDust=false,includeContact=false){
    normalizedPointer(clientX,clientY);
    if(keyRoot.visible){
      const point=projectPointerToKey();
      if(!point)return null;
      const index=keyPickIndexAt(point.x,point.y,getLayout());
      return index>=0&&!getCuts().some(v=>v>=BREAK_CUT)?{kind:'cut',index}:null;
    }
    if(isGearMode()){
      const hits=raycaster.intersectObjects(visibleHitMeshes(),false);
      const hit=hits.find(item=>item.object.userData.kind==='oilCan')||
        hits.find(item=>item.object.userData.kind==='gearWheel');
      if(!hit)return null;
      return includeContact?{...hit.object.userData,point:hit.point.clone()}:
        hit.object.userData;
    }
    const hits=raycaster.intersectObjects(
      visibleHitMeshes(),false);
    const screwHit=hits.find(hit=>hit.object.userData.kind==='screw');
    const toolHit=hits.find(hit=>['rag','screwdriver','oilCan'].includes(hit.object.userData.kind));
    const looseHit=hits.find(hit=>hit.object.userData.kind==='loose');
    const shackleHit=hits.find(hit=>hit.object.userData.kind==='shackle');
    const dustHit=hits.find(hit=>hit.object.userData.kind==='dust');
    const coverHit=hits.find(hit=>hit.object.userData.kind==='cover');
    // Select an actually removable piece before the rear plate or outer shell.
    // Those large blocked meshes otherwise swallow the entire visible lock.
    const available=hit=>canDetachPart?.(hit.object.userData.id)?.allowed!==false;
    const internalHit=hits.find(hit=>hit.object.userData.kind==='internal'&&available(hit));
    const blockedHit=hits.find(hit=>hit.object.userData.kind==='internal'&&
      !['rear-0','shell-0','frame-0'].includes(hit.object.userData.id));
    const assisted=toolHit||looseHit||shackleHit||screwHit||coverHit||internalHit||
      (preferDust&&dustHit)?null:assistedAssemblyHit(clientX,clientY);
    // An actively held rag must be able to wipe across the screw heads as
    // well. Otherwise clicking a dirty screw unexpectedly changes tools.
    const hit=toolHit||looseHit||shackleHit||
      (preferDust?dustHit:null)||screwHit||coverHit||internalHit||assisted||blockedHit||dustHit;
    if(!hit)return null;
    const result=hit.object.userData.kind==='dust'?
      {...hit.object.userData,uv:hit.uv?.clone()}:hit.object.userData;
    return includeContact?{...result,point:hit.point.clone()}:result;
  }
  function pointerToolPoint(clientX,clientY,worldY=-1.5){
    normalizedPointer(clientX,clientY);
    toolPlane.constant=-worldY;
    const out=new THREE.Vector3();
    if(!raycaster.ray.intersectPlane(toolPlane,out))return null;
    assemblyRoot.updateWorldMatrix(true,false);
    return assemblyRoot.worldToLocal(out);
  }
  return {keyPointer,hitTest,pointerToolPoint};
}
