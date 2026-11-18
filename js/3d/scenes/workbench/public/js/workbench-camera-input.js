// Isolated pointer gesture ownership for the assembly camera. A captured
// pointer always has a matching release path, including blur and disposal.
export function createWorkbenchCameraGestures({canvas,state,scene,
  releaseCapture,onCameraUnlocked}){
  let panPointer=null;
  let rotationPointer=null,rotationKind=null,rotationLastX=0,rotationLastY=0,
    rotationUnlocked=false;

  function beginPan(event){
    if(!scene.beginCameraPan?.(event.pointerId,event.clientX,event.clientY))return false;
    panPointer=event.pointerId;state.cameraDragging=true;
    scene.setHoveredDetachable?.(null);scene.setGearHover?.(null);
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor='grabbing';
    event.preventDefault();return true;
  }
  function endPan(pointerId){
    if(panPointer!==pointerId)return false;
    scene.endCameraPan?.(pointerId);
    panPointer=null;state.cameraDragging=false;
    releaseCapture(pointerId);canvas.style.cursor='grab';
    return true;
  }
  function beginRotation(event){
    const hit=scene.hitTest(event.clientX,event.clientY,false,true);
    const kind=scene.beginInspectionRotation?.(hit);
    if(!kind)return false;
    rotationPointer=event.pointerId;rotationKind=kind;
    rotationLastX=event.clientX;rotationLastY=event.clientY;
    rotationUnlocked=false;
    scene.setHoveredDetachable?.(null);
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor='grabbing';
    event.preventDefault();return true;
  }
  function stopRotation(pointerId=rotationPointer){
    if(rotationPointer===null||rotationPointer!==pointerId)return false;
    scene.endInspectionRotation?.(rotationKind);
    releaseCapture(rotationPointer);
    rotationPointer=null;rotationKind=null;rotationUnlocked=false;
    canvas.style.cursor='grab';
    return true;
  }
  function move(event){
    if(panPointer===event.pointerId){
      scene.moveCameraPan?.(event.pointerId,event.clientX,event.clientY);
      event.preventDefault();return true;
    }
    if(rotationPointer!==event.pointerId)return false;
    if(!(event.buttons&2)){stopRotation();return true;}
    const dx=event.clientX-rotationLastX,dy=event.clientY-rotationLastY;
    rotationLastX=event.clientX;rotationLastY=event.clientY;
    if(rotationKind==='lock'&&!rotationUnlocked&&Math.hypot(dx,dy)>=1){
      rotationUnlocked=true;onCameraUnlocked?.();
    }
    scene.rotateInspection?.(rotationKind,dx,dy);
    event.preventDefault();return true;
  }
  function cancel(){
    if(panPointer!==null)endPan(panPointer);
    stopRotation();
  }
  return {beginPan,beginRotation,move,endPan,stopRotation,cancel,dispose:cancel};
}
