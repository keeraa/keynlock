import {applyFilingStroke,assistedFilingStroke,BREAK_CUT,cutTolerance} from './logic.js';

export function installWorkbenchInput({canvas,state,scene,save,toast,measuredCuts,
  inspectCurrentKey,selectCut,renderCuts,renderSelection,removePart,placement,
  testMechanism,releaseCapture,inspectKeyButton,isActive=()=>true}){
const subscriptions=[];
function listen(target,type,handler){
  target.addEventListener(type,handler);
  subscriptions.push([target,type,handler]);
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
  if(event.button!==0||state.testing)return;
  if(event.shiftKey||event.metaKey||event.ctrlKey){
    state.cameraDragging=true;return;
  }
  const hit=scene.hitTest(event.clientX,event.clientY,
    state.mode==='assembly'?state.selectedPart:null);
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
  if(hit?.kind==='slot'&&state.selectedPart){
    placement(state.selectedPart,hit.id);event.preventDefault();return;
  }
  if(hit?.kind==='part'){
    state.selectedPart=hit.id;scene.setSelectedPart(hit.id);
    renderSelection();
    state.drag={id:hit.id,x:event.clientX,y:event.clientY,moved:false,
      originalSlot:Object.keys(state.installed).find(slot=>state.installed[slot]===hit.id)||null};
    canvas.setPointerCapture(event.pointerId);event.preventDefault();return;
  }
  state.cameraDragging=true;canvas.style.cursor='grabbing';
  state.selectedPart=null;scene.setSelectedPart(null);renderSelection();
});
listen(canvas,'pointermove',event=>{
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
    hoverHit=scene.hitTest(event.clientX,event.clientY);
    if(hoverHit?.kind==='cut'&&hoverHit.index!==state.activeCut){
      // Hover instantly becomes the active (and sole highlighted) zone.
      selectCut(hoverHit.index);renderCuts();
    }
  }
  if(!state.filing&&!state.drag){
    canvas.style.cursor=state.cameraDragging?'grabbing':
      (hoverHit?.kind==='cut'?'crosshair':'grab');
  }
  if(state.mode==='assembly'&&state.drag){
    const drag=state.drag;
    if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>6)drag.moved=true;
    if(drag.moved){const point=scene.pointerPoint(event.clientX,event.clientY);
      scene.movePart(drag.id,point);event.preventDefault();}
  }
});
listen(canvas,'pointerleave',()=>{
  if(!state.filing)scene.setFilePointerActive(false);
});
listen(canvas,'pointerup',event=>{
  state.cameraDragging=false;
  canvas.style.cursor='grab';
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
  const drag=state.drag;
  if(!drag)return;
  state.drag=null;releaseCapture(event.pointerId);
  if(!drag.moved)return;
  const point=scene.pointerPoint(event.clientX,event.clientY);
  if(drag.originalSlot&&point.y<-1.05){removePart(drag.id);return;}
  const socket=scene.findNearestSocket(drag.id,point);
  if(socket)placement(drag.id,socket);
  else{
    // Return to the previous valid socket or its original position.
    scene.updateInstalled(state.installed);scene.setSelectedPart(drag.id);
    if(!drag.originalSlot)toast('Отпустите деталь над подходящим гнездом.');
  }
});
listen(canvas,'dblclick',event=>{
  if(state.mode!=='assembly'||state.testing||event.metaKey||event.ctrlKey)return;
  const hit=scene.hitTest(event.clientX,event.clientY);
  if(hit?.kind==='part')removePart(hit.id);
});
listen(canvas,'pointercancel',event=>{
  state.filing=false;state.spaceFiling=false;scene.setFiling(false);
  state.drag=null;state.cameraDragging=false;
  canvas.style.cursor='grab';
  releaseCapture(event.pointerId);
  scene.updateInstalled(state.installed);scene.setSelectedPart(null);
});

listen(window,'keydown',event=>{
  if(!isActive())return;
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
  }else if(state.mode==='assembly'&&event.code==='Space'){
    event.preventDefault();testMechanism();
  }else if(state.mode==='assembly'&&(event.code==='Delete'||event.code==='Backspace')){
    if(state.selectedPart){event.preventDefault();removePart(state.selectedPart);}
  }
  if(event.code==='Escape'){
    state.filing=false;state.spaceFiling=false;scene.setFiling(false);
    releaseCapture(state.filingPointer);
    state.drag=null;state.cameraDragging=false;
    state.selectedPart=null;scene.setSelectedPart(null);
    scene.updateInstalled(state.installed);
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
    for(const [target,type,handler] of subscriptions)target.removeEventListener(type,handler);
  };
}
