import {logicalKey} from './keys.js';
import {createLifecycle} from '../app/lifecycle.js';
export function bindPlayerInput({canvas,player,getMode,lock,actions,hideProgress}){
 const life=createLifecycle(),{state,held}=player;
 let timer=null,press=false,longPress=false,tap=false;
 let hide=null,inspecting=false;
 function stopInspection(){if(inspecting){inspecting=false;if(state){state.lastPointer=null;state.edge.until=0;}actions.inspect(false);}}
 const hideDuration=2000;
 function resetHide(){
  hide=null;
  hideProgress.hidden=true;
  hideProgress.value=0;
 }
 function update(now){
  if(!hide)return;
  if(getMode()!=='play'||(hide.id&&actions.aimedId()!==hide.id)){resetHide();return;}
  if(!hide.id)return;
  const fraction=Math.min(1,(now-hide.start)/hideDuration);
  hideProgress.hidden=false;
  hideProgress.value=fraction;
  if(fraction===1){resetHide();actions.exclude();}
 }
 let removal=null;
 function cancelRemoval(){if(removal)clearTimeout(removal.timer);removal=null;}
 function holdWall(button){
  const id=actions.wallPick();
  if(!id)return false;
  cancelRemoval();
  removal={button,timer:setTimeout(()=>{
   removal=null;
   if(getMode()==='play' && actions.wallPick()===id)actions.interact(id);
  },380)};
  return true;
 }
 life.own(cancelRemoval);
 life.listen(window,'pointerup',e=>{
  if(e.button===0&&removal?.button==='mouse')cancelRemoval();
  if(e.button===2)stopInspection();
 });
 life.listen(window,'pointercancel',()=>{cancelRemoval();stopInspection();});
 life.own(stopInspection);
 function resetGesture(){
  cancelRemoval();
  clearTimeout(timer);press=longPress=tap=false;actions.raise(false);
 }
 life.own(()=>clearTimeout(timer));
 life.listen(canvas,'contextmenu',e=>{if(getMode()==='play')e.preventDefault();});
 life.listen(canvas,'pointerdown',e=>{
  if(e.button===2&&getMode()==='play'){e.preventDefault();lock.request?.();inspecting=actions.inspect(true)!==false;if(inspecting&&state){state.lastPointer=null;state.edge.until=0;}}
 });
 let lastPointerMotion=null;
 function moveLook(e){
  if(getMode()!=='play')return;
  if(lock.locked()){state.edge.until=0;player.turn(e.movementX,e.movementY);}
  else{
   if(state.lastPointer)player.turn(e.clientX-state.lastPointer.x,e.clientY-state.lastPointer.y);
   state.lastPointer={x:e.clientX,y:e.clientY};
   const rate=(p,total)=>p<total*.1?-(1-p/(total*.1)):p>total*.9?(p-total*.9)/(total*.1):0;
   state.edge={x:lock.unavailable?rate(e.clientX,innerWidth):0,y:lock.unavailable?rate(e.clientY,innerHeight):0,until:performance.now()+160};
  }
 }
 life.listen(document,'pointermove',e=>{lastPointerMotion={time:e.timeStamp,x:e.clientX,y:e.clientY,dx:e.movementX,dy:e.movementY};moveLook(e);});
 life.listen(document,'mousemove',e=>{
  const p=lastPointerMotion;
  if(p&&Math.abs(e.timeStamp-p.time)<8&&e.clientX===p.x&&e.clientY===p.y&&e.movementX===p.dx&&e.movementY===p.dy)return;
  moveLook(e);
 });
 life.listen(document,'mouseleave',()=>{state.lastPointer=null;state.edge.until=0;});
 life.listen(canvas,'pointerdown',e=>{if(getMode()==='play'&&!inspecting&&e.button===0){lock.request();if(!holdWall('mouse')){actions.interact();resetGesture();}}});
 life.listen(canvas,'wheel',e=>{if(getMode()==='plan'){e.preventDefault();actions.zoom(e.deltaY);}},{passive:false});
 life.listen(window,'keydown',e=>{
  if(document.querySelector('dialog[open]'))return;
  if(e.target instanceof Element&&e.target.closest('.music-controls, #archive-music-toggle'))return;
  if(e.target instanceof Element&&e.target.closest('input,select,textarea,[contenteditable="true"]'))return;
  const key=logicalKey(e),mode=getMode();
  if(mode==='loading')return;
  if(['tab',' ','w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key))e.preventDefault();
  if(e.repeat){if(mode==='play'&&['w','a','s','d','shift','arrowup','arrowdown','arrowleft','arrowright'].includes(key))held.add(key);return;}
  if(key==='tab'){actions.plan();return;}
  if(e.code==='KeyL'&&mode==='play'){player.level();return;}
  if(key==='escape'){if(lock.justReleasedByBrowser())return;mode==='intro'?actions.play():actions.pause();return;}
  if(mode!=='play')return;
  if(key===' '||key==='p'){actions.pause();return;}if(key==='h')actions.hints();
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  if(key==='q'){e.preventDefault();stopInspection();resetGesture();resetHide();actions.openPainting?.();return;}
  if(key==='f'){e.preventDefault();hide={id:actions.aimedId(),start:performance.now()};return;}
  if(key==='e'){
   if(inspecting)return;
   if(press)return;
   press=true;if(holdWall('key'))return;tap=actions.canRaise();
   if(!tap)actions.interact();
   if(actions.canRaise())timer=setTimeout(()=>{
    if(getMode()==='play' && actions.canRaise()){longPress=true;actions.raise(true);}
   },230);
   return;
  }
  if(key==='enter')actions.interact();held.add(key);
 });
 life.listen(window,'keyup',e=>{held.delete(logicalKey(e));
  if(logicalKey(e)==='f'&&hide){
   const now=performance.now(),short=now-hide.start<hideDuration;
   if(!short)update(now);
   resetHide();
   // F remains the deliberate hold-to-exclude shortcut; inspection uses held RMB.
  }
  if(logicalKey(e)==='e' && press){
   const commit=tap && !longPress && !inspecting && getMode()==='play';
   if(commit)actions.interact();resetGesture();
  }
  if(e.key==='Escape')lock.clearBrowserRelease();});
 life.listen(window,'blur',()=>{stopInspection();player.clearInput();if(getMode()==='play')actions.pause();});
 return {...life,update,resetGesture(){stopInspection();resetGesture();resetHide();player.zoom(false);}};
}
