// KEYNLOCK mechanism sandbox. Geometry, contacts, motion and attack use the
// same deterministic model; there is no separate hard-coded picking outcome.
import {STANDARD_TENSION_TOOLS,checkTensionProfile} from './mechanism-lockpicks.js';
export const BOARD={width:920,height:610};
export const CONTACT_TOLERANCE=15;
export const PICK_REACH=300;
// The five spring-loaded driver pairs have individual lift depths. A single
// click cannot magically defeat the entire secret block.
export const PIN_CODES=Object.freeze([2,4,3,5,2]);

export const PARTS=Object.freeze({
  key:{name:'Ключевой ротор',short:'КЛЮЧ',span:48,kind:'rotary',fixed:true,
    detail:'Ключ входит через скважину в левой торцевой стенке. Поворот передаётся дальше, когда кодовые штифты освобождают сердцевину.'},
  pinbank:{name:'Штифтовый секрет · 5 пар',short:'СЕКРЕТ',span:110,kind:'secret',pickable:true,
    detail:'Пять пар кодовых и запирающих штифтов стоят поперёк сердцевины. Пружины прижимают их вниз. При правильной высоте стыки совпадают с линией среза и цилиндр может повернуться.',
    param:'resistance',min:.05,max:.55,step:.05,unit:'',defaultValue:.15},
  gear:{name:'Шестерня',short:'ШЕСТЕРНЯ',span:36,kind:'rotary',
    detail:'Передаёт вращение на следующую ось с изменением направления и передаточного отношения.',
    param:'ratio',min:.6,max:1.4,step:.1,unit:'×',defaultValue:1},
  lever:{name:'Качающийся рычаг',short:'РЫЧАГ',span:52,kind:'swing',pickable:true,
    detail:'Перекидывает усилие через опору. Можно поменять сторону рабочего плеча.'},
  pin:{name:'Подвижный штифт',short:'ШТИФТ',span:39,kind:'linear',pickable:true,
    detail:'Дополнительный механический блокиратор. В стандартном секрете отдельные штифты и их пружины уже собраны в единый пакет.',
    param:'resistance',min:.05,max:.55,step:.05,unit:'',defaultValue:.15},
  spring:{name:'Возвратная пружина',short:'ПРУЖИНА',span:40,kind:'linear',
    detail:'В старых схемах это самостоятельная деталь. В новом замке пружины входят в штифтовый пакет и защёлку.',
    param:'strength',min:.6,max:1,step:.05,unit:'×',defaultValue:.95},
  ratchet:{name:'Трещотка',short:'ТРЕЩОТКА',span:36,kind:'stepped',
    detail:'Фиксирует положение после каждого отдельного хода. Обратное движение не отменяет шаг.',
    param:'steps',min:1,max:5,step:1,unit:' ход.',defaultValue:3},
  cam:{name:'Кулачковый диск',short:'КУЛАЧОК',span:39,kind:'rotary',
    detail:'На конце разблокированной сердцевины преобразует поворот ключа в поступательное усилие, которое отводит защёлку.',
    param:'phase',min:.3,max:.8,step:.05,unit:'',defaultValue:.5},
  latch:{name:'Пружинная защёлка',short:'ЗАЩЁЛКА',span:45,kind:'swing',pickable:true,
    detail:'Прижимается к пазу засова. Кулачок отводит защёлку; после этого засов можно втянуть. Пружина возврата встроена.',
    param:'threshold',min:.4,max:.9,step:.05,unit:'',defaultValue:.68},
  splitter:{name:'Разветвитель тяги',short:'РАЗВИЛКА',span:43,kind:'linkage',
    detail:'Один вход двигает два разнесённых плеча. Позволяет строить собственные параллельные цепи.'},
  interlock:{name:'Двойной блокиратор',short:'БЛОКИРАТОР',span:45,kind:'interlock',pickable:true,
    detail:'Пропускает ход только когда два независимых входа срабатывают одновременно.',
    param:'threshold',min:.4,max:.9,step:.05,unit:'',defaultValue:.68},
  shield:{name:'Защитная пластина',short:'ЭКРАН',span:0,kind:'barrier',
    detail:'Перекрывает прямой доступ крючком к деталям за ней. На работу передачи не влияет.',
    param:'radius',min:35,max:90,step:5,unit:' px',defaultValue:64},
  bolt:{name:'Выдвижной засов',short:'ЗАСОВ',span:50,kind:'linear',fixed:true,
    detail:'Стальной стержень в зацеплении с правой скобой. При освобождении защёлки засов сдвигается внутрь корпуса и скоба выходит из гнезда.'}
});

