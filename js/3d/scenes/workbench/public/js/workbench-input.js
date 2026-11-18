import {applyFilingStroke,assistedFilingStroke,BREAK_CUT,cutTolerance} from './logic.js';
import {createWorkbenchCameraGestures} from './workbench-camera-input.js';

export function installWorkbenchInput({canvas,state,scene,save,toast,measuredCuts,
  inspectCurrentKey,selectCut,renderCuts,
  releaseCapture,inspectKeyButton,onCameraUnlocked,onAssemblySelect,
  onGearChange,
  isActive=()=>true}){
const subscriptions=[];
let loosePointer=null;
let pendingDetach=null;
let shacklePointer=null,shackleLastX=0,shackleLastY=0;
let ragPointer=null,ragContactStarted=false;
let gearPointer=null,gearLastX=0,gearLastY=0;
const cameraGestures=createWorkbenchCameraGestures({canvas,state,scene,
  releaseCapture,onCameraUnlocked});
const toolPointer=(event)=>scene.pointerToolPoint?.(
  event.clientX,event.clientY,scene.interactionPlaneY?.());
function listen(target,type,handler){
  target.addEventListener(type,handler);
  subscriptions.push([target,type,handler]);
}
function armDetachment(event,kind,id,point){
  pendingDetach={pointerId:event.pointerId,kind,id,point,
    x:event.clientX,y:event.clientY};
  scene.setHoveredDetachable?.(null);
  canvas.setPointerCapture(event.pointerId);
  canvas.style.cursor='grab';
  event.preventDefault();
}
function dropRag(pointerId){
  if(ragPointer!==pointerId)return false;
  scene.setRagContact?.(false);scene.setWiping?.(false);
  scene.setToolHeld?.(false);
  state.wiping=false;state.heldTool=null;
  ragPointer=null;ragContactStarted=false;
  releaseCapture(pointerId);
  return true;
}
function strokeAt(index,pixels,pulse){
  if(index<0||inspectCurrentKey().brokenAt>=0)return false;
  if(index!==state.activeCut)selectCut(index);
  const before=state.cuts[index];
  const stroke=state.keyMethod!=='guided'?applyFilingStroke(state.cuts[index],pixels):
    assistedFilingStroke(state.cuts[index],pixels,state.targets[index]);
  const next=Math.max(state.cuts[index],Math.min(BREAK_CUT,stroke));
  if(next!==state.cuts[index]){
    state.keyInspection=null;
    state.cuts[index]=next;scene.setCuts(state.cuts);renderCuts();
    if(next>=BREAK_CUT){
      state.filing=false;state.spaceFiling=false;scene.setFiling(false);
      releaseCapture(state.filingPointer);
      save();toast('Пропил насквозь! Часть ключа отломилась и упала.');
      return false;
    }
    if(state.keyMethod==='guided'&&measuredCuts()[index]>state.targets[index]+cutTolerance(state.targets[index])&&
      !state.warnedOvercut[index]){
      state.warnedOvercut[index]=true;toast(`Зубец ${index+1} выпилен слишком глубоко.`);
    }
  }
  scene.filingPulse(pulse);
  if(next>before)scene.filingChips(Math.abs(pulse));
  return true;
}
listen(canvas,'pointerdown',event=>{
  if(event.button===1&&['assembly','gears'].includes(state.mode)&&!state.testing){
    cameraGestures.beginPan(event);return;
  }
  if(event.button===2&&['assembly','gears'].includes(state.mode)&&!state.testing){
    cameraGestures.beginRotation(event);
    return;
  }
  if(event.button!==0||state.testing)return;
  if(event.shiftKey||event.metaKey||event.ctrlKey){
    if(['assembly','gears'].includes(state.mode))cameraGestures.beginPan(event);
    else{state.cameraDragging=true;canvas.style.cursor='grabbing';}
    return;
  }
  const hit=scene.hitTest(event.clientX,event.clientY,Boolean(state.wiping),true);
  if(state.mode==='assembly')onAssemblySelect?.(hit);
  if(state.mode==='key'){
    if(hit?.kind!=='cut'){state.cameraDragging=true;canvas.style.cursor='grabbing';return;}
    if(state.cuts.some(value=>value>=BREAK_CUT)){
      toast('Ключ переломлен. Установите новую заготовку.');return;
    }
    selectCut(hit.index);
    canvas.style.cursor='crosshair';
    scene.setFilePointer(event.clientX,event.clientY);
    state.filing=true;scene.setFiling(true);
    state.lastPointerX=event.clientX;state.lastPointerY=event.clientY;
    state.filingPointer=event.pointerId;canvas.setPointerCapture(event.pointerId);
    event.preventDefault();return;
  }
  if(hit?.kind==='oilCan'){
    const pickUp=state.heldTool!=='oiler';
    if(state.heldTool==='rag')dropRag(ragPointer);
    if(state.heldTool==='screwdriver')scene.setScrewdriverHeld?.(false);
    state.heldTool=pickUp?'oiler':null;
    scene.setOilerHeld?.(pickUp);
    onGearChange?.();
    toast(pickUp?'Маслёнка в руке. Нажмите на деталь, чтобы смазать её.':
      'Маслёнка возвращена на стол.');
    event.preventDefault();return;
  }
  if(state.heldTool==='oiler'){
    const applied=scene.oilPart?.(hit);
    if(applied)toast(hit?.kind==='gearWheel'?`Шестерня №${hit.index+1} смазана.`:
      'Масло нанесено на деталь.');
    onGearChange?.();event.preventDefault();return;
  }
  if(state.mode==='gears'){
    if(hit?.kind==='gearWheel'){
      if(hit.index===0){
        gearPointer=event.pointerId;gearLastX=event.clientX;gearLastY=event.clientY;
        canvas.setPointerCapture(event.pointerId);
        canvas.style.cursor='grabbing';
      }else toast('Вращайте ведущую шестерню слева. Остальные связаны с ней.');
    }else if(!hit){cameraGestures.beginPan(event);return;}
    event.preventDefault();return;
  }
  if(hit?.kind==='loose'){
    if(state.heldTool){toast('Сначала положите инструмент.');return;}
    if(scene.beginLooseDrag?.(hit.index,hit.point)){
      loosePointer=event.pointerId;
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor='grabbing';event.preventDefault();
    }
    return;
  }
  if(hit?.kind==='internal'){
    if(state.heldTool){toast('Сначала положите инструмент.');return;}
    const status=scene.canDetachPart?.(hit.id);
    if(status&&!status.allowed){toast(status.reason);event.preventDefault();return;}
    armDetachment(event,'internal',hit.id,hit.point);
    return;
  }
  if(hit?.kind==='shackle'){
    if(state.heldTool){toast('Сначала положите инструмент.');return;}
    if(scene.canDetachPart?.('shackle-0')?.allowed){
      armDetachment(event,'internal','shackle-0',hit.point);
      return;
    }
    shacklePointer=event.pointerId;shackleLastX=event.clientX;shackleLastY=event.clientY;
    scene.setShacklePull?.(true);
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor='grabbing';event.preventDefault();return;
  }
  if(hit?.kind==='screw'){
    if(state.heldTool!=='screwdriver'){
      if(state.heldTool==='rag'){
        dropRag(ragPointer);
      }
      state.heldTool='screwdriver';
      scene.setScrewdriverHeld?.(true);
      scene.setToolHeld?.(true);
    }
    const result=scene.unscrewCorner?.(hit.index);
    if(result){
      if(scene.remainingScrews?.()===0){
        state.heldTool=null;
        scene.stowScrewdriver?.();scene.setToolHeld?.(false);
        toast('Последний винт выкручен. Отвёртка возвращается на стол.');
      }else toast(`Выкручиваем винт ${hit.index+1} из 4 — он упадёт на стол.`);
    }
    event.preventDefault();return;
  }
  if(hit?.kind==='cover'){
    if(state.heldTool){toast('Сначала положите инструмент на стол.');event.preventDefault();return;}
    if(!scene.canRemoveCover?.())toast('Сначала выкрутите все четыре винта.');
    else armDetachment(event,'cover','cover',hit.point);
    event.preventDefault();return;
  }
  if(hit?.kind==='rag'){
    if(state.heldTool==='screwdriver')scene.setScrewdriverHeld?.(false);
    state.heldTool='rag';state.wiping=true;
    ragPointer=event.pointerId;ragContactStarted=false;
    scene.setWiping?.(true);
    scene.captureRagGrip?.(toolPointer(event));
    scene.setToolHeld?.(true);
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor='grabbing';
    event.preventDefault();return;
  }
  if(hit?.kind==='screwdriver'){
    if(state.heldTool==='rag')scene.setWiping?.(false);
    state.wiping=false;state.heldTool='screwdriver';
    scene.setScrewdriverHeld?.(true);
    const initialTip=toolPointer(event);
    if(initialTip)scene.moveHeldTool?.(initialTip);
    scene.setToolHeld?.(true);
    toast('Отвёртка в руке. Нажимайте на винты — они выкрутятся сами.');
    event.preventDefault();return;
  }
  if(state.heldTool){
    const point=toolPointer(event);
    if(point)scene.moveHeldTool?.(point);
    if(state.heldTool==='rag'){scene.setRagContact?.(false);scene.setWiping?.(false);}
    if(state.heldTool==='screwdriver')scene.setScrewdriverHeld?.(false);
    state.wiping=false;state.heldTool=null;
    scene.setToolHeld?.(false);
    toast('Инструмент оставлен на столе.');event.preventDefault();return;
  }
  if(state.mode==='assembly'){
    if(!hit)cameraGestures.beginPan(event);
    return;
  }
  state.cameraDragging=!scene.isAssemblyCameraLocked?.();
  canvas.style.cursor=state.cameraDragging?'grabbing':'default';
});
listen(canvas,'pointermove',event=>{
  if(cameraGestures.move(event))return;
  if(gearPointer===event.pointerId){
    const dx=event.clientX-gearLastX,dy=event.clientY-gearLastY;
    gearLastX=event.clientX;gearLastY=event.clientY;
    const result=scene.turnGear?.((dx-dy*.30)*.0045);
    onGearChange?.();
    if(result?.open)toast('Зубчатый привод освободил дужку замка!');
    event.preventDefault();return;
  }
  if(ragPointer===event.pointerId){
    const stillHeld=Boolean(event.buttons&1);
    if(!stillHeld){dropRag(event.pointerId);return;}
    const point=toolPointer(event);
    if(point)scene.moveHeldTool?.(point);
    const contact=scene.hitTest(event.clientX,event.clientY,true);
    if(contact?.kind==='dust'){
      scene.setRagContact?.(true);
      scene.wipeDust?.(contact.uv,true);
      if(!ragContactStarted)scene.puffDust?.(contact.uv);
      ragContactStarted=true;
    }else{
      scene.setRagContact?.(false);ragContactStarted=false;
    }
    canvas.style.cursor='grabbing';
    event.preventDefault();return;
  }
  if(pendingDetach&&pendingDetach.pointerId===event.pointerId){
    const travel=Math.hypot(event.clientX-pendingDetach.x,
      event.clientY-pendingDetach.y);
    if(travel>=6){
      const pending=pendingDetach;
      const started=pending.kind==='cover'?
        scene.beginLooseDrag?.('cover',pending.point):
        scene.beginInternalDrag?.(pending.id,pending.point);
      pendingDetach=null;
      if(started){
        loosePointer=event.pointerId;
        const point=toolPointer(event);
        if(point)scene.moveLooseDrag?.(point);
        canvas.style.cursor='grabbing';
      }else releaseCapture(event.pointerId);
    }
    event.preventDefault();return;
  }
  if(loosePointer===event.pointerId){
    const point=toolPointer(event);
    if(point)scene.moveLooseDrag?.(point);
    event.preventDefault();return;
  }
  if(shacklePointer===event.pointerId){
    const travel=Math.hypot(event.clientX-shackleLastX,event.clientY-shackleLastY);
    shackleLastX=event.clientX;shackleLastY=event.clientY;
    scene.setShacklePull?.(true,travel);
    event.preventDefault();return;
  }
  if(state.mode==='key'&&state.filing){
    // Drag the file freely across the workpiece. The scene constrains only
    // penetration into the brass, never the player's horizontal movement.
    const dx=event.clientX-state.lastPointerX,dy=event.clientY-state.lastPointerY;
    state.lastPointerX=event.clientX;state.lastPointerY=event.clientY;
    const axial=scene.fileStrokePixels(dx,dy);
    scene.setFilePointer(event.clientX,event.clientY);
    const aiming=scene.hitTest(event.clientX,event.clientY);
    if(aiming?.kind==='cut'&&aiming.index!==state.activeCut){
      selectCut(aiming.index);renderCuts();
    }
    const travel=Math.min(85,Math.abs(axial));
    if(travel>=.5){
      const index=scene.filingContact();
      if(index>=0)strokeAt(index,travel,axial/65);
    }
    event.preventDefault();return;
  }
  let hoverHit=null;
  if(state.mode==='key'&&!state.cameraDragging&&!(event.buttons&2)){
    scene.setFilePointer(event.clientX,event.clientY);
    hoverHit=scene.hitTest(event.clientX,event.clientY,Boolean(state.wiping));
    if(hoverHit?.kind==='cut'&&hoverHit.index!==state.activeCut){
      // Hover instantly becomes the active (and sole highlighted) zone.
      selectCut(hoverHit.index);renderCuts();
    }
  }
  if(state.mode==='assembly'&&!state.cameraDragging){
    hoverHit=scene.hitTest(event.clientX,event.clientY,Boolean(state.wiping));
    scene.setHoveredDetachable?.(state.heldTool?null:hoverHit);
    if(state.heldTool){
      const point=toolPointer(event);
      if(point){
        if(state.heldTool==='oiler')scene.moveOiler?.(point);
        else scene.moveHeldTool?.(point);
      }
    }
  }
  if(state.mode==='gears'&&!state.cameraDragging){
    hoverHit=scene.hitTest(event.clientX,event.clientY);
    scene.setGearHover?.(hoverHit);
    if(state.heldTool==='oiler'){
      const point=toolPointer(event);if(point)scene.moveOiler?.(point);
    }
  }
  if(!state.filing){
    canvas.style.cursor=state.cameraDragging?'grabbing':
      (hoverHit?.kind==='cut'?'crosshair':
      ['screw','rag','screwdriver','oilCan','gearWheel','cover','loose','internal','shackle'].includes(hoverHit?.kind)?'pointer':
      hoverHit?.kind==='dust'&&state.wiping?'crosshair':
      'grab');
  }
});
listen(canvas,'pointerleave',()=>{
  if(!state.filing)scene.setFilePointerActive(false);
  scene.setRagContact?.(false);
  scene.setHoveredDetachable?.(null);
  scene.setGearHover?.(null);
});
listen(canvas,'pointerup',event=>{
  if(cameraGestures.endPan(event.pointerId))return;
  state.cameraDragging=false;
  canvas.style.cursor='grab';
  if(cameraGestures.stopRotation(event.pointerId))return;
  if(gearPointer===event.pointerId){gearPointer=null;releaseCapture(event.pointerId);return;}
  if(dropRag(event.pointerId))return;
  if(pendingDetach&&pendingDetach.pointerId===event.pointerId){
    pendingDetach=null;releaseCapture(event.pointerId);return;
  }
  if(loosePointer===event.pointerId){
    scene.endLooseDrag?.();loosePointer=null;
    releaseCapture(event.pointerId);return;
  }
  if(shacklePointer===event.pointerId){
    shacklePointer=null;scene.setShacklePull?.(false);
    releaseCapture(event.pointerId);return;
  }
  if(state.filing){
    state.filing=false;scene.setFiling(state.spaceFiling);releaseCapture(event.pointerId);save();
    const box=canvas.getBoundingClientRect();
    if(event.clientX>=box.left&&event.clientX<=box.right&&
      event.clientY>=box.top&&event.clientY<=box.bottom)
      scene.setFilePointer(event.clientX,event.clientY);
    else scene.setFilePointerActive(false);
    if(state.keyMethod==='guided'&&state.cuts[state.activeCut]>=state.targets[state.activeCut]*.95){
      const next=state.targets.findIndex((target,i)=>state.cuts[i]<target*.95);
      if(next>=0){selectCut(next);renderCuts();}
    }
    return;
  }
});
listen(canvas,'pointercancel',event=>{
  if(cameraGestures.endPan(event.pointerId))return;
  if(cameraGestures.stopRotation(event.pointerId))return;
  if(gearPointer===event.pointerId){gearPointer=null;releaseCapture(event.pointerId);return;}
  if(dropRag(event.pointerId))return;
  if(pendingDetach&&pendingDetach.pointerId===event.pointerId)pendingDetach=null;
  if(loosePointer===event.pointerId){scene.endLooseDrag?.();loosePointer=null;}
  if(shacklePointer===event.pointerId){shacklePointer=null;scene.setShacklePull?.(false);}
  scene.setRagContact?.(false);
  scene.setHoveredDetachable?.(null);
  state.filing=false;state.spaceFiling=false;scene.setFiling(false);
  state.cameraDragging=false;
  canvas.style.cursor='grab';
  releaseCapture(event.pointerId);
});

listen(window,'keydown',event=>{
  if(!isActive())return;
  if(event.code==='Escape'&&state.wiping){
    if(ragPointer!==null)dropRag(ragPointer);
    else{
      state.wiping=false;state.heldTool=null;
      scene.setRagContact?.(false);scene.setWiping?.(false);
      scene.setToolHeld?.(false);
    }
    toast('Ветошь положена на стол.');event.preventDefault();return;
  }
  if(event.code==='Escape'&&state.heldTool==='screwdriver'){
    state.heldTool=null;scene.setScrewdriverHeld?.(false);
    scene.setToolHeld?.(false);
    toast('Отвёртка положена на стол.');event.preventDefault();return;
  }
  if(event.code==='Escape'&&state.heldTool==='oiler'){
    state.heldTool=null;scene.setOilerHeld?.(false);onGearChange?.();
    toast('Маслёнка положена на стол.');event.preventDefault();return;
  }
  if(event.metaKey||event.ctrlKey||event.altKey||event.target?.closest?.('input,textarea,select'))return;
  if(state.mode==='key'){
    if(event.code==='Space'){
      event.preventDefault();
      if(!event.repeat&&!state.testing&&inspectCurrentKey().brokenAt<0){
        state.spaceFiling=true;scene.setFiling(true);
      }
    }else if(event.code==='KeyQ'||event.code==='KeyE'){
      event.preventDefault();scene.rotateFile(event.code==='KeyQ'?-.09:.09);
    }else if(event.code==='KeyA'||event.code==='ArrowLeft'){
      event.preventDefault();selectCut((state.activeCut+state.difficulty-1)%state.difficulty);renderCuts();}
    else if(event.code==='KeyD'||event.code==='ArrowRight'){
      event.preventDefault();selectCut((state.activeCut+1)%state.difficulty);renderCuts();}
    else if(event.code==='Enter'){event.preventDefault();inspectKeyButton.click();}
  }
  if(event.code==='Escape'){
    state.filing=false;state.spaceFiling=false;scene.setFiling(false);
    releaseCapture(state.filingPointer);
    state.cameraDragging=false;
  }
});

listen(window,'keyup',event=>{
  if(!isActive())return;
  if(event.code==='Space'&&state.spaceFiling){
    event.preventDefault();state.spaceFiling=false;scene.setFiling(state.filing);save();
  }
});
listen(window,'blur',()=>{
  if(!isActive())return;
  cameraGestures.cancel();
  state.spaceFiling=false;scene.setFiling(state.filing);
  if(!state.filing)scene.setFilePointerActive(false);
});

// Holding Space produces continuous filing strokes even without mouse travel.
// Each stroke is assigned to the tooth actually under the file.
let previousSpaceTick=performance.now();
const spaceTimer=setInterval(()=>{
  const now=performance.now();
  const elapsed=Math.min(.09,Math.max(0,(now-previousSpaceTick)/1000));
  previousSpaceTick=now;
  if(!isActive())return;
  if(!state.spaceFiling||state.filing||state.mode!=='key'||state.testing)return;
  const index=scene.filingContact();
  if(index>=0)strokeAt(index,elapsed*120,Math.sin(now*.024)*.38);
},55);

  return ()=>{
    clearInterval(spaceTimer);
    cameraGestures.dispose();
    if(gearPointer!==null){releaseCapture(gearPointer);gearPointer=null;}
    if(ragPointer!==null)dropRag(ragPointer);
    if(pendingDetach){releaseCapture(pendingDetach.pointerId);pendingDetach=null;}
    if(loosePointer!==null){scene.endLooseDrag?.();releaseCapture(loosePointer);loosePointer=null;}
    if(shacklePointer!==null){scene.setShacklePull?.(false);
      releaseCapture(shacklePointer);shacklePointer=null;}
    if(state.filing){state.filing=false;scene.setFiling(false);
      if(state.filingPointer!==undefined)releaseCapture(state.filingPointer);}
    if(state.spaceFiling){state.spaceFiling=false;scene.setFiling(false);}
    state.cameraDragging=false;
    for(const [target,type,handler] of subscriptions)target.removeEventListener(type,handler);
  };
}
