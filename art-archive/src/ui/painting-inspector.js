import {createLifecycle} from '../app/lifecycle.js';
import {t,paintingTitle,paintingArtist} from '../localization/i18n.js';
import {logicalKey} from '../player/keys.js';

export function createPaintingInspector({elements,catalog,setMode}) {
  const life=createLifecycle(),dialog=elements('art-inspector'),image=elements('inspect-image');
  const viewport=elements('inspect-viewport'),actual=elements('inspect-zoom'),fit=elements('inspect-fit');
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  let generation=0,level=1,panX=0,panY=0,width=0,height=0,drag=null,pending=null;
  function bounds(){
    const w=viewport.clientWidth,h=viewport.clientHeight;
    const base=width&&height?Math.min(w/width,h/height):1;
    return {w,h,base,iw:width*base*level,ih:height*base*level};
  }
  function render(){
    if(!width||!height)return;
    const {w,h,base,iw,ih}=bounds();
    panX=clamp(panX,-Math.max(0,(iw-w)/2),Math.max(0,(iw-w)/2));
    panY=clamp(panY,-Math.max(0,(ih-h)/2),Math.max(0,(ih-h)/2));
    image.style.width=width+'px';image.style.height=height+'px';
    image.style.transform=`translate(${(w-iw)/2+panX}px,${(h-ih)/2+panY}px) scale(${base*level})`;
    viewport.classList.toggle('can-pan',iw>w+.5||ih>h+.5);
    viewport.dataset.zoom=String(level);viewport.dataset.panX=String(panX);viewport.dataset.panY=String(panY);
    const isFit=Math.abs(level-1)<.001;
    fit.textContent=t(isFit?'Заполнить экран':'Вписать целиком');fit.setAttribute('aria-pressed',String(isFit));
    actual.setAttribute('aria-pressed',String(Math.abs(base*level-1)<.001));
    elements('inspect-scale').textContent=Math.round(base*level*100)+'%';
  }
  function changeZoom(next,x=viewport.clientWidth/2,y=viewport.clientHeight/2){
    if(!width||!height)return;
    const {w,h,base,iw,ih}=bounds();
    const u=(x-(w-iw)/2-panX)/iw,v=(y-(h-ih)/2-panY)/ih;
    level=clamp(next,.5,Math.max(16,1/base));
    const nw=width*base*level,nh=height*base*level;
    panX=x-(w-nw)/2-u*nw;panY=y-(h-nh)/2-v*nh;render();
  }
  function endDrag(){
    const previous=drag;drag=null;viewport.classList.toggle('dragging',false);
    if(previous&&viewport.hasPointerCapture?.(previous.id))viewport.releasePointerCapture(previous.id);
  }
  function clearPending(){if(pending){pending.onload=pending.onerror=null;pending=null;}}
  life.listen(image,'load',()=>{if(!dialog.open)return;width=image.naturalWidth;height=image.naturalHeight;render();});
  life.listen(image,'dragstart',event=>event.preventDefault());
  life.listen(window,'resize',render);
  life.listen(viewport,'wheel',event=>{
    event.preventDefault();
    const rect=viewport.getBoundingClientRect(),unit=event.deltaMode===1?16:event.deltaMode===2?viewport.clientHeight:1;
    changeZoom(level*Math.exp(-event.deltaY*unit*.0015),event.clientX-rect.left,event.clientY-rect.top);
  },{passive:false});
  life.listen(viewport,'pointerdown',event=>{
    if(event.button!==0)return;
    event.preventDefault();drag={id:event.pointerId,x:event.clientX,y:event.clientY,panX,panY};
    viewport.setPointerCapture?.(event.pointerId);viewport.classList.toggle('dragging',true);
  });
  life.listen(viewport,'pointermove',event=>{
    if(!drag||event.pointerId!==drag.id)return;
    panX=drag.panX+event.clientX-drag.x;panY=drag.panY+event.clientY-drag.y;render();
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture'])life.listen(viewport,event,endDrag);
  life.listen(elements('inspect-minus'),'click',()=>changeZoom(level/1.25));
  life.listen(elements('inspect-plus'),'click',()=>changeZoom(level*1.25));
  life.listen(fit,'click',()=>{
    const {w,h,base}=bounds();
    const next=Math.abs(level-1)<.001?Math.max(w/width,h/height)/base:1;
    panX=panY=0;changeZoom(next);
  });
  life.listen(actual,'click',()=>{
    const {base}=bounds();changeZoom(Math.abs(base*level-1)<.001?1:1/base);
  });
  life.listen(elements('inspect-close'),'click',()=>dialog.close());
  life.listen(dialog,'contextmenu',event=>event.preventDefault());
  // Dismiss before the game can handle the same key as a pause shortcut.
  life.listen(document,'keydown',event=>{
    if(!dialog.open||!['escape','q'].includes(logicalKey(event)))return;
    event.preventDefault();event.stopImmediatePropagation();
    if(!event.repeat)dialog.close();
  },{capture:true});
  life.listen(dialog,'cancel',event=>{event.preventDefault();dialog.close();});
  life.listen(dialog,'close',()=>{
    generation++;clearPending();endDrag();image.removeAttribute('src');width=height=0;
    setMode('play');
  });
  function open(painting){
    if(!painting||dialog.open)return;
    const request=++generation,high=catalog.detailUrl(painting.id),preview=catalog.imageUrl(painting.id);
    clearPending();endDrag();level=1;panX=panY=0;width=height=0;
    image.style.transform='';image.style.width=image.style.height='';
    elements('inspect-title').textContent=[paintingTitle(painting),paintingArtist(painting)].filter(Boolean).join(' · ');
    elements('inspect-original').href=painting.image.detail?.originalUrl||painting.image.hdUrl||high||preview;
    elements('inspect-hint').textContent=t('Колесо — масштаб · Перетаскивание — перемещение · Q / Esc — закрыть');
    for(const [id,label] of [['inspect-minus','Уменьшить'],['inspect-plus','Увеличить'],['inspect-close','Закрыть'],['inspect-scale','Масштаб']])elements(id).setAttribute('aria-label',t(label));
    elements('inspect-original').textContent=t('Оригинал ↗');fit.textContent=t('Заполнить экран');
    elements('inspect-scale').textContent='';
    image.alt=paintingTitle(painting);image.draggable=false;
    setMode('pause');dialog.showModal();image.src=preview;
    if(!high||high===preview)return;
    pending=new Image();
    pending.onload=()=>{if(request===generation){image.src=high;pending=null;}};
    pending.onerror=()=>{if(request===generation)pending=null;};pending.src=high;
  }
  return {open,dispose(){generation++;clearPending();endDrag();life.dispose();if(dialog.open)dialog.close();image.removeAttribute('src');}};
}