// Everyday locks need three editable functional modules. The remaining devices
// are optional challenges; a spring is part of its physical assembly.
export const CORE_PALETTE=['pinbank','cam','latch'];
export const ADVANCED_PALETTE=['gear','lever','ratchet','splitter','interlock','shield'];
export const PALETTE=[...CORE_PALETTE,...ADVANCED_PALETTE];
// Playable arrangements, not arbitrary decorative bundles. Every joint in
// these examples touches its neighbour in the same contact solver as editing.
export const MECHANISM_PRESETS=Object.freeze({
  basic:{name:'Обычный',short:'1 поворот',effect:'Ключ поднимает пять штифтов, кулачок отводит защёлку, засов освобождает скобу.',
    value:'Открывается за один поворот. Доступный из скважины секрет можно попытаться вскрыть крючком.'},
  ratchet:{name:'Три щелчка',short:'3 поворота',effect:'Собачка трещотки удерживает набранный шаг, когда ключ возвращается назад.',
    value:'Для штатного открытия требуются три отдельных поворота ключа. Трещотка сама по себе не закрывает доступ к штифтам.'},
  guarded:{name:'Защита от крючка',short:'1 поворот',effect:'Стальная пластина перекрывает прямой путь от скважины к кодовым штифтам.',
    value:'Правильный ключ по-прежнему открывает замок за один поворот. Крючок из скважины не достаёт до секрета.'},
  dual:{name:'Два рычага',short:'2 тяги',effect:'Разветвитель толкает верхний и нижний рычаг. Двойной стопор отпускает засов только при ходе обоих.',
    value:'Если одна тяга отсоединена, засов останется заперт. Само разветвление не скрывает штифтовый секрет от крючка.'}
});
export function mechanismPreset(name='basic'){
  switch(name){
    case 'basic':return demoMechanism();
    case 'ratchet':return [makePart('key','key',120,305,{wrenchProfile:1}),makePart('pinbank','secret',278,305),
      makePart('ratchet','counter',424,305),makePart('cam','drive',499,305),
      makePart('latch','catch',583,305),makePart('bolt','bolt',678,305)];
    case 'guarded':return [makePart('key','key',120,305,{wrenchProfile:3}),
      ...demoMechanism().slice(1),makePart('shield','guard',205,305)];
    case 'dual':return [makePart('key','key',120,305,{wrenchProfile:4}),makePart('pinbank','secret',278,305),
      makePart('splitter','fork',431,305),makePart('lever','upper',526,245),
      makePart('lever','lower',526,365),makePart('interlock','gate',623,305),
      makePart('latch','catch',713,305),makePart('bolt','bolt',808,305)];
    default:throw new Error(`Unknown example: ${name}`);
  }
}
export function identifyMechanismPreset(parts){
  for(const name of Object.keys(MECHANISM_PRESETS)){
    const sample=mechanismPreset(name);
    if(parts.length===sample.length&&parts.every((p,i)=>
      Object.keys(sample[i]).every(key=>p[key]===sample[i][key])))return name;
  }
  return null;
}
const clamp=(x,min=0,max=1)=>Math.min(max,Math.max(min,x));
const round=(x)=>Math.round(x*10000)/10000;

export function makePart(type,id,x,y,extra={}){
  if(!PARTS[type])throw new Error(`Unknown mechanism part: ${type}`);
  return {type,id,x,y,rot:0,polarity:1,flip:false,
    setting:PARTS[type].defaultValue??1,
    ...(type==='key'?{wrenchProfile:2}:{}),...extra};
}

export function keywayWrenchProfile(parts){
  const key=parts.find(part=>part.type==='key');
  return Number.isInteger(key?.wrenchProfile)&&key.wrenchProfile>=0&&
    key.wrenchProfile<STANDARD_TENSION_TOOLS.length?key.wrenchProfile:2;
}

