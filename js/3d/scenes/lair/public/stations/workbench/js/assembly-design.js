import {ASSEMBLY_STEPS,SLOT_TYPES,CUT_LEVELS,inspectKey} from './logic.js';

// These are actual additional meshes with their own snap sockets and test motion.
export const EXTENDED_STEPS=Object.freeze([
  {id:'retainers',title:'Шайбы и стопорное кольцо',
    instruction:'Поставьте две опорные шайбы на оси шестерён и зафиксируйте кулачок стопорным кольцом.',
    slots:['washer-0','washer-1','clip-0']},
  {id:'linkage',title:'Тяга и подвижный засов',
    instruction:'Соедините кулачок тягой с отдельным подвижным засовом.',
    slots:['rod-0','bolt-0']}
]);
export const EXTENDED_SLOTS=Object.freeze(EXTENDED_STEPS.flatMap(step=>step.slots));
export const ALL_ASSEMBLY_SLOTS=Object.freeze([...SLOT_TYPES,...EXTENDED_SLOTS]);
export const ASSEMBLY_VARIANTS=Object.freeze(['classic','extended','free']);
export const DEFAULT_FREE_DESIGN=Object.freeze({order:[2,0,3,1],ratio:'12:16',reinforced:true});

export function normalizeFreeDesign(value){
  const candidate=value&&typeof value==='object'?value:{};
  const order=Array.isArray(candidate.order)?candidate.order:DEFAULT_FREE_DESIGN.order;
  const valid=order.length===4&&new Set(order).size===4&&
    order.every(code=>Number.isInteger(code)&&code>=0&&code<4);
  return {
    order:valid?[...order]:[...DEFAULT_FREE_DESIGN.order],
    ratio:candidate.ratio==='16:12'?'16:12':'12:16',
    reinforced:candidate.reinforced!==false
  };
}

export function swapPinCode(design,index,code){
  const next=normalizeFreeDesign(design);
  if(!Number.isInteger(index)||index<0||index>=4||!Number.isInteger(code)||code<0||code>3)return next;
  const other=next.order.indexOf(code);
  [next.order[index],next.order[other]]=[next.order[other],next.order[index]];
  return next;
}

export function freeKeySignature(design){return normalizeFreeDesign(design).order.join('-');}

export function targetsForDesign(targets,design){
  const output=[...targets];
  normalizeFreeDesign(design).order.forEach((code,i)=>{output[i]=CUT_LEVELS[code];});
  return output;
}

export function hasExtraHardware(variant,design){
  return variant==='extended'||(variant==='free'&&normalizeFreeDesign(design).reinforced);
}

export function assemblyStepsFor(variant,design){
  return hasExtraHardware(variant,design)?[...ASSEMBLY_STEPS,...EXTENDED_STEPS]:[...ASSEMBLY_STEPS];
}

export function requiredAssemblySlots(variant,design){
  return hasExtraHardware(variant,design)?ALL_ASSEMBLY_SLOTS:SLOT_TYPES;
}

export function inspectConfiguredAssembly(installed,cuts,targets,pinOrder,variant='classic',design,freeKey=''){
  const required=requiredAssemblySlots(variant,design);
  const missing=required.filter(socket=>!installed[socket]);
  const order=variant==='free'?normalizeFreeDesign(design).order:pinOrder;
  const wrongPins=order.map((code,i)=>installed[`pin-${i}`]===`pin-${code}`?null:i)
    .filter(index=>index!==null);
  const key=inspectKey(cuts,targets);
  const keyBlueprintMissing=variant==='free'&&freeKey!==freeKeySignature(design);
  const complete=missing.length===0;
  return {complete,missing,wrongPins,key,keyBlueprintMissing,
    success:complete&&wrongPins.length===0&&key.accurate&&!keyBlueprintMissing};
}
