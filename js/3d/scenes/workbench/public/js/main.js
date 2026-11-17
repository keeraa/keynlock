import {detachPart,cutLayout,checkSocket} from './logic.js';
import {createWorkshopScene} from './scene.js';
import {effectiveCuts,inspectMachinedKey,emptyWearProfile} from './key-wear.js';
import {assemblyStepsFor,requiredAssemblySlots,inspectConfiguredAssembly,
  targetsForDesign,freeKeySignature} from './assembly-design.js';
import {loadWorkbenchState,saveWorkbenchState,resetBlankState} from './workbench-state.js';
import {describeKeyInspection} from './key-inspection.js';
import {createKeyPanel} from './key-panel.js';
import {createAssemblyPanel,partName} from './assembly-panel.js';
import {installWorkbenchInput} from './workbench-input.js';
import {createMechanismUI} from './mechanism-ui.js';
import {createCodeLockUI} from './code-lock-ui.js';

const $=id=>document.getElementById(id);
const canvas=$('scene');
const state=loadWorkbenchState();
let scene;
let hasWebGL=true;
try{scene=createWorkshopScene(canvas);}catch(error){
  console.error(error);
  hasWebGL=false;
  // The free-form lock is another WebGL scene. Show a clear diagnostic if the
  // device cannot create either renderer.
  const noop=()=>{};
  scene=new Proxy({}, {get:(_target,key)=>key==='getFps'||key==='getPolygons'?()=>0:
    key==='filingContact'?()=>-1:key==='hitTest'?()=>null:noop});
  $('sceneDescription').textContent='Для трёхмерной мастерской и механизмов требуется WebGL.';
  $('keyFeedback').textContent='Браузер не поддерживает запуск этой 3D-сцены.';
  document.querySelectorAll('[data-mode="key"],[data-mode="assembly"]').forEach(button=>{
    button.disabled=true;button.title='Для 3D-сцен требуется WebGL2';});
}
scene.setBlueprint(state.targets);scene.setCuts(state.cuts);
scene.setWear(state.wear);
scene.setKeyMethod(state.keyMethod);
scene.setAssemblyDesign(state.assemblyVariant,state.freeDesign);
scene.updateInstalled(state.installed);
const sandbox=createMechanismUI();
const codeBox=createCodeLockUI({canvas:$('codeCanvas'),$,toast,
  isActive:()=>state.mode==='code'});

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
const {renderAssembly,renderSelection,renderDesign}=createAssemblyPanel({state,scene,feedback,$,
  onChange:()=>{
    if(state.mode==='assembly')$('sceneDescription').textContent=assemblySceneDescription();
    save();
  },
  onCutDesignKey:()=>prepareDesignKey()
});

function assemblySceneDescription(){
  if(state.assemblyVariant==='free')return 'Проектируйте код штифтов, передаточное отношение и привод. Соберите свой замок и изготовьте к нему ключ.';
  if(state.assemblyVariant==='extended')return '18 деталей: две шайбы, стопорное кольцо, тяга и подвижный засов дополняют цилиндр.';
  return 'Сверяйтесь с одной контурной схемой и собирайте замок в любом порядке.';
}

