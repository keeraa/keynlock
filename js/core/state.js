  const GOAL=4, MIN=1, MAX=7;
  const STORE=(()=>{
    try{
      const s=window.localStorage;
      const k='__lockpick_probe__';
      s.setItem(k,'1'); s.removeItem(k);
      return s;
    }catch{
      const mem={};
      return {
        getItem:k=>Object.prototype.hasOwnProperty.call(mem,k)?mem[k]:null,
        setItem:(k,v)=>{mem[k]=String(v)},
        removeItem:k=>{delete mem[k]}
      };
    }
  })();
  const PICK_TYPES={
    wood:{name:'Деревянная',breakChance:1,saveChance:0},
    iron:{name:'Железная',breakChance:.30,saveChance:.30},
    diamond:{name:'Алмазная',breakChance:.20,saveChance:.50}
  };
  const SHOP_PRICES={iron:3000,diamond:10000,pouch4:4500,pouch5:9000};
  const PICK_SKINS=[null,
    'assets/picks/pick_01.webp',
    'assets/picks/pick_02.webp',
    'assets/picks/pick_03.webp',
    'assets/picks/pick_04.webp',
    'assets/picks/pick_05.webp'
  ];
  let pickSkin=Math.max(1,Math.min(5,Number(STORE.getItem('lockpickSkin'))||1));
  let tensionSkin=Math.max(1,Math.min(5,Number(STORE.getItem('tensionSkin'))||1));


  function loadPickProgress(){
    try{
      const saved=JSON.parse(STORE.getItem('lockpickProgress')||'{}');
      return {iron:!!saved.iron,diamond:!!saved.diamond,capacity:[3,4,5].includes(saved.capacity)?saved.capacity:3,equipped:PICK_TYPES[saved.equipped]?saved.equipped:'wood'};
    }catch{ return {iron:false,diamond:false,capacity:3,equipped:'wood'}; }
  }
  let pickProgress=loadPickProgress();
  if(pickProgress.equipped==='iron'&&!pickProgress.iron) pickProgress.equipped='wood';
  if(pickProgress.equipped==='diamond'&&!pickProgress.diamond) pickProgress.equipped=pickProgress.iron?'iron':'wood';
  let pickType=pickProgress.equipped, pickCapacity=pickProgress.capacity, shopOpen=false;
  let mapOpen=false, mapMoving=false;
  const MAP_LOCATIONS={
    lair:{name:'Логово',x:20,y:68,text:'Точка старта. Здесь находится база команды.',action:'lair'},
    shop:{name:'Лавка отмычек',x:49,y:55,text:'Здесь можно покупать материалы, внешний вид и увеличивать запас отмычек.',action:'shop'},
    upper:{name:'Верхний город',x:56,y:18,text:'Район пока закрыт.',locked:true},
    port:{name:'Порт',x:73,y:84,text:'Район пока закрыт.',locked:true},
    old:{name:'Старый квартал',x:65,y:48,text:'Район пока закрыт.',locked:true}
  };
  const MAP_CONNECTIONS={lair:['shop'],shop:['lair']};
  let mapLocation=MAP_LOCATIONS[STORE.getItem('lockpickMapLocation')]?STORE.getItem('lockpickMapLocation'):'lair';
  if(MAP_LOCATIONS[mapLocation]?.locked) mapLocation='lair';
  let lairOpen=false;
  const LAIR_KAI_PORTRAIT="assets/characters/kai.png";
  const LAIR_SAI_PORTRAIT="assets/characters/sai.png";
  const LAIR_TIK_PORTRAIT="assets/characters/tik.png";
  const LAIR_CHARACTERS={
    kai:{name:'Кай',role:'Взломщик',desc:'Работает аккуратно и предпочитает понятные цели. Хорош как основной персонаж для первых вылазок.',portrait:LAIR_KAI_PORTRAIT},
    sai:{name:'Сай',role:'Разведчик',desc:'Собирает слухи, замечает связи между районами и помогает оценивать риск до выхода в город.',portrait:LAIR_SAI_PORTRAIT},
    tik:{name:'Тик',role:'Механик',desc:'Разбирается в инструментах и конструкциях замков. Полезен при подготовке снаряжения.',portrait:LAIR_TIK_PORTRAIT}
  };
  let lairCharacter=LAIR_CHARACTERS[STORE.getItem('lockpickLairCharacter')]?STORE.getItem('lockpickLairCharacter'):'kai';
  let lairTab='team';
  let lairDialoguePerson='sai';
  let lairIntelSelected='lair';
  const LAIR_DIALOGUES={
    kai:[
      {label:'Следующая цель',text:'Сначала нужны простые замки рядом с базой. Набьём руку, потом полезем глубже в город.'},
      {label:'О риске',text:'Чем дальше от логова, тем важнее заранее знать путь назад и не тратить хорошие отмычки впустую.'},
      {label:'О команде',text:'Сай лучше видит город целиком. Тик — инструменты. Я беру на себя сам замок.'}
    ],
    sai:[
      {label:'Слухи',text:'В старом квартале много закрытых мастерских. В верхнем городе замки лучше, но и добыча заметно выше.'},
      {label:'Районы',text:'Пока безопасный маршрут только между логовом и лавкой. Остальные направления стоит сначала изучить.'},
      {label:'Что анализировать',text:'Смотри на три вещи: сложность замков, ценность целей и насколько понятен путь отхода.'}
    ],
    tik:[
      {label:'Инструменты',text:'Дешёвые отмычки подходят для тренировки. Хороший металл имеет смысл беречь для сложных механизмов.'},
      {label:'Лавка',text:'Лавка рядом — удобно. Сначала увеличил бы запас, потом уже собирал дорогие варианты.'},
      {label:'Новые замки',text:'Если найдём незнакомый механизм, тащи сведения сюда. Разберём его как отдельную схему.'}
    ]
  };
  const LAIR_INTEL_INFO={
    lair:{name:'Логово',risk:'Низкий',locks:'Тренировочные',loot:'Нет',notes:['База команды и точка старта.','Здесь безопасно менять персонажа и обсуждать планы.','Полная информация собрана.']},
    shop:{name:'Лавка отмычек',risk:'Низкий',locks:'Нет',loot:'Снаряжение',notes:['Доступный маршрут от логова.','Можно покупать и улучшать отмычки.','Полная информация собрана.']},
    old:{name:'Старый квартал',risk:'Средний',locks:'Средние',loot:'Средняя',notes:['Район закрыт, известны только общие слухи.','Много мастерских и подсобных помещений.','Известны основные типы целей и подходы.']},
    upper:{name:'Верхний город',risk:'Высокий',locks:'Сложные',loot:'Высокая',notes:['Район закрыт, сведений мало.','Богатые дома и более сложные механизмы.','Известны ключевые точки и уровень охраны.']},
    port:{name:'Порт',risk:'Средний',locks:'Разные',loot:'Высокая',notes:['Район закрыт, сведений мало.','Склады дают много разных типов замков.','Известны основные склады и время активности.']}
  };
  let lairIntel={lair:3,shop:3,old:0,upper:0,port:0};
  try{
    const savedIntel=JSON.parse(STORE.getItem('lockpickLairIntel')||'null');
    if(savedIntel && typeof savedIntel==='object'){
      Object.keys(lairIntel).forEach(k=>{
        if(Number.isFinite(Number(savedIntel[k]))) lairIntel[k]=Math.max(0,Math.min(3,Number(savedIntel[k])));
      });
    }
  }catch{}

  let hfTarget=[], hfOptions=[], hfSelected=-1;
  let meRings=[], meSelected=0, meInitialPositions=[];
  let g1Sequence=[], g1Input=[];
  let r2Sequence=[], r2ProgressCount=0, r2PickPos=0, r2PinEls=[];
  let skTargetAngle=0, skPickAngle=0, skCylinderAngle=0, skTorqueBusy=false, skDragging=false;
  let anTarget=[0,0,0], anState=[0,0,0], anInitialState=[0,0,0], anSelected=0;
  let tnTension=40, tnTarget=52, tnWidth=18, tnIndex=0, tnDrift=.05, tnDragging=false, tnReady=false;
  let rsIndex=0, rsT=0, rsSpeeds=[], rsBaseSpeeds=[], rsSpeedTargets=[], rsSpeedChangeAt=[], rsPauseUntil=[], rsOffsets=[], rsPhases=[], rsLaneEls=[], rsOrbEls=[], rsReady=false;
  let kdVals=[2,2,2,2,2], kdTarget=[2,2,2,2,2], kdSelected=0, kdTests=0, kdFailures=0, kdLogs=[], kdReady=false;
  const CP_LEVEL_NAMES=['ВЕРХ','ЦЕНТР','НИЗ'];
  let cpNodes=[1,1,1,1,1], cpTarget=[1,1,1,1], cpVals=[1,1,1,1], cpInitial=[1,1,1,1], cpSelected=0, cpReady=false;
  let hcSecret=[0,0,0,0], hcAttempts=[], hcDigits=[0,0,0,0], hcActiveIndex=0;
  let drumSecret=[0,0,0,0], drumState=[0,0,0,0], drumSoundOn=true, drumAudioCtx=null;
  let scopeSecret=[0,0,0,0], scopeState=[0,0,0,0];
  let n=5, selected=0, picks=pickCapacity, state=[], initial=[], links=[], targets=[], solved=false, mode='classic', goalLine=GOAL, moves=0, brokenPicks=0, runReward=1000, specialType='chain', generatedDistance=0, balance=Math.max(0,Number(STORE.getItem('lockpickBalance'))||0), hfTimeLeft=45, hfTimeMax=45, hfTimerHandle=null, hfLastTick=0, inventoryBrokenSlot=0, inventoryBreakTimer=null;
  let g1Length=4, r2PinCount=6, tnPinCount=5, rsPinCount=5, kdToothCount=5, skSolveTolerance=6;
  const $plates=document.querySelector('#plates'), $status=document.querySelector('#status'),
        $lock=document.querySelector('#lock'),
        $timerCircleHud=document.querySelector('#timerCircleHud'), $timerCircleProgress=document.querySelector('#timerCircleProgress'), $timerCircleValue=document.querySelector('#timerCircleValue'), $timerCircleLabel=document.querySelector('#timerCircleLabel'),
        $toast=document.querySelector('#toast'), $toastText=document.querySelector('#toastText'), $toastAction=document.querySelector('#toastAction'), $scene=document.querySelector('.scene'), $mechanism=document.querySelector('.mechanismZone'), $lockHitArea=document.querySelector('#lockHitArea'),
        $objectiveLine=document.querySelector('#objectiveLine'),
        $tabClassic=document.querySelector('#tabClassic'), $tabTarget=document.querySelector('#tabTarget'), $tabLine=document.querySelector('#tabLine'), $tabAlt2=document.querySelector('#tabAlt2'), $tabSpecial=document.querySelector('#tabSpecial'), $tabHillsfar=document.querySelector('#tabHillsfar'), $tabMass=document.querySelector('#tabMass'), $tabG1=document.querySelector('#tabG1'), $tabR2=document.querySelector('#tabR2'), $tabSkyrim=document.querySelector('#tabSkyrim'), $tabAnach=document.querySelector('#tabAnach'), $tabTension=document.querySelector('#tabTension'), $tabResonance=document.querySelector('#tabResonance'), $tabDeduction=document.querySelector('#tabDeduction'), $tabComposite=document.querySelector('#tabComposite'), $mapTab=document.querySelector('#mapTab'),
        $coinBalance=document.querySelector('#coinBalance'), $runReward=document.querySelector('#runReward'), $rewardBox=document.querySelector('#rewardBox'),
        $shopTab=document.querySelector('#shopTab'), $shopOverlay=document.querySelector('#shopOverlay'), $shopClose=document.querySelector('#shopClose'), $shopBalance=document.querySelector('#shopBalance'),
        $worldMapScreen=document.querySelector('#worldMapScreen'), $worldMapCanvas=document.querySelector('#worldMapCanvas'), $mapPlayer=document.querySelector('#mapPlayer'), $mapCurrentName=document.querySelector('#mapCurrentName'), $mapInfoTitle=document.querySelector('#mapInfoTitle'), $mapInfoText=document.querySelector('#mapInfoText'), $mapLocationAction=document.querySelector('#mapLocationAction'),
        $lairOverlay=document.querySelector('#lairOverlay'), $lairClose=document.querySelector('#lairClose'), $lairActiveName=document.querySelector('#lairActiveName'), $lairSceneCharacters=document.querySelector('#lairSceneCharacters'), $lairModuleWindow=document.querySelector('#lairModuleWindow'), $lairModuleTitle=document.querySelector('#lairModuleTitle'), $lairModuleClose=document.querySelector('#lairModuleClose'), $lairCharacters=document.querySelector('#lairCharacters'), $lairDialoguePeople=document.querySelector('#lairDialoguePeople'), $lairDialogueSpeaker=document.querySelector('#lairDialogueSpeaker'), $lairDialogueText=document.querySelector('#lairDialogueText'), $lairDialogueTopics=document.querySelector('#lairDialogueTopics'), $lairIntelGrid=document.querySelector('#lairIntelGrid'), $lairIntelDetail=document.querySelector('#lairIntelDetail'),
        $pickSkinGrid=document.querySelector('#pickSkinGrid'), $pickSkinMain=document.querySelector('#pickSkinMain'), $tensionSkinGrid=document.querySelector('#tensionSkinGrid'), $tensionSkinMain=document.querySelector('#tensionSkinMain'),
        $hillsfarMode=document.querySelector('#hillsfarMode'), $hfTryArea=document.querySelector('#hfTryArea'), $hfLockCut=document.querySelector('#hfLockCut'), $hfCandidates=document.querySelector('#hfCandidates'),
        $massMode=document.querySelector('#massMode'), $massRings=document.querySelector('#massRings'), $massCenter=document.querySelector('#massCenter'), $massCenterText=document.querySelector('#massCenterText'),
        $g1Mode=document.querySelector('#g1Mode'), $g1ProgressRow=document.querySelector('#g1ProgressRow'),
        $r2Mode=document.querySelector('#r2Mode'), $r2Pins=document.querySelector('#r2Pins'), $r2Pick=document.querySelector('#r2Pick'), $r2Progress=document.querySelector('#r2Progress'), $r2Message=document.querySelector('#r2Message'),
        $skMode=document.querySelector('#skMode'), $skBoard=document.querySelector('#skBoard'), $skTorqueButton=document.querySelector('#skTorqueButton'), $skFeedbackText=document.querySelector('#skFeedbackText'),
        $shopWood=document.querySelector('#shopWood'), $shopIron=document.querySelector('#shopIron'), $shopDiamond=document.querySelector('#shopDiamond'),
        $woodAction=document.querySelector('#woodAction'), $ironAction=document.querySelector('#ironAction'), $diamondAction=document.querySelector('#diamondAction'),
        $pouchTitle=document.querySelector('#pouchTitle'), $pouchBuy=document.querySelector('#pouchBuy'),
        $anMode=document.querySelector('#anMode'), $anUnlock=document.querySelector('#anUnlock'), $anReadout=document.querySelector('#anReadout'), $anActionLabel=document.querySelector('#anActionLabel'), $anSelectedHint=document.querySelector('#anSelectedHint'),
        $tensionMode=document.querySelector('#tensionMode'), $tnGauge=document.querySelector('#tnGauge'), $tnBand=document.querySelector('#tnBand'), $tnNeedle=document.querySelector('#tnNeedle'), $tnPins=document.querySelector('#tnPins'), $tnMessage=document.querySelector('#tnMessage'),
        $resonanceMode=document.querySelector('#resonanceMode'), $rsLanes=document.querySelector('#rsLanes'),
        $deductionMode=document.querySelector('#deductionMode'), $kdPanel=document.querySelector('#kdPanel'), $kdKey=document.querySelector('#kdKey'), $kdCheck=document.querySelector('#kdCheck'), $kdFeedback=document.querySelector('#kdFeedback'), $kdHistory=document.querySelector('#kdHistory'),
        $compositeMode=document.querySelector('#compositeMode'), $cpPins=document.querySelector('#cpPins'), $cpBuildPins=document.querySelector('#cpBuildPins'), $cpTargetShadow=document.querySelector('#cpTargetShadow'), $cpTargetFill=document.querySelector('#cpTargetFill'), $cpTargetTopLine=document.querySelector('#cpTargetTopLine'), $cpTargetBevel=document.querySelector('#cpTargetBevel'), $cpTargetPath=document.querySelector('#cpTargetPath'), $cpTargetGlow=document.querySelector('#cpTargetGlow'), $cpBuildShadow=document.querySelector('#cpBuildShadow'), $cpBuildFill=document.querySelector('#cpBuildFill'), $cpBuildTopLine=document.querySelector('#cpBuildTopLine'), $cpBuildBevel=document.querySelector('#cpBuildBevel'), $cpBuildPath=document.querySelector('#cpBuildPath'), $cpBuildGlow=document.querySelector('#cpBuildGlow'), $cpBuildJoints=document.querySelector('#cpBuildJoints'), $cpParts=document.querySelector('#cpParts'), $cpState=document.querySelector('#cpState'),
        $tabHeatCold=document.querySelector('#tabHeatCold'), $tabDrum=document.querySelector('#tabDrum'), $tabScope=document.querySelector('#tabScope'),
        $heatColdMode=document.querySelector('#heatColdMode'), $hcInput=document.querySelector('#hcInput'), $hcDialRow=document.querySelector('#hcDialRow'), $hcSlots=document.querySelector('#hcSlots'), $hcResult=document.querySelector('#hcResult'), $hcRows=document.querySelector('#hcRows'),
        $drumMode=document.querySelector('#drumMode'), $drumWheels=document.querySelector('#drumWheels'), $drumCheck=document.querySelector('#drumCheck'), $drumResult=document.querySelector('#drumResult'), $drumSound=document.querySelector('#drumSound'), $drumNew=document.querySelector('#drumNew'),
        $scopeMode=document.querySelector('#scopeMode'), $scopeCanvas=document.querySelector('#scopeCanvas'), $scopeWheels=document.querySelector('#scopeWheels'), $scopeScore=document.querySelector('#scopeScore'), $scopeBar=document.querySelector('#scopeBar'), $scopeCheck=document.querySelector('#scopeCheck'), $scopeResult=document.querySelector('#scopeResult'), $scopeNew=document.querySelector('#scopeNew');

  const MODE_PANELS=Object.freeze({
    hillsfar:$hillsfarMode,
    mass:$massMode,
    g1:$g1Mode,
    r2:$r2Mode,
    skyrim:$skMode,
    anach:$anMode,
    tension:$tensionMode,
    resonance:$resonanceMode,
    deduction:$deductionMode,
    composite:$compositeMode,
    heatcold:$heatColdMode,
    drum:$drumMode,
    scope:$scopeMode
  });
  const IMPORTED_MODES=new Set(Object.keys(MODE_PANELS));
  const ALL_MODES=new Set(['classic','target','line','sequence','special',...IMPORTED_MODES]);

  const DIFFICULTY_STORAGE_KEY='lockpickModeDifficulty';
  const DEFAULT_MODE_DIFFICULTY=Object.freeze({classic:1,target:1,line:1,sequence:1,special:1,hillsfar:1,mass:1,g1:1,r2:1,skyrim:1,anach:1,tension:1,resonance:1,deduction:1,composite:1,heatcold:1,drum:1,scope:1});
  function loadModeDifficulty(){
    try{
      const saved=JSON.parse(STORE.getItem(DIFFICULTY_STORAGE_KEY)||'{}');
      const out={...DEFAULT_MODE_DIFFICULTY};
      Object.keys(out).forEach(key=>{ const v=Number(saved?.[key]); if([1,2,3].includes(v)) out[key]=v; });
      return out;
    }catch{ return {...DEFAULT_MODE_DIFFICULTY}; }
  }
  let modeDifficultyMap=loadModeDifficulty();
  function saveModeDifficulty(){ STORE.setItem(DIFFICULTY_STORAGE_KEY, JSON.stringify(modeDifficultyMap)); }
  function getModeDifficulty(modeName=mode){ const v=Number(modeDifficultyMap?.[modeName]); return [1,2,3].includes(v)?v:1; }
  function diffStep(a,b,c,modeName=mode){ const level=getModeDifficulty(modeName); return level===1?a:level===2?b:c; }
  function renderDifficultyDock(){
    const dock=document.querySelector('#difficultyDock');
    document.querySelectorAll('.difficultyBtn').forEach(btn=>{
      btn.classList.toggle('active', Number(btn.dataset.difficulty)===getModeDifficulty(mode));
    });
    if(!dock) return;

    const activeTab=document.querySelector('.modeTabs .tab.active');
    const hide=mapOpen || lairOpen || shopOpen || !activeTab || activeTab.hidden;
    dock.style.display=hide?'none':'flex';
    if(hide) return;

    requestAnimationFrame(()=>{
      const r=activeTab.getBoundingClientRect();
      const h=dock.offsetHeight || 34;
      const btn=document.querySelector('.mobileModeMenuButton');
      if(r.right < 8 && btn){
        const b=btn.getBoundingClientRect();
        dock.style.left=`${Math.round(b.right + 8)}px`;
        dock.style.top=`${Math.round(b.top + (b.height-h)/2)}px`;
        return;
      }
      dock.style.left=`${Math.round(r.right + 7)}px`;
      dock.style.top=`${Math.round(r.top + (r.height-h)/2)}px`;
    });
  }
  function setModeDifficulty(level, modeName=mode, regenerate=true){
    level=Math.max(1,Math.min(3,Number(level)||1));
    modeDifficultyMap[modeName]=level;
    saveModeDifficulty();
    renderDifficultyDock();
    if(modeName!==mode || !regenerate) return;
    if(lairOpen) closeLair();
    if(mapOpen) closeMap();
    if(shopOpen) closeShop();
    requestAnimationFrame(()=>{ newLock(false); if(mode==='r2') requestAnimationFrame(renderR2); });
  }

  function syncModePanels(activeMode=mode){
    for(const [name,panel] of Object.entries(MODE_PANELS)){
      if(!panel) continue;
      const active=name===activeMode;
      panel.hidden=!active;
      panel.inert=!active;
      panel.style.setProperty('display',active?'flex':'none','important');
      panel.style.setProperty('visibility',active?'visible':'hidden','important');
      panel.style.setProperty('opacity',active?'1':'0','important');
      panel.style.setProperty('pointer-events',active?'auto':'none','important');
      panel.setAttribute('aria-hidden',active?'false':'true');
    }
  }

  let pointerTargetX=0, pointerTargetY=0, pointerX=0, pointerY=0;
  let bgParallaxTargetX=0, bgParallaxTargetY=0, bgParallaxX=0, bgParallaxY=0;

  function rand(a,b){return Math.floor(Math.random()*(b-a+1))+a}

  function cssUrl(uri){ return `url("${new URL(uri, document.baseURI).href}")`; }

  
  const PLATE_SKINS=[
'assets/plates/plate_01.webp',
'assets/plates/plate_02.webp',
'assets/plates/plate_03.webp',
'assets/plates/plate_04.webp'
];
  const PIN_SKINS=[
'assets/pins/iron/iron_pin_01.png',
'assets/pins/iron/iron_pin_02.png',
'assets/pins/iron/iron_pin_03.png',
'assets/pins/iron/iron_pin_04.png',
'assets/pins/iron/iron_pin_05.png',
'assets/pins/iron/iron_pin_06.png',
'assets/pins/iron/iron_pin_07.png',
'assets/pins/iron/iron_pin_08.png',
'assets/pins/iron/iron_pin_09.png',
'assets/pins/iron/iron_pin_10.png'
  ];
  const PIN_SKIN_NAMES=['iron_pin_01.png','iron_pin_02.png','iron_pin_03.png','iron_pin_04.png','iron_pin_05.png','iron_pin_06.png','iron_pin_07.png','iron_pin_08.png','iron_pin_09.png','iron_pin_10.png'];
  const GOLD_PIN_SKINS=[
    'assets/pins/gold/gold_pin_01.png',
    'assets/pins/gold/gold_pin_02.png',
    'assets/pins/gold/gold_pin_03.png',
    'assets/pins/gold/gold_pin_04.png',
    'assets/pins/gold/gold_pin_05.png',
    'assets/pins/gold/gold_pin_06.png',
    'assets/pins/gold/gold_pin_07.png',
    'assets/pins/gold/gold_pin_08.png',
    'assets/pins/gold/gold_pin_09.png',
    'assets/pins/gold/gold_pin_10.png'
  ];
  const GOLD_PIN_SKIN_NAMES=['gold_pin_01.png','gold_pin_02.png','gold_pin_03.png','gold_pin_04.png','gold_pin_05.png','gold_pin_06.png','gold_pin_07.png','gold_pin_08.png','gold_pin_09.png','gold_pin_10.png'];
  const TENSION_SKINS=[null,
    'assets/tensions/tension_01.webp',
    'assets/tensions/tension_02.webp',
    'assets/tensions/tension_03.webp',
    'assets/tensions/tension_04.webp',
    'assets/tensions/tension_05.webp',
  ];
  const TENSION_SKIN_LABELS=[null,'Прямой','Крючок','Угловой','Волнистый','L-образный'];
  const ACTIVE_PLATE_SKIN_COUNT=4;
  const PLATE_SKIN_NAMES=['plate_01.png','plate_02.png','plate_03.png','plate_04.png'];
  const PLATE_HOLE_Y=[0.41711230,0.44547872,0.47406417,0.49202128,0.52032086];
  const PLATE_HOLE_X=[150.5,275,399.5,524.5,649,773.5,898].map(x=>x/1054);
  let roundPinSkin=0, roundPlateSkin=0, currentPinLevel=1;
  function pinSkinPoolForLevel(level=currentPinLevel){ return level===2 ? GOLD_PIN_SKINS : PIN_SKINS; }
  function pinNamePoolForLevel(level=currentPinLevel){ return level===2 ? GOLD_PIN_SKIN_NAMES : PIN_SKIN_NAMES; }
  function chooseRoundPinSkin(){
    currentPinLevel=getModeDifficulty(mode);
    const pool=pinSkinPoolForLevel(currentPinLevel);
    roundPinSkin=rand(0,Math.max(0,pool.length-1));
    updateMechanismAssetHud();
  }
  function chooseRoundPlateSkin(){ roundPlateSkin=rand(0,Math.max(0,Math.min(ACTIVE_PLATE_SKIN_COUNT,PLATE_SKINS.length)-1)); }
  function currentPinSkin(){ const pool=pinSkinPoolForLevel(); return pool[roundPinSkin] || pool[0] || ''; }
  function currentPinName(){ const pool=pinNamePoolForLevel(); return pool[roundPinSkin] || pool[0] || '—'; }
  function currentPlateName(){ return PLATE_SKIN_NAMES[Math.min(roundPlateSkin||0,ACTIVE_PLATE_SKIN_COUNT-1)] || 'plate_01.png'; }
  function currentPlateSkin(){ return PLATE_SKINS[Math.min(roundPlateSkin||0,ACTIVE_PLATE_SKIN_COUNT-1)] || PLATE_SKINS[0]; }
  function currentPlateHoleY(){ return PLATE_HOLE_Y[Math.min(roundPlateSkin||0,ACTIVE_PLATE_SKIN_COUNT-1)] ?? .47; }

  const LOCK_BODY_SKINS_BY_LEVEL={
  1:[
    {name:"lock_00.png",data:"assets/locks/level1/lock_00.png"},
    {name:"lock_01.png",data:"assets/locks/level1/lock_01.png"},
    {name:"iron_lock_02.png",data:"assets/locks/level1/iron_lock_02.png"},
    {name:"iron_lock_03.png",data:"assets/locks/level1/iron_lock_03.png"},
    {name:"iron_lock_04.png",data:"assets/locks/level1/iron_lock_04.png"},
    {name:"iron_lock_05.png",data:"assets/locks/level1/iron_lock_05.png"},
    {name:"iron_lock_06.png",data:"assets/locks/level1/iron_lock_06.png"},
    {name:"iron_lock_07.png",data:"assets/locks/level1/iron_lock_07.png"},
    {name:"iron_lock_08.png",data:"assets/locks/level1/iron_lock_08.png"},
    {name:"iron_lock_09.png",data:"assets/locks/level1/iron_lock_09.png"},
    {name:"iron_lock_10.png",data:"assets/locks/level1/iron_lock_10.png"},
    {name:"iron_lock_11.png",data:"assets/locks/level1/iron_lock_11.png"},
    {name:"iron_lock_12.png",data:"assets/locks/level1/iron_lock_12.png"}
  ],
  2:[
    {name:"lock_05.png",data:"assets/locks/level2/lock_05.png"},
    {name:"gold_lock_01.png",data:"assets/locks/level2/gold_lock_01.png"},
    {name:"gold_lock_03.png",data:"assets/locks/level2/gold_lock_03.png"},
    {name:"gold_lock_05.png",data:"assets/locks/level2/gold_lock_05.png"}
  ],
  3:[
    {name:"premium_lock_04.png",data:"assets/locks/level3/premium_lock_04.png"}
  ]
};

