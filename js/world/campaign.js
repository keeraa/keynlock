/* A short authored route, alongside the free city map. Progress uses SaveStore
   so ordinary save slots and New Game include it automatically. */
(() => {
  'use strict';
  const store=window.KeynlockSaveStore;
  const briefs=[
    {mode:'wharf',title:'Набережная',mechanic:'Последовательность задвижек',place:'Порт',story:'Открой складской механизм. Найди порядок задвижек и повтори найденную последовательность до конца.',hint:'Нажимай на задвижки и запоминай, какие поднимаются. Ошибка сбрасывает цепочку; две ошибки подряд ломают отмычку. Когда поднимешь все четыре задвижки, нажми «Открыть». Следи за шкалой шума. При появлении птицы посмотри вверх или удерживай указатель на ней, пока она не улетит.',time:'Без таймера',tool:'Нужна отмычка',risk:'Две ошибки подряд ломают отмычку. Ошибки, резкие движения и незамеченная птица повышают шум. Заполненная шкала привлекает стражу.',after:'Первый замок открыт. На верстаке можно создать отмычку из двух деталей и подготовиться к следующему заказу.'},
    {mode:'keyprofile',title:'Ключ от старой лавки',mechanic:'Подбор ключа по слепку',place:'Старый квартал',story:'Найди ключ, точно повторяющий слепок замочной скважины. Сравни каждый зубец, прежде чем провернуть механизм.',hint:'Сравни зубцы слева направо. Выбери ключ в нижнем наборе, затем нажми «Открыть». Неверный ключ ломает отмычку; сам выбор ключа безопасен.',time:'30 секунд',tool:'Нужна отмычка',risk:'Подтверждение неверного ключа расходует отмычку.',after:'Следующий заказ потребует памяти. Для парных узлов отмычки не нужны.'},
    {mode:'pairednodes',title:'Архив портового смотрителя',mechanic:'Поиск парных символов',place:'Порт',story:'Восстанови четыре пары архивных меток. Запоминай расположение символов, чтобы открыть все узлы до окончания времени.',hint:'Наведи курсор на узел, чтобы увидеть знак, и выбери два одинаковых. На сенсорном экране удерживай узел около секунды для выбора. Несовпадение закрывает пару; отмычки не расходуются.',time:'75 секунд',tool:'Без отмычек',risk:'Когда время закончится, попытку придётся начать заново.',after:'Архив открыт. Осталось подобрать профили последнего механизма.'},
    {mode:'museum',title:'Заказ переплётчика',mechanic:'Символьный замок',place:'Район искусств',story:'Сопоставь три профиля механизма с формами в наборе инструментов. Здесь можно спокойно поработать без ограничения времени.',hint:'Смотри на выделенный символ сверху. Нажми такую же форму в нижнем наборе. После трёх совпадений механизм откроется сам.',time:'Без таймера',tool:'Без отмычек',risk:'Ошибки не расходуют инструменты. Попробуй другую форму.',after:'Все четыре заказа выполнены. Загляни в коллекцию или выбери новое место на карте.'}
  ];
  const route=window.KeynlockCampaignRoute;
  const config=window.KeynlockContent.campaign;
  const orders=route.buildOrders({catalog:window.GameCatalog,places:window.KeynlockContent.world.missionPlaces,...config});
  const saved=store.getJSON('keynlockFirstChapter',{});
  const progress=route.createProgress(orders,saved);
  let introduced=saved?.introduced===true;
  let trainingMode=null;
  let trackedRound=null;
  let returnFocus=null;
  let selectedId=null;
  let viewTier=progress.next()?.tier||1;
  let renderedTier=null;
  function describe(order,step){
    const game=window.GameCatalog.get(step.mode);
    const brief=briefs.find(b=>b.mode===step.mode);
    const narrative=window.KeynlockContent.chapterStory.orders[order.id];
    const place=window.KeynlockContent.world.missionPlaces.find(p=>p.mode===step.mode);
    const story=game.description||window.PuzzleModes.objective(step.mode)||'Выставь механизм в правильное положение и открой замок.';
    return {
      title:order.title||narrative?.title||briefs.find(b=>b.mode===order.mode)?.title||window.GameCatalog.get(order.mode).title,
      place:window.KeynlockContent.world.districts[place.district].name,
      mechanic:brief?.mechanic||game.title,
      story:narrative?.brief||(step.tier===1&&brief?brief.story:story),
      hint:step.tier===1?(brief?.hint||window.KeynlockMissionLessons?.hint(step.mode)||story):story,
      risk:step.tier===1&&brief?brief.risk:game.lock.requiresPick?'Береги отмычки. Пополнить запас можно на верстаке.':'Эта головоломка не расходует отмычки.',
      tool:game.lock.requiresPick?'Нужна отмычка':'Без отмычек',
      image:game.location
    };
  }
  const button=document.createElement('button');
  button.type='button';button.id='campaignButton';button.className='campaignButton';
  button.setAttribute('aria-label','Заказы');button.title='Заказы';
  const dialog=document.createElement('dialog');
  dialog.id='campaignDialog';dialog.className='campaignDialog';
  dialog.setAttribute('aria-labelledby','campaignTitle');
  dialog.innerHTML=`<header class="campaignHeader">
    <div><p class="campaignEyebrow">КИЙЕНЛОК · ЛИЧНЫЕ ЗАПИСИ</p><h1 id="campaignTitle">Заказы</h1></div>
    <form method="dialog"><button class="campaignClose" aria-label="Закрыть заказы" value="close">×</button></form>
    </header>
    <div class="campaignStorySummary"><p id="campaignStoryProgress"></p><button id="campaignEnding" class="uiButton" type="button" hidden>Итоги главы</button></div>
    <div class="campaignPages">
      <aside class="campaignIndex" aria-label="Заказы по сложности">
        <div class="campaignChapter"><span id="campaignTierNumber">01</span><div><p class="campaignEyebrow">УРОВЕНЬ СЛОЖНОСТИ</p><h2 id="campaignTierTitle">Первые шаги</h2></div></div>
        <nav class="campaignTierPicker" aria-label="Уровень сложности"><button type="button" data-tier="1">Уровень 1</button><button type="button" data-tier="2">Уровень 2</button><button type="button" data-tier="3">Уровень 3</button></nav>
        <div class="campaignProgress"><span id="campaignCount"></span><progress id="campaignProgress" max="27" value="0" aria-label="Выполнено заказов"></progress></div>
        <ol id="campaignSteps"></ol>
        <p id="campaignIntro" class="campaignNote"></p>
      </aside>
      <article class="campaignSheet" aria-labelledby="campaignTask">
        <div class="campaignArtwork"><img id="campaignImage" alt=""><span id="campaignStamp"></span><span id="campaignNumber"></span></div>
        <div class="campaignBrief"><p id="campaignPlace" class="campaignEyebrow"></p><h2 id="campaignTask"></h2><p id="campaignMechanic"></p>
          <p id="campaignPart"></p><p id="campaignStory"></p>
          <dl class="campaignFacts"><div><dt>Сложность</dt><dd id="campaignTime"></dd></div><div><dt>Инструмент</dt><dd id="campaignTool"></dd></div><div><dt>Добыча</dt><dd id="campaignLoot">Монеты и материалы</dd></div></dl>
          <details id="campaignHelp"><summary>Заметки о механизме <span aria-hidden="true">+</span></summary><p id="campaignHint"></p><p id="campaignRisk"></p></details>
        </div>
        <footer class="campaignFooter"><p id="campaignPreparation" role="status"></p><div class="campaignActions uiActions"><button id="campaignStart" class="uiButton uiButton--primary" type="button"></button><button id="campaignWorkbench" class="uiButton" type="button">К верстаку</button><button id="campaignCollection" class="uiButton" type="button" hidden>Коллекция</button></div></footer>
      </article>
    </div><div class="campaignFootnote"><span>Прогресс сохраняется после победы</span><span>Игра на паузе</span></div>`;
  document.body.append(button,dialog);
  const el=id=>dialog.querySelector(`#${id}`);
  function persist(){store.setJSON('keynlockFirstChapter',{...progress.snapshot(),introduced});}
  function selected(){return orders.find(order=>order.id===selectedId)||progress.next()||orders.at(-1);}
  function resuming(order,step){
    const active=window.KeynlockMissions?.active;
    return !!(active?.guided&&active.orderId===order.id&&active.stepId===step.id&&active.mode===step.mode&&active.tier===step.tier);
  }
  function render(){
    const current=progress.next(),order=selected(),step=progress.step(order),stage=describe(order,step);
    const visible=orders.filter(o=>o.tier===viewTier);
    const active=window.KeynlockMissions?.active;
    const storyIds=Object.keys(window.KeynlockContent.chapterStory.orders);
    const storyDone=storyIds.filter(id=>progress.completed.includes(id)).length;
    const isStory=storyIds.includes(order.id);
    el('campaignStoryProgress').textContent=storyDone===storyIds.length
      ?'«Чужие подписи» завершены. Дальше — дополнительные испытания. Продолжение сюжета пока недоступно.'
      :`«Чужие подписи» · сюжетных заказов выполнено ${storyDone} из ${storyIds.length}. Свободные испытания доступны на карте.`;
    el('campaignEnding').hidden=storyDone!==storyIds.length;

    el('campaignTierNumber').textContent=String(viewTier).padStart(2,'0');
    el('campaignTierTitle').textContent=['Первые шаги','Новые испытания','Сложные механизмы'][viewTier-1];
    dialog.querySelectorAll('[data-tier]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.tier)===viewTier)));
    el('campaignCount').textContent=`Выполнено ${visible.filter(progress.done).length} из ${visible.length}`;
    el('campaignProgress').max=visible.length;el('campaignProgress').value=visible.filter(progress.done).length;
    el('campaignIntro').textContent=current?`Сначала все заказы уровня 1, затем уровня 2 и 3. Следующий: «${describe(current,progress.step(current)).title}», уровень ${current.tier}.`:'Все заказы выполнены. Можно повторить любой или вернуться к коллекции.';
    const list=el('campaignSteps');
    if(renderedTier!==viewTier){
      renderedTier=viewTier;list.replaceChildren();
      visible.forEach((item,index)=>{
        const li=document.createElement('li'),row=document.createElement('button');
        row.type='button';row.dataset.order=item.id;
        const number=document.createElement('span');number.className='campaignOrderNumber';number.textContent=String(index+1).padStart(2,'0');
        const copy=document.createElement('span');copy.className='campaignOrderCopy';
        const title=document.createElement('strong');title.textContent=describe(item,progress.step(item)).title;
        const status=document.createElement('small');copy.append(title,status);row.append(number,copy);li.append(row);list.append(li);
        row.addEventListener('click',()=>{selectedId=item.id;el('campaignHelp').open=false;render();});
      });
    }
    [...list.children].forEach((li,index)=>{
      const item=visible[index],row=li.querySelector('button');
      row.setAttribute('aria-pressed',String(item===order));
      row.classList.toggle('done',progress.done(item));row.classList.toggle('upcoming',!progress.allowed(item));
      row.querySelector('small').textContent=`${storyIds.includes(item.id)?'Сюжет':'Испытание'} · ${progress.done(item)?'Выполнен':item===current?'Доступен':'Предстоит'}`;
    });
    el('campaignImage').src=stage.image;
    el('campaignNumber').textContent=`УРОВЕНЬ ${order.tier} · ЗАКАЗ № ${String(visible.indexOf(order)+1).padStart(2,'0')}`;
    el('campaignStamp').textContent=progress.done(order)?'Выполнен':progress.allowed(order)?'К исполнению':'Предстоит';
    el('campaignStamp').classList.toggle('done',progress.done(order));
    el('campaignPlace').textContent=stage.place;el('campaignTask').textContent=stage.title;
    el('campaignMechanic').textContent=`${isStory?'Сюжетный заказ':'Дополнительное испытание'} · ${stage.mechanic}`;el('campaignStory').textContent=stage.story;
    el('campaignTime').textContent=`Уровень ${step.tier}`;el('campaignTool').textContent=stage.tool;
    el('campaignRisk').textContent=stage.risk;el('campaignHint').textContent=stage.hint;
    el('campaignPart').hidden=order.steps.length===1;
    el('campaignPart').textContent=`Головоломка ${order.steps.indexOf(step)+1} из ${order.steps.length}`;
    const rewardId=`${step.mode}-${step.tier}`;
    const bonus=window.KeynlockRewardPolicy.firstClearBonus(rewardId,store.getJSON('keynlockFirstClearBonuses',store.getJSON('lockpickMissions',{})));
    el('campaignLoot').textContent=[bonus?`+${bonus} монет за первое прохождение`:'Монеты и материалы',window.KeynlockCollection?.handleRewardHint(rewardId,step.tier)].filter(Boolean).join(' · ');
    const resources=window.KeynlockResources.state;
    const missing=window.GameCatalog.feature(step.mode,'lock.requiresPick')&&resources.picks===0;
    const resume=resuming(order,step);
    el('campaignPreparation').textContent=!progress.allowed(order)?`Сначала выполни «${describe(current,progress.step(current)).title}», уровень ${current.tier}.`:missing?'Отмычки закончились. Пополни запас на верстаке.':`С собой: ${route.quantity(resources.picks,['отмычка','отмычки','отмычек'])} · ${route.quantity(resources.parts,['деталь','детали','деталей'])}`;
    el('campaignStart').setAttribute('aria-disabled',String(missing||(!resume&&!progress.allowed(order))));
    el('campaignStart').textContent=resume?'Продолжить заказ':order.steps.indexOf(step)>0?'Следующая головоломка':progress.done(order)?'Повторить заказ':'Отправиться на заказ';
    el('campaignCollection').hidden=progress.completed.length===0;
    el('campaignWorkbench').textContent='К верстаку';
    el('campaignWorkbench').hidden=progress.completed.length===0&&!missing;
    if(window.KeynlockOnboarding?.active){
      el('campaignStart').setAttribute('aria-disabled','false');
      el('campaignStart').textContent=window.KeynlockOnboarding.step==='done'?'Завершить обучение':'Продолжить обучение';
      el('campaignPreparation').textContent='Перед следующим заказом заверши обучение в логове: реставрация, изготовление и покупка отмычки.';
    }
  }
  function revealSelection(){
    const list=el('campaignSteps'),row=list.querySelector('[aria-pressed="true"]');
    if(row)list.scrollTop+=row.getBoundingClientRect().top-list.getBoundingClientRect().top;
  }
  function open(hint=false){
    if(dialog.open)return;
    const active=window.KeynlockMissions?.active;
    selectedId=hint&&active?.guided&&orders.some(o=>o.id===active.orderId)?active.orderId:progress.replayOrder||progress.next()?.id||orders.at(-1).id;
    viewTier=selected().tier;
    introduced=true;persist();render();el('campaignHelp').open=hint;
    returnFocus=document.activeElement;
    document.body.classList.add('campaign-open');dialog.showModal();
    dialog.querySelector('.campaignClose').focus({preventScroll:true});
    dialog.scrollTop=0;
    revealSelection();
  }
  function close(){dialog.close();}
  dialog.addEventListener('close',()=>{
    document.body.classList.remove('campaign-open');
    if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});
  });
  // Keep global game shortcuts from acting underneath the modal.
  window.addEventListener('keydown',event=>{
    if(!dialog.open)return;
    event.stopImmediatePropagation();
    if(event.key==='Escape'){event.preventDefault();close();}
  },true);
  button.addEventListener('click',()=>open(!!window.KeynlockMissions?.active?.guided));
  dialog.querySelectorAll('[data-tier]').forEach(b=>b.addEventListener('click',()=>{
    viewTier=Number(b.dataset.tier);
    selectedId=orders.find(o=>o.tier===viewTier&&!progress.done(o))?.id||orders.find(o=>o.tier===viewTier)?.id;
    el('campaignHelp').open=false;render();revealSelection();
  }));
  el('campaignStart').addEventListener('click',()=>{
    if(window.KeynlockOnboarding?.active){close();window.KeynlockOnboarding.resume();return;}
    const order=selected(),step=progress.step(order);
    if(window.GameCatalog.feature(step.mode,'lock.requiresPick')&&window.KeynlockResources.state.picks===0){
      const notice=el('campaignPreparation');
      notice.textContent='Нужна отмычка. Пополни запас на верстаке, чтобы отправиться на заказ.';
      notice.setAttribute('role','status');
      notice.scrollIntoView({block:'nearest'});
      notice.getAnimations().forEach(animation=>animation.cancel());
      if(!matchMedia('(prefers-reduced-motion: reduce)').matches) notice.animate([
        {backgroundColor:'transparent'},
        {backgroundColor:'#d5ab6570',color:'#743e2d',offset:.3},
        {backgroundColor:'transparent'}
      ],{duration:1200,iterations:2});
      return;
    }
    if(resuming(order,step)){close();window.KeynlockMissions.resume();return;}
    if(!progress.allowed(order))return;
    if(progress.done(order))progress.beginReplay(order);
    close();window.KeynlockChapterStory.before({mode:step.mode,tier:step.tier,orderId:order.id,stepId:step.id});
  });
  el('campaignEnding').addEventListener('click',()=>{close();window.KeynlockLair.open();window.KeynlockChapterStory.ending();});
  el('campaignWorkbench').addEventListener('click',()=>{close();window.KeynlockLair.workbench();});
  el('campaignCollection').addEventListener('click',()=>{close();window.KeynlockLair.module('collection');});
  window.addEventListener('keynlock-mission-started',event=>{
    trackedRound=event.detail.guided?event.detail.roundId:null;render();
  });
  window.addEventListener('keynlock-mission-cleared',event=>{
    const run=event.detail;
    if(!run.guided||run.roundId!==trackedRound)return;
    const orderId=run.orderId||`${run.mode}-${run.tier}`;
    const stepId=run.stepId||'main';
    const advanced=progress.complete(orderId,stepId,run.mode,run.tier);
    trackedRound=null;trainingMode=null;
    if(advanced)persist();
    render();
    const order=orders.find(o=>o.id===orderId);

  });
  window.addEventListener('keynlock-training-change',()=>{if(dialog.open)render();});
  window.addEventListener('keynlock-resources-change',()=>{if(dialog.open)render();});
  window.addEventListener('keynlock:play',()=>{if(!introduced)window.KeynlockDialogs.intro(open);});
  window.KeynlockCampaign={
    open,
    prepare(mode,guided,tier=1){trainingMode=guided&&tier===1?mode:null;},
    training:mode=>trainingMode===mode,
    balance:mode=>trainingMode===mode?config.balance?.[mode]:null,
    get progress(){return {completed:progress.completed,next:progress.next()?.id||null,total:orders.length};}
  };
  render();
})();
