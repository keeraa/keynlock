  function renderWorldMap(){
    if(!$worldMapScreen) return;
    const loc=MAP_LOCATIONS[mapLocation]||MAP_LOCATIONS.lair;
    $mapPlayer.style.setProperty('--mx',`${loc.x}%`);
    $mapPlayer.style.setProperty('--my',`${loc.y}%`);
    $mapCurrentName.textContent=loc.name;
    $mapInfoTitle.textContent=loc.name;
    $mapInfoText.textContent=loc.text
      + (mapLocation==='lair'?` Активный персонаж: ${LAIR_CHARACTERS[lairCharacter].name}.`:'')
      + (mapLocation==='mission1'?' Нажми на точку ещё раз, чтобы начать.':'');
    document.querySelectorAll('.mapNode').forEach(node=>{
      node.classList.toggle('current',node.dataset.location===mapLocation);
    });
    if($mapLocationAction) $mapLocationAction.hidden=true;
  }

  function openMap(){
    closeMobileModeMenu();
    setInventoryOpen(false);
    if(shopOpen) closeShop();
    if(lairOpen) closeLair();
    mapOpen=true;
    document.body.classList.add('map-open');
    $worldMapScreen.hidden=false;
    document.querySelectorAll('.modeTabs .tab').forEach(tab=>tab.classList.remove('active'));
    $mapTab.classList.add('active');
    renderWorldMap();
  }

  function closeMap(){
    if(!mapOpen) return;
    if(lairOpen) closeLair();
    mapOpen=false;
    document.body.classList.remove('map-open');
    $worldMapScreen.hidden=true;
    updateModeUI();
  }

  function startFirstMission(){
    if(lairOpen) closeLair();
    if(shopOpen) closeShop();

    if(mapOpen){
      mapOpen=false;
      document.body.classList.remove('map-open');
      $worldMapScreen.hidden=true;
    }

    mode='classic';
    syncModePanels(mode);
    updateModeUI();

    requestAnimationFrame(()=>{
      newLock(false);
      toast('Миссия 1 · Классика');
    });
  }

  function travelToMapLocation(next){
    const target=MAP_LOCATIONS[next];
    if(!target || target.locked || mapMoving) {
      if(target?.locked) toast('Этот район пока закрыт');
      return;
    }
    if(next===mapLocation){
      renderWorldMap();
      if(next==='shop') openShop();
      if(next==='lair') openLair();
      if(next==='mission1') startFirstMission();
      return;
    }
    const allowed=MAP_CONNECTIONS[mapLocation]||[];
    if(!allowed.includes(next)){
      toast('Сюда пока нет доступного пути');
      return;
    }
    mapMoving=true;
    $mapInfoTitle.textContent='В пути';
    $mapInfoText.textContent=`Идём: ${target.name}`;
    if($mapLocationAction) $mapLocationAction.hidden=true;
    $mapPlayer.style.setProperty('--mx',`${target.x}%`);
    $mapPlayer.style.setProperty('--my',`${target.y}%`);
    setTimeout(()=>{
      mapLocation=next;
      STORE.setItem('lockpickMapLocation',mapLocation);
      mapMoving=false;
      renderWorldMap();
      if(next==='shop') openShop();
      if(next==='lair') openLair();
      if(next==='mission1') startFirstMission();
    },1180);
  }

  function openShop(){ closeMobileModeMenu(); setInventoryOpen(false); shopOpen=true; document.body.classList.add('shop-open'); $toast.classList.remove('show','actionable'); updateShopUI(); $shopOverlay.classList.add('open'); }
  function closeShop(){ shopOpen=false; document.body.classList.remove('shop-open'); $shopOverlay.classList.remove('open'); updatePickUI(); }
  function switchMode(nextMode){
    setGameInactive(false);
    if(lairOpen) closeLair();
    if(mapOpen) closeMap();
    if(shopOpen) closeShop();
    if(!ALL_MODES.has(nextMode) || mode===nextMode) return;
    mode=nextMode;
    syncModePanels(mode);
    updateModeUI();
    requestAnimationFrame(()=>{
      newLock(false);
      if(mode==='r2') requestAnimationFrame(renderR2);
    });
  }

  function spend(cost){
    if(balance<cost){ toast('Не хватает монет'); return false; }
    balance-=cost;
    STORE.setItem('lockpickBalance',String(balance));
    updateEconomyUI();
    return true;
  }

  function buyOrEquipPick(type){
    if(ownsPick(type)){
      pickType=type;
      savePickProgress();
      updatePickUI();
      updateShopUI();
      return;
    }
    const cost=SHOP_PRICES[type];
    if(!spend(cost)) return;
    pickProgress[type]=true;
    pickType=type;
    savePickProgress();
    updatePickUI();
    updateShopUI();
    toast(`${PICK_TYPES[type].name} отмычка куплена`);
  }

  function buyPouch(){
    if(pickCapacity>=5) return;
    const cost=pickCapacity===3?SHOP_PRICES.pouch4:SHOP_PRICES.pouch5;
    if(!spend(cost)) return;
    pickCapacity++;
    picks=Math.min(pickCapacity,picks+1);
    savePickProgress();
    updatePickUI();
    updateShopUI();
    toast(`Запас увеличен до ${pickCapacity}`);
  }

