import {ASSEMBLY_STEPS} from './logic.js';
import {EXTENDED_STEPS,assemblyStepsFor,requiredAssemblySlots,hasExtraHardware,
  swapPinCode,freeKeySignature} from './assembly-design.js';
import {manualIllustration} from './manual.js';

const ROMAN=['I','II','III','IV'];
const PART_GROUP_NAMES=['Сердцевина','Штифты','Пружины','Привод','Крышка','Фиксаторы','Засов'];

export function partName(id,ratio='12:16'){
  if(id==='core-0')return 'Сердцевина';
  if(id==='cover-0')return 'Крышка пружин';
  if(id==='cam-0')return 'Выходной кулачок';
  if(id==='gear-0')return `Шестерня · ${ratio==='16:12'?16:12} зубьев`;
  if(id==='gear-1')return `Шестерня · ${ratio==='16:12'?12:16} зубьев`;
  if(id?.startsWith('pin-'))return `Кодовый штифт ${ROMAN[Number(id.split('-')[1])]}`;
  if(id?.startsWith('spring-'))return `Пружина ${Number(id.split('-')[1])+1}`;
  if(id?.startsWith('washer-'))return `Опорная шайба ${Number(id.split('-')[1])+1}`;
  if(id==='clip-0')return 'Стопорное кольцо';
  if(id==='rod-0')return 'Передающая тяга';
  if(id==='bolt-0')return 'Подвижный засов';
  return 'Деталь не выбрана';
}

export function createAssemblyPanel({state,scene,feedback,$,onChange=()=>{},onCutDesignKey=()=>{}}){
  const groups=[...ASSEMBLY_STEPS,...EXTENDED_STEPS];
  const partGroupButtons=groups.map((step,i)=>{
    const button=document.createElement('button');button.type='button';button.className='parts-filter-button';
    button.textContent=PART_GROUP_NAMES[i];button.title=step.title;
    button.addEventListener('click',()=>{
      if(state.testing)return;
      state.partGroup=i;state.selectedPart=null;scene.setSelectedPart(null);
      renderAssembly();onChange();
    });
    $('partsFilter').append(button);return button;
  });

  const pinSelects=Array.from({length:4},(_,index)=>{
    const label=document.createElement('label');label.className='design-pin';
    label.textContent=`КАНАЛ ${index+1}`;
    const select=document.createElement('select');select.setAttribute('aria-label',`Код штифта, канал ${index+1}`);
    ROMAN.forEach((name,code)=>{
      const option=document.createElement('option');option.value=String(code);option.textContent=name;
      select.append(option);
    });
    select.addEventListener('change',()=>{
      if(state.testing)return;
      state.freeDesign=swapPinCode(state.freeDesign,index,Number(select.value));
      applyDesignChange();
    });
    label.append(select);$('designPinRow').append(label);return select;
  });
  $('designRatio').addEventListener('change',()=>{
    if(state.testing)return;
    state.freeDesign.ratio=$('designRatio').value;
    applyDesignChange();
  });
  $('designReinforced').addEventListener('change',()=>{
    if(state.testing)return;
    state.freeDesign.reinforced=$('designReinforced').checked;
    state.partGroup=0;
    applyDesignChange();
  });
  $('cutDesignKey').addEventListener('click',()=>{
    if(!state.testing)onCutDesignKey();
  });
  document.querySelectorAll('[data-assembly-variant]').forEach(button=>{
    button.addEventListener('click',()=>{
      if(state.testing)return;
      state.assemblyVariant=button.dataset.assemblyVariant;
      state.partGroup=0;state.selectedPart=null;scene.setSelectedPart(null);
      applyDesignChange();
    });
  });

  function applyDesignChange(){
    scene.setAssemblyDesign(state.assemblyVariant,state.freeDesign);
    renderAssembly();onChange();
  }
  function renderSelection(){
    const id=state.selectedPart;
    const attached=Boolean(id&&Object.values(state.installed).includes(id));
    const ratio=state.assemblyVariant==='free'?state.freeDesign.ratio:'12:16';
    $('partSelectionLabel').textContent=id?partName(id,ratio)+(attached?' · установлена':' · в лотке'):
      'Деталь не выбрана';
    $('removeSelected').disabled=!attached||state.testing;
  }
  let drawnSignature='';
  function renderManual(){
    const variant=state.assemblyVariant,design=state.freeDesign;
    const order=variant==='free'?design.order:state.pinOrder;
    const ratio=variant==='free'?design.ratio:'12:16';
    const hardware=hasExtraHardware(variant,design);
    const signature=[order.join('-'),ratio,hardware].join('|');
    if(signature!==drawnSignature){
      $('manualIllustration').innerHTML=manualIllustration(order,{ratio,hardware});
      drawnSignature=signature;
    }
    $('manualInstruction').textContent=
      `Каналы: ${order.map(i=>ROMAN[i]).join(' · ')}. Передача ${ratio}. `+
      (hardware?'Шайбы, стопорное кольцо, тяга и засов обязательны.':'Базовый прямой привод.');
    partGroupButtons.forEach((button,i)=>{
      const activeGroup=assemblyStepsFor(variant,design)[i];
      button.hidden=!activeGroup;
      button.classList.toggle('active',i===state.partGroup);
      button.classList.toggle('done',Boolean(activeGroup&&activeGroup.slots.every(slot=>state.installed[slot])));
      button.setAttribute('aria-pressed',String(i===state.partGroup));
    });
    scene.setPartGroup(state.partGroup);
  }
  function renderDesign(){
    const variant=state.assemblyVariant,design=state.freeDesign;
    $('freeDesignPanel').hidden=variant!=='free';
    document.querySelectorAll('[data-assembly-variant]').forEach(button=>{
      const active=button.dataset.assemblyVariant===variant;
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',String(active));
    });
    if(variant==='free'){
      pinSelects.forEach((select,i)=>{select.value=String(design.order[i]);select.disabled=state.testing;});
      $('designRatio').value=design.ratio;
      $('designRatio').disabled=state.testing;
      $('designReinforced').checked=design.reinforced;
      $('designReinforced').disabled=state.testing;
      const ready=state.freeKeyBlueprint===freeKeySignature(design);
      $('designKeyStatus').textContent=ready?
        'Чертёж ключа готов. Выпилите его профиль на верстаке.':
        'Требуется заготовка с вашим кодом штифтов.';
      $('designKeyStatus').classList.toggle('ready',ready);
      $('cutDesignKey').textContent=ready?'Перенарезать ключ по чертежу ↻':
        'Изготовить ключ по своему чертежу →';
    }
  }
  function renderAssembly(){
    scene.setAssemblyDesign(state.assemblyVariant,state.freeDesign);
    renderDesign();renderManual();renderSelection();
    const required=requiredAssemblySlots(state.assemblyVariant,state.freeDesign);
    const count=required.filter(id=>state.installed[id]).length;
    $('assemblyCount').textContent=`${count} / ${required.length}`;
    if(state.testing)return;
    if(count===required.length&&state.blueprint){
      feedback('assemblyFeedback','Все узлы на месте. Механизм готов к повторному испытанию.','good');
    }else if(count===required.length){
      feedback('assemblyFeedback',`Все ${required.length} деталей установлены. Проверьте работу механизма.`, 'good');
    }else feedback('assemblyFeedback',
      `Собрано ${count} из ${required.length}. Выберите группу деталей и установите их в гнёзда.`);
  }
  return {renderAssembly,renderSelection,renderDesign};
}
