import {createCartoonFilter} from './cartoon-filter.js';

// The three architecture workbenches share the exact same illustrated render
// pass, controls and persisted settings. No model material is replaced here.
export const EDITOR_VISUAL_DEFAULTS=Object.freeze({
  toon:true,toonStrength:80,bands:4,
  outline:true,outlineStrength:70,outlineWidth:1,
  exposure:130,grain:14,
});
export const EDITOR_VISUAL_STORAGE_KEY='keynlock.editor.visual.v1';

const rangeFields=[
  {id:'toonStrength',key:'toonStrength',title:'Сила эффекта',min:0,max:100,step:1,unit:'%'},
  {id:'toonBands',key:'bands',title:'Число ступеней',min:2,max:8,step:1,unit:' ступ.'},
  {id:'outlineStrength',key:'outlineStrength',title:'Насыщенность',min:0,max:100,step:1,unit:'%'},
  {id:'outlineWidth',key:'outlineWidth',title:'Толщина линии',min:1,max:4,step:.5,unit:' px'},
  {id:'visualExposure',key:'exposure',title:'Экспозиция',min:70,max:180,step:1,unit:'%'},
  {id:'visualGrain',key:'grain',title:'Бумажная зернистость',min:0,max:40,step:1,unit:'%'},
];
export function normalizeEditorVisualState(saved){
  const result={...EDITOR_VISUAL_DEFAULTS};
  if(!saved||typeof saved!=='object')return result;
  for(const key of ['toon','outline'])if(typeof saved[key]==='boolean')result[key]=saved[key];
  for(const field of rangeFields){
    const number=Number(saved[field.key]);
    if(saved[field.key]===null||saved[field.key]===''||!Number.isFinite(number))continue;
    const bounded=Math.min(field.max,Math.max(field.min,number));
    result[field.key]=Math.round(bounded/field.step)*field.step;
  }
  return result;
}

function loadState(){
  try{return normalizeEditorVisualState(JSON.parse(localStorage.getItem(EDITOR_VISUAL_STORAGE_KEY)));}
  catch{return normalizeEditorVisualState(null);}
}

const rangeMarkup=field=>`<label class="keynlock-visual-range" for="${field.id}">
  <span>${field.title}<output id="${field.id}Value" for="${field.id}"></output></span>
  <input type="range" id="${field.id}" min="${field.min}" max="${field.max}" step="${field.step}" />
</label>`;
const toggleMarkup=(id,title,hint)=>`<div class="keynlock-visual-row">
  <div><b>${title}</b><small>${hint}</small></div>
  <button type="button" id="${id}" class="keynlock-visual-switch" aria-label="${title}" aria-pressed="false"><span aria-hidden="true"></span></button>
</div>`;