export function checkTensionFit(parts,wrenchIndex){
  return checkTensionProfile(keywayWrenchProfile(parts),wrenchIndex);
}

export function demoMechanism(){
  // Every adjoining pair touches at its actual mechanical port.
  return [makePart('key','key',120,305),makePart('pinbank','secret',278,305),
    makePart('cam','drive',427,305),makePart('latch','catch',511,305),
    makePart('bolt','bolt',606,305)];
}

export function validateParts(parts){
  if(!Array.isArray(parts)||parts.length>60)throw new Error('Неверное число деталей');
  const ids=new Set();
  return parts.map(raw=>{
    if(!raw||!PARTS[raw.type]||typeof raw.id!=='string'||raw.id.length>70||ids.has(raw.id))
      throw new Error('Некорректная или повторяющаяся деталь');
    ids.add(raw.id);
    const def=PARTS[raw.type];
    const value=Number(raw.setting);
    const setting=def.param?clamp(Number.isFinite(value)?value:def.defaultValue,def.min,def.max):1;
    return makePart(raw.type,raw.id,
      clamp(Number(raw.x)||0,28,BOARD.width-28),
      clamp(Number(raw.y)||0,32,BOARD.height-32),{
        rot:([0,1,2,3].includes(raw.rot)?raw.rot:0),
        polarity:raw.polarity===-1?-1:1,flip:raw.flip===true,setting:round(setting),
        ...(raw.type==='key'?{wrenchProfile:Number.isInteger(raw.wrenchProfile)&&
          raw.wrenchProfile>=0&&raw.wrenchProfile<STANDARD_TENSION_TOOLS.length?
            raw.wrenchProfile:2}:{})
      });
  });
}

export function portPosition(part,port){
  const angle=(part.rot||0)*Math.PI/2;
  const c=Math.cos(angle),s=Math.sin(angle);
  return {x:round(part.x+port.x*c-port.y*s),y:round(part.y+port.x*s+port.y*c),
    nx:round(port.nx*c-port.ny*s),ny:round(port.nx*s+port.ny*c)};
}

export function portsFor(part){
  const span=PARTS[part.type].span;
  if(part.type==='shield')return {inputs:[],outputs:[]};
  if(part.type==='key')return {inputs:[],outputs:[{
    ...portPosition(part,{x:span,y:0,nx:1,ny:0}),name:'out'}]};
  if(part.type==='bolt')return {inputs:[{
    ...portPosition(part,{x:-span,y:0,nx:-1,ny:0}),name:'in'}],outputs:[]};
  if(part.type==='splitter')return {
    inputs:[{...portPosition(part,{x:-span,y:0,nx:-1,ny:0}),name:'in'}],
    outputs:[-60,60].map((y,i)=>({
      ...portPosition(part,{x:span,y,nx:1,ny:0}),name:`out-${i}`}))
  };
  if(part.type==='interlock')return {
    inputs:[-60,60].map((y,i)=>({
      ...portPosition(part,{x:-span,y,nx:-1,ny:0}),name:`in-${i}`})),
    outputs:[{...portPosition(part,{x:span,y:0,nx:1,ny:0}),name:'out'}]
  };
  return {
    inputs:[{...portPosition(part,{x:-span,y:0,nx:-1,ny:0}),name:'in'}],
    outputs:[{...portPosition(part,{x:span,y:0,nx:1,ny:0}),name:'out'}]
  };
}

export function buildContacts(parts){
  const connections=[];
  const inputs=parts.map(part=>({part,ports:portsFor(part).inputs}));
  const used=new Set();
  for(const part of parts){
    for(const output of portsFor(part).outputs){
      let best=null;
      for(const receiver of inputs){
        if(receiver.part.id===part.id)continue;
        for(const input of receiver.ports){
          const id=`${receiver.part.id}:${input.name}`;
          if(used.has(id))continue;
          const d=Math.hypot(output.x-input.x,output.y-input.y);
          const opposite=output.nx*input.nx+output.ny*input.ny<-.7;
          if(opposite&&d<=CONTACT_TOLERANCE&&(!best||d<best.distance))
            best={from:part.id,to:receiver.part.id,fromPort:output.name,toPort:input.name,
              distance:round(d),x:(output.x+input.x)/2,y:(output.y+input.y)/2};
        }
      }
      if(best){connections.push(best);used.add(`${best.to}:${best.toPort}`);}
    }
  }
  return connections;
}

