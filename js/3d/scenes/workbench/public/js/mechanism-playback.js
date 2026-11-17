import {PARTS} from './mechanism-engine.js';

export const STAGE_MS=510;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

// Track force through real contacts, including parallel branches. Detached
// parts never receive a playback stage.
export function transmissionStages(parts,view){
  const key=parts.find(part=>part.type==='key');if(!key)return [];
  const depths=new Map([[key.id,0]]),queue=[key.id];
  for(let i=0;i<queue.length;i++)for(const link of view.links){
    if(link.from!==queue[i]||depths.has(link.to))continue;
    depths.set(link.to,depths.get(link.from)+1);queue.push(link.to);
  }
  const levels=[...new Set(depths.values())].sort((a,b)=>a-b);
  const stages=levels.map(depth=>({
    ids:parts.filter(part=>depths.get(part.id)===depth).map(part=>part.id),depth
  }));
  const stopped=stages.findIndex(stage=>stage.depth>0&&stage.ids.every(id=>
    Math.abs(view.values[id]||0)<.015));
  return stopped>=0?stages.slice(0,stopped+1):stages;
}

export function stepCaption(stage,parts,view){
  const matches=stage.ids.map(id=>parts.find(part=>part.id===id)).filter(Boolean);
  const part=matches[0];if(!part)return {title:'Нет контакта',detail:'Передача разорвана.'};
  const moving=matches.some(item=>(view.values[item.id]||0)>.015);
  switch(part.type){
    case 'key':return {title:'Ключ поворачивает сердцевину',detail:'Поворот ключа — источник движения всего механизма.'};
    case 'pinbank':return {title:moving?'Штифты освободили сердцевину':'Штифты удерживают сердцевину',
      detail:'Пять пар поднимаются на разную высоту; их стыки должны совпасть с линией среза.'};
    case 'cam':return {title:moving?'Кулачок начинает давить на защёлку':'Кулачку не хватает хода',
      detail:'Поворот диска превращается в поступательное усилие.'};
    case 'latch':return {title:moving?'Защёлка отходит от засова':'Защёлка продолжает держать засов',
      detail:'Пружинный стопор должен выйти из паза, иначе засов не сдвинется.'};
    case 'bolt':return {title:view.ready?'Засов освобождает правую скобу':'Засов остаётся запертым',
      detail:'Только после освобождения стопоров стальной стержень может уйти внутрь корпуса.'};
    case 'ratchet':{
      const count=view.runtime.pawls[part.id]?.steps||0;
      return {title:`Трещотка: ${count} из ${part.setting} щелчков`,
        detail:'Собачка удерживает каждый шаг после возврата ключа. Нужно набрать все щелчки.'};
    }
    case 'splitter':return {title:'Усилие расходится на две тяги',detail:'Одно движение от сердцевины передаётся верхнему и нижнему плечу.'};
    case 'lever':return {title:'Два рычага двигаются вместе',detail:'Каждое плечо поворачивается вокруг своей опоры и толкает отдельный вход стопора.'};
    case 'interlock':return {title:moving?'Оба рычага освободили стопор':'Один из входов не сработал',
      detail:'Для освобождения засова два плеча должны давить одновременно.'};
    case 'gear':return {title:'Шестерня передаёт вращение',detail:'Зацепление меняет направление вращения следующей оси.'};
    default:return {title:PARTS[part.type].name,
      detail:moving?'Передача усилия продолжается.':'Этот узел остановил передачу движения.'};
  }
}

export function stagedView(full,stages,elapsed,parts){
  const positions=new Map(stages.flatMap((stage,i)=>stage.ids.map(id=>[id,i])));
  const fade=index=>{
    if(index===undefined)return 0;
    const t=clamp((elapsed-index*STAGE_MS)/STAGE_MS,0,1);
    return t*t*(3-2*t);
  };
  const values={},inputs={};
  for(const [id,value] of Object.entries(full.values))values[id]=value*fade(positions.get(id));
  for(const [id,value] of Object.entries(full.inputs))inputs[id]=value*fade(positions.get(id));
  const bolt=parts.find(part=>part.type==='bolt')?.id;
  return {...full,values,inputs,
    boltTravel:full.boltTravel*fade(positions.get(bolt))};
}