function setMode(mode){
  if(state.filing||state.spaceFiling){state.filing=false;state.spaceFiling=false;
    scene.setFiling(false);save();try{canvas.releasePointerCapture(state.filingPointer);}catch{}}
  if(state.drag){state.drag=null;scene.updateInstalled(state.installed);}
  state.mode=mode;state.selectedPart=null;state.cameraDragging=false;
  scene.setMode(mode==='mechanism'||mode==='code'?'assembly':mode);
  scene.setSuspended(mode==='mechanism'||mode==='code');
  document.body.classList.toggle('mechanism-active',mode==='mechanism');
  document.body.classList.toggle('code-active',mode==='code');
  if(mode==='mechanism')sandbox.open();else sandbox.close();
  $('codeWorkspace').hidden=mode!=='code';
  if(mode==='code')codeBox.open();else codeBox.close();
  document.querySelectorAll('.workspace-tab').forEach(button=>{
    const active=button.dataset.mode===mode;button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  });
  $('keyPanel').hidden=mode!=='key';$('assemblyPanel').hidden=mode!=='assembly';
  $('codePanel').hidden=mode!=='code';
  $('workbenchHint').hidden=mode!=='key';
  $('sceneIndex').textContent=mode==='key'?'01 / 04':mode==='assembly'?'02 / 04':
    mode==='mechanism'?'03 / 04':'04 / 04';
  $('sceneTitle').textContent=mode==='key'?'Изготовление ключа':
    mode==='assembly'?'Сборка штифтового механизма':
    mode==='mechanism'?'Песочница механизмов':'Кодовая шкатулка';
  $('sceneDescription').textContent=mode==='key'?keySceneDescription():
    mode==='assembly'?assemblySceneDescription():
      mode==='mechanism'?
      'Трёхмерный разрез замка: взаимосвязанные механизмы, ключ, стопоры и проверка взлома.':
      'Сверьтесь с шестизначным кодом в меню. Нажимайте стрелки на шкатулке и откройте крышку.';
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
function prepareDesignKey(){
  if(state.testing)return;
  state.targets=targetsForDesign(state.targets,state.freeDesign);
  state.pinOrder=[...state.freeDesign.order];
  state.signature=state.targets.map(target=>String(Math.round(target*100))).join('-');
  state.serial++;
  state.cuts=Array(state.difficulty).fill(0);
  state.wear=emptyWearProfile();
  state.warnedOvercut=Array(state.difficulty).fill(false);
  state.keyInspection=null;state.blueprint=false;
  state.freeKeyBlueprint=freeKeySignature(state.freeDesign);
  scene.setBlueprint(state.targets);scene.setCuts(state.cuts);scene.setWear(state.wear);
  buildCutRows();selectCut(0);renderCuts();renderAssembly();save();
  setMode('key');
  toast('Чертёж вашего замка перенесён на ключ. Выпилите профиль и вернитесь к сборке.');
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
  const groupIndex=assemblyStepsFor(state.assemblyVariant,state.freeDesign)
    .findIndex(step=>step.slots.includes(socket));
  if(groupIndex>=0)state.partGroup=groupIndex;
  state.selectedPart=null;scene.updateInstalled(state.installed);scene.setSelectedPart(null);
  renderAssembly();save();toast(`Деталь «${partName(id,state.assemblyVariant==='free'?state.freeDesign.ratio:'12:16')}» снята и возвращена в лоток.`);
  return true;
}
$('removeSelected').addEventListener('click',()=>{
  if(state.selectedPart&&!state.testing)removePart(state.selectedPart);
});

function placement(partId,socketId){
  if(!requiredAssemblySlots(state.assemblyVariant,state.freeDesign).includes(socketId)||
    !checkSocket(partId,socketId)){
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
  const outcome=inspectConfiguredAssembly(state.installed,actual,state.targets,state.pinOrder,
    state.assemblyVariant,state.freeDesign,state.freeKeyBlueprint);
  if(outcome.key.accurate&&!inspectCurrentKey().accurate){
    outcome.success=false;outcome.key.accurate=false;
  }
  if(!outcome.complete){
    toast(`Не хватает ${outcome.missing.length} деталей. Закончите сборку.`);return;
  }
  if(outcome.keyBlueprintMissing){
    toast('Спроектируйте и изготовьте ключ для текущего кода штифтов.');return;
  }
  state.testing=true;$('runTest').disabled=true;renderDesign();
  feedback('assemblyFeedback','Проверка: ключ поднимает кодовые штифты, пружины сжимаются, привод получает усилие…');
  scene.startTest(outcome.success,actual,state.installed,()=>{
    state.testing=false;$('runTest').disabled=false;renderDesign();
    if(outcome.success){
      state.blueprint=true;save();
      const ratio=state.assemblyVariant==='free'?state.freeDesign.ratio:'12:16';
      const hardware=requiredAssemblySlots(state.assemblyVariant,state.freeDesign).length>13;
      feedback('assemblyFeedback',`Успех! Линия среза совпала, передача ${ratio} сработала, ${hardware?'тяга переместила отдельный засов':'засов открылся'}. Чертёж сохранён.`,'good');
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
buildCutRows();selectCut(0);renderCuts();renderAssembly();setMode(hasWebGL?'key':'mechanism');
const fpsTimer=setInterval(()=>{
  $('fps').textContent=String(scene.getFps()||'—');
  $('polygons').textContent=scene.getPolygons().toLocaleString('ru-RU');
},850);
window.addEventListener('beforeunload',()=>{
  clearTimeout(toastTimer);clearInterval(fpsTimer);detachControls();sandbox.dispose();
  codeBox.dispose();scene.dispose();
},{once:true});
