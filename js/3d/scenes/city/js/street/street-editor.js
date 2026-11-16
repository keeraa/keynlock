import { DISTRICTS } from '../world-data.js';
import { DISTRICT_PROFILES, resolveDistrictProfile, ROOF_TYPES } from './district-profiles.js';
import { createStreetBlueprint, generateStreetPlan } from './street-generator.js';
import { generateQuarterPlan } from './quarter-generator.js';
import { createStreetFallback } from './street-fallback.js';

const $=id=>document.getElementById(id);
const STORAGE_KEY='keynlock.street.lab.v1';
const prettier=n=>Number(n).toLocaleString('ru-RU',{maximumFractionDigits:1});
const surfaceLabels={cobble:'Булыжная',paving:'Каменная',asphalt:'Асфальт'};
const roofLabels={gable:'Двускатная',hip:'Вальмовая',flat:'Плоская'};
let stored={};try{stored=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')||{};}catch{}
let district=DISTRICT_PROFILES[stored.district]?stored.district:'old';
let mode=stored.mode==='street'?'street':'quarter';
let seed=Number.isFinite(Number(stored.seed))?(Number(stored.seed)>>>0):1129;
let overrides=stored.overrides&&typeof stored.overrides==='object'?stored.overrides:{};
let night=Boolean(stored.night);
let view='three-quarter';
let engine,plan,refreshQueued=false;
function current(){return overrides[district]||{};}
function profile(){return resolveDistrictProfile(district,current());}
function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify({district,mode,seed,overrides,night}));}catch{}}
function updateOverride(key,value){
  overrides[district]={...current(),[key]:value};persist();
  if(refreshQueued)return;
  refreshQueued=true;
  requestAnimationFrame(()=>{refreshQueued=false;syncEditor();updatePlan();});
}