const LOCKER_SKINS_BY_LEVEL={
  1:[
    {name:"iron_locker_01.png",data:"assets/shackles/level1/iron_locker_01.png"},
    {name:"iron_locker_02.png",data:"assets/shackles/level1/iron_locker_02.png"},
    {name:"iron_locker_03.png",data:"assets/shackles/level1/iron_locker_03.png"},
    {name:"iron_locker_04.png",data:"assets/shackles/level1/iron_locker_04.png"},
    {name:"iron_locker_05.png",data:"assets/shackles/level1/iron_locker_05.png"},
    {name:"iron_locker_06.png",data:"assets/shackles/level1/iron_locker_06.png"},
    {name:"iron_locker_07.png",data:"assets/shackles/level1/iron_locker_07.png"},
  ],
  2:[
    {name:"locker_03.png",data:"assets/shackles/level2/locker_03.png"},
    {name:"gold_locker_02.png",data:"assets/shackles/level2/gold_locker_02.png"},
    {name:"gold_locker_03.png",data:"assets/shackles/level2/gold_locker_03.png"},
    {name:"gold_locker_04.png",data:"assets/shackles/level2/gold_locker_04.png"},
    {name:"gold_locker_05.png",data:"assets/shackles/level2/gold_locker_05.png"}
  ],
  3:[
    {name:"premium_locker_08.png",data:"assets/shackles/level3/premium_locker_08.png"}
  ]
};

