// Dependencies describe the physical order of removing the assembled lock.
// Every entry is a real mesh; none of the steps create replacement parts.
const partNames={
  'cover-0':'верхнюю планку штифтов',
  'rod-0':'соединительный вал',
  'gear-0':'первую шестерню',
  'gear-1':'вторую шестерню',
  'cam-0':'кулачок',
  'bolt-0':'запирающий ригель',
  'core-0':'цилиндр замка',
  'shackle-0':'дужку замка',
  'frame-0':'переднюю рамку',
  'shell-0':'боковой корпус'
};

export function disassemblyPrerequisites(id){
  const indexed=/^(spring|driver|pin|fastener|clip|collar)-(\d+)$/.exec(id);
  if(indexed){
    const [,kind,index]=indexed;
    if(kind==='spring')return [`driver-${index}`];
    if(kind==='driver')return ['cover-0'];
    if(kind==='pin')return ['core-0'];
    if(kind==='clip')return ['rod-0'];
    if(kind==='collar')return ['shackle-0'];
    return [];
  }
  switch(id){
    case 'gear-0':case 'gear-1':case 'cam-0':return ['rod-0'];
    case 'bolt-0':return ['cam-0'];
    case 'shackle-0':return ['bolt-0'];
    case 'core-0':return ['rod-0','clip-0','clip-1'];
    case 'frame-0':return [0,1,2,3].map(index=>`fastener-${index}`);
    case 'shell-0':return ['frame-0','collar-0','collar-1'];
    default:return [];
  }
}

export function disassemblyBlocker(id,removed){
  const missing=disassemblyPrerequisites(id).find(prerequisite=>!removed.has(prerequisite));
  if(!missing)return null;
  const indexed=/^(driver|pin|fastener|clip|collar)-(\d+)$/.exec(missing);
  const name=indexed?{
    driver:'верхний штифт',pin:'штифт',fastener:'крепёжную стойку с кольцом',
    clip:'стопорную скобу цилиндра',collar:'втулку дужки'
  }[indexed[1]]:partNames[missing]||'предыдущую деталь';
  return indexed?`${name} №${Number(indexed[2])+1}`:name;
}

// A suggested route for first-time players. Any other unlocked component may
// still be removed; the route simply points to one small, reachable piece.
const steps=[
  {id:'cover-0',title:'Снимите верхнюю планку',
    detail:'Это длинная пластина над четырьмя пружинами. Зажмите ЛКМ и перенесите её на стол.'},
  ...Array.from({length:4},(_,i)=>({id:`driver-${i}`,
    title:`Выньте верхний штифт №${i+1}`})),
  ...Array.from({length:4},(_,i)=>({id:`spring-${i}`,
    title:`Выньте пружину №${i+1}`})),
  ...Array.from({length:4},(_,i)=>({id:`fastener-${i}`,
    title:`Снимите стойку с кольцом №${i+1}`})),
  {id:'rod-0',title:'Выньте соединительный вал'},
  {id:'gear-0',title:'Снимите ведущую шестерню'},
  {id:'gear-1',title:'Снимите ведомую шестерню'},
  {id:'cam-0',title:'Извлеките кулачок'},
  {id:'bolt-0',title:'Извлеките запирающий ригель'},
  {id:'shackle-0',title:'Достаньте дужку замка',
    detail:'Дужка справа теперь свободна. Потяните её мышью и положите на стол.'},
  ...Array.from({length:2},(_,i)=>({id:`clip-${i}`,
    title:`Снимите стопорную скобу цилиндра №${i+1}`})),
  {id:'core-0',title:'Достаньте цилиндр замка'},
  ...Array.from({length:4},(_,i)=>({id:`pin-${i}`,
    title:`Достаньте нижний штифт №${i+1}`})),
  ...Array.from({length:2},(_,i)=>({id:`collar-${i}`,
    title:`Снимите втулку дужки №${i+1}`})),
  {id:'frame-0',title:'Снимите переднюю рамку'},
  {id:'shell-0',title:'Снимите боковой корпус'}
];
// Shared with the physical assembly drawing: adding or removing a real
// detachable assembly updates its specification count automatically.
export const DISASSEMBLY_PART_IDS=Object.freeze(steps.map(step=>step.id));

export function nextDisassemblyStep(removed){
  const step=steps.find(item=>!removed.has(item.id)&&!disassemblyBlocker(item.id,removed));
  return step?{...step,
    detail:step.detail||'Зажмите ЛКМ на подсвеченной детали, перетащите её на свободное место стола.'}:null;
}
