// Scene hit testing and inspection; no ownership of lock mechanics.
import {isPlugBoreOpening} from '../geometry/pin-bores.js';
export function createScenePointerInteractions({THREE,$,canvas,camera,raycastables,inspectionWindow,
  mat,plugSurface,plugSideReveal,plugCutStart,plugCutEnd,getPinPuzzle,getPinXs,
  pinStacks,state,dispatch,shacklePivot,status,window}) {
  const raycaster=new THREE.Raycaster(), pointer=new THREE.Vector2(),tooltip=$('tooltip');
  let pointerStart=null,dragged=false;
  function findTarget(event){
    const r=canvas.getBoundingClientRect();
    pointer.set(((event.clientX-r.left)/r.width)*2-1,-((event.clientY-r.top)/r.height)*2+1);
    raycaster.setFromCamera(pointer,camera);
    const hits=raycaster.intersectObjects(raycastables.filter(o=>o.visible&&isVisibleTree(o)),false);
    for(const hit of hits){
      if(hit.object===inspectionWindow&&mat.glass.opacity<.8)continue;
      if(hit.object===plugSurface){
        const local=plugSurface.worldToLocal(hit.point.clone());
        if(isPlugBoreOpening(local,getPinXs()))continue;
        if(plugSideReveal.value>.75&&
          local.x>plugCutStart.value&&local.x<plugCutEnd.value)continue;
      }
      if(hit.object.material?.transparent&&hit.object.material.opacity<.20)continue;
      return hit.object;
    }
    return null;
  }
  function isVisibleTree(o){let a=o;while(a){if(a.visible===false)return false;a=a.parent;}return true;}
  canvas.addEventListener('pointerdown',e=>{pointerStart={x:e.clientX,y:e.clientY};dragged=false;tooltip.style.display='none';});
  canvas.addEventListener('pointermove',e=>{
    if(pointerStart&&Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)>4)dragged=true;
    if(e.buttons!==0)return;
    const obj=findTarget(e);
    if(obj&&obj.userData.partName){
      tooltip.textContent=obj.userData.partName+(obj.userData.partDescription?' · '+obj.userData.partDescription:'');
      tooltip.style.display='block';tooltip.style.left=Math.min(window.innerWidth-330,e.clientX+15)+'px';
      tooltip.style.top=Math.min(window.innerHeight-70,e.clientY+17)+'px';
      canvas.style.cursor='help';
    }else{tooltip.style.display='none';canvas.style.cursor='grab';}
  });
  canvas.addEventListener('pointerup',e=>{
    if(!dragged&&pointerStart){
      const obj=findTarget(e);
      if(state.mode==='plate'&&Number.isInteger(obj?.userData.plateIndex)){
        dispatch({type:'plate-select',index:obj.userData.plateIndex},{source:'scene'});
        pointerStart=null;return;
      }
      if(getPinPuzzle()&&state.mode==='pin'){
        const touched=pinStacks.find(st=>st.i<getPinXs().length&&(obj===st.pin||obj===st.driver));
        if(touched){dispatch({type:'puzzle-select',index:touched.i,press:true},{source:'scene'});
          pointerStart=null;return;}
      }
      let parent=obj;
      while(parent&&parent!==shacklePivot)parent=parent.parent;
      if(parent===shacklePivot)dispatch({type:'open'},{source:'scene'});
      else if(obj?.userData.partName)status(obj.userData.partName+' — '+(obj.userData.partDescription||'деталь механизма'));
    }
    pointerStart=null;
  });
  canvas.addEventListener('pointerleave',()=>{pointerStart=null;tooltip.style.display='none';});
  return {raycaster,pointer,isVisibleTree,tooltip,
    cancelPointerClick:()=>{pointerStart=null;}};
}
