(() => {
  'use strict';
  const store=window.KeynlockSaveStore,key='keynlockLairTraining';
  let state=store.getJSON(key,{step:null});
  const panel=document.createElement('aside');panel.id='lairTraining';panel.hidden=true;panel.setAttribute('aria-label','Обучение в логове');
  panel.innerHTML='<small id="trainingCount"></small><strong id="trainingTitle"></strong><p id="trainingText" aria-live="polite"></p><button type="button" id="trainingAction"></button>';
  document.body.append(panel);
  const help=document.createElement('button');help.id='trainingHelp';help.type='button';help.textContent='?';help.setAttribute('aria-label','Показать или скрыть обучение');help.setAttribute('aria-controls','lairTraining');document.body.append(help);
  let helpOpen=false,lastView='';
  help.addEventListener('click',()=>{helpOpen=!helpOpen;render();});
  const stages={
    return:['Снова в логове','Сай: «Замок открыт. Теперь займусь найденной картиной. В мастерской ей будет безопаснее».','Открыть мастерскую'],
    restoration:['Реставрация картины','Очисти полотно щёткой, исследуй УФ-фонарём и обработай найденные следы реагентом. Удали проявленные пятна, восстанови утраты кистью и подбери цвет. Нажми «Проверить».','Открыть мастерскую'],
    craft:['Создай одну отмычку','Первая отмычка сломалась на заказе. Создай одну новую из двух деталей, чтобы пополнить футляр.','К верстаку'],
    buy:['Купи одну отмычку','Кай: «Запасной инструмент дешевле сорванного дела». Купи одну обычную отмычку за 30 монет. Если футляр полон, она останется в запасе; с собой можно взять три.','К верстаку'],
    done:['Всё готово к следующему заказу','Картина восстановлена. Ты умеешь создавать и покупать отмычки. Теперь можно продолжить заказы первого уровня.','Открыть журнал']
  };
  function persist(){store.setJSON(key,state);window.dispatchEvent(new Event('keynlock-training-change'));}
  let displayedStep=null;
  function render(){
    const module=document.querySelector('#lairModuleWindow'),workbench=document.querySelector('#lairWorkbenchModal');
    const view=module&&!module.hidden?module.dataset.module:workbench&&!workbench.hidden?'workbench':'';
    if(view!==lastView){lastView=view;helpOpen=false;}
    const available=!!state.step&&!state.finished&&state.step!=='loot';
    help.hidden=!available;
    const journal=document.querySelector('#campaignButton');
    if(journal)help.style.left=`${journal.offsetLeft+journal.offsetWidth+8}px`;
    panel.hidden=!available||(!!view&&!helpOpen);
    help.setAttribute('aria-expanded',String(!panel.hidden));
    if(panel.hidden)return;
    if(displayedStep!==state.step){displayedStep=state.step;panel.classList.remove('trainingAttention');void panel.offsetWidth;panel.classList.add('trainingAttention');}
    const row=stages[state.step];
    panel.querySelector('small').textContent=`ПОСЛЕ ПЕРВОГО ЗАКАЗА · ${Object.keys(stages).indexOf(state.step)+1} / 5`;
    panel.querySelector('strong').textContent=row[0];panel.querySelector('p').textContent=row[1];panel.querySelector('button').textContent=row[2];
    const workshop=document.querySelector('#lairModuleWindow');
    const bench=document.querySelector('#lairWorkbenchModal');
    panel.querySelector('button').hidden=(['return','restoration'].includes(state.step)&&workshop?.dataset.module==='restoration'&&!workshop.hidden)||(['craft','buy'].includes(state.step)&&bench&&!bench.hidden);
  }
  function advance(step){state.step=step;persist();render();window.KeynlockResources.render();}
  function resume(){
    if(!state.step||state.finished)return false;
    if(state.step==='loot'){document.body.classList.remove('solved-notice-visible');advance('return');window.KeynlockLair.open();}
    else if(state.step==='return'){advance('restoration');window.KeynlockLair.module('restoration');}
    else if(state.step==='restoration')window.KeynlockLair.module('restoration');
    else if(state.step==='craft'||state.step==='buy')window.KeynlockLair.workbench();
    else {state.finished=true;persist();render();window.KeynlockCampaign.open();}
    return true;
  }
  panel.querySelector('button').addEventListener('click',resume);
  window.addEventListener('keynlock-mission-cleared',event=>{
    if(state.step||!event.detail.guided||event.detail.orderId!=='wharf-1')return;
    state={step:'loot',paintingId:window.KeynlockPaintingRewards.ownedIds().at(-1),lootText:document.querySelector('#solvedPuzzleLoot').textContent};persist();render();
    document.querySelector('#newPuzzleButton').textContent='Вернуться в логово';
  });
  window.addEventListener('keynlock-restored',event=>{
    if(state.step!=='restoration'||event.detail.id!==state.paintingId)return;
    advance('craft');
    keynlockResources.parts=Math.max(2,keynlockResources.parts);
    saveKeynlockResources();
    window.KeynlockLair.workbench();
  });
  window.addEventListener('keynlock-pick-acquired',event=>{
    if(state.step==='craft'&&event.detail.source==='craft')advance('buy');
    else if(state.step==='buy'&&event.detail.source==='buy')advance('done');
  });
  window.addEventListener('keynlock:play',()=>{
    if(!state.step&&window.KeynlockCampaign.progress.completed.includes('wharf-1')){state={step:'return',paintingId:window.KeynlockPaintingRewards.ownedIds().at(-1)};persist();}
    if(state.step==='loot'){
      if(lairOpen)closeLair();
      solved=true;setGameInactive(true);
      document.querySelector('#solvedPuzzleLoot').textContent=state.lootText||'Награда за заказ получена. Найденная картина ждёт в мастерской.';
      document.querySelector('#newPuzzleButton').textContent='Вернуться в логово';
      document.body.classList.add('solved-notice-visible');
      render();
    }else if(state.step&&!state.finished){window.KeynlockLair.open();render();}});
  window.KeynlockOnboarding={resume,get active(){return !!state.step&&!state.finished;},get step(){return state.finished?null:state.step;},get paintingId(){return state.step==='restoration'?state.paintingId:null;}};
  const viewObserver=new MutationObserver(render);
  ['#lairModuleWindow','#lairWorkbenchModal'].forEach(selector=>{const target=document.querySelector(selector);if(target)viewObserver.observe(target,{attributes:true,attributeFilter:['hidden','data-module']});});
  render();
})();
