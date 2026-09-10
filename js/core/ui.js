  function shuffle(a){for(let i=a.length-1;i>0;i--){let j=rand(0,i);[a[i],a[j]]=[a[j],a[i]]}return a}
  function toast(t, action=false){
    $toastText.textContent=t;
    $toast.classList.toggle('actionable', action);
    $toast.classList.add('show');
    clearTimeout(toast.t);
    if(!action){
      toast.t=setTimeout(()=>{
        $toast.classList.remove('show');
        $toast.classList.remove('actionable');
      },1600);
    }
  }

  function setToastActionLabel(label='Новый замок'){
    if(!$toastAction) return;
    $toastAction.innerHTML=typeof tablerIcon==='function'
      ? `${tablerIcon('refresh',16)}<span>${label}</span>`
      : `<span>${label}</span>`;
  }

  function showPickDepletedLoss(){
    showGameDefeat('picks');
  }

  function showGameDefeat(reason='generic',options={}){
    if(gameDefeat.isActive())return false;
    solved=true;
    setGameInactive(true);
    setGlobalTimer(false);
    $toast.classList.remove('show','actionable');
    $toastText.textContent='';
    return gameDefeat.show(reason,options);
  }

  function updateEconomyUI(){
    $coinBalance.textContent=balance;
    challengeHud.setReward(runReward);
}

  function animateRewardDrop(){
    challengeHud.pulseReward();
  }

  function registerMove(){
    toolMotionController.impulse();
    moves++;
    const lessonBalance=window.KeynlockCampaign?.balance?.(mode);
    const next=lessonBalance?Math.max(lessonBalance.rewardFloor,100-Math.max(0,moves-lessonBalance.freeMoves)*lessonBalance.movePenalty):Math.max(10,100-moves*5);
    if(next!==runReward){
      runReward=next;
      animateRewardDrop();
      updateEconomyUI();
    }
  }

  function awardRun(){
    const cleanBonus = brokenPicks===0 ? 25 : 0;
    const baseCoins=runReward+cleanBonus;
    const resources=window.KeynlockResources?.awardLock?.({tier:getModeDifficulty(mode),baseCoins});
    const painting=typeof awardMissionPainting==='function'?awardMissionPainting():null;
    const earned=resources?.coins??baseCoins;
    balance += earned;
    STORE.setItem('lockpickBalance', String(balance));
    window.KeynlockResources?.render();
    const loot=document.querySelector('#solvedPuzzleLoot');
    if(loot&&resources){
      const componentRows=Object.entries(resources.components).map(([id,count])=>{
        const component=window.KeynlockResources.components.find(item=>item.id===id);
        return `<span class="lootRow" tabindex="0" data-tip="${component?.material||id} · ${component?.name||id} компонент: +${count}. Используется в алхимии." aria-label="${component?.name||id} компонент: +${count}"><img class="componentIcon" src="${component.image}" alt="" draggable="false"><b>+${count}</b></span>`;
      }).join('');
      loot.innerHTML=`
        <div class="lootResources"><span class="lootRow lootCoins" tabindex="0" data-tip="Монеты: +${earned}.${resources.firstClearBonus?` Включая премию за первое прохождение: ${resources.firstClearBonus}.`:""} Нужны для покупки отмычек и улучшений." aria-label="Монеты: +${earned}"><img class="lootResourceIcon" src="assets/ui/money-ico.png" alt=""><b>+${earned}</b></span>
        <span class="lootRow" tabindex="0" data-tip="Детали замков: +${resources.parts}. Из двух деталей можно создать одну отмычку." aria-label="Детали замков: +${resources.parts}"><img class="lootResourceIcon" src="assets/ui/details-ico.png" alt=""><b>+${resources.parts}</b></span>
        <span class="lootComponents" tabindex="0" data-tip="Цветные компоненты нужны для алхимии и изготовления материалов.">${componentRows||'<span class="lootRow" tabindex="0" data-tip="Компоненты не найдены" aria-label="Компоненты не найдены">0</span>'}</span></div>
        ${painting?`<div class="lootPainting lootPaintingQuiz"><img src="${painting.image}" alt="Найденная картина"><span><small>Найдена картина</small><b class="paintingQuizResult">Как называется эта картина? Верный ответ: +50 монет</b><em></em></span></div><div class="paintingQuiz" role="group" aria-label="Выбери название картины"></div>`:''}
        ${resources.handle?`<span class="lootPainting lootHandle"><span class="lootHandleArt"><img src="${resources.handle.image}" alt="Найденная рукоятка"></span><span><small>Найдена рукоятка</small><b>${resources.handle.name}</b></span></span>`:''}`;
    }
    if(loot&&resources&&painting)mountPaintingQuiz(loot,painting,earned,activeRoundId);
    updateEconomyUI();
    return {earned, cleanBonus};
  }
  function mountPaintingQuiz(loot,painting,earned,roundId){
    const quiz=window.KeynlockPaintingRewards.createQuiz(painting,window.KeynlockContent.paintings);
    const choices=loot.querySelector('.paintingQuiz');
    const result=loot.querySelector('.paintingQuizResult');
    result.setAttribute('role','status');
    for(const choice of quiz.choices){
      const button=document.createElement('button');
      button.type='button';button.className='digitalBtn';button.textContent=choice.title;
      button.dataset.paintingId=choice.id;
      button.addEventListener('click',()=>{
        if(roundId!==activeRoundId||!choices.isConnected||!solved)return;
        const answer=quiz.answer(choice.id);
        if(!answer)return;
        choices.querySelectorAll('button').forEach(option=>{
          option.disabled=true;
          option.classList.toggle('correct',option.dataset.paintingId===painting.id);
          option.classList.toggle('wrong',option===button&&!answer.correct);
        });
        result.textContent=`${answer.correct?'Верно! +50 монет.':'Правильный ответ:'} ${painting.title} (${painting.year})`;
        result.nextElementSibling.textContent=painting.artist;
        if(!answer.coins)return;
        balance+=answer.coins;
        STORE.setItem('lockpickBalance',String(balance));
        updateEconomyUI();
        window.KeynlockResources?.render();
        const coins=loot.querySelector('.lootCoins');
        const value=coins.querySelector('b');
        coins.setAttribute('aria-label',`Монеты: +${earned+answer.coins}`);
        coins.dataset.tip=`Монеты: +${earned+answer.coins}, включая +50 за название картины.`;
        const bonus=document.createElement('span');
        bonus.className='lootCoinBonus';bonus.textContent='+50';bonus.setAttribute('aria-hidden','true');coins.appendChild(bonus);
        bonus.animate([{opacity:0,transform:'translateY(10px)'},{opacity:1,offset:.2},{opacity:0,transform:'translateY(-30px)'}],{duration:1000}).onfinish=()=>bonus.remove();
        value.animate([{color:'#7fe39d',transform:'scale(1.2)'},{color:'#7fe39d',offset:.7},{color:'#edd19a',transform:'scale(1)'}],{duration:1100});
        const started=performance.now();
        const count=now=>{
          if(roundId!==activeRoundId||!value.isConnected)return;
          const progress=Math.min(1,(now-started)/700);
          value.textContent=`+${earned+Math.round(answer.coins*(1-(1-progress)**3))}`;
          if(progress<1)requestAnimationFrame(count);
        };
        requestAnimationFrame(count);
      });
      choices.appendChild(button);
    }
  }