function districtButtons(){
  const root=$('districtList');root.replaceChildren();
  [...DISTRICTS].sort((a,b)=>Number(a.index)-Number(b.index)).forEach(d=>{
    const b=document.createElement('button');b.type='button';b.className='district-button';b.dataset.district=d.id;
    b.innerHTML=`<span class="district-dot" style="background:${d.color}"></span><span class="district-text"><b>${d.name}</b><small>${d.kind}</small></span><span class="district-index">${d.index}</span>`;
    b.addEventListener('click',()=>{district=d.id;persist();syncEditor();updatePlan(true);});
    root.append(b);
  });
}
function drawSwatches(rootId,key){
  const target=$(rootId),base=DISTRICT_PROFILES[district],active=profile()[key];
  target.replaceChildren();
  const all=[...new Set([...base[key],...(current()[key]||[])])];
  all.forEach(color=>{
    const button=document.createElement('button');button.type='button';button.className='swatch'+(active.includes(color)?' selected':'');
    button.style.setProperty('--color',color);button.title=`${color} — ${active.includes(color)?'исключить':'разрешить'}`;
    button.setAttribute('aria-label',`Цвет ${color}`);button.setAttribute('aria-pressed',String(active.includes(color)));
    button.addEventListener('click',()=>{
      if(active.length===1&&active.includes(color))return;
      const next=active.includes(color)?active.filter(c=>c!==color):[...active,color];
      updateOverride(key,next);
    });target.append(button);
  });
}
function miniPalette(id,colors){const el=$(id);el.replaceChildren();for(const color of colors){const item=document.createElement('span');item.style.background=color;item.title=color;el.append(item);}}
function syncEditor(){
  const p=profile();
  document.querySelectorAll('[data-layout-mode]').forEach(button=>{
    const active=button.dataset.layoutMode===mode;
    button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
  });
  document.querySelector('.intro h1').innerHTML=mode==='quarter'?'Лаборатория<br>квартала':'Лаборатория<br>улицы';
  document.title=`Лаборатория ${mode==='quarter'?'квартала':'улицы'} · KEYNLOCK`;
  $('breadcrumbMode').textContent=mode==='quarter'?'ТЕСТОВЫЙ КВАРТАЛ':'ТЕСТОВАЯ УЛИЦА';
  $('newStreet').textContent=mode==='quarter'?'↻  Новый квартал':'↻  Новая улица';
  $('inspectorTitle').textContent=mode==='quarter'?'Образ квартала':'Образ улицы';
  $('inspectorFoot').textContent=`${mode==='quarter'?'Квартал':'Одна улица'} для испытаний. Основная карта города пока не меняется.`;
  document.querySelectorAll('.district-button').forEach(button=>{const active=button.dataset.district===district;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
  $('districtCharacter').textContent=p.character;
  for(const [id,value] of Object.entries({minFloor:p.floors[0],maxFloor:p.floors[1],minWidth:p.width[0],maxWidth:p.width[1],roadWidth:p.roadWidth,sidewalkWidth:p.sidewalkWidth,lampSpacing:p.lampSpacing,lampStyle:p.lampStyle,gapScale:p.gapScale})){
    $(id).value=value;
  }
  $('roadWidthValue').textContent=`${prettier(p.roadWidth)} м`;
  $('sidewalkWidthValue').textContent=`${prettier(p.sidewalkWidth)} м`;
  $('gapScaleValue').textContent=`×${prettier(p.gapScale)}`;
  document.querySelectorAll('[data-roof]').forEach(input=>{input.checked=p.roofs.includes(input.dataset.roof);});
  drawSwatches('wallPalette','walls');drawSwatches('roofPalette','roofsPalette');
  $('nightMode').checked=night;
  document.querySelector('.stage').classList.toggle('is-night',night);
  miniPalette('previewWalls',p.walls);miniPalette('previewRoofs',p.roofsPalette);
  $('streetTitle').textContent=p.name;
  $('streetDescription').textContent=p.character;
  $('stageEyebrow').textContent=`РАЙОН ${p.districtIndex} / 07`;
}
function renderPicked(house){
  const c=house.config;
  $('pickedHouse').innerHTML=`<div class="selected-number">${house.id.split('-').at(-2)==='l'?'ЛЕВАЯ':'ПРАВАЯ'} СТОРОНА · № ${house.id.split('-').at(-1)}</div><strong>${c.floors} эт. · ${prettier(c.width)} × ${prettier(c.depth)} м</strong><dl><div><dt>Крыша</dt><dd>${roofLabels[c.roofType]}</dd></div><div><dt>Окна фасада</dt><dd>${c.frontWindows} / этаж</dd></div><div><dt>Балкон</dt><dd>${c.balcony?'Есть':'Нет'}</dd></div><div><dt>Фахверк</dt><dd>${c.timberFrame?'Есть':'Нет'}</dd></div><div><dt>Штукатурка</dt><dd>${c.plasterDamage?'Сколы':'Целая'}</dd></div></dl>`;
}
function onMetrics(metrics){
  if(metrics.fps!==undefined)$('fpsValue').textContent=metrics.fps;
  if(metrics.triangles!==undefined)$('triangleValue').textContent=typeof metrics.triangles==='number'?Math.round(metrics.triangles).toLocaleString('ru-RU'):metrics.triangles;
  if(metrics.drawCalls!==undefined)$('drawCallsValue').textContent=Number(metrics.drawCalls).toLocaleString('ru-RU');
  if(metrics.meshCount!==undefined)$('meshCount').textContent=`${metrics.meshCount} / ${metrics.originalMeshCount}`;
  if(metrics.lod)$('lodValue').textContent=typeof metrics.lod==='string'?metrics.lod:`${metrics.lod.high} / ${metrics.lod.medium} / ${metrics.lod.low}`;
}
function updatePlan(resetView=false){
  plan=mode==='quarter'?generateQuarterPlan(district,seed,current()):generateStreetPlan(district,seed,current());
  engine?.setPlan(plan);
  if(resetView)engine?.setView(view);
  $('seedValue').textContent=String(seed).padStart(6,'0');
  $('houseCount').textContent=plan.stats.houses;
  $('lampCount').textContent=String(plan.stats.lamps).padStart(2,'0');
  $('rangeFloors').textContent=plan.profile.floors.join('–');
  $('rangeWidth').textContent=`${plan.profile.width.map(prettier).join('–')} м`;
  $('surfaceType').textContent=surfaceLabels[plan.profile.surface];
  $('streetLength').textContent=`${prettier(plan.road.length)} м`;
  $('sidewalkStat').textContent=`${prettier(plan.sidewalks.width)} м`;
  $('streetCount').textContent=plan.stats.streets||1;
  $('junctionCount').textContent=plan.stats.junctions||0;
  $('walkwayCount').textContent=plan.stats.paths||0;
  $('courtyardStat').textContent=plan.courtyard?'Есть':'Нет';
  $('residentCapacity').textContent=`≈ ${prettier(plan.stats.residents.min)}–${prettier(plan.stats.residents.max)}`;
  $('pickedHouse').innerHTML='<p>Нажми на дом, чтобы увидеть параметры генерации.</p>';
  persist();
}
function downloadJson(){
  const json=JSON.stringify(createStreetBlueprint(plan),null,2);
  const blob=new Blob([json],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');anchor.href=url;anchor.download=`keynlock-${district}-${mode}-${seed}.json`;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function bind(){
  document.querySelectorAll('[data-layout-mode]').forEach(button=>button.addEventListener('click',()=>{
    if(mode===button.dataset.layoutMode)return;
    mode=button.dataset.layoutMode;persist();syncEditor();updatePlan(true);
  }));
  for(let n=6;n<=12;n+=.5){for(const id of ['minWidth','maxWidth']){const option=document.createElement('option');option.value=n;option.textContent=prettier(n);$(id).append(option);}}
  document.querySelectorAll('[data-override]').forEach(control=>{
    control.addEventListener(control.type==='range'?'input':'change',()=>{
      const key=control.dataset.override;
      updateOverride(key,control.type==='number'||control.type==='range'||control.tagName==='SELECT'&&key!=='lampStyle'?Number(control.value):control.value);
    });
  });
  document.querySelectorAll('[data-roof]').forEach(input=>input.addEventListener('change',()=>{
    const roofs=ROOF_TYPES.filter(type=>document.querySelector(`[data-roof="${type}"]`).checked);
    if(!roofs.length){input.checked=true;return;}
    updateOverride('roofs',roofs);
  }));
  for(const [id,key] of [['wallAdd','walls'],['roofAdd','roofsPalette']]){$(id).addEventListener('change',()=>{const next=[...new Set([...profile()[key],$(id).value.toLowerCase()])];updateOverride(key,next);});}
  $('newStreet').addEventListener('click',()=>{seed=(seed+1)>>>0;updatePlan();});
  $('resetDistrict').addEventListener('click',()=>{delete overrides[district];syncEditor();updatePlan();});
  $('exportStreet').addEventListener('click',downloadJson);
  $('nightMode').addEventListener('change',()=>{night=$('nightMode').checked;document.querySelector('.stage').classList.toggle('is-night',night);engine?.setNight(night);persist();});
  document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{
    view=button.dataset.view;document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b===button));engine?.setView(view);
  }));
}
async function bootstrap(){
  districtButtons();bind();syncEditor();
  let canvas=$('streetCanvas');
  try {
    const {createStreetScene}=await import('./street-scene.js');
    engine=createStreetScene(canvas,{onMetrics,onPick:renderPicked});
  }catch(error){
    console.warn('WebGL недоступен, включена схема улицы:',error);
    const replacement=document.createElement('canvas');replacement.id=canvas.id;replacement.setAttribute('aria-label',canvas.getAttribute('aria-label'));
    canvas.replaceWith(replacement);canvas=replacement;
    engine=createStreetFallback(canvas,{onMetrics,onPick:renderPicked});
    $('renderMode').textContent='СХЕМА · WEBGL НЕДОСТУПЕН';
    $('cameraNote').textContent='ВИД СВЕРХУ · НАЖМИ НА ДОМ ДЛЯ ПАРАМЕТРОВ';
  }
  engine.setNight(night);
  updatePlan(true);
}
bootstrap().catch(error=>{console.error(error);$('renderMode').textContent='ОШИБКА СЦЕНЫ';});
