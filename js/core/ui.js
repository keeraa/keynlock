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

  let toolMotionKick = 0;

  function computeToolMotionProfile(){
    const safeMax = (typeof MAX === 'number' ? MAX : 6);
    const safeMin = (typeof MIN === 'number' ? MIN : 1);
    const span = Math.max(1, safeMax - safeMin);

    let rowBias = 0;
    let posBias = 0;

    if(Array.isArray(state) && state.length){
      const idx = Math.max(0, Math.min(state.length - 1, Number.isFinite(selected) ? selected : 0));
      rowBias = state.length > 1 ? (idx / (state.length - 1) - 0.5) : 0;

      const rawPos = typeof state[idx] === 'number' ? state[idx] : safeMin;
      posBias = ((rawPos - safeMin) / span) - 0.5;
    }

    return { rowBias, posBias };
  }

  function registerMove(){
    toolMotionKick = Math.min(1, toolMotionKick + 1);
    moves++;
    const next=Math.max(100, 1000 - moves*50);
    if(next!==runReward){
      runReward=next;
      animateRewardDrop();
      updateEconomyUI();
    }
  }

  function awardRun(){
    const cleanBonus = brokenPicks===0 ? 250 : 0;
    const earned = runReward + cleanBonus;
    balance += earned;
    STORE.setItem('lockpickBalance', String(balance));
    updateEconomyUI();
    updateShopUI();
    return {earned, cleanBonus};
  }

  function savePickProgress(){
    pickProgress={iron:pickProgress.iron,diamond:pickProgress.diamond,capacity:pickCapacity,equipped:pickType};
    STORE.setItem('lockpickProgress',JSON.stringify(pickProgress));
  }

  function ownsPick(type){
    return type==='wood' || (type==='iron'&&pickProgress.iron) || (type==='diamond'&&pickProgress.diamond);
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

  function applyPickSkin(){
    const uri=PICK_SKINS[pickSkin]||PICK_SKINS[1];
    document.documentElement.style.setProperty('--pick-skin-image',cssUrl(uri));
  }

  function selectPickSkin(index){
    pickSkin=Math.max(1,Math.min(5,Number(index)||1));
    STORE.setItem('lockpickSkin',String(pickSkin));
    applyPickSkin();
    updatePickSkinShop();
    renderInventoryTools();
    SFX.select();
  }

  function buildSkinMain($mount, uri, label, kind){
    if(!$mount) return;
    $mount.innerHTML='';
    const img=document.createElement('img');
    img.className='pickSkinPreview';
    img.alt=label;
    img.src=uri;
    const cap=document.createElement('div');
    cap.className='pickSkinLabel';
    cap.textContent=label;
    $mount.dataset.kind=kind;
    $mount.append(img,cap);
  }

  function updatePickSkinShop(){
    if(!$pickSkinGrid || !$pickSkinMain) return;
    buildSkinMain($pickSkinMain,PICK_SKINS[pickSkin]||PICK_SKINS[1],`Вариант ${pickSkin}`,'pick');
    $pickSkinGrid.innerHTML='';
    for(let i=1;i<=5;i++){
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='pickSkinCard'+(i===pickSkin?' selected':'');
      btn.dataset.pickSkin=String(i);
      btn.dataset.kind='pick';
      const img=document.createElement('img');
      img.className='pickSkinPreview';
      img.alt=`Отмычка ${i}`;
      img.src=PICK_SKINS[i];
      const label=document.createElement('span');
      label.className='pickSkinLabel';
      label.textContent=`Вариант ${i}`;
      btn.append(img,label);
      btn.addEventListener('click',()=>selectPickSkin(i));
      $pickSkinGrid.appendChild(btn);
    }
  }

  function initPickSkinShop(){
    updatePickSkinShop();
  }

  function applyTensionSkin(){
    const uri=TENSION_SKINS[tensionSkin]||TENSION_SKINS[1];
    document.documentElement.style.setProperty('--tension-skin-image',cssUrl(uri));
  }

  function selectTensionSkin(index){
    tensionSkin=Math.max(1,Math.min(5,Number(index)||1));
    STORE.setItem('tensionSkin',String(tensionSkin));
    applyTensionSkin();
    updateTensionSkinShop();
    renderInventoryTools();
    SFX.select();
  }

  function updateTensionSkinShop(){
    if(!$tensionSkinGrid || !$tensionSkinMain) return;
    buildSkinMain($tensionSkinMain,TENSION_SKINS[tensionSkin]||TENSION_SKINS[1],TENSION_SKIN_LABELS[tensionSkin]||`Вариант ${tensionSkin}`,'tension');
    $tensionSkinGrid.innerHTML='';
    for(let i=1;i<=5;i++){
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='pickSkinCard'+(i===tensionSkin?' selected':'');
      btn.dataset.tensionSkin=String(i);
      btn.dataset.kind='tension';
      const img=document.createElement('img');
      img.className='pickSkinPreview';
      img.alt=`Натяжитель ${i}`;
      img.src=TENSION_SKINS[i];
      const label=document.createElement('span');
      label.className='pickSkinLabel';
      label.textContent=TENSION_SKIN_LABELS[i]||`Вариант ${i}`;
      btn.append(img,label);
      btn.addEventListener('click',()=>selectTensionSkin(i));
      $tensionSkinGrid.appendChild(btn);
    }
  }

  function initTensionSkinShop(){
    updateTensionSkinShop();
  }

  function updateShopUI(){
    $shopBalance.textContent=balance;
    updatePickSkinShop();
    updateTensionSkinShop();
    const cards={wood:$shopWood,iron:$shopIron,diamond:$shopDiamond};
    Object.entries(cards).forEach(([type,el])=>{
      el.classList.toggle('equipped',pickType===type);
      el.classList.toggle('locked',!ownsPick(type));
    });
    $woodAction.textContent=pickType==='wood'?'Используется':'Использовать';
    $ironAction.textContent=pickProgress.iron?(pickType==='iron'?'Используется':'Использовать'):`Купить · ${SHOP_PRICES.iron}`;
    $diamondAction.textContent=pickProgress.diamond?(pickType==='diamond'?'Используется':'Использовать'):`Купить · ${SHOP_PRICES.diamond}`;
    $pouchTitle.textContent=`Чехол · ${pickCapacity} ${pickCapacity===5?'отмычек':'отмычки'}`;
    if(pickCapacity===3){ $pouchBuy.textContent='3 → 4 · 4500'; $pouchBuy.disabled=false; }
    else if(pickCapacity===4){ $pouchBuy.textContent='4 → 5 · 9000'; $pouchBuy.disabled=false; }
    else { $pouchBuy.textContent='Максимум · 5'; $pouchBuy.disabled=true; }
  }