function cycleExists(parts,links){
  const outgoing=new Map(parts.map(part=>[part.id,[]]));
  for(const link of links)outgoing.get(link.from)?.push(link.to);
  const seen=new Set(),active=new Set();
  function dfs(id){
    if(active.has(id))return true;
    if(seen.has(id))return false;
    seen.add(id);active.add(id);
    for(const to of outgoing.get(id)||[])if(dfs(to))return true;
    active.delete(id);return false;
  }
  return parts.some(part=>dfs(part.id));
}

export function inspectLayout(parts,links=buildContacts(parts)){
  const byId=new Map(parts.map(part=>[part.id,part]));
  const key=parts.find(part=>part.type==='key'),bolt=parts.find(part=>part.type==='bolt');
  const issues=[];
  if(!key||!bolt)issues.push('Не хватает ключевого ротора или засова.');
  const cycles=cycleExists(parts,links);
  if(cycles)issues.push('Замкнутая передача заклинивает: устраните обратную связь.');
  const collisions=[];
  for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++){
    const a=parts[i],b=parts[j];
    // Covers are mounted above the mechanism and may intentionally overlap.
    if(a.type==='shield'||b.type==='shield')continue;
    const spacing=(PARTS[a.type].span+PARTS[b.type].span)*.62+12;
    if(Math.hypot(a.x-b.x,a.y-b.y)<spacing)collisions.push([a.id,b.id]);
  }
  if(collisions.length)issues.push(`${collisions.length} пересечений деталей: передача заклинивает.`);
  const visited=new Set(key?[key.id]:[]),queue=key?[key.id]:[];
  for(let i=0;i<queue.length;i++)for(const edge of links){
    if(edge.from===queue[i]&&!visited.has(edge.to)){
      visited.add(edge.to);queue.push(edge.to);
    }
  }
  const missingStopArms=parts.filter(part=>part.type==='interlock'&&
    links.filter(link=>link.to===part.id).length!==2);
  const missingForkArms=parts.filter(part=>part.type==='splitter'&&
    links.filter(link=>link.from===part.id).length!==2);
  if(missingStopArms.length)issues.push('Двойному стопору нужны два присоединённых рычага.');
  if(missingForkArms.length)issues.push('К развилке подключены не обе тяги.');
  const boltEdges=links.filter(link=>link.to===bolt?.id);
  const connected=Boolean(bolt&&boltEdges.length>0&&boltEdges.every(edge=>visited.has(edge.from))&&
    !missingStopArms.length&&!missingForkArms.length);
  if(!connected)issues.push('Не все стопоры засова связаны с ключом непрерывной передачей.');
  if(bolt&&!boltEdges.length)issues.push('Засов открыт для прямого натяжения: нет стопоров.');
  const unused=parts.filter(part=>part.type!=='shield'&&part.type!=='bolt'&&
    !visited.has(part.id));
  if(unused.length)issues.push(`${unused.length} дополнительных узлов не получают движение от ключа.`);
  if(boltEdges.some(link=>byId.get(link.from)?.type!=='latch'))
    issues.push('К засову подключён привод без защёлки — его легче обойти.');
  return {connections:links,connected,cycles,collisions,jammed:cycles||collisions.length>0,
    boltGates:boltEdges.length,issues};
}

export function createMechanismRuntime(){return {pawls:{},pinBanks:{},bolt:0};}

