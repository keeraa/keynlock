(function(){
  'use strict';

  const root=document.querySelector('.pigmentMixScene');
  if(!root)return;
  const elements={
    target:root.querySelector('#pigmentTarget'),targetName:root.querySelector('#pigmentTargetName'),
    result:root.querySelector('#pigmentResult'),resultName:root.querySelector('#pigmentResultName'),
    slots:root.querySelector('#pigmentSlots'),palette:root.querySelector('#pigmentPalette'),
    status:root.querySelector('#pigmentStatus'),check:root.querySelector('#pigmentCheck')
  };
  const state={slots:[null,null,null],solution:[],selected:null,dragging:false,suppressClick:false};
  // Resource ids/counts belong to the shared economy, while these vivid
  // swatches preserve the readable paint palette of the supplied prototype.
  const PIGMENT_HEX=Object.freeze({
    red:'#EF3B3B',orange:'#FF8A1F',yellow:'#FFD31A',green:'#45BF58',
    cyan:'#32C7D9',blue:'#2F6FF2',violet:'#8B4BE8'
  });
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const colors=()=>window.KeynlockResources?.components||[];
  const stock=id=>Math.max(0,Number(window.KeynlockResources?.state?.components?.[id])||0);
  const byId=id=>colors().find(color=>color.id===id)||null;
  const pigmentHex=id=>PIGMENT_HEX[id]||byId(id)?.color||'#888888';
  const hexToRgb=hex=>{const value=hex.replace('#','');return [0,2,4].map(index=>parseInt(value.slice(index,index+2),16));};
  const rgbToHex=rgb=>'#'+rgb.map(value=>clamp(Math.round(value),0,255).toString(16).padStart(2,'0')).join('');
  function rgbToHsl([r,g,b]){
    r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b),light=(max+min)/2;
    if(max===min)return{hue:0,saturation:0,light};
    const delta=max-min,saturation=light>.5?delta/(2-max-min):delta/(max+min);
    let hue=max===r?(g-b)/delta+(g<b?6:0):max===g?(b-r)/delta+2:(r-g)/delta+4;
    return{hue:hue*60,saturation,light};
  }
  function rgbToRyb([r,g,b]){r/=255;g/=255;b/=255;const white=Math.min(r,g,b);r-=white;g-=white;b-=white;const max=Math.max(r,g,b);let yellow=Math.min(r,g);r-=yellow;g-=yellow;if(b>0&&g>0){b/=2;g/=2}yellow+=g;b+=g;const scale=Math.max(r,yellow,b);if(scale>0){const ratio=max/scale;r*=ratio;yellow*=ratio;b*=ratio}return[r+white,yellow+white,b+white];}
  function rybToRgb([r,yellow,b]){const white=Math.min(r,yellow,b);r-=white;yellow-=white;b-=white;const max=Math.max(r,yellow,b);let green=Math.min(yellow,b);yellow-=green;b-=green;if(b>0&&green>0){b*=2;green*=2}r+=yellow;green+=yellow;const scale=Math.max(r,green,b);if(scale>0){const ratio=max/scale;r*=ratio;green*=ratio;b*=ratio}return[(r+white)*255,(green+white)*255,(b+white)*255];}
  function mix(ids){
    const pigments=ids.map(byId).filter(Boolean);
    if(!pigments.length)return null;
    const ryb=pigments.map(color=>rgbToRyb(hexToRgb(pigmentHex(color.id))));
    const average=[0,1,2].map(channel=>ryb.reduce((sum,value)=>sum+value[channel],0)/ryb.length);
    return rgbToHex(rybToRgb(average));
  }
  function describe(ids){
    if(!ids.length)return 'Добавь пигменты';
    const unique=[...new Set(ids)];
    if(unique.length===1)return byId(unique[0])?.name||'Цвет';
    const {hue,saturation,light}=rgbToHsl(hexToRgb(mix(ids)));
    let name;
    if(saturation<.16)name='Серо-коричневый';
    else if(hue<12||hue>=348)name='Красный';
    else if(hue<28)name='Красно-оранжевый';
    else if(hue<45)name='Оранжевый';
    else if(hue<67)name='Жёлтый';
    else if(hue<92)name='Жёлто-зелёный';
    else if(hue<145)name='Зелёный';
    else if(hue<175)name='Зелёно-бирюзовый';
    else if(hue<198)name='Бирюзовый';
    else if(hue<220)name='Голубой';
    else if(hue<252)name='Синий';
    else if(hue<282)name='Сине-фиолетовый';
    else if(hue<318)name='Фиолетовый';
    else name='Красно-фиолетовый';
    if(light<.3)return `Тёмный ${name.toLowerCase()}`;
    if(light>.72)return `Светлый ${name.toLowerCase()}`;
    return name;
  }
  function available(){return colors().filter(color=>stock(color.id)>0);}
  function newTask(){
    const pool=available();
    state.slots=[null,null,null];state.selected=null;
    if(!pool.length){state.solution=[];render();return;}
    const count=pool.length>1?(Math.random()<.55?2:3):1;
    state.solution=Array.from({length:count},()=>pool[Math.floor(Math.random()*pool.length)].id).sort();
    render();
  }
  function firstEmpty(){return state.slots.findIndex(value=>!value);}
  function addSelected(index){if(!state.selected)return;state.slots[index]=state.selected;render();}
  function slotAt(x,y){
    return [...elements.slots.querySelectorAll('[data-pigment-slot]')].find(slot=>{
      const rect=slot.getBoundingClientRect();
      return x>=rect.left&&x<=rect.right&&y>=rect.top&&y<=rect.bottom;
    })||null;
  }
  function clearDropState(){elements.slots.querySelectorAll('.dropReady,.dragOver').forEach(slot=>slot.classList.remove('dropReady','dragOver'));}
  function startDrag(event,id,fromSlot=null){
    if(event.pointerType==='mouse'&&event.button!==0)return;
    const source=event.target.closest('[data-pigment-color],[data-pigment-slot]');
    if(!source||!id)return;
    const start={x:event.clientX,y:event.clientY};
    let ghost=null,started=false;
    const move=pointer=>{
      if(!started&&Math.hypot(pointer.clientX-start.x,pointer.clientY-start.y)<7)return;
      if(!started){
        started=true;state.dragging=true;
        const color=byId(id);
        ghost=document.createElement('div');
        ghost.className='pigmentDragGhost';
        ghost.style.setProperty('--pigment-color',pigmentHex(id));
        ghost.innerHTML=`<i></i><span>${color?.name||id}</span>`;
        document.body.appendChild(ghost);
        elements.slots.querySelectorAll('.pigmentSlot').forEach(slot=>slot.classList.add('dropReady'));
      }
      pointer.preventDefault();
      ghost.style.left=`${pointer.clientX}px`;ghost.style.top=`${pointer.clientY}px`;
      const over=slotAt(pointer.clientX,pointer.clientY);
      elements.slots.querySelectorAll('.pigmentSlot').forEach(slot=>slot.classList.toggle('dragOver',slot===over));
    };
    const finish=pointer=>{
      document.removeEventListener('pointermove',move);
      document.removeEventListener('pointerup',finish);
      document.removeEventListener('pointercancel',cancel);
      clearDropState();ghost?.remove();state.dragging=false;
      if(!started)return;
      state.suppressClick=true;
      const target=slotAt(pointer.clientX,pointer.clientY);
      if(target){
        const to=Number(target.dataset.pigmentSlot);
        if(fromSlot===null)state.slots[to]=id;
        else if(to!==fromSlot){const displaced=state.slots[to];state.slots[to]=id;state.slots[fromSlot]=displaced||null;}
      }else if(fromSlot!==null)state.slots[fromSlot]=null;
      state.selected=null;render();
      setTimeout(()=>{state.suppressClick=false;},0);
    };
    const cancel=()=>{
      document.removeEventListener('pointermove',move);
      document.removeEventListener('pointerup',finish);
      document.removeEventListener('pointercancel',cancel);
      clearDropState();ghost?.remove();state.dragging=false;
    };
    document.addEventListener('pointermove',move,{passive:false});
    document.addEventListener('pointerup',finish);
    document.addEventListener('pointercancel',cancel);
  }
  function renderSlots(){
    elements.slots.innerHTML=state.slots.map((id,index)=>`<button class="pigmentSlot${id?' filled':''}" type="button" data-pigment-slot="${index}" style="--pigment-color:${id?pigmentHex(id):'transparent'}" aria-label="${id?(byId(id)?.name||'Пигмент')+', убрать':'Добавить пигмент'}">${id?`<span>${byId(id)?.name||id}</span>`:''}</button>`).join('');
  }
  function renderPalette(){
    elements.palette.innerHTML=colors().map(color=>`<button class="pigmentColor${state.selected===color.id?' selected':''}" type="button" data-pigment-color="${color.id}" style="--pigment-color:${pigmentHex(color.id)}" ${stock(color.id)?'': 'disabled'}><i></i><span>${color.name}</span><b>×${stock(color.id)}</b></button>`).join('');
  }
  function render(){
    const used=state.slots.filter(Boolean),target=mix(state.solution),result=mix(used);
    elements.target.style.backgroundColor=target||'#302a22';
    elements.targetName.textContent=state.solution.length?describe(state.solution):'Нет доступных цветов';
    elements.result.style.backgroundColor=result||'#302a22';
    elements.resultName.textContent=describe(used);
    elements.check.disabled=!state.solution.length||!used.length;
    elements.status.textContent=state.solution.length?'Выбери цвет, затем положи его в свободную ячейку.':'Получи цветные компоненты за прохождение замков или реставрацию.';
    elements.status.className='';
    renderSlots();renderPalette();
  }
  root.addEventListener('click',event=>{
    if(state.suppressClick)return;
    const colorButton=event.target.closest('[data-pigment-color]');
    if(colorButton){state.selected=state.selected===colorButton.dataset.pigmentColor?null:colorButton.dataset.pigmentColor;render();return;}
    const slot=event.target.closest('[data-pigment-slot]');
    if(slot){const index=Number(slot.dataset.pigmentSlot);if(state.selected)addSelected(index);else if(state.slots[index]){state.slots[index]=null;render();}}
  });
  root.addEventListener('pointerdown',event=>{
    const colorButton=event.target.closest('[data-pigment-color]');
    if(colorButton&&!colorButton.disabled){startDrag(event,colorButton.dataset.pigmentColor);return;}
    const slot=event.target.closest('[data-pigment-slot]');
    const index=Number(slot?.dataset.pigmentSlot);
    if(slot&&state.slots[index])startDrag(event,state.slots[index],index);
  });
  root.addEventListener('dblclick',event=>{const button=event.target.closest('[data-pigment-color]');const index=firstEmpty();if(button&&index>=0){event.preventDefault();state.slots[index]=button.dataset.pigmentColor;state.selected=null;render();}});
  root.querySelector('#pigmentClear').addEventListener('click',()=>{state.slots=[null,null,null];state.selected=null;render();});
  root.querySelector('#pigmentNew').addEventListener('click',newTask);
  elements.check.addEventListener('click',()=>{
    const correct=state.slots.filter(Boolean).sort().join('+')===state.solution.join('+');
    elements.status.textContent=correct?'Точный оттенок получен.':'Оттенок не совпал с образцом.';
    elements.status.className=correct?'good':'bad';
  });
  addEventListener('keynlock-resources-change',()=>{if(!state.solution.every(id=>stock(id)>0))newTask();else renderPalette();});
  newTask();
})();
