  function renderWorldMap(){
    if(!$worldMapScreen) return;
    const loc=MAP_LOCATIONS[mapLocation]||MAP_LOCATIONS.lair;
    $mapPlayer.style.setProperty('--mx',`${loc.x}%`);
    $mapPlayer.style.setProperty('--my',`${loc.y}%`);
    $mapCurrentName.textContent=loc.name;
    $mapInfoTitle.textContent=loc.name;
    $mapInfoText.textContent=loc.text
      + (loc.action==='mission'?' Нажми на точку ещё раз, чтобы начать.':'');
    document.querySelectorAll('.mapNode').forEach(node=>{
      node.classList.toggle('current',node.dataset.location===mapLocation);
    });
    if($mapLocationAction) $mapLocationAction.hidden=true;
  }

  let mapReturnToLair=false;

  function openMap(){
    setInventoryOpen(false);
    if(shopOpen) closeShop();
    mapReturnToLair=lairOpen;
    if(lairOpen) closeLair();
    mapOpen=true;
    document.body.classList.add('map-open');
    $worldMapScreen.hidden=false;
    $mapTab.classList.add('active');
    renderWorldMap();
  }

  let mapTravelId=0;
  function closeMap(restorePrevious=false){
    if(!mapOpen) return;
    const restoreLair=restorePrevious&&mapReturnToLair&&mapLocation==='lair';
    mapReturnToLair=false;
    mapTravelId++;
    mapMoving=false;
    if(lairOpen) closeLair();
    mapOpen=false;
    document.body.classList.remove('map-open');
    $worldMapScreen.hidden=true;
    updateModeUI();
    if(restoreLair) openLair();
  }

  // Locations say what they are; the map no longer needs to know their names.
  function arriveAtLocation(id){
    const loc=MAP_LOCATIONS[id];
    if(!loc) return;
    if(loc.action==='shop') openShop();
    else if(loc.action==='lair') openLair();
    else if(loc.action==='mission') window.startMapMission?.(id);
  }

  function travelToMapLocation(next){
    const target=MAP_LOCATIONS[next];
    if(!target || target.locked || mapMoving) {
      if(target?.locked) toast('Этот район пока закрыт');
      return;
    }
    if(next===mapLocation){
      renderWorldMap();
      arriveAtLocation(next);
      return;
    }
    const allowed=MAP_CONNECTIONS[mapLocation]||[];
    if(!allowed.includes(next)){
      toast('Сюда пока нет доступного пути');
      return;
    }
    mapMoving=true;
    const travelId=++mapTravelId;
    $mapInfoTitle.textContent='В пути';
    $mapInfoText.textContent=`Идём: ${target.name}`;
    if($mapLocationAction) $mapLocationAction.hidden=true;
    $mapPlayer.style.setProperty('--mx',`${target.x}%`);
    $mapPlayer.style.setProperty('--my',`${target.y}%`);
    setTimeout(()=>{
      if(travelId!==mapTravelId || !mapOpen) return;
      mapLocation=next;
      STORE.setItem('lockpickMapLocation',mapLocation);
      mapMoving=false;
      renderWorldMap();
      arriveAtLocation(next);
    },1180);
  }

  function openShop(){ setInventoryOpen(false); if(mapOpen) closeMap(false); shopOpen=true; document.body.classList.add('shop-open'); $toast.classList.remove('show','actionable'); updateShopUI(); $shopOverlay.classList.add('open'); }
  function closeShop(){ shopOpen=false; document.body.classList.remove('shop-open'); $shopOverlay.classList.remove('open'); updatePickUI(); }
  let modeSwitchFrame=0;
  function switchMode(nextMode,forceRestart=false){
    if(!ALL_MODES.has(nextMode)) return;
    window.dispatchEvent(new CustomEvent('keynlock-game-opened',{detail:{id:nextMode}}));
    if(lairOpen) closeLair();
    if(mapOpen) closeMap(false);
    if(shopOpen) closeShop();
    if(!forceRestart && mode===nextMode && !solved && !document.body.classList.contains('game-inactive')) return;
    mode=nextMode;
    syncModePanels(mode);
    updateModeUI();
    if(modeSwitchFrame) cancelAnimationFrame(modeSwitchFrame);
    const requestedMode=nextMode;
    modeSwitchFrame=requestAnimationFrame(()=>{
      modeSwitchFrame=0;
      if(mode!==requestedMode) return;
      newLock(false);
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
