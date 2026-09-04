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
  const state={slots:[null,null,null],solution:[],selected:null};
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const colors=()=>window.KeynlockResources?.components||[];
  const stock=id=>Math.max(0,Number(window.KeynlockResources?.state?.components?.[id])||0);
  const byId=id=>colors().find(color=>color.id===id)||null;
  const hexToRgb=hex=>{const value=hex.replace('#','');return [0,2,4].map(index=>parseInt(value.slice(index,index+2),16));};
  const rgbToHex=rgb=>'#'+rgb.map(value=>clamp(Math.round(value),0,255).toString(16).padStart(2,'0')).join('');
  function rgbToRyb([r,g,b]){r/=255;g/=255;b/=255;const white=Math.min(r,g,b);r-=white;g-=white;b-=white;const max=Math.max(r,g,b);let yellow=Math.min(r,g);r-=yellow;g-=yellow;if(b>0&&g>0){b/=2;g/=2}yellow+=g;b+=g;const scale=Math.max(r,yellow,b);if(scale>0){const ratio=max/scale;r*=ratio;yellow*=ratio;b*=ratio}return[r+white,yellow+white,b+white];}
  function rybToRgb([r,yellow,b]){const white=Math.min(r,yellow,b);r-=white;yellow-=white;b-=white;const max=Math.max(r,yellow,b);let green=Math.min(yellow,b);yellow-=green;b-=green;if(b>0&&green>0){b*=2;green*=2}r+=yellow;green+=yellow;const scale=Math.max(r,green,b);if(scale>0){const ratio=max/scale;r*=ratio;green*=ratio;b*=ratio}return[(r+white)*255,(green+white)*255,(b+white)*255];}
  function mix(ids){
    const pigments=ids.map(byId).filter(Boolean);
    if(!pigments.length)return null;
    const ryb=pigments.map(color=>rgbToRyb(hexToRgb(color.color)));
    const average=[0,1,2].map(channel=>ryb.reduce((sum,value)=>sum+value[channel],0)/ryb.length);
    return rgbToHex(rybToRgb(average));
  }
  function describe(ids){
    if(!ids.length)return 'Добавь пигменты';
    const unique=[...new Set(ids)];
    if(unique.length===1)return byId(unique[0])?.name||'Цвет';
    const names={
      'blue+red':'Фиолетовый','blue+yellow':'Зелёный','red+yellow':'Оранжевый',
      'blue+green':'Сине-зелёный','cyan+yellow':'Бирюзово-зелёный','orange+violet':'Тёплый пурпурный',
      'green+red':'Земляной коричневый','orange+yellow':'Золотистый','red+violet':'Красно-фиолетовый'
    };
    return names[unique.sort().join('+')]||'Составной оттенок';
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
  function renderSlots(){
    elements.slots.innerHTML=state.slots.map((id,index)=>`<button class="pigmentSlot${id?' filled':''}" type="button" data-pigment-slot="${index}" style="--pigment-color:${byId(id)?.color||'transparent'}" aria-label="${id?(byId(id)?.name||'Пигмент')+', убрать':'Добавить пигмент'}">${id?`<span>${byId(id)?.name||id}</span>`:''}</button>`).join('');
  }
  function renderPalette(){
    elements.palette.innerHTML=colors().map(color=>`<button class="pigmentColor${state.selected===color.id?' selected':''}" type="button" data-pigment-color="${color.id}" style="--pigment-color:${color.color}" ${stock(color.id)?'': 'disabled'}><i></i><span>${color.name}</span><b>×${stock(color.id)}</b></button>`).join('');
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
    const colorButton=event.target.closest('[data-pigment-color]');
    if(colorButton){state.selected=state.selected===colorButton.dataset.pigmentColor?null:colorButton.dataset.pigmentColor;render();return;}
    const slot=event.target.closest('[data-pigment-slot]');
    if(slot){const index=Number(slot.dataset.pigmentSlot);if(state.selected)addSelected(index);else if(state.slots[index]){state.slots[index]=null;render();}}
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
