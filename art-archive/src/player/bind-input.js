import {logicalKey} from './keys.js';
import {createLifecycle} from '../app/lifecycle.js';
export function bindPlayerInput({canvas,player,getMode,lock,actions}){
 const life=createLifecycle(),{state,held}=player;
 let timer=null,press=false,longPress=false,tap=false,rightRaised=false;
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
 life.listen(window,'pointerup',e=>{if(e.button===0 && removal?.button==='mouse')cancelRemoval();});
 life.listen(window,'pointercancel',cancelRemoval);
 function resetGesture(){
  cancelRemoval();
  clearTimeout(timer);press=longPress=tap=rightRaised=false;actions.raise(false);
 }
 life.own(()=>clearTimeout(timer));
 life.listen(canvas,'contextmenu',e=>{if(getMode()==='play')e.preventDefault();});
 life.listen(canvas,'pointerdown',e=>{
  if(e.button===2 && getMode()==='play' && actions.canRaise()){
   rightRaised=!rightRaised;actions.raise(rightRaised || longPress);
  }
 });
 life.listen(document,'mousemove',e=>{
  if(getMode()!=='play')return;
  if(lock.locked()){state.edge.until=0;player.turn(e.movementX,e.movementY);}
  else{
   if(state.lastPointer)player.turn(e.clientX-state.lastPointer.x,e.clientY-state.lastPointer.y);
   state.lastPointer={x:e.clientX,y:e.clientY};
   const rate=(p,total)=>p<total*.1?-(1-p/(total*.1)):p>total*.9?(p-total*.9)/(total*.1):0;
   state.edge={x:lock.unavailable?rate(e.clientX,innerWidth):0,y:lock.unavailable?rate(e.clientY,innerHeight):0,until:performance.now()+160};
  }
 });
 life.listen(document,'mouseleave',()=>{state.lastPointer=null;state.edge.until=0;});
 life.listen(canvas,'pointerdown',e=>{if(getMode()==='play'&&e.button===0){lock.request();if(!holdWall('mouse')){actions.interact();resetGesture();}}});
 life.listen(canvas,'wheel',e=>{if(getMode()==='plan'){e.preventDefault();actions.zoom(e.deltaY);}},{passive:false});
 life.listen(window,'keydown',e=>{
  if(document.querySelector('dialog[open]'))return;
  if(e.target instanceof Element&&e.target.closest('input,select,textarea,[contenteditable="true"]'))return;
  const key=logicalKey(e),mode=getMode();
  if(['tab',' ','w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key))e.preventDefault();
  if(e.repeat){if(mode==='play'&&['w','a','s','d','shift','arrowup','arrowdown','arrowleft','arrowright'].includes(key))held.add(key);return;}
  if(key==='tab'){actions.plan();return;}if(key==='f2'){e.preventDefault();actions.scale();return;}
  if(e.code==='KeyL'&&mode==='play'){player.level();return;}
  if(key==='escape'){if(lock.justReleasedByBrowser())return;mode==='intro'?actions.play():actions.pause();return;}
  if(mode!=='play')return;
  if(key===' '||key==='p'){actions.pause();return;}if(key==='h')actions.hints();
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  if(key==='f'){e.preventDefault();actions.inspect();return;}
  if(key==='q'){e.preventDefault();actions.exclude();return;}
  if(key==='r'){actions.drop();return;}
  if(key==='e'){
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
  if(logicalKey(e)==='e' && press){
   const commit=tap && !longPress && getMode()==='play' && actions.canRaise();
   if(commit)actions.interact();resetGesture();
  }
  if(e.key==='Escape')lock.clearBrowserRelease();});
 life.listen(window,'blur',()=>{player.clearInput();if(getMode()==='play')actions.pause();});
 return {...life,resetGesture};
}
