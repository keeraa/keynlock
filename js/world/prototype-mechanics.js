  // ===== IMPORTED V63 MECHANIC LOCATIONS =====
  const PROTOTYPE_MECHANIC_PLACES=[
    {id:'pipeline',name:'Трубопровод',game:'Трубопровод',x:14,y:40},
    {id:'bioshock2',name:'Охранный дрон',game:'BioShock 2',x:17,y:23},
    {id:'risen-2',name:'Верфь Risen 2',game:'Risen 2',x:11,y:61},
    {id:'alpha-protocol',name:'Архив пазов',game:'Alpha Protocol',x:31,y:17},
    {id:'hillsfar',name:'Музей Hillsfar',game:'Hillsfar',x:25,y:82},
    {id:'thief-ds',name:'Теневой квартал',game:'Thief: Deadly Shadows',x:48,y:15},
    {id:'kingdom-come',name:'Дом бронника',game:'Kingdom Come',x:64,y:16},
    {id:'oblivion',name:'Башня штифтов',game:'Oblivion',x:79,y:20},
    {id:'watchmen',name:'Часовая мастерская',game:'Watchmen',x:86,y:34},
    {id:'thief-12',name:'Гильдия воров',game:'Thief 1/2',x:88,y:49},
    {id:'fallout',name:'Старый бункер',game:'Fallout',x:88,y:70},
    {id:'anachronox',name:'Лаборатория Anachronox',game:'Anachronox',x:57,y:86},
    {id:'mass-effect',name:'Узел Mass Effect',game:'Mass Effect',x:96,y:59},
    {id:'mass-effect-2',name:'Парные узлы',game:'Mass Effect 2',x:76,y:82},
    {id:'pathologic-2',name:'Дом механика',game:'Pathologic 2',x:40,y:82}
  ];
  const PROTOTYPE_MECHANIC_DONE_KEY='keynlockPrototypeMechanicsDone';
  let prototypeMechanicsDone={};
  try{prototypeMechanicsDone=JSON.parse(STORE.getItem(PROTOTYPE_MECHANIC_DONE_KEY)||'{}')||{};}catch(_){prototypeMechanicsDone={};}
  let activePrototypeMechanic=null;

  const $prototypeMechanicOverlay=document.querySelector('#prototypeMechanicOverlay');
  const $prototypeMechanicLoss=document.querySelector('#prototypeMechanicLoss');

  function prototypeLocationId(place){return `prototype-${place.id}`;}
  function syncPrototypeTools(){
    if(!activePrototypeMechanic)return;
    window.KeynlockImportedGames?.setTools({tension:Math.max(1,Math.min(5,tensionSkin||1))});
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
      const label=document.createElement('span');label.className='mapNodeLabel';label.textContent=place.name;
      node.append(dot,label);
      canvas.insertBefore(node,player||null);
    });
  }

  function openPrototypeMechanic(location){
    const place=PROTOTYPE_MECHANIC_PLACES.find(item=>item.id===location.prototypeId);
    if(!place||!$prototypeMechanicOverlay)return;
    if(mapOpen){mapOpen=false;document.body.classList.remove('map-open');$worldMapScreen.hidden=true;}
    activePrototypeMechanic=place;
    document.body.dataset.prototypeGameId=`prototype:${place.id}`;
    document.body.classList.add('prototype-mechanic-open');
    document.body.classList.toggle('prototype-has-classic-lock',!!GameCatalog.feature(`prototype:${place.id}`,'lock.present'));
    setGameInactive(true);
    $prototypeMechanicLoss.hidden=picks>0;
    $prototypeMechanicOverlay.hidden=false;
    $objectiveLine.innerHTML='ЦЕЛЬ: <b>ПОДГОТОВКА МЕХАНИКИ</b>';
    runReward=1000;
    updateEconomyUI();
    updateMechanismAssetHud();
    window.KeynlockImportedInitialPicks=Math.max(0,picks);
    window.KeynlockImportedGames?.open(place.game,{picks,tension:Math.max(1,Math.min(5,tensionSkin||1))})
      .catch(error=>{console.error('[prototype-mechanic]',error);toast('Не удалось открыть механику');});
  }

  function closePrototypeMechanic(){
    if(!$prototypeMechanicOverlay)return;
    activePrototypeMechanic=null;
    delete document.body.dataset.prototypeGameId;
    $prototypeMechanicOverlay.hidden=true;
    $prototypeMechanicLoss.hidden=true;
    window.KeynlockImportedGames?.close();
    document.body.classList.remove('prototype-mechanic-open','prototype-has-classic-lock');
    setGameInactive(false);
    updateMechanismAssetHud();
    render();
    openMap();
  }

  function leavePrototypeMechanic(){
    if(!activePrototypeMechanic||!$prototypeMechanicOverlay)return;
    activePrototypeMechanic=null;
    delete document.body.dataset.prototypeGameId;
    $prototypeMechanicOverlay.hidden=true;
    $prototypeMechanicLoss.hidden=true;
    window.KeynlockImportedGames?.close();
    document.body.classList.remove('prototype-mechanic-open','prototype-has-classic-lock');
    setGameInactive(false);
    updateMechanismAssetHud();
    render();
  }

  function replayPrototypeMechanic(){
    if(!activePrototypeMechanic)return;
    picks=pickCapacity;
    brokenPicks=0;
    renderInventoryTools();
    $prototypeMechanicLoss.hidden=true;
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
  document.querySelector('#prototypeMechanicReplay')?.addEventListener('click',replayPrototypeMechanic);
  document.querySelector('#inventoryTensionRail')?.addEventListener('click',()=>requestAnimationFrame(syncPrototypeTools));
  ['#shopHudButton','#lairHudButton','#mapTab'].forEach(selector=>{
    document.querySelector(selector)?.addEventListener('click',()=>leavePrototypeMechanic(),{capture:true});
  });

  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==window||!activePrototypeMechanic)return;
    if(event.data?.game!==activePrototypeMechanic.game)return;
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
      $prototypeMechanicLoss.hidden=false;
      return;
    }
    if(event.data.type==='keynlock-mechanic-tension'){
      $prototypeMechanicOverlay.dataset.requiredTension=String(Math.max(1,Math.min(5,Number(event.data.required)||1)));
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
