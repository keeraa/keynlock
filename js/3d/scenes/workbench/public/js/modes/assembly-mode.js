import {detachPart,checkSocket} from '../logic.js';
import {assemblyStepsFor,requiredAssemblySlots,inspectConfiguredAssembly} from '../assembly-design.js';
import {createAssemblyPanel,partName} from '../assembly-panel.js';

/** Pin-lock assembly shares its physical key with key-mode, but owns the
 * installation controls, design variants, test and result handling. */
export function createAssemblyMode({state,scene,keyMode,$,query,listen,save,toast,feedback,
  onCutDesignKey}){
  const {renderAssembly,renderSelection,renderDesign}=createAssemblyPanel({
    state,scene,feedback,$,query,onChange:()=>{
      if(state.mode==='assembly')$('sceneDescription').textContent=getDescription();
      save();
    },onCutDesignKey});
  function getDescription(){
    if(state.assemblyVariant==='free')return 'Проектируйте код штифтов, передаточное отношение и привод. Соберите свой замок и изготовьте к нему ключ.';
    if(state.assemblyVariant==='extended')return '18 деталей: две шайбы, стопорное кольцо, тяга и подвижный засов дополняют цилиндр.';
    return 'Сверяйтесь с одной контурной схемой и собирайте замок в любом порядке.';
  }
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
  function placement(partId,socketId){
    if(!requiredAssemblySlots(state.assemblyVariant,state.freeDesign).includes(socketId)||
      !checkSocket(partId,socketId)){
      toast('Деталь не подходит к этому посадочному месту.');return false;
    }
    for(const [socket,id] of Object.entries(state.installed))if(id===partId)delete state.installed[socket];
    state.installed[socketId]=partId;
    state.selectedPart=null;scene.updateInstalled(state.installed);scene.setSelectedPart(null);
    renderAssembly();save();return true;
  }
  function testMechanism(){
    if(state.testing)return;
    const actual=keyMode.measuredCuts();
    const outcome=inspectConfiguredAssembly(state.installed,actual,state.targets,state.pinOrder,
      state.assemblyVariant,state.freeDesign,state.freeKeyBlueprint);
    if(outcome.key.accurate&&!keyMode.inspectCurrentKey().accurate){
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
  listen($('resetAssembly'),'click',()=>{
    state.installed={};state.selectedPart=null;state.partGroup=0;
    scene.updateInstalled(state.installed);scene.setSelectedPart(null);renderAssembly();save();
    toast('Все детали возвращены в лоток.');
  });
  listen($('removeSelected'),'click',()=>{
    if(state.selectedPart&&!state.testing)removePart(state.selectedPart);
  });
  listen($('runTest'),'click',testMechanism);
  renderAssembly();
  return {getDescription,renderAssembly,renderSelection,renderDesign,
    removePart,placement,testMechanism};
}
