  // ===== IMPORTED V63 MECHANIC LOCATIONS =====
  const PROTOTYPE_MECHANIC_PLACES=[
    {id:'bioshock2',name:'Охранный дрон',game:'BioShock 2',x:17,y:23},
    {id:'alpha-protocol',name:'Архив пазов',game:'Alpha Protocol',x:31,y:17},
    {id:'mass-effect',name:'Узел Mass Effect',game:'Mass Effect',x:96,y:59},
    {id:'pathologic-2',name:'Дом механика',game:'Pathologic 2',x:40,y:82}
  ];
  const PROTOTYPE_MECHANIC_DONE_KEY='keynlockPrototypeMechanicsDone';
  let prototypeMechanicsDone={};
  try{prototypeMechanicsDone=JSON.parse(STORE.getItem(PROTOTYPE_MECHANIC_DONE_KEY)||'{}')||{};}catch(_){prototypeMechanicsDone={};}
  let activePrototypeMechanic=null;
  let prototypeMechanicReady=false;

  const $prototypeMechanicOverlay=document.querySelector('#prototypeMechanicOverlay');

  function prototypeLocationId(place){return `prototype-${place.id}`;}
  function syncPrototypeTools(){
    if(!activePrototypeMechanic)return;
    window.KeynlockImportedGames?.setTools({tension:Math.max(1,Math.min(5,tensionSkin||1))});
  }

  function alignFalloutLock(){
    if(activePrototypeMechanic?.id!=='fallout')return;
    const dial=$prototypeMechanicOverlay?.querySelector('#prototypeMechanicHost')?.shadowRoot?.querySelector('#sfLock');
    const lock=document.querySelector('#lock.universalLockBlock');
    const panel=lock?.querySelector('.lockPanel');
    if(!dial||!lock||!panel)return;
    document.body.style.setProperty('--fallout-lock-align-x','0px');
    document.body.style.setProperty('--fallout-lock-align-y','0px');
    requestAnimationFrame(()=>{
      if(activePrototypeMechanic?.id!=='fallout')return;
      const dialRect=dial.getBoundingClientRect();
      const panelRect=panel.getBoundingClientRect();
      document.body.style.setProperty('--fallout-lock-align-x',`${dialRect.left+dialRect.width/2-(panelRect.left+panelRect.width/2)}px`);
      document.body.style.setProperty('--fallout-lock-align-y',`${dialRect.top+dialRect.height/2-(panelRect.top+panelRect.height/2)}px`);
    });
  }

  PROTOTYPE_MECHANIC_PLACES.forEach(place=>{
    if(!GameCatalog.has(`prototype:${place.id}`))throw new Error(`Missing game catalogue entry: prototype:${place.id}`);
    MAP_LOCATIONS[prototypeLocationId(place)]={name:place.name,x:place.x,y:place.y,text:`Новая механика: ${place.game}.`,action:'prototype-mechanic',prototypeId:place.id,game:place.game};
  });
  const prototypeAllLocationIds=Object.keys(MAP_LOCATIONS).filter(id=>!MAP_LOCATIONS[id].locked);
  prototypeAllLocationIds.forEach(id=>{MAP_CONNECTIONS[id]=prototypeAllLocationIds.filter(other=>other!==id);});

  function renderPrototypeMechanicNodes(){
    const canvas=document.querySelector('#worldMapCanvas');
    if(!canvas)return;
    canvas.querySelectorAll('.prototypeMechanicNode').forEach(node=>node.remove());
    const player=canvas.querySelector('#mapPlayer');
    PROTOTYPE_MECHANIC_PLACES.forEach(place=>{
      const node=document.createElement('button');
      node.type='button';
      node.className=`mapNode accessible prototypeMechanicNode${prototypeMechanicsDone[place.id]?' done':''}`;
      node.dataset.location=prototypeLocationId(place);
      node.style.setProperty('--mx',`${place.x}%`);
      node.style.setProperty('--my',`${place.y}%`);
      const dot=document.createElement('span');dot.className='mapNodeDot';
      const label=document.createElement('span');label.className='mapNodeLabel';label.textContent=GameCatalog.mapLabel(`prototype:${place.id}`,place.game);
      node.append(dot,label);
      canvas.insertBefore(node,player||null);
    });
  }

  function openPrototypeMechanic(location){
    const place=PROTOTYPE_MECHANIC_PLACES.find(item=>item.id===location.prototypeId);
    if(!place||!$prototypeMechanicOverlay)return;
    window.dispatchEvent(new CustomEvent('keynlock-game-opened',{detail:{id:`prototype:${place.id}`}}));
    if(mapOpen){mapOpen=false;document.body.classList.remove('map-open');$worldMapScreen.hidden=true;}
    activePrototypeMechanic=place;
    prototypeMechanicReady=false;
    solved=false;
    $mechanism?.classList.remove('opening','opened','shake-fail');
    document.body.dataset.prototypeGameId=`prototype:${place.id}`;
    document.body.classList.add('prototype-mechanic-open');
    document.body.classList.remove('prototype-lock-ready');
    document.body.classList.toggle('prototype-has-classic-lock',!!GameCatalog.feature(`prototype:${place.id}`,'lock.present'));
    resetNoise?.();
    setGameInactive(true);
    gameDefeat.reset();
    $prototypeMechanicOverlay.hidden=false;
    $objectiveLine.innerHTML='ЦЕЛЬ: <b>ПОДГОТОВКА МЕХАНИКИ</b>';
    setGlobalTimer(false);
    runReward=1000;
    updateEconomyUI();
    updateMechanismAssetHud();
    window.KeynlockImportedInitialPicks=Math.max(0,picks);
    window.KeynlockImportedGames?.open(place.game,{
      picks,
      tension:Math.max(1,Math.min(5,tensionSkin||1)),
      manualOpen:!!GameCatalog.feature(`prototype:${place.id}`,'lock.present')&&!!GameCatalog.feature(`prototype:${place.id}`,'lock.manualOpen')
    }).then(()=>{if(place.id==='fallout')requestAnimationFrame(alignFalloutLock);})
      .catch(error=>{console.error('[prototype-mechanic]',error);toast('Не удалось открыть механику');});
  }

  function closePrototypeMechanic(){
    if(!$prototypeMechanicOverlay)return;
    activePrototypeMechanic=null;
    prototypeMechanicReady=false;
    delete document.body.dataset.prototypeGameId;
    document.body.style.removeProperty('--fallout-lock-align-x');
    document.body.style.removeProperty('--fallout-lock-align-y');
    $prototypeMechanicOverlay.hidden=true;
    gameDefeat.reset();
    window.KeynlockImportedGames?.close();
    setGlobalTimer(false);
    document.body.classList.remove('prototype-mechanic-open','prototype-has-classic-lock','prototype-lock-ready');
    setGameInactive(false);
    updateMechanismAssetHud();
    render();
    openMap();
  }

  function leavePrototypeMechanic(){
    if(!activePrototypeMechanic||!$prototypeMechanicOverlay)return;
    activePrototypeMechanic=null;
    prototypeMechanicReady=false;
    delete document.body.dataset.prototypeGameId;
    document.body.style.removeProperty('--fallout-lock-align-x');
    document.body.style.removeProperty('--fallout-lock-align-y');
    $prototypeMechanicOverlay.hidden=true;
    gameDefeat.reset();
    window.KeynlockImportedGames?.close();
    setGlobalTimer(false);
    document.body.classList.remove('prototype-mechanic-open','prototype-has-classic-lock','prototype-lock-ready');
    setGameInactive(false);
    updateMechanismAssetHud();
    render();
  }

  function replayPrototypeMechanic(){
    if(!activePrototypeMechanic)return;
    solved=false;
    picks=pickCapacity;
    brokenPicks=0;
    renderInventoryTools();
    gameDefeat.reset();
    window.KeynlockImportedGames?.replay();
  }

  const baseArriveAtLocationForPrototype=arriveAtLocation;
  arriveAtLocation=function(id){
    const location=MAP_LOCATIONS[id];
    if(location?.action==='prototype-mechanic'){openPrototypeMechanic(location);return;}
    return baseArriveAtLocationForPrototype(id);
  };

  document.querySelector('#worldMapCanvas')?.addEventListener('click',event=>{
    const node=event.target.closest?.('.prototypeMechanicNode');
    if(node)travelToMapLocation(node.dataset.location);
  });
  document.querySelector('#lockHitArea')?.addEventListener('click',event=>{
    if(!activePrototypeMechanic||!GameCatalog.feature(`prototype:${activePrototypeMechanic.id}`,'lock.manualOpen'))return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if(!prototypeMechanicReady){
      const lock=document.querySelector('#lock.universalLockBlock');
      lock?.classList.remove('prototype-wrong-tension');
      void lock?.offsetWidth;
      lock?.classList.add('prototype-wrong-tension');
      setTimeout(()=>lock?.classList.remove('prototype-wrong-tension'),420);
      if(activePrototypeMechanic.id==='fallout'){
        window.KeynlockImportedGames?.penalizeOpenAttempt();
        SFX.wrongLock();
        toast('Замок не готов · отмычка сломана');
      }else{
        toast('Сначала выставь головоломку');
      }
      return;
    }
    window.KeynlockImportedGames?.attemptOpen();
  },{capture:true});
  document.querySelector('#inventoryTensionRail')?.addEventListener('click',()=>requestAnimationFrame(syncPrototypeTools));
  window.addEventListener('resize',()=>requestAnimationFrame(alignFalloutLock),{passive:true});
  ['#lairHudButton','#mapTab','#gameSettingsButton'].forEach(selector=>{
    document.querySelector(selector)?.addEventListener('click',()=>leavePrototypeMechanic(),{capture:true});
  });

  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==window||!activePrototypeMechanic)return;
    if(event.data?.game!==activePrototypeMechanic.game)return;
    if(event.data.type==='keynlock-mechanic-timer'){
      setGlobalTimer(!!event.data.active,Number(event.data.timeLeft)||0,Number(event.data.timeMax)||1,event.data.label||'Время');
      return;
    }
    if(event.data.type==='keynlock-mechanic-state'){
      const goal=String(event.data.goal||'Выполнить взлом').trim().toUpperCase();
      const moveInfo=Number.isFinite(+event.data.moves)&&Number.isFinite(+event.data.ideal)
        ? ` · ${Math.max(0,+event.data.moves)} ходов · норма ${Math.max(1,+event.data.ideal)}`:'';
      $objectiveLine.innerHTML=`ЦЕЛЬ: <b>${goal}</b>${moveInfo}`;
      runReward=Math.max(0,Number(event.data.reward)||0);
      updateEconomyUI();
      return;
    }
    if(event.data.type==='keynlock-mechanic-picks'){
      const remaining=Math.max(0,Math.min(pickCapacity,Number(event.data.remaining)||0));
      if(remaining<picks){
        brokenPicks+=picks-remaining;
        triggerInventoryBreakAnimation(remaining+1);
      }
      picks=remaining;
      renderInventoryTools();
      return;
    }
    if(event.data.type==='keynlock-mechanic-loss'){
      const reason=event.data.reason==='time'||activePrototypeMechanic.game==='Alpha Protocol'?'time':'picks';
      showGameDefeat(reason);
      return;
    }
    if(event.data.type==='keynlock-mechanic-tension'){
      $prototypeMechanicOverlay.dataset.requiredTension=String(Math.max(1,Math.min(5,Number(event.data.required)||1)));
      return;
    }
    if(event.data.type==='keynlock-mechanic-tools'){
      const lock=document.querySelector('#lock.universalLockBlock');
      lock?.style.setProperty('--fallout-pick-angle',`${Number(event.data.angle)||-90}deg`);
      lock?.style.setProperty('--fallout-turn-angle',`${Number(event.data.turn)||0}deg`);
      return;
    }
    if(event.data.type==='keynlock-mechanic-ready'){
      prototypeMechanicReady=!!event.data.ready;
      document.body.classList.toggle('prototype-lock-ready',prototypeMechanicReady);
      return;
    }
    if(event.data.type==='keynlock-mechanic-wrong-tension'){
      const lock=document.querySelector('#lock.universalLockBlock');
      lock?.classList.remove('prototype-wrong-tension');
      void lock?.offsetWidth;
      lock?.classList.add('prototype-wrong-tension');
      setTimeout(()=>lock?.classList.remove('prototype-wrong-tension'),420);
      toast('Неверный натяжитель · ориентируйся по символу');
      return;
    }
    if(event.data.type!=='keynlock-mechanic-open')return;
    prototypeMechanicReady=false;
    document.body.classList.remove('prototype-lock-ready');
    $mechanism?.classList.remove('opened','shake-fail');
    $mechanism?.classList.add('opening');
    setTimeout(()=>{
      if(!activePrototypeMechanic)return;
      $mechanism?.classList.remove('opening');
      $mechanism?.classList.add('opened');
    },950);
    if(!prototypeMechanicsDone[activePrototypeMechanic.id]){
      prototypeMechanicsDone[activePrototypeMechanic.id]=true;
      STORE.setItem(PROTOTYPE_MECHANIC_DONE_KEY,JSON.stringify(prototypeMechanicsDone));
      const reward=Math.max(100,Number(event.data.score)||1000);
      balance+=reward;
      STORE.setItem('lockpickBalance',String(balance));
      updateEconomyUI();
      toast(`${activePrototypeMechanic.name} пройдена · +${reward}`);
      renderPrototypeMechanicNodes();
    }
  });

  const baseRenderWorldMapForPrototype=renderWorldMap;
  renderWorldMap=function(){
    baseRenderWorldMapForPrototype();
    const location=MAP_LOCATIONS[mapLocation];
    if(location?.action==='prototype-mechanic'&&$mapInfoText){
      const done=prototypeMechanicsDone[location.prototypeId];
      $mapInfoText.textContent=`Новая механика: ${location.game}. ${done?'Уже пройдена. ':''}Нажми на точку ещё раз, чтобы войти.`;
    }
  };

  renderPrototypeMechanicNodes();
  window.addEventListener('keynlock-game-catalog-change',event=>{
    if(event.detail?.path==='readiness'||event.detail?.path==='reset')renderPrototypeMechanicNodes();
  });
