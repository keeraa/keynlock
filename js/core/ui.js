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
    const next=Math.max(10, 100 - moves*5);
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
    const painting=window.awardMissionPainting?.()||null;
    const earned=resources?.coins??baseCoins;
    balance += earned;
    STORE.setItem('lockpickBalance', String(balance));
    const loot=document.querySelector('#solvedPuzzleLoot');
    if(loot&&resources){
      const componentRows=Object.entries(resources.components).map(([id,count])=>{
        const component=window.KeynlockResources.components.find(item=>item.id===id);
        return `<span class="lootRow"><i class="lootColor" style="--loot-color:${component?.color||'#888'}"></i><b>+${count}</b> ${component?.name||id} компонент</span>`;
      }).join('');
      loot.innerHTML=`
        <span class="lootRow lootCoins"><b>+${earned}</b> монет</span>
        <span class="lootRow"><b>+${resources.parts}</b> дет. замка</span>
        ${componentRows}
        ${painting?`<span class="lootPainting"><img src="${painting.image}" alt=""><span><small>Найдена картина</small><b>${painting.title} (${painting.year})</b><em>${painting.artist}</em></span></span>`:''}
        ${resources.handle?`<span class="lootRow lootRare">Редкая рукоятка: <b>${resources.handle.name}</b></span>`:''}`;
    }
    updateEconomyUI();
    return {earned, cleanBonus};
  }
function setGlobalTimer(active=false, timeLeft=0, timeMax=1, label='ТАЙМЕР'){
    challengeHud.setTimer({active,timeLeft,timeMax,label});
  }

  function updatePickUI(){
renderInventoryTools();
  }

  function damagePick({resetProgress=null, renderState=null, surviveText='Ошибка'}={}){
    const info=PICK_TYPES[pickType];
    const breaks=Math.random()<info.breakChance;

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

    toast(kept?'Отмычка сломалась · прогресс сохранён':'Отмычка сломалась · прогресс сброшен');
    return {broke:true, kept, depleted:false};
  }

  function forceBreakOnePick(message='Замок ещё не готов · отмычка сломалась'){
    if(solved || picks<=0)return false;
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