function setGlobalTimer(active=false, timeLeft=0, timeMax=1, label='ТАЙМЕР'){
    challengeHud.setTimer({active,timeLeft,timeMax,label});
  }

  function updatePickUI(){
renderInventoryTools();
  }

  function damagePick({resetProgress=null, renderState=null, surviveText='Ошибка', forceBreak=false}={}){
    if(!GameCatalog.feature(mode,'lock.requiresPick')){
      if(resetProgress)resetProgress();
      if(renderState)renderState();
      toast(surviveText);
      return {broke:false,kept:true,depleted:false};
    }
    if(picks===1&&window.KeynlockMissions?.protectsLastPick?.()){
      if(resetProgress)resetProgress();
      if(renderState)renderState();
      SFX.survive();
      toast('До первой победы последняя отмычка не ломается · попробуй ещё раз');
      return {broke:false,kept:false,depleted:false,protected:true};
    }
    const info=PICK_TYPES[pickType];
    const breaks=forceBreak || Math.random()<info.breakChance;

    if(!breaks){
      SFX.survive();
      updatePickUI();
      if(renderState) renderState();
      toast(`${surviveText} · ${info.name.toLowerCase()} выдержала`);
      return {broke:false, kept:true, depleted:false};
    }

    const previousVisiblePicks=Math.max(0, Math.min(pickCapacity, picks));
    picks=Math.max(0,picks-1);
    window.KeynlockResources?.consumePicks?.(1);
    if(previousVisiblePicks>0) triggerInventoryBreakAnimation(previousVisiblePicks);
    brokenPicks++;
    if(picks<=0)showPickDepletedLoss();
    SFX.break();
    const kept=Math.random()<info.saveChance;
    if(!kept && resetProgress) resetProgress();
    updatePickUI();
    if(renderState) renderState();

    if(picks<=0)return {broke:true, kept, depleted:true};

    toast(`${surviveText} · отмычка сломалась${kept?' · прогресс сохранён':''}`);
    return {broke:true, kept, depleted:false};
  }

  function forceBreakOnePick(message='Замок ещё не готов · отмычка сломалась'){
    if(solved || picks<=0)return false;
    if(picks===1&&window.KeynlockMissions?.protectsLastPick?.()){
      SFX.survive();
      toast('До первой победы последняя отмычка не ломается · попробуй ещё раз');
      return false;
    }
    const previousVisiblePicks=Math.max(0,Math.min(pickCapacity,picks));
    picks=Math.max(0,picks-1);
    window.KeynlockResources?.consumePicks?.(1);
    if(previousVisiblePicks>0)triggerInventoryBreakAnimation(previousVisiblePicks);
    brokenPicks++;
    SFX.break();
    updatePickUI();
    if(picks<=0)showPickDepletedLoss();
    else toast(message);
    return true;
  }
  window.forceBreakOnePick=forceBreakOnePick;

  function applyPickSkin(){
    const uri=PICK_SKINS[pickSkin]||PICK_SKINS[1];
    document.documentElement.style.setProperty('--pick-skin-image',cssUrl(uri));
  }

  function selectPickSkin(index){
    pickSkin=Math.max(1,Math.min(5,Number(index)||1));
    STORE.setItem('lockpickSkin',String(pickSkin));
    applyPickSkin();
    renderInventoryTools();
    SFX.select();
  }

  function applyTensionSkin(){
    const uri=TENSION_SKINS[tensionSkin]||TENSION_SKINS[1];
    document.documentElement.style.setProperty('--tension-skin-image',cssUrl(uri));
  }

  function selectTensionSkin(index){
    tensionSkin=Math.max(1,Math.min(5,Number(index)||1));
    STORE.setItem('tensionSkin',String(tensionSkin));
    applyTensionSkin();
    renderInventoryTools();
    SFX.select();
  }
