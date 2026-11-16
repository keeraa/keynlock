import {inspectAssembly,detachPart,cutLayout} from './logic.js';
import {createWorkshopScene} from './scene.js';
import {effectiveCuts,inspectMachinedKey} from './key-wear.js';
import {loadWorkbenchState,saveWorkbenchState,resetBlankState} from './workbench-state.js';
import {describeKeyInspection} from './key-inspection.js';
import {createKeyPanel} from './key-panel.js';
import {createAssemblyPanel,partName} from './assembly-panel.js';
import {installWorkbenchInput} from './workbench-input.js';

const $=id=>document.getElementById(id);
const canvas=$('scene');
const state=loadWorkbenchState();
let scene;
try{scene=createWorkshopScene(canvas);}catch(error){
  console.error(error);
  $('sceneDescription').textContent='Для работы мастерской нужен браузер с поддержкой WebGL2.';
  $('keyFeedback').textContent='Не удалось запустить 3D-сцену.';
  throw error;
}
scene.setBlueprint(state.targets);scene.setCuts(state.cuts);
scene.setWear(state.wear);
scene.setKeyMethod(state.keyMethod);
scene.updateInstalled(state.installed);

let toastTimer;
function toast(message){
  const node=$('toast');node.textContent=message;node.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove('show'),3100);
}
function save(){
  saveWorkbenchState(state);
}
function feedback(id,message,tone=''){
  const el=$(id);el.textContent=message;el.classList.toggle('good',tone==='good');
  el.classList.toggle('bad',tone==='bad');
}

function measuredCuts(){return effectiveCuts(state.cuts,cutLayout(state.difficulty),state.wear);}
function inspectCurrentKey(){return inspectMachinedKey(
  state.cuts,state.targets,cutLayout(state.difficulty),state.wear);}
const {buildCutRows,selectCut,renderCuts}=createKeyPanel({
  state,scene,inspectCurrentKey,measuredCuts,feedback,$
});
const {renderAssembly,renderSelection}=createAssemblyPanel({state,scene,feedback,$});

function setMode(mode){
  if(state.filing||state.spaceFiling){state.filing=false;state.spaceFiling=false;
    scene.setFiling(false);save();try{canvas.releasePointerCapture(state.filingPointer);}catch{}}
  if(state.drag){state.drag=null;scene.updateInstalled(state.installed);}
  state.mode=mode;state.selectedPart=null;state.cameraDragging=false;scene.setMode(mode);
  document.querySelectorAll('.workspace-tab').forEach(button=>{
    const active=button.dataset.mode===mode;button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  });
  $('keyPanel').hidden=mode!=='key';$('assemblyPanel').hidden=mode!=='assembly';
  $('workbenchHint').hidden=mode!=='key';
  $('sceneIndex').textContent=mode==='key'?'01 / 02':'02 / 02';
  $('sceneTitle').textContent=mode==='key'?'Изготовление ключа':'Сборка штифтового механизма';
  $('sceneDescription').textContent=mode==='key'?
    keySceneDescription():
    'Сверяйтесь с одной контурной схемой и собирайте замок в любом порядке.';
  renderAssembly();
}
document.querySelectorAll('.workspace-tab').forEach(button=>button.addEventListener('click',()=>setMode(button.dataset.mode)));