export function mountEditorVisual(){
  const header=document.querySelector('.site-header, .topbar');
  if(!header)throw new Error('Не найдена шапка архитектурной мастерской');
  const host=document.createElement('div');host.className='keynlock-visual';
  host.innerHTML=`
    <button type="button" id="visualButton" class="keynlock-visual-button" aria-expanded="false" aria-controls="visualPanel">✧ <span>Визуал</span></button>
    <section id="visualPanel" class="keynlock-visual-panel" aria-label="Настройки визуала" hidden>
      <div class="keynlock-visual-head"><div><small>KEYNLOCK · РИСОВКА</small><h2>Визуал</h2></div><button type="button" id="visualClose" class="keynlock-visual-close" aria-label="Закрыть настройки">×</button></div>
      ${toggleMarkup('cartoonToggle','Мультяшный стиль','Включить оба эффекта')}
      <div class="keynlock-visual-section">
        ${toggleMarkup('toonToggle','Цветовые ступени','Рисованное освещение')}
        ${rangeMarkup(rangeFields[0])}${rangeMarkup(rangeFields[1])}
      </div>
      <div class="keynlock-visual-section">
        ${toggleMarkup('outlineToggle','Контурная обводка','Границы формы и деталей')}
        ${rangeMarkup(rangeFields[2])}${rangeMarkup(rangeFields[3])}
      </div>
      <div class="keynlock-visual-section"><div class="keynlock-visual-section-title">Атмосфера</div>
        ${rangeMarkup(rangeFields[4])}${rangeMarkup(rangeFields[5])}
      </div>
      <div class="keynlock-visual-foot"><span>Гуашевые текстуры зданий сохранены.</span><button type="button" id="resetVisual">Сбросить</button></div>
      <nav class="keynlock-visual-nav" aria-label="Разделы редактора"><a href="../house-builder/">Дома</a><a href="../street-lab/">Кварталы</a><a href="../landmark-lab/">Особые здания</a></nav>
    </section>`;
  const firstNavigation=[...header.children].find(child=>child.matches('nav, .top-links, .back-button'))||null;
  header.insertBefore(host,firstNavigation);
  const q=id=>host.querySelector(`#${id}`);
  const grain=document.getElementById('stageGrain');
  const state=loadState();
  let renderer=null,filter=null;

  function apply(){
    if(filter)filter.setOptions({
      toon:state.toon,toonStrength:state.toonStrength/100,bands:state.bands,
      outline:state.outline,outlineStrength:state.outlineStrength/100,outlineWidth:state.outlineWidth,
    });
    if(renderer)renderer.toneMappingExposure=state.exposure/100;
    if(grain)grain.style.opacity=String(state.grain/100);
  }
  function save(){
    try{localStorage.setItem(EDITOR_VISUAL_STORAGE_KEY,JSON.stringify(state));}catch{}
  }
  function sync(){
    for(const [id,active] of [['toonToggle',state.toon],['outlineToggle',state.outline],['cartoonToggle',state.toon&&state.outline]]){
      q(id).classList.toggle('is-on',active);q(id).setAttribute('aria-pressed',String(active));
    }
    for(const field of rangeFields){
      q(field.id).value=String(state[field.key]);
      q(field.id+'Value').textContent=`${state[field.key]}${field.unit}`;
      q(field.id).disabled=(field.key==='toonStrength'||field.key==='bands')&&!state.toon||
        (field.key==='outlineStrength'||field.key==='outlineWidth')&&!state.outline;
    }
  }
  function change(next){Object.assign(state,next);save();sync();apply();}
  const panel=q('visualPanel'),button=q('visualButton');
  function setOpen(open){
    panel.hidden=!open;
    button.classList.toggle('is-active',open);
    button.setAttribute('aria-expanded',String(open));
  }
  button.addEventListener('click',()=>setOpen(panel.hidden));
  q('visualClose').addEventListener('click',()=>{setOpen(false);button.focus();});
  document.addEventListener('pointerdown',event=>{if(!panel.hidden&&!host.contains(event.target))setOpen(false);});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){setOpen(false);button.focus();}});
  q('toonToggle').addEventListener('click',()=>change({toon:!state.toon}));
  q('outlineToggle').addEventListener('click',()=>change({outline:!state.outline}));
  q('cartoonToggle').addEventListener('click',()=>{
    const enabled=!(state.toon&&state.outline);change({toon:enabled,outline:enabled});
  });
  for(const field of rangeFields)q(field.id).addEventListener('input',event=>{
    change({[field.key]:Number(event.target.value)});
  });
  q('resetVisual').addEventListener('click',()=>change(EDITOR_VISUAL_DEFAULTS));
  window.addEventListener('storage',event=>{
    if(event.key!==EDITOR_VISUAL_STORAGE_KEY)return;
    let next;try{next=normalizeEditorVisualState(JSON.parse(event.newValue));}catch{next=normalizeEditorVisualState(null);}
    Object.assign(state,next);sync();apply();
  });
  sync();apply();
  return {
    connect({THREE,renderer:nextRenderer,scene,camera}){
      filter?.dispose();renderer=nextRenderer;
      filter=createCartoonFilter({THREE,renderer,scene,camera});
      apply();
    },
    resize(width,height,pixelRatio){filter?.resize(width,height,pixelRatio);},
    render(){return filter?.render()||{calls:0,triangles:0};},
    dispose(){filter?.dispose();filter=null;renderer=null;},
    getState(){return {...state};},
  };
}
