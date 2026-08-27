  // ===== IMPORTED V63 MECHANIC LOCATIONS =====
  const PROTOTYPE_MECHANIC_PLACES=[
    {id:'pipeline',name:'Трубопровод',game:'Трубопровод',x:14,y:40},
    {id:'bioshock2',name:'Охранный дрон',game:'BioShock 2',x:17,y:23},
    {id:'alpha-protocol',name:'Архив пазов',game:'Alpha Protocol',x:31,y:17},
    {id:'thief-ds',name:'Теневой квартал',game:'Thief: Deadly Shadows',x:48,y:15},
    {id:'kingdom-come',name:'Дом бронника',game:'Kingdom Come',x:64,y:16},
    {id:'oblivion',name:'Башня штифтов',game:'Oblivion',x:79,y:20},
    {id:'watchmen',name:'Часовая мастерская',game:'Watchmen',x:86,y:34},
    {id:'thief-12',name:'Гильдия воров',game:'Thief 1/2',x:88,y:49},
    {id:'fallout',name:'Старый бункер',game:'Fallout',x:88,y:70},
    {id:'mass-effect-2',name:'Парные узлы',game:'Mass Effect 2',x:76,y:82},
    {id:'pathologic-2',name:'Дом механика',game:'Pathologic 2',x:40,y:82}
  ];
  const PROTOTYPE_MECHANIC_DONE_KEY='keynlockPrototypeMechanicsDone';
  let prototypeMechanicsDone={};
  try{prototypeMechanicsDone=JSON.parse(STORE.getItem(PROTOTYPE_MECHANIC_DONE_KEY)||'{}')||{};}catch(_){prototypeMechanicsDone={};}
  let activePrototypeMechanic=null;

  const $prototypeMechanicOverlay=document.querySelector('#prototypeMechanicOverlay');
  const $prototypeMechanicFrame=document.querySelector('#prototypeMechanicFrame');
  const $prototypeMechanicTitle=document.querySelector('#prototypeMechanicTitle');
  const $prototypeMechanicLoss=document.querySelector('#prototypeMechanicLoss');

  function prototypeLocationId(place){return `prototype-${place.id}`;}
  function prototypeMechanicUrl(place){return `prototypes/lockpicking-mechanics-v63.html?game=${encodeURIComponent(place.game)}&run=${Date.now()}`;}

  PROTOTYPE_MECHANIC_PLACES.forEach(place=>{
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
    if(!place||!$prototypeMechanicOverlay||!$prototypeMechanicFrame)return;
    if(mapOpen){mapOpen=false;document.body.classList.remove('map-open');$worldMapScreen.hidden=true;}
    activePrototypeMechanic=place;
    document.body.classList.add('prototype-mechanic-open');
    setGameInactive(true);
    $prototypeMechanicTitle.textContent=place.name;
    $prototypeMechanicLoss.hidden=true;
    $prototypeMechanicOverlay.hidden=false;
    $prototypeMechanicFrame.src=prototypeMechanicUrl(place);
  }

  function closePrototypeMechanic(){
    if(!$prototypeMechanicOverlay)return;
    activePrototypeMechanic=null;
    $prototypeMechanicOverlay.hidden=true;
    $prototypeMechanicLoss.hidden=true;
    if($prototypeMechanicFrame)$prototypeMechanicFrame.src='about:blank';
    document.body.classList.remove('prototype-mechanic-open');
    setGameInactive(false);
    openMap();
  }

  function replayPrototypeMechanic(){
    if(!activePrototypeMechanic||!$prototypeMechanicFrame)return;
    $prototypeMechanicLoss.hidden=true;
    $prototypeMechanicFrame.src=prototypeMechanicUrl(activePrototypeMechanic);
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
  document.querySelector('#prototypeMechanicClose')?.addEventListener('click',closePrototypeMechanic);
  document.querySelector('#prototypeMechanicReplay')?.addEventListener('click',replayPrototypeMechanic);

  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==$prototypeMechanicFrame?.contentWindow||!activePrototypeMechanic)return;
    if(event.data?.game!==activePrototypeMechanic.game)return;
    if(event.data.type==='keynlock-mechanic-loss'){
      $prototypeMechanicLoss.hidden=false;
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