function keySceneDescription(){
  const teeth=state.fileOrientation==='bottom'?'вниз':'вверх';
  if(state.keyMethod==='soap')
    return `Заготовка зубцами ${teeth}. Изготовьте ключ по настоящему углублению в мыльном слепке.`;
  if(state.keyMethod==='imprint')
    return `Заготовка зубцами ${teeth}. Сравнивайте профиль с контурным чертежом на доске.`;
  return `Заготовка в тисках зубцами ${teeth}. Выпилите ${state.difficulty} пазов по чертежу.`;
}
function setKeyMethod(next){
  state.keyMethod=next==='imprint'||next==='soap'?next:'guided';
  state.keyInspection=null;
  state.filing=false;state.spaceFiling=false;scene.setFiling(false);
  releaseCapture(state.filingPointer);
  scene.setKeyMethod(state.keyMethod);
  const manual=state.keyMethod!=='guided';
  $('keyPanel').classList.toggle('imprint-mode',manual);
  $('cutCaption').textContent=state.keyMethod==='soap'?'ПО СЛЕПКУ':
    state.keyMethod==='imprint'?'ПО СХЕМЕ':'ФАКТ / ЧЕРТЁЖ';
  $('filingNote').textContent=manual?
    'Выпиливайте профиль на глаз. Автодоводка отключена; результат покажет проверка ключа.':
    'На 95% паз автоматически совпадает с чертежом. Дальнейшие движения углубляют его: можно перепилить ключ насквозь.';
  document.querySelectorAll('[data-key-method]').forEach(button=>{
    const active=button.dataset.keyMethod===state.keyMethod;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  });
  if(state.mode==='key')$('sceneDescription').textContent=keySceneDescription();
  renderCuts();save();
}
document.querySelectorAll('[data-key-method]').forEach(button=>button.addEventListener('click',
  ()=>setKeyMethod(button.dataset.keyMethod)));
setKeyMethod(state.keyMethod);

function setFileOrientation(next){
  const orientation=next==='top'?'top':'bottom';
  state.fileOrientation=orientation;
  state.filing=false;state.spaceFiling=false;scene.setFiling(false);
  releaseCapture(state.filingPointer);
  scene.setFileOrientation(orientation);
  document.querySelectorAll('[data-file-orientation]').forEach(button=>{
    const active=button.dataset.fileOrientation===orientation;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  });
  $('keyToolInstruction').textContent=orientation==='bottom'?
    'Зубцы направлены вниз. Ведите середину насечки под ключом: стержень уходит за него. ЛКМ + движение вдоль оси — пилить; Q / E — поворот.':
    'Зубцы направлены вверх. Ведите середину насечки по зубцам: стержень уходит за ключ. ЛКМ + движение вдоль оси — пилить; Q / E — поворот.';
  if(state.mode==='key')
    $('sceneDescription').textContent=keySceneDescription();
  save();
}
document.querySelectorAll('[data-file-orientation]').forEach(button=>
  button.addEventListener('click',()=>setFileOrientation(button.dataset.fileOrientation)));
setFileOrientation(state.fileOrientation);

function newBlank(difficulty=state.difficulty){
  if(state.testing){toast('Дождитесь окончания испытания механизма.');return;}
  if(state.filing||state.spaceFiling){state.filing=false;state.spaceFiling=false;scene.setFiling(false);
    releaseCapture(state.filingPointer);}
  resetBlankState(state,difficulty);
  scene.updateInstalled(state.installed);scene.setBlueprint(state.targets);
  scene.setCuts(state.cuts);scene.setWear(state.wear);buildCutRows();selectCut(0);
  renderCuts();renderAssembly();save();
  toast(`Новая заготовка № ${state.serial}: ${state.difficulty} пазов, новый профиль.`);
}
$('newBlank').addEventListener('click',()=>newBlank());
document.querySelectorAll('[data-cuts]').forEach(button=>button.addEventListener('click',()=>{
  const difficulty=Number(button.dataset.cuts);
  if(difficulty!==state.difficulty)newBlank(difficulty);
}));
$('inspectKey').addEventListener('click',()=>{
  const result=inspectCurrentKey();
  if(result.brokenAt>=0){newBlank();return;}
  const inspection=describeKeyInspection(result,state.targets,state.keyMethod);
  state.keyInspection=inspection;
  if(inspection.tooth>=0)selectCut(inspection.tooth);
  renderCuts();
  toast(inspection.message);
});
$('resetAssembly').addEventListener('click',()=>{
  state.installed={};state.selectedPart=null;
  state.partGroup=0;
  scene.updateInstalled(state.installed);scene.setSelectedPart(null);renderAssembly();save();
  toast('Все детали возвращены в лоток.');
});