function solveSignals(parts,links,runtime,{key=0,picks={}}={}){
  const byId=new Map(parts.map(part=>[part.id,part]));
  const incoming=new Map(parts.map(part=>[part.id,[]]));
  for(const link of links)incoming.get(link.to)?.push(link.from);
  const values={},inputs={},busy=new Set();
  function evaluate(id){
    if(Object.hasOwn(values,id))return values[id];
    if(busy.has(id))return 0;
    busy.add(id);
    const part=byId.get(id);if(!part)return 0;
    const forces=(incoming.get(id)||[]).map(evaluate);
    if(Object.hasOwn(picks,id))forces.push(Number(picks[id])||0);
    const input=forces.reduce((best,v)=>Math.abs(v)>Math.abs(best)?v:best,0);
    inputs[id]=input;
    let output=0;
    switch(part.type){
      case 'key':output=clamp(key,-1,1);break;
      case 'gear':output=clamp(-input*part.setting,-1,1);break;
      case 'lever':output=clamp(input*(part.flip?-1:1),-1,1);break;
      case 'pin':output=clamp((input*part.polarity-part.setting)/(1-part.setting));break;
      case 'pinbank':{
        const pins=runtime.pinBanks?.[id]?.pins||[];
        const released=pins.length===PIN_CODES.length&&pins.every(pin=>pin.set);
        // A correctly cut key aligns all pins in one stroke. During picking,
        // only the independent, tension-held pin stack states can release it.
        output=(key>.6&&input>.6)||released?1:0;break;
      }
      case 'spring':output=clamp(input*part.setting,-1,1);break;
      case 'ratchet':output=(runtime.pawls[id]?.steps||0)/Math.max(1,part.setting);break;
      case 'cam':output=clamp((input*part.polarity-part.setting)/(1-part.setting));break;
      case 'latch':output=input*part.polarity>=part.setting?1:0;break;
      case 'splitter':output=input;break;
      case 'interlock':output=forces.length>=2&&forces.every(force=>force>=part.setting)?1:0;break;
      default:output=input;break;
    }
    values[id]=round(output);busy.delete(id);return values[id];
  }
  for(const part of parts)evaluate(part.id);
  return {values,inputs};
}

// Advancing with the *same* external inputs is stable: ratchets advance only
// on new rising edges, and all releases reset their edge detectors.
export function stepMechanism(parts,prior=createMechanismRuntime(),control={},dt=1/60){
  // The same fit constraint is enforced in the solver: a forced UI state or
  // imported action cannot hold pins with an incompatible bent wrench.
  if(Number.isInteger(control.wrenchIndex)&&!checkTensionFit(parts,control.wrenchIndex).fits)
    control={...control,tension:false,picks:{}};
  const links=buildContacts(parts);
  const runtime={pawls:Object.fromEntries(Object.entries(prior.pawls||{}).map(([id,v])=>
    [id,{steps:v.steps||0,high:!!v.high}])),
    pinBanks:Object.fromEntries(Object.entries(prior.pinBanks||{}).map(([id,bank])=>
      [id,{pins:(bank.pins||[]).map(pin=>({lift:pin.lift||0,set:!!pin.set,high:!!pin.high}))}])),
    bolt:prior.bolt||0};
  for(const part of parts){
    if(part.type!=='pinbank')continue;
    const bank=runtime.pinBanks[part.id]||{pins:PIN_CODES.map(()=>({lift:0,set:false,high:false}))};
    if(!control.tension&&!control.key){
      for(const pin of bank.pins){pin.lift=0;pin.set=false;pin.high=false;}
    }
    for(let i=0;i<PIN_CODES.length;i++){
      const pin=bank.pins[i];
      const pressure=Number(control.picks?.[`${part.id}:${i}`])||0;
      const pressed=Math.abs(pressure)>.55;
      if(pressed&&!pin.high){
        pin.lift=Math.max(0,Math.min(6,pin.lift+(pressure>0?1:-1)));
        pin.set=pin.lift===PIN_CODES[i];pin.high=true;
      }
      if(!pressed)pin.high=false;
    }
    runtime.pinBanks[part.id]=bank;
  }
  const before=solveSignals(parts,links,runtime,control);
  for(const part of parts){
    if(part.type!=='ratchet')continue;
    const input=before.inputs[part.id]||0;
    const pawl=runtime.pawls[part.id]||{steps:0,high:false};
    if(input>.55&&!pawl.high){pawl.steps=Math.min(part.setting,pawl.steps+1);pawl.high=true;}
    if(input<.24)pawl.high=false;
    runtime.pawls[part.id]=pawl;
  }
  const motion=solveSignals(parts,links,runtime,control);
  const bolt=parts.find(part=>part.type==='bolt');
  const gates=links.filter(link=>link.to===bolt?.id);
  const layout=inspectLayout(parts,links);
  const gateReady=gates.every(link=>motion.values[link.from]>=.82);
  const ready=Boolean(bolt&&!layout.jammed&&gateReady);
  const target=ready&&Boolean(control.tension)?1:0;
  const speed=clamp(dt*8,0,1);
  runtime.bolt=round(runtime.bolt+(target-runtime.bolt)*speed);
  return {runtime,links,layout,inputs:motion.inputs,values:motion.values,
    ready,open:runtime.bolt>.88,boltTravel:runtime.bolt};
}

