import {cutLayout} from '../logic.js';
import {effectiveCuts,inspectMachinedKey,emptyWearProfile} from '../key-wear.js';
import {targetsForDesign,freeKeySignature} from '../assembly-design.js';
import {resetBlankState} from '../workbench-state.js';
import {describeKeyInspection} from '../key-inspection.js';
import {createKeyPanel} from '../key-panel.js';

/** The key workshop owns its controls, cutting state and visual feedback. */
export function createKeyMode({state,scene,$,query,listen,save,toast,feedback,
  releaseCapture,onAssemblyChange,onNavigate}){
  const measuredCuts=()=>effectiveCuts(state.cuts,cutLayout(state.difficulty),state.wear);
  const inspectCurrentKey=()=>inspectMachinedKey(
    state.cuts,state.targets,cutLayout(state.difficulty),state.wear);
  const {buildCutRows,selectCut,renderCuts}=createKeyPanel({
    state,scene,inspectCurrentKey,measuredCuts,feedback,$,query});

  function getDescription(){
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
    query('[data-key-method]').forEach(button=>{
      const active=button.dataset.keyMethod===state.keyMethod;
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',String(active));
    });
    if(state.mode==='key')$('sceneDescription').textContent=getDescription();
    renderCuts();save();
  }
  function setFileOrientation(next){
    const orientation=next==='top'?'top':'bottom';
    state.fileOrientation=orientation;
    state.filing=false;state.spaceFiling=false;scene.setFiling(false);
    releaseCapture(state.filingPointer);
    scene.setFileOrientation(orientation);
    query('[data-file-orientation]').forEach(button=>{
      const active=button.dataset.fileOrientation===orientation;
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',String(active));
    });
    $('keyToolInstruction').textContent=orientation==='bottom'?
      'Зубцы направлены вниз. Ведите середину насечки под ключом: стержень уходит за него. ЛКМ + движение вдоль оси — пилить; Q / E — поворот.':
      'Зубцы направлены вверх. Ведите середину насечки по зубцам: стержень уходит за ключ. ЛКМ + движение вдоль оси — пилить; Q / E — поворот.';
    if(state.mode==='key')$('sceneDescription').textContent=getDescription();
    save();
  }
  function newBlank(difficulty=state.difficulty){
    if(state.testing){toast('Дождитесь окончания испытания механизма.');return;}
    if(state.filing||state.spaceFiling){state.filing=false;state.spaceFiling=false;scene.setFiling(false);
      releaseCapture(state.filingPointer);}
    resetBlankState(state,difficulty);
    scene.updateInstalled(state.installed);scene.setBlueprint(state.targets);
    scene.setCuts(state.cuts);scene.setWear(state.wear);buildCutRows();selectCut(0);
    renderCuts();onAssemblyChange();save();
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
    buildCutRows();selectCut(0);renderCuts();onAssemblyChange();save();
    onNavigate('key');
    toast('Чертёж вашего замка перенесён на ключ. Выпилите профиль и вернитесь к сборке.');
  }
  listen($('newBlank'),'click',()=>newBlank());
  query('[data-cuts]').forEach(button=>listen(button,'click',()=>{
    const difficulty=Number(button.dataset.cuts);
    if(difficulty!==state.difficulty)newBlank(difficulty);
  }));
  listen($('inspectKey'),'click',()=>{
    const result=inspectCurrentKey();
    if(result.brokenAt>=0){newBlank();return;}
    const inspection=describeKeyInspection(result,state.targets,state.keyMethod);
    state.keyInspection=inspection;
    if(inspection.tooth>=0)selectCut(inspection.tooth);
    renderCuts();toast(inspection.message);
  });
  query('[data-key-method]').forEach(button=>listen(button,'click',
    ()=>setKeyMethod(button.dataset.keyMethod)));
  query('[data-file-orientation]').forEach(button=>listen(button,'click',
    ()=>setFileOrientation(button.dataset.fileOrientation)));

  setKeyMethod(state.keyMethod);
  setFileOrientation(state.fileOrientation);
  buildCutRows();selectCut(0);renderCuts();
  return {getDescription,setKeyMethod,setFileOrientation,newBlank,prepareDesignKey,
    measuredCuts,inspectCurrentKey,buildCutRows,selectCut,renderCuts};
}