function removePart(id){
  const socket=Object.keys(state.installed).find(key=>state.installed[key]===id);
  if(!socket)return false;
  state.installed=detachPart(state.installed,id);
  const groupIndex=ASSEMBLY_STEPS.findIndex(step=>step.slots.includes(socket));
  if(groupIndex>=0)state.partGroup=groupIndex;
  state.selectedPart=null;scene.updateInstalled(state.installed);scene.setSelectedPart(null);
  renderAssembly();save();toast(`Деталь «${partName(id)}» снята и возвращена в лоток.`);
  return true;
}
$('removeSelected').addEventListener('click',()=>{
  if(state.selectedPart&&!state.testing)removePart(state.selectedPart);
});

function placement(partId,socketId){
  if(!checkSocket(partId,socketId)){
    toast('Деталь не подходит к этому посадочному месту.');return false;
  }
  for(const [socket,id] of Object.entries(state.installed))if(id===partId)delete state.installed[socket];
  // Replacing a fitted pin returns the previous pin to the lower tray.
  state.installed[socketId]=partId;
  state.selectedPart=null;scene.updateInstalled(state.installed);scene.setSelectedPart(null);
  renderAssembly();save();return true;
}
function testMechanism(){
  if(state.testing)return;
  const actual=measuredCuts();
  const outcome=inspectAssembly(state.installed,actual,state.targets,state.pinOrder);
  if(outcome.key.accurate&&!inspectCurrentKey().accurate){
    outcome.success=false;outcome.key.accurate=false;
  }
  if(!outcome.complete){
    toast(`Не хватает ${outcome.missing.length} деталей. Закончите сборку.`);return;
  }
  state.testing=true;$('runTest').disabled=true;
  feedback('assemblyFeedback','Проверка: ключ поднимает кодовые штифты, пружины сжимаются, привод получает усилие…');
  scene.startTest(outcome.success,actual,state.installed,()=>{
    state.testing=false;$('runTest').disabled=false;
    if(outcome.success){
      state.blueprint=true;save();
      feedback('assemblyFeedback','Успех! Линия среза совпала, шестерни 12:16 передали вращение, засов открылся. Чертёж сохранён.','good');
      toast('Механизм собран и работает. Чертёж штифтового замка изучен.');
    }else if(!outcome.key.accurate){
      feedback('assemblyFeedback','Ключ не вывел все пары штифтов на линию среза. Исправьте профиль на верстаке.','bad');
      toast('Проверка не пройдена: профиль ключа не совпадает.');
    }else if(outcome.wrongPins.length){
      feedback('assemblyFeedback',`Не совпала длина штифтов в каналах: ${outcome.wrongPins.map(i=>i+1).join(', ')}. Поменяйте их местами.`, 'bad');
      toast('Штифты не выставились на линию среза.');
    }
  });
}
$('runTest').addEventListener('click',testMechanism);

function releaseCapture(pointerId){
  try{if(canvas.hasPointerCapture(pointerId))canvas.releasePointerCapture(pointerId);}catch{}
}
const detachControls=installWorkbenchInput({canvas,state,scene,save,toast,measuredCuts,
  inspectCurrentKey,selectCut,renderCuts,renderSelection,removePart,placement,
  testMechanism,releaseCapture,inspectKeyButton:$('inspectKey')});
buildCutRows();selectCut(0);renderCuts();renderAssembly();setMode('key');
const fpsTimer=setInterval(()=>{
  $('fps').textContent=String(scene.getFps()||'—');
  $('polygons').textContent=scene.getPolygons().toLocaleString('ru-RU');
},850);
window.addEventListener('beforeunload',()=>{
  clearTimeout(toastTimer);clearInterval(fpsTimer);detachControls();scene.dispose();
},{once:true});
