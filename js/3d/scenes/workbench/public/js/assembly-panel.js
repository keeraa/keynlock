import {SLOT_TYPES,ASSEMBLY_STEPS,stepComplete} from './logic.js';
import {manualIllustration} from './manual.js';

export function partName(id){
  if(id==='core-0')return 'Сердцевина';
  if(id==='cover-0')return 'Крышка пружин';
  if(id==='cam-0')return 'Выходной кулачок';
  if(id==='gear-0')return 'Шестерня · 12 зубьев';
  if(id==='gear-1')return 'Шестерня · 16 зубьев';
  if(id?.startsWith('pin-'))return `Кодовый штифт ${['I','II','III','IV'][Number(id.split('-')[1])]}`;
  if(id?.startsWith('spring-'))return `Пружина ${Number(id.split('-')[1])+1}`;
  return 'Деталь не выбрана';
}

export function createAssemblyPanel({state,scene,feedback,$}){
const partGroupNames=['Сердцевина','Штифты','Пружины','Привод','Крышка'];
const partGroupButtons=ASSEMBLY_STEPS.map((step,i)=>{
  const button=document.createElement('button');button.type='button';button.className='parts-filter-button';
  button.textContent=partGroupNames[i];button.title=step.title;
  button.addEventListener('click',()=>{
    if(state.testing)return;
    state.partGroup=i;state.selectedPart=null;scene.setSelectedPart(null);
    renderAssembly();
  });
  $('partsFilter').append(button);return button;
});
function renderSelection(){
  const id=state.selectedPart;
  const attached=Boolean(id&&Object.values(state.installed).includes(id));
  $('partSelectionLabel').textContent=id?partName(id)+(attached?' · установлена':' · в лотке'):'Деталь не выбрана';
  $('removeSelected').disabled=!attached||state.testing;
}
let drawnPinSignature='';
function renderManual(){
  const signature=state.pinOrder.join('-');
  if(signature!==drawnPinSignature){
    $('manualIllustration').innerHTML=manualIllustration(state.pinOrder);
    drawnPinSignature=signature;
  }
  $('manualInstruction').textContent=
    `Порядок штифтов слева направо: ${state.pinOrder.map(i=>['I','II','III','IV'][i]).join(' · ')}. Все детали и их места показаны на одном листе.`;
  partGroupButtons.forEach((button,i)=>{
    button.classList.toggle('active',i===state.partGroup);
    button.classList.toggle('done',stepComplete(i,state.installed));
    button.setAttribute('aria-pressed',String(i===state.partGroup));
  });
  scene.setPartGroup(state.partGroup);
}
function renderAssembly(){
  const count=SLOT_TYPES.filter(id=>state.installed[id]).length;
  $('assemblyCount').textContent=`${count} / ${SLOT_TYPES.length}`;
  renderManual();renderSelection();
  if(state.testing)return;
  if(count===SLOT_TYPES.length&&state.blueprint){
    feedback('assemblyFeedback','Чертёж уже изучен. Механизм готов к повторному испытанию.','good');
  }else if(count===SLOT_TYPES.length){
    feedback('assemblyFeedback','Все 13 деталей установлены. Проверьте замок изготовленным ключом.','good');
  }else feedback('assemblyFeedback',
    `Собрано ${count} из ${SLOT_TYPES.length}. Выберите группу деталей и установите их по общей схеме.`);
}
  return {renderAssembly,renderSelection};
}