export function canPick(part,parts){
  if(!PARTS[part.type]?.pickable)return false;
  const key=parts.find(candidate=>candidate.type==='key');
  if(!key)return false;
  if(part.x<=key.x||Math.hypot(part.x-key.x,part.y-key.y)>PICK_REACH)return false;
  for(const shield of parts){
    if(shield.type!=='shield')continue;
    // Cover only intervenes when it actually lies between keyway and target.
    const dx=part.x-key.x,dy=part.y-key.y;
    const t=clamp(((shield.x-key.x)*dx+(shield.y-key.y)*dy)/(dx*dx+dy*dy));
    const px=key.x+t*dx,py=key.y+t*dy;
    if(t>.04&&t<.98&&Math.hypot(shield.x-px,shield.y-py)<shield.setting)
      return false;
  }
  return true;
}

// Search for an exploit using the player's standard hook and tension wrench.
// The analysis must match the actual set of actions offered by the interface.
export function analyzePicking(parts){
  const layout=inspectLayout(parts);
  if(layout.jammed)return {status:'jammed',summary:'Передача заклинена.'};
  if(!layout.boltGates)return {status:'trivial',summary:'Засов уходит от одного натяжения.',moves:0};
  if(!layout.connected)return {status:'invalid',
    summary:'К одному из стопоров не подходит рабочая цепь. Штатное открытие ключом пока невозможно.'};
  const targets=parts.filter(part=>canPick(part,parts));
  if(!targets.length)return {status:'guarded',summary:'Крючок не достаёт до управляющих деталей.'};
  const secret=targets.find(part=>part.type==='pinbank');
  const wrenchIndex=keywayWrenchProfile(parts);
  if(secret){
    // Model the actual 5-step lockpicking procedure with the same stateful
    // stroke solver, including separate releases between pin movements.
    let runtime=createMechanismRuntime(),result;
    for(let i=0;i<PIN_CODES.length;i++)for(let stroke=0;stroke<PIN_CODES[i];stroke++){
      result=stepMechanism(parts,runtime,{picks:{[`${secret.id}:${i}`]:1},tension:true,wrenchIndex},.35);
      runtime=stepMechanism(parts,result.runtime,{picks:{},tension:true,wrenchIndex},.20).runtime;
    }
    result=stepMechanism(parts,runtime,{tension:true,wrenchIndex},.9);
    if(result.open)return {status:'pickable',summary:
      `Штифтовый секрет доступен из скважины: нужно по очереди выставить ${PIN_CODES.length} штифтов по линии среза.`,
      moves:PIN_CODES.reduce((sum,n)=>sum+n,0),tap:secret.id,wedge:null};
  }
  for(const tap of targets){
    if(tap.type==='pinbank')continue;
    const direction=tap.polarity||1;
    let runtime=createMechanismRuntime();
    for(let n=1;n<=5;n++){
      const rising=stepMechanism(parts,runtime,{picks:{[tap.id]:direction},tension:true,wrenchIndex},.7);
      runtime=rising.runtime;
      if(rising.open)return {status:'pickable',summary:
        'Крючок позволяет сдвинуть '+PARTS[tap.type].name.toLowerCase()+'.',
        moves:n,tap:tap.id,direction};
      runtime=stepMechanism(parts,runtime,{tension:true,wrenchIndex},.45).runtime;
    }
  }
  return {status:'guarded',summary:'Крючок и натяжитель не освобождают засов через доступные точки.'};
}