const REMOVED_SHACKLE_NAMES = new Set([
  "iron_shackle_08.png",
  "iron_shackle_09.png",
  "gold_shackle_01.png",
  "locker_01.png",
  "iron_locker_09.png"
]);
Object.keys(LOCKER_SKINS_BY_LEVEL).forEach(level=>{
  LOCKER_SKINS_BY_LEVEL[level] = (LOCKER_SKINS_BY_LEVEL[level] || []).filter(item=>!REMOVED_SHACKLE_NAMES.has(item.name));
});

let roundLockBodySkin=0, roundLockerSkin=0;
let currentMechanismLevel=1;
const LAST_LOCK_BODY_KEY='lastRoundLockBodyName';
const LAST_SHACKLE_KEY='lastRoundShackleName';
let previousRoundLockBodyName=STORE.getItem(LAST_LOCK_BODY_KEY)||'';
let previousRoundShackleName=STORE.getItem(LAST_SHACKLE_KEY)||'';
function getSkinPoolByLevel(store, level=getModeDifficulty(mode)){
  const fallback=(store && store[1] && store[1].length)?store[1]:[];
  return (store && store[level] && store[level].length)?store[level]:fallback;
}
function chooseNonRepeatingSkinIndex(pool, previousName=''){
  if(!Array.isArray(pool) || !pool.length) return 0;
  if(pool.length===1) return 0;
  const candidates=pool
    .map((item,index)=>({item,index}))
    .filter(({item})=>(item?.name||'')!==previousName);
  if(candidates.length){
    return candidates[rand(0,candidates.length-1)].index;
  }
  return rand(0,Math.max(0,pool.length-1));
}
function chooseRoundMechanismSkin(){
  currentMechanismLevel=getModeDifficulty(mode);
  const bodyPool=getSkinPoolByLevel(LOCK_BODY_SKINS_BY_LEVEL,currentMechanismLevel);
  const shacklePool=getSkinPoolByLevel(LOCKER_SKINS_BY_LEVEL,currentMechanismLevel);
  roundLockBodySkin=chooseNonRepeatingSkinIndex(bodyPool,previousRoundLockBodyName);
  roundLockerSkin=chooseNonRepeatingSkinIndex(shacklePool,previousRoundShackleName);
  previousRoundLockBodyName=(bodyPool[roundLockBodySkin] && bodyPool[roundLockBodySkin].name) || '';
  previousRoundShackleName=(shacklePool[roundLockerSkin] && shacklePool[roundLockerSkin].name) || '';
  STORE.setItem(LAST_LOCK_BODY_KEY,previousRoundLockBodyName);
  STORE.setItem(LAST_SHACKLE_KEY,previousRoundShackleName);
  applyMechanismSkin();
}
function currentLockBodyEntry(){
  const pool=getSkinPoolByLevel(LOCK_BODY_SKINS_BY_LEVEL,currentMechanismLevel);
  return pool[roundLockBodySkin] || pool[0] || {name:'—',data:''};
}
function currentLockerEntry(){
  const pool=getSkinPoolByLevel(LOCKER_SKINS_BY_LEVEL,currentMechanismLevel);
  return pool[roundLockerSkin] || pool[0] || {name:'—',data:''};
}
function currentLockBodySkin(){ return currentLockBodyEntry().data || ''; }
function currentLockerSkin(){ return currentLockerEntry().data || ''; }
function updateMechanismAssetHud(){
  const wrap=document.querySelector('#assetNameHud');
  const lockEl=document.querySelector('#assetNameLock');
  const shackleEl=document.querySelector('#assetNameShackle');
  const plateEl=document.querySelector('#assetNamePlate');
  const pinEl=document.querySelector('#assetNamePin');
  if(!wrap || !lockEl || !shackleEl) return;
  const lockEntry=currentLockBodyEntry();
  const shackleEntry=currentLockerEntry();
  lockEl.textContent=`lock: ${lockEntry.name || '—'}`;
  shackleEl.textContent=`shackle: ${shackleEntry.name || '—'}`;
  if(plateEl) plateEl.textContent=`plate: ${currentPlateName()}`;
  if(pinEl) pinEl.textContent=`pin: ${currentPinName()}`;
}
function applyMechanismSkin(){
  const lockBody=cssUrl(currentLockBodySkin());
  const locker=cssUrl(currentLockerSkin());
  document.querySelectorAll('.mechanismZone, .sharedModeLockArt, #skBoard').forEach(el=>{
    el.style.setProperty('--lock-body-image', lockBody);
    el.style.setProperty('--locker-image', locker);
  });
  updateMechanismAssetHud();
}

