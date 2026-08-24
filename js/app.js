(() => {
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
    lair:{name:'Логово',x:20,y:68,text:'Точка старта. Здесь находится база команды.',action:null},
    shop:{name:'Лавка отмычек',x:49,y:55,text:'Здесь можно покупать материалы, внешний вид и увеличивать запас отмычек.',action:'shop'},
    mission1:{name:'Миссия 1',x:34,y:48,text:'Первый рабочий замок. Механика: Классика.',action:'mission-classic'},
    upper:{name:'Верхний город',x:56,y:18,text:'Район пока закрыт.',locked:true},
    port:{name:'Порт',x:73,y:84,text:'Район пока закрыт.',locked:true},
    old:{name:'Старый квартал',x:65,y:48,text:'Район пока закрыт.',locked:true}
  };
  const MAP_CONNECTIONS={lair:['shop','mission1'],shop:['lair','mission1'],mission1:['lair','shop']};
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

  const LEGACY_PIN_SKINS=[
'assets/pins/legacy/legacy_pin_01.webp',
'assets/pins/legacy/legacy_pin_02.webp',
'assets/pins/legacy/legacy_pin_03.webp',
'assets/pins/legacy/legacy_pin_04.webp',
'assets/pins/legacy/legacy_pin_05.webp',
'assets/pins/legacy/legacy_pin_06.webp',
'assets/pins/legacy/legacy_pin_07.webp',
'assets/pins/legacy/legacy_pin_08.webp',
'assets/pins/legacy/legacy_pin_09.webp',
'assets/pins/legacy/legacy_pin_10.webp'
];
  const PLATE_SKINS=[
'assets/plates/plate_01.webp',
'assets/plates/plate_02.webp',
'assets/plates/plate_03.webp',
'assets/plates/plate_04.webp',
'assets/plates/plate_05.webp'
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
  const lockBody=`url("${currentLockBodySkin()}")`;
  const locker=`url("${currentLockerSkin()}")`;
  document.querySelectorAll('.mechanismZone, .sharedModeLockArt').forEach(el=>{
    el.style.setProperty('--lock-body-image', lockBody);
    el.style.setProperty('--locker-image', locker);
  });
  updateMechanismAssetHud();
}


  let audioCtx=null;

  function ensureAudio(){
    if(!audioCtx){
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC) return null;
      audioCtx=new AC();
    }
    if(audioCtx.state==='suspended') audioCtx.resume().catch(()=>{});
    return audioCtx;
  }

  function tone(freq=440,duration=.08,type='sine',gain=.035,slideTo=null){
    const ctx=ensureAudio();
    if(!ctx) return;
    const now=ctx.currentTime;
    const osc=ctx.createOscillator();
    const vol=ctx.createGain();
    osc.type=type;
    osc.frequency.setValueAtTime(freq,now);
    if(slideTo!=null) osc.frequency.exponentialRampToValueAtTime(Math.max(20,slideTo),now+duration);
    vol.gain.setValueAtTime(.0001,now);
    vol.gain.exponentialRampToValueAtTime(gain,now+.008);
    vol.gain.exponentialRampToValueAtTime(.0001,now+duration);
    osc.connect(vol).connect(ctx.destination);
    osc.start(now);
    osc.stop(now+duration+.02);
  }

  function noise(duration=.06,gain=.025){
    const ctx=ensureAudio();
    if(!ctx) return;
    const length=Math.max(1,Math.floor(ctx.sampleRate*duration));
    const buffer=ctx.createBuffer(1,length,ctx.sampleRate);
    const data=buffer.getChannelData(0);
    for(let i=0;i<length;i++) data[i]=(Math.random()*2-1)*(1-i/length);
    const src=ctx.createBufferSource();
    const vol=ctx.createGain();
    src.buffer=buffer;
    vol.gain.setValueAtTime(gain,ctx.currentTime);
    vol.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+duration);
    src.connect(vol).connect(ctx.destination);
    src.start();
  }

  const SFX={
    select(){ tone(520,.045,'triangle',.022,600); },
    move(){
      tone(250,.07,'triangle',.026,330);
      setTimeout(()=>tone(620,.045,'sine',.018,700),40);
    },
    blocked(){ tone(145,.10,'sawtooth',.025,95); },
    break(){
      noise(.09,.036);
      tone(120,.12,'square',.022,70);
    },
    survive(){ tone(390,.06,'triangle',.018,470); },
    ready(){
      tone(660,.08,'sine',.018,820);
      setTimeout(()=>tone(880,.09,'sine',.016,990),70);
    },
    wrongLock(){
      tone(180,.09,'triangle',.022,130);
      setTimeout(()=>tone(130,.08,'triangle',.018,100),70);
    },
    open(){
      tone(240,.09,'triangle',.025,360);
      setTimeout(()=>tone(480,.11,'sine',.025,720),80);
      setTimeout(()=>tone(760,.16,'sine',.022,980),165);
    },
    newRound(){ tone(330,.06,'sine',.012,410); }
  };

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

  function updateEconomyUI(){
    $coinBalance.textContent=balance;
    $runReward.textContent=runReward;
}

  function animateRewardDrop(){
    $rewardBox.classList.remove('drop');
    void $rewardBox.offsetWidth;
    $rewardBox.classList.add('drop');
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
    if(!$timerCircleHud || !$timerCircleProgress || !$timerCircleValue || !$timerCircleLabel) return;
    $timerCircleHud.classList.toggle('hidden', !active);
    $timerCircleHud.setAttribute('aria-hidden', active ? 'false' : 'true');
    if(!active) return;
    const safeMax = Math.max(.001, timeMax || 1);
    const pct = Math.max(0, Math.min(1, timeLeft / safeMax));
    const radius = 30;
    const circumference = 2 * Math.PI * radius;
    $timerCircleProgress.style.strokeDasharray = `${circumference}`;
    $timerCircleProgress.style.strokeDashoffset = `${circumference * (1 - pct)}`;
    $timerCircleProgress.style.stroke = pct > .45 ? '#d9f184' : (pct > .2 ? '#e8c77e' : '#e58468');
    $timerCircleValue.textContent = `${timeLeft.toFixed(1)}с`;
    $timerCircleLabel.textContent = label;
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
    SFX.break();
    const kept=Math.random()<info.saveChance;
    if(!kept && resetProgress) resetProgress();
    updatePickUI();
    if(renderState) renderState();

    if(picks<=0){
      solved=true;
      toast('Отмычки закончились · проигрыш');
      setTimeout(()=>newLock(false),1320);
      return {broke:true, kept, depleted:true};
    }

    toast(kept?'Отмычка сломалась · прогресс сохранён':'Отмычка сломалась · прогресс сброшен');
    return {broke:true, kept, depleted:false};
  }

  function applyPickSkin(){
    const uri=PICK_SKINS[pickSkin]||PICK_SKINS[1];
    document.documentElement.style.setProperty('--pick-skin-image',`url("${uri}")`);
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
    document.documentElement.style.setProperty('--tension-skin-image',`url("${uri}")`);
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

  function inventoryEls(){
    return {
      root:document.querySelector('#inventoryDrawer'),
      toggle:document.querySelector('#inventoryToggle'),
      pickRail:document.querySelector('#inventoryPickRail'),
      tensionRail:document.querySelector('#inventoryTensionRail'),
      avatar:document.querySelector('#inventoryAvatar')
    };
  }

  function triggerInventoryBreakAnimation(slot){
    inventoryBrokenSlot = Math.max(0, Math.min(5, Number(slot)||0));
    if(inventoryBreakTimer) clearTimeout(inventoryBreakTimer);
    inventoryBreakTimer = setTimeout(()=>{
      inventoryBrokenSlot = 0;
      renderInventoryTools();
    }, 280);
  }

  function setInventoryOpen(force){
    const {root,toggle}=inventoryEls();
    if(!root || !toggle) return;
    const next=typeof force==='boolean' ? force : !root.classList.contains('open');
    root.classList.toggle('open',next);
    document.body.classList.toggle('inventory-open',next);
    toggle.setAttribute('aria-expanded',next?'true':'false');
    toggle.setAttribute('aria-label',next?'Закрыть инвентарь':'Открыть инвентарь');
  }

  function renderInventoryAvatar(){
    const {avatar}=inventoryEls();
    if(!avatar) return;
    const ch=LAIR_CHARACTERS[lairCharacter] || LAIR_CHARACTERS.kai;
    avatar.innerHTML=ch?.portrait
      ? `<img src="${ch.portrait}" alt="${ch.name}">`
      : `<span>${(ch?.name||'К')[0]}</span>`;
  }

  function inventoryTool(kind,index,src,label,options={}){
    const btn=document.createElement('button');
    btn.type='button';
    const active=kind==='pick' ? pickSkin===index : tensionSkin===index;
    btn.className=`inventoryTool inventoryTool-${kind}${active?' selected':''}`;
    if(options.hidden) btn.classList.add('hidden-slot');
    if(options.breaking) btn.classList.add('breaking-out');
    if(options.hidden || options.breaking) btn.disabled = true;
    btn.title=label;
    btn.setAttribute('aria-label',label);
    const img=document.createElement('img');
    img.src=src;
    img.alt='';
    btn.appendChild(img);
    if(!(options.hidden || options.breaking)) btn.addEventListener('click',e=>{
      e.stopPropagation();
      if(kind==='pick') selectPickSkin(index);
      else selectTensionSkin(index);
    });
    return btn;
  }

  function renderInventoryTools(){
    const {pickRail,tensionRail}=inventoryEls();
    if(!pickRail || !tensionRail) return;
    pickRail.replaceChildren();
    tensionRail.replaceChildren();

    const visiblePicks=Math.max(0, Math.min(pickCapacity, picks));
    pickRail.style.gridTemplateColumns = 'repeat(5,1fr)';
    pickRail.style.opacity = pickCapacity > 0 ? '1' : '.45';

    for(let i=1;i<=5;i++){
      const pickIndex=i;
      const isAvailable=i<=visiblePicks;
      const isBreaking=(i===inventoryBrokenSlot && i===visiblePicks+1 && i<=pickCapacity+1);
      const isRenderable=isAvailable || isBreaking;
      const btn=inventoryTool('pick',pickIndex,PICK_SKINS[pickIndex],`Отмычка ${pickIndex} · слот ${i}${isAvailable ? ` · осталось ${visiblePicks}` : ''}`,{
        hidden: !isRenderable,
        breaking: isBreaking
      });
      btn.dataset.pickIndex=String(pickIndex);
      btn.dataset.slot=String(i);
      pickRail.appendChild(btn);
    }

    tensionRail.style.gridTemplateColumns = 'repeat(5,1fr)';
    for(let i=1;i<=5;i++){
      tensionRail.appendChild(inventoryTool('tension',i,TENSION_SKINS[i],`Натяжитель · ${TENSION_SKIN_LABELS[i]||`Вариант ${i}`}`));
    }
  }

  function initInventoryDrawer(){
    const {toggle,root}=inventoryEls();
    renderInventoryTools();
    renderInventoryAvatar();
    window.setInventoryOpen = setInventoryOpen;
    toggle?.addEventListener('click',e=>{
      e.stopPropagation();
      setInventoryOpen();
    });
    if(!initInventoryDrawer._outsideBound){
      document.addEventListener('pointerdown',function(e){
        const currentRoot=document.querySelector('#inventoryDrawer');
        if(!currentRoot || !currentRoot.classList.contains('open')) return;
        if(currentRoot.contains(e.target)) return;
        setInventoryOpen(false);
      },true);
      initInventoryDrawer._outsideBound = true;
    }
  }

  function saveLairIntel(){
    STORE.setItem('lockpickLairIntel',JSON.stringify(lairIntel));
  }

  function setLairTab(next){
    lairTab=next;
    document.querySelectorAll('.lairPanel').forEach(panel=>panel.classList.toggle('active',panel.dataset.lairPanel===next));
    if(next==='team') renderLairTeam();
    if(next==='dialogue') renderLairDialogue();
    if(next==='city') renderLairIntel();
  }

  function renderLairScene(){
    if(!$lairSceneCharacters) return;
    $lairActiveName.textContent=LAIR_CHARACTERS[lairCharacter].name;
    renderInventoryAvatar();
    const order=['kai','sai','tik'];
    $lairSceneCharacters.innerHTML=order.map((id,index)=>{
      const ch=LAIR_CHARACTERS[id];
      return `
        <div class="lairSceneCharacter ${id}${id===lairCharacter?' active':''}" data-lair-character="${id}" role="button" tabindex="0" aria-label="Выбрать персонажа ${ch.name}">
          <img src="${ch.portrait}" alt="${ch.name}">
        </div>
      `;
    }).join('');
    $lairSceneCharacters.querySelectorAll('[data-lair-character]').forEach(el=>{
      const selectCharacter=()=>{
        const id=el.dataset.lairCharacter;
        if(!LAIR_CHARACTERS[id]) return;
        lairCharacter=id;
        STORE.setItem('lockpickLairCharacter',id);
        renderLairScene();
        renderWorldMap();
        if(lairOpen && $lairModuleWindow && !$lairModuleWindow.hidden && lairTab==='team') renderLairTeam();
      };
      el.addEventListener('click',selectCharacter);
      el.addEventListener('keydown',e=>{
        if(e.key==='Enter'||e.key===' '){e.preventDefault();selectCharacter();}
      });
    });
  }

  function openLairModule(next){
    if(!$lairModuleWindow) return;
    const titles={team:'Выбор персонажа',dialogue:'Диалоги',city:'Анализ города'};
    setLairTab(next);
    $lairModuleTitle.textContent=titles[next]||'Логово';
    $lairModuleWindow.hidden=false;
    $lairModuleWindow.classList.add('open');
  }

  function closeLairModule(){
    if(!$lairModuleWindow) return;
    $lairModuleWindow.classList.remove('open');
    $lairModuleWindow.hidden=true;
  }

  function openLairWorkbench(){
    const modal=document.querySelector('#lairWorkbenchModal');
    if(!modal) return;
    closeLairModule();
    modal.hidden=false;
    document.querySelector('#lairWorkbenchClose')?.focus({preventScroll:true});
  }

  function closeLairWorkbench(){
    const modal=document.querySelector('#lairWorkbenchModal');
    if(!modal || modal.hidden) return;
    modal.hidden=true;
  }

  function lairPortraitMarkup(ch,{small=false}={}){
    if(!ch?.portrait){
      return small
        ? `<span class="lairPersonThumb">${ch.name[0]}</span>`
        : `<div class="lairPortrait"><div class="lairPortraitMark">${ch.name[0]}</div></div>`;
    }
    if(small){
      return `<span class="lairPersonThumb"><img src="${ch.portrait}" alt="${ch.name}"></span>`;
    }
    return `<div class="lairPortrait hasArt"><div class="lairPortraitInner"><img class="lairPortraitArt" src="${ch.portrait}" alt="${ch.name}"></div></div>`;
  }

  function renderLairTeam(){
    if(!$lairCharacters) return;
    $lairActiveName.textContent=LAIR_CHARACTERS[lairCharacter].name;
    $lairCharacters.innerHTML='';
    Object.entries(LAIR_CHARACTERS).forEach(([id,ch])=>{
      const card=document.createElement('button');
      card.type='button';
      card.className='lairCharacter'+(id===lairCharacter?' active':'');
      card.innerHTML=`
        ${lairPortraitMarkup(ch)}
        <div class="lairCharacterName">${ch.name}</div>
        <div class="lairCharacterRole">${ch.role}</div>
        <div class="lairCharacterDesc">${ch.desc}</div>
        <div class="lairCharacterSelect">${id===lairCharacter?'Активный персонаж':'Выбрать'}</div>
      `;
      card.addEventListener('click',()=>{
        lairCharacter=id;
        STORE.setItem('lockpickLairCharacter',id);
        renderLairTeam();
        renderLairScene();
        renderWorldMap();
        renderInventoryAvatar();
      });
      $lairCharacters.appendChild(card);
    });
  }

  function renderLairDialogue(){
    if(!$lairDialoguePeople) return;
    $lairDialoguePeople.innerHTML='';
    Object.entries(LAIR_CHARACTERS).forEach(([id,ch])=>{
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='lairPersonBtn'+(id===lairDialoguePerson?' active':'');
      btn.innerHTML=`${lairPortraitMarkup(ch,{small:true})}<span><strong>${ch.name}</strong><br><small>${ch.role}</small></span>`;
      btn.addEventListener('click',()=>{
        lairDialoguePerson=id;
        renderLairDialogue();
      });
      $lairDialoguePeople.appendChild(btn);
    });

    const ch=LAIR_CHARACTERS[lairDialoguePerson];
    const topics=LAIR_DIALOGUES[lairDialoguePerson]||[];
    $lairDialogueSpeaker.textContent=ch.name;
    $lairDialogueText.textContent='Выбери тему разговора.';
    $lairDialogueTopics.innerHTML='';
    topics.forEach(topic=>{
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='lairTopic';
      btn.textContent=topic.label;
      btn.addEventListener('click',()=>{
        $lairDialogueText.textContent=topic.text;
      });
      $lairDialogueTopics.appendChild(btn);
    });
  }

  function renderLairIntelDetail(){
    if(!$lairIntelDetail) return;
    const info=LAIR_INTEL_INFO[lairIntelSelected];
    const level=lairIntel[lairIntelSelected]||0;
    const revealed=level ? info.notes[Math.min(level-1,info.notes.length-1)] : 'Достоверных сведений пока нет.';
    const maxed=level>=3;
    $lairIntelDetail.innerHTML=`
      <div class="lairIntelDetailTitle">${info.name}</div>
      <div class="lairIntelDetailText">${revealed}</div>
      <div class="lairIntelRows">
        <div class="lairIntelRow"><span>Риск</span><strong>${level>=1?info.risk:'?'}</strong></div>
        <div class="lairIntelRow"><span>Замки</span><strong>${level>=2?info.locks:'?'}</strong></div>
        <div class="lairIntelRow"><span>Ценность</span><strong>${level>=3?info.loot:'?'}</strong></div>
      </div>
      <button class="lairAnalyze" id="lairAnalyze" type="button" ${maxed?'disabled':''}>${maxed?'Изучено полностью':'Изучить район'}</button>
    `;
    const analyze=$lairIntelDetail.querySelector('#lairAnalyze');
    analyze?.addEventListener('click',()=>{
      if(lairIntel[lairIntelSelected]>=3) return;
      lairIntel[lairIntelSelected]++;
      saveLairIntel();
      renderLairIntel();
    });
  }

  function renderLairIntel(){
    if(!$lairIntelGrid) return;
    $lairIntelGrid.innerHTML='';
    ['lair','shop','old','upper','port'].forEach(id=>{
      const info=LAIR_INTEL_INFO[id];
      const level=lairIntel[id]||0;
      const card=document.createElement('button');
      card.type='button';
      card.className='lairIntelCard'+(id===lairIntelSelected?' active':'')+(MAP_LOCATIONS[id]?.locked?' locked':'');
      const pips=[0,1,2].map(i=>`<span class="${i<level?'on':''}"></span>`).join('');
      card.innerHTML=`
        <div class="lairIntelName">${info.name}</div>
        <div class="lairIntelLevel">СВЕДЕНИЯ ${level}/3</div>
        <div class="lairIntelPips">${pips}</div>
        <div class="lairIntelMini">${level?info.notes[Math.min(level-1,2)]:'Нет данных'}</div>
      `;
      card.addEventListener('click',()=>{
        lairIntelSelected=id;
        renderLairIntel();
      });
      $lairIntelGrid.appendChild(card);
    });
    renderLairIntelDetail();
  }

  function openLair(){
    closeMobileModeMenu();
    setInventoryOpen(false);
    if(mapLocation!=='lair' || !$lairOverlay) return;
    if(shopOpen) closeShop();
    if(mapOpen){
      mapOpen=false;
      document.body.classList.remove('map-open');
      if($worldMapScreen) $worldMapScreen.hidden=true;
    }
    lairOpen=true;
    document.body.classList.add('lair-open');
    $lairOverlay.hidden=false;
    $lairOverlay.classList.add('open');
    closeLairModule();
    renderLairScene();
  }

  function closeLair(){
    if(!lairOpen || !$lairOverlay) return;
    closeLairWorkbench();
    closeLairModule();
    lairOpen=false;
    document.body.classList.remove('lair-open');
    $lairOverlay.classList.remove('open');
    $lairOverlay.hidden=true;
  }

  function openLairFromHud(){
    if(shopOpen) closeShop();
    if(mapOpen){
      mapOpen=false;
      document.body.classList.remove('map-open');
      if($worldMapScreen) $worldMapScreen.hidden=true;
    }
    mapLocation='lair';
    STORE.setItem('lockpickMapLocation',mapLocation);
    renderWorldMap();
    openLair();
  }

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

  // Digital puzzle helpers
  function randomFourDigitCode(){
    return Array.from({length:4},()=>rand(0,9));
  }

  function randomCodeAndState(){
    let secret,state;
    do{
      secret=randomFourDigitCode();
      state=randomFourDigitCode();
    }while(state.every((value,index)=>value===secret[index]));
    return {secret,state};
  }

  function resetDigitalRunState(){
    solved=false;
    picks=pickCapacity;
    moves=0;
    brokenPicks=0;
    runReward=1000;
    generatedDistance=4;
  }

  function setDigitalResult(element,text='',success=false){
    if(!element)return;
    element.textContent=text;
    element.classList.toggle('success',success);
  }

  function finishDigitalPuzzle(renderFn=null){
    if(solved)return;
    solved=true;
    SFX.open();
    $lock.classList.add('win');
    $mechanism.classList.remove('ready');
    try{renderFn?.();}catch{}
    setTimeout(()=>celebrate(),420);
  }

  // Heat / cold
  function hcGrade(distance){
    if(distance===0)return ['точно',100];
    if(distance===1)return ['очень горячо',88];
    if(distance===2)return ['горячо',70];
    if(distance<=4)return ['тепло',48];
    if(distance<=6)return ['прохладно',28];
    return ['холодно',10];
  }

  function syncHeatColdInput(){
    if($hcInput)$hcInput.value=hcDigits.join('');
  }

  function renderHeatColdControls(){
    if(!$hcDialRow)return;
    $hcDialRow.innerHTML=hcDigits.map((digit,index)=>`
      <div class="hcDigitCol${index===hcActiveIndex?' active':''}" data-hc-col="${index}" tabindex="0" aria-label="Разряд ${index+1}: ${digit}">
        <button class="hcStepBtn" type="button" data-hc-step="1" data-hc-index="${index}" aria-label="Увеличить цифру ${index+1}">▲</button>
        <div class="hcDigitValue">${digit}</div>
        <button class="hcStepBtn" type="button" data-hc-step="-1" data-hc-index="${index}" aria-label="Уменьшить цифру ${index+1}">▼</button>
      </div>
    `).join('');
  }

  function adjustHeatColdDigit(index,delta){
    if(solved) return;
    hcActiveIndex=((index%4)+4)%4;
    hcDigits[hcActiveIndex]=(hcDigits[hcActiveIndex]+delta+10)%10;
    syncHeatColdInput();
    renderHeatColdControls();
    focusHeatColdDigit(hcActiveIndex);
    setDigitalResult($hcResult);
  }

  function setHeatColdActive(index){
    hcActiveIndex=((index%4)+4)%4;
    renderHeatColdControls();
    focusHeatColdDigit(hcActiveIndex);
  }

  function focusHeatColdDigit(index){
    if(!$hcDialRow) return;
    const col=$hcDialRow.querySelector(`[data-hc-col="${index}"]`);
    if(col && document.activeElement!==col) col.focus({preventScroll:true});
  }

  function handleHeatColdKey(e){
    if(mode!=='heatcold' || solved) return;
    const key=e.key;
    if(key==='ArrowLeft'){e.preventDefault();setHeatColdActive(hcActiveIndex-1);return;}
    if(key==='ArrowRight'){e.preventDefault();setHeatColdActive(hcActiveIndex+1);return;}
    if(key==='ArrowUp'){e.preventDefault();adjustHeatColdDigit(hcActiveIndex,1);return;}
    if(key==='ArrowDown'){e.preventDefault();adjustHeatColdDigit(hcActiveIndex,-1);return;}
    if(key==='Home'){e.preventDefault();setHeatColdActive(0);return;}
    if(key==='End'){e.preventDefault();setHeatColdActive(3);return;}
    if(/^[0-9]$/.test(key)){e.preventDefault();hcDigits[hcActiveIndex]=Number(key);syncHeatColdInput();renderHeatColdControls();focusHeatColdDigit(hcActiveIndex);setDigitalResult($hcResult);return;}
    if(key==='Enter' || key===' '){e.preventDefault();scanHeatCold();return;}
  }

  function renderHeatColdEmpty(){
    renderHeatColdControls();
    if(!$hcSlots)return;
    $hcSlots.innerHTML=[0,1,2,3].map(index=>`
      <div class="hcSlot">
        <div class="hcNum">?</div>
        <div class="hcWord">—</div>
        <div class="hcThermo"><i style="width:0%"></i></div>
      </div>
    `).join('');
  }

  function startHeatColdRound(){
    resetDigitalRunState();
    hcSecret=randomFourDigitCode();
    hcAttempts=[];
    hcDigits=[0,0,0,0];
    hcActiveIndex=0;
    syncHeatColdInput();
    setDigitalResult($hcResult);
    if($hcRows)$hcRows.innerHTML='';
    renderHeatColdEmpty();
    focusHeatColdDigit(hcActiveIndex);
    updateEconomyUI();
  }

  function scanHeatCold(){
    if(solved)return;
    const code=hcDigits.join('');

    registerMove();
    let exact=0;
    const states=hcDigits.map((value,index)=>{
      const distance=Math.abs(value-hcSecret[index]);
      if(distance===0)exact++;
      const [word,pct]=hcGrade(distance);
      return {value,distance,word,pct};
    });

    if($hcSlots){
      $hcSlots.innerHTML=states.map(state=>`
        <div class="hcSlot">
          <div class="hcNum">${state.value}</div>
          <div class="hcWord">${state.word}</div>
          <div class="hcThermo"><i style="width:${state.pct}%"></i></div>
        </div>
      `).join('');
    }

    hcAttempts.unshift({code,states});
    hcAttempts=hcAttempts.slice(0,5);
    if($hcRows){
      $hcRows.innerHTML=hcAttempts.map(attempt=>`
        <div class="hcRow">
          <b>${attempt.code}</b>
          <span>${attempt.states.map(state=>state.word).join(' · ')}</span>
        </div>
      `).join('');
    }

    if(exact===4){
      setDigitalResult($hcResult,'Код подобран. Замок открыт.',true);
      finishDigitalPuzzle();
    }else{
      setDigitalResult($hcResult);
    }
  }

  // Drum clicks
  function drumCircDist(a,b){
    const distance=Math.abs(a-b);
    return Math.min(distance,10-distance);
  }

  function drumStrength(distance){
    return [100,82,60,36,18,8][distance]||8;
  }

  function drumLabel(distance){
    return [
      'точный резонанс',
      'очень сильный щелчок',
      'сильный щелчок',
      'средний отклик',
      'слабый отклик',
      'почти тишина'
    ][distance]||'почти тишина';
  }

  function drumPlayClick(distance){
    if(!drumSoundOn)return;
    try{
      const AudioContextClass=window.AudioContext||window.webkitAudioContext;
      if(!AudioContextClass)return;
      drumAudioCtx ||= new AudioContextClass();
      const now=drumAudioCtx.currentTime;
      const hit=(time,frequency,gainValue,duration=.035)=>{
        const oscillator=drumAudioCtx.createOscillator();
        const gain=drumAudioCtx.createGain();
        oscillator.type='square';
        oscillator.frequency.value=frequency;
        gain.gain.setValueAtTime(gainValue,time);
        gain.gain.exponentialRampToValueAtTime(.001,time+duration);
        oscillator.connect(gain);
        gain.connect(drumAudioCtx.destination);
        oscillator.start(time);
        oscillator.stop(time+duration);
      };
      const strength=drumStrength(distance)/100;
      hit(now,140+420*strength,.018+.045*strength);
      if(distance===0)hit(now+.055,520,.052,.045);
    }catch{}
  }

  function renderDrum(){
    if(!$drumWheels)return;
    $drumWheels.innerHTML=drumState.map((value,index)=>{
      const distance=drumCircDist(value,drumSecret[index]);
      return `
        <div class="digitalWheel" id="drumWheel${index}">
          <button data-drum-i="${index}" data-dir="1" type="button">▲</button>
          <div class="digitalWheelValue">${value}</div>
          <button data-drum-i="${index}" data-dir="-1" type="button">▼</button>
          <div class="drumMeter"><i style="width:${drumStrength(distance)}%"></i></div>
          <div class="drumLabel">${drumLabel(distance)}</div>
        </div>
      `;
    }).join('');
  }

  function startDrumRound(){
    resetDigitalRunState();
    ({secret:drumSecret,state:drumState}=randomCodeAndState());
    setDigitalResult($drumResult);
    renderDrum();
    updateEconomyUI();
  }

  function changeDrum(index,direction){
    if(solved)return;
    drumState[index]=(drumState[index]+direction+10)%10;
    registerMove();
    const distance=drumCircDist(drumState[index],drumSecret[index]);
    drumPlayClick(distance);
    renderDrum();
    const wheel=document.querySelector(`#drumWheel${index}`);
    wheel?.classList.add('hit');
    setTimeout(()=>wheel?.classList.remove('hit'),120);
    setDigitalResult($drumResult);
  }

  function checkDrum(){
    if(solved)return;
    const exact=drumState.filter((value,index)=>value===drumSecret[index]).length;
    if(exact===4){
      setDigitalResult($drumResult,'Все четыре барабана в резонансе. Замок открыт.',true);
      finishDigitalPuzzle(renderDrum);
      return;
    }
    setDigitalResult($drumResult,`Точно выставлено барабанов: ${exact}/4`);
    SFX.wrongLock();
  }

  // Oscilloscope
  const scopeFreqs=[1,2,3,5];
  const scopeWeights=[.22,.18,.14,.11];
  const scopePhases=[.1,.7,1.3,2.1];

  function scopeSignal(code){
    const sampleCount=420;
    const signal=[];
    for(let index=0;index<sampleCount;index++){
      const x=index/(sampleCount-1)*Math.PI*2;
      let y=.10*Math.sin(x*.5);
      for(let harmonic=0;harmonic<4;harmonic++){
        const coefficient=(code[harmonic]-4.5)/4.5;
        y+=scopeWeights[harmonic]*coefficient*Math.sin(scopeFreqs[harmonic]*x+scopePhases[harmonic]);
      }
      signal.push(y);
    }
    return signal;
  }

  function scopeScoreValue(reference,current){
    let squaredError=0;
    for(let index=0;index<reference.length;index++){
      const delta=reference[index]-current[index];
      squaredError+=delta*delta;
    }
    const rms=Math.sqrt(squaredError/reference.length);
    return Math.max(0,Math.min(100,100-rms*180));
  }

  function drawScope(){
    if(!$scopeCanvas)return;
    const context=$scopeCanvas.getContext('2d');
    const width=$scopeCanvas.width;
    const height=$scopeCanvas.height;

    context.clearRect(0,0,width,height);
    context.fillStyle='#08090a';
    context.fillRect(0,0,width,height);
    context.strokeStyle='rgba(220,201,170,.055)';
    context.lineWidth=1;

    for(let row=0;row<7;row++){
      const y=20+row*(height-40)/6;
      context.beginPath();
      context.moveTo(18,y);
      context.lineTo(width-18,y);
      context.stroke();
    }
    for(let column=0;column<10;column++){
      const x=18+column*(width-36)/9;
      context.beginPath();
      context.moveTo(x,16);
      context.lineTo(x,height-16);
      context.stroke();
    }

    const plot=(signal,color,lineWidth)=>{
      context.beginPath();
      signal.forEach((value,index)=>{
        const x=18+index*(width-36)/(signal.length-1);
        const y=height/2-value*height*.70;
        index?context.lineTo(x,y):context.moveTo(x,y);
      });
      context.strokeStyle=color;
      context.lineWidth=lineWidth;
      context.shadowBlur=7;
      context.shadowColor=color;
      context.stroke();
      context.shadowBlur=0;
    };

    const reference=scopeSignal(scopeSecret);
    const current=scopeSignal(scopeState);
    plot(reference,'#748d9f',2.4);
    plot(current,'#d2a75f',2.6);

    const score=scopeScoreValue(reference,current);
    if($scopeScore)$scopeScore.textContent=score.toFixed(1)+'%';
    if($scopeBar)$scopeBar.style.width=score+'%';
  }

  function renderScope(){
    if($scopeWheels){
      $scopeWheels.innerHTML=scopeState.map((value,index)=>`
        <div class="digitalWheel">
          <button data-scope-i="${index}" data-dir="1" type="button">▲</button>
          <div class="digitalWheelValue">${value}</div>
          <button data-scope-i="${index}" data-dir="-1" type="button">▼</button>
        </div>
      `).join('');
    }
    drawScope();
  }

  function startScopeRound(){
    resetDigitalRunState();
    ({secret:scopeSecret,state:scopeState}=randomCodeAndState());
    setDigitalResult($scopeResult);
    renderScope();
    updateEconomyUI();
  }

  function changeScope(index,direction){
    if(solved)return;
    scopeState[index]=(scopeState[index]+direction+10)%10;
    registerMove();
    SFX.select();
    renderScope();
    setDigitalResult($scopeResult);
  }

  function checkScope(){
    if(solved)return;
    const exact=scopeState.every((value,index)=>value===scopeSecret[index]);
    if(exact){
      setDigitalResult($scopeResult,'Код найден. Сигналы совпали на 100%.',true);
      finishDigitalPuzzle(renderScope);
      return;
    }
    setDigitalResult($scopeResult,'Сигналы ещё различаются.');
    SFX.wrongLock();
  }

  function updateModeUI(){
    $tabClassic.classList.toggle('active', mode==='classic');
    $tabTarget.classList.toggle('active', mode==='target');
    $tabLine.classList.toggle('active', mode==='line');
    $tabAlt2.classList.toggle('active', mode==='sequence');
    $tabSpecial.classList.toggle('active', mode==='special');
    $tabHillsfar.classList.toggle('active', mode==='hillsfar');
    $tabMass.classList.toggle('active', mode==='mass');
    $tabG1.classList.toggle('active', mode==='g1');
    $tabR2.classList.toggle('active', mode==='r2');
    $tabSkyrim.classList.toggle('active', mode==='skyrim');
    $tabAnach.classList.toggle('active', mode==='anach');
    $tabTension.classList.toggle('active', mode==='tension');
    $tabResonance.classList.toggle('active', mode==='resonance');
    $tabDeduction.classList.toggle('active', mode==='deduction');
    $tabComposite.classList.toggle('active', mode==='composite');
    $tabHeatCold.classList.toggle('active', mode==='heatcold');
    $tabDrum.classList.toggle('active', mode==='drum');
    $tabScope.classList.toggle('active', mode==='scope');
    if($mapTab) $mapTab.classList.toggle('active',mapOpen);

    syncModePanels(mode);
    const isImported=IMPORTED_MODES.has(mode);
    $scene.classList.toggle('hideBase',isImported);
    document.body.classList.toggle('importedMode',isImported);
    document.body.classList.toggle('mode-hillsfar', mode==='hillsfar');
    renderDifficultyDock();
    if(mode!=='hillsfar') clearHillsfarTimer();
    if(mode==='hillsfar') setGlobalTimer(true, hfTimeLeft || hfTimeMax, hfTimeMax || 1, 'ТАЙМЕР');
    else setGlobalTimer(false);
if(mode==='classic'){
      $objectiveLine.innerHTML = `ЦЕЛЬ: <b>ПОДНЯТЬ ВСЕ ШТИФТЫ</b> · ${generatedDistance} ходов минимум`;
    }else if(mode==='target'){
      $objectiveLine.innerHTML = `ЦЕЛЬ: <b>СОВМЕСТИТЬ ШТЫРИ С СИНИМИ МЕТКАМИ</b> · ${generatedDistance} ходов минимум`;
    }else if(mode==='line'){
      $objectiveLine.innerHTML = `ЦЕЛЬ: <b>ВЫСТРОИТЬ ВСЕ ШТИФТЫ ПО ЛИНИИ ${goalLine}</b> · ${generatedDistance} ходов минимум`;
    }else if(mode==='sequence'){
      $objectiveLine.innerHTML = `КОД: <b>${targets.join(', ')}</b> · ${generatedDistance} ходов минимум`;
    }else if(mode==='special'){
      $objectiveLine.innerHTML = `ОСОБЫЙ ЗАМОК: <b>${specialTypeName()}</b> · ${generatedDistance} ходов минимум`;
    }else if(mode==='hillsfar'){
      $objectiveLine.innerHTML = 'ЦЕЛЬ: <b>ПОДОБРАТЬ ПРАВИЛЬНЫЙ КЛЮЧ</b>';
    }else if(mode==='mass'){
      $objectiveLine.innerHTML = 'ЦЕЛЬ: <b>ВЫСТРОИТЬ ВСЕ КОЛЬЦА И ОТКРЫТЬ ЗАМОК</b>';
    }else if(mode==='g1'){
      $objectiveLine.innerHTML = `ЦЕЛЬ: <b>УГАДАТЬ ПОСЛЕДОВАТЕЛЬНОСТЬ ИЗ ${g1Length} ШАГОВ</b>`;
    }else if(mode==='r2'){
      $objectiveLine.innerHTML = 'ЦЕЛЬ: <b>ПОДНЯТЬ ШТИФТЫ В ПРАВИЛЬНОМ ПОРЯДКЕ</b>';
    }else if(mode==='skyrim'){
      $objectiveLine.innerHTML = 'ЦЕЛЬ: <b>НАЙТИ ПРАВИЛЬНЫЙ УГОЛ ОТМЫЧКИ</b>';
    }else if(mode==='anach'){
      $objectiveLine.innerHTML = 'ЦЕЛЬ: <b>МЕНЯЙ 3 КАНАЛА ТАК, ЧТОБЫ ЧИСЛО ВЫРОСЛО ДО 100.0</b>';
    }else if(mode==='tension'){
      $objectiveLine.innerHTML = `ЦЕЛЬ: <b>УДЕРЖИВАТЬ НАТЯЖЕНИЕ В РАБОЧЕЙ ЗОНЕ И ПОСТАВИТЬ ${tnPinCount} ШТИФТОВ</b>`;
    }else if(mode==='resonance'){
      $objectiveLine.innerHTML = `ЦЕЛЬ: <b>ЗАФИКСИРОВАТЬ ${rsPinCount} ШТИФТОВ ТОЧНО НА ЗОЛОТОЙ ЛИНИИ</b>`;
    }else if(mode==='deduction'){
      $objectiveLine.innerHTML = 'ЦЕЛЬ: <b>ВОССТАНОВИТЬ ПРОФИЛЬ КЛЮЧА ПО ОБРАТНОЙ СВЯЗИ</b>';
    }else if(mode==='composite'){
      $objectiveLine.innerHTML = 'ЦЕЛЬ: <b>СОБРАТЬ ОТМЫЧКУ ИЗ 4 ЧАСТЕЙ ПОД ПРОФИЛЬ ШТИФТОВ</b>';
    }else if(mode==='heatcold'){
      $objectiveLine.innerHTML = 'ЦЕЛЬ: <b>ПОДОБРАТЬ 4-ЗНАЧНЫЙ КОД ПО ПОДСКАЗКАМ ТЕПЛО / ХОЛОДНО</b>';
    }else if(mode==='drum'){
      $objectiveLine.innerHTML = 'ЦЕЛЬ: <b>ВЫСТАВИТЬ 4 БАРАБАНА ПО СИЛЕ ЩЕЛЧКА</b>';
    }else if(mode==='scope'){
      $objectiveLine.innerHTML = 'ЦЕЛЬ: <b>СОВМЕСТИТЬ ТЕКУЩИЙ СИГНАЛ С ЭТАЛОНОМ</b>';
    }
    $objectiveLine.innerHTML += ` <span class="objectiveDiff">· Ур. ${getModeDifficulty(mode)}</span>`;
  }

  function getVisibleLockArts(){
    return [...document.querySelectorAll('.mechanismZone, .sharedModeLockArt')].filter(el=>{
      const st=getComputedStyle(el);
      const r=el.getBoundingClientRect();
      return st.display!=='none' && st.visibility!=='hidden' && r.width>0 && r.height>0;
    });
  }

  function setGameInactive(flag){
    document.body.classList.toggle('game-inactive', !!flag);
    if(!flag){
      document.body.classList.remove('mobile-mode-menu-open');
      document.body.classList.remove('solved-notice-visible');
    }
  }

  function restartCurrentRound(){
    if(shopOpen) closeShop();
    if(lairOpen) closeLair();
    if(mapOpen) closeMap();
    setGameInactive(false);
    newLock(false);
    SFX.newRound?.();
  }

  function celebrate(){
    awardRun();
    setGameInactive(true);
    document.body.classList.remove('solved-notice-visible');
    setTimeout(()=>{
      if(solved && document.body.classList.contains('game-inactive')){
        document.body.classList.add('solved-notice-visible');
      }
    },4200);
    // После успешного прохождения не показываем общий toast/кнопку «Новый замок».
    $toast.classList.remove('show','actionable');
    $toastText.textContent='';

    // Во всех режимах доигрываем анимацию открытия и оставляем замок раскрытым.
    getVisibleLockArts().forEach(el=>{
      el.classList.remove('shake-fail','ready');
      if(el.classList.contains('opened')) return;
      if(!el.classList.contains('opening')){
        el.classList.add('opening');
        setTimeout(()=>{
          el.classList.remove('opening');
          el.classList.add('opened');
        },4300);
      }
    });
  }

  function nudgeTools(){
    const tools=[...document.querySelectorAll('.mechanismZone, .sharedModeLockArt')];
    tools.forEach(el=>el.classList.remove('nudge'));
    // force a single reflow after clearing the class so animations restart
    void document.body.offsetWidth;
    tools.forEach(el=>{
      const r=el.getBoundingClientRect();
      if(r.width>0 && r.height>0) el.classList.add('nudge');
    });
  }

  function goalMet(){
    if(mode==='classic' || mode==='special') return state.every(v=>v===GOAL);
    if(mode==='target' || mode==='sequence') return state.every((v,i)=>v===targets[i]);
    return state.every(v=>v===goalLine);
  }
function stateKey(s){ return s.join(''); }

  function shortestDistance(start, goal, maxDepth=24){
    const targetKey=stateKey(goal);
    const startKey=stateKey(start);
    if(startKey===targetKey) return 0;

    const queue=[[start,0]];
    const seen=new Set([startKey]);
    let head=0;

    while(head<queue.length){
      const [cur,depth]=queue[head++];
      if(depth>=maxDepth) continue;

      for(let i=0;i<n;i++){
        for(const dir of [-1,1]){
          if(!legal(cur,i,dir)) continue;
          const next=applyRaw(cur,i,dir);
          const key=stateKey(next);
          if(seen.has(key)) continue;
          if(key===targetKey) return depth+1;
          seen.add(key);
          queue.push([next,depth+1]);
        }
      }
    }
    return Infinity;
  }

  function randomWalkFrom(goalState, steps){
    let s=[...goalState];
    let last=null;
    for(let k=0;k<steps;k++){
      const choices=[];
      for(let i=0;i<n;i++){
        for(const dir of [-1,1]){
          if(!legal(s,i,dir)) continue;
          if(last && last.i===i && last.dir===-dir) continue;
          choices.push({i,dir});
        }
      }
      if(!choices.length) break;
      const c=choices[rand(0,choices.length-1)];
      s=applyRaw(s,c.i,c.dir);
      last=c;
    }
    return s;
  }

  function generateLinkedPuzzle(goal, minMoves=7, maxMoves=12){
    const goalState=Array(n).fill(goal);
    let best=null;
    let bestScore=-Infinity;

    for(let attempt=0;attempt<80;attempt++){
      const steps=rand(minMoves,maxMoves+6);
      const candidate=randomWalkFrom(goalState,steps);
      if(candidate.every(v=>v===goal)) continue;

      const distance=shortestDistance(candidate,goalState,maxMoves+8);
      if(Number.isFinite(distance) && distance>=minMoves && distance<=maxMoves){
        generatedDistance=distance;
        return candidate;
      }

      if(Number.isFinite(distance)){
        const score=-Math.abs(distance-(minMoves+maxMoves)/2);
        if(score>bestScore){
          best=[...candidate];
          bestScore=score;
          generatedDistance=distance;
        }
      }
    }

    if(best) return best;
    generatedDistance=minMoves;
    return randomWalkFrom(goalState,minMoves);
  }

  function independentDistance(a,b){
    return a.reduce((sum,v,i)=>sum+Math.abs(v-b[i]),0);
  }

  function makeSmartTargetModeStart(minMoves=8,maxMoves=14){
    for(let attempt=0;attempt<100;attempt++){
      const t=Array.from({length:n},()=>rand(MIN,MAX));
      const s=Array.from({length:n},()=>rand(MIN,MAX));
      const d=independentDistance(s,t);
      if(d>=minMoves && d<=maxMoves){
        targets=t;
        state=s;
        generatedDistance=d;
        return;
      }
    }
    targets=[2,3,4,5,6];
    state=[6,5,4,3,2];
    generatedDistance=12;
  }

  // ===== MASS EFFECT =====
  function massGradientForRing(ring){
    const step = 360 / ring.count;
    const goodColor = '#f0c878';
    const decoyColor = '#8e6a39';
    const baseColor = '#2f2418';
    const darkGap = '#15100b';
    const gap = Math.max(2.2, step * .11);
    const parts = [];

    // Все кольца используют одну и ту же дискретную угловую сетку.
    // Сектор i центрирован ровно на i * step градусов.
    for(let i=0;i<ring.count;i++){
      const start = i * step;
      const segStart = start + gap;
      const segEnd = start + step - gap;
      let color = baseColor;
      if(i === ring.goodIndex) color = goodColor;
      else if(ring.decoys.includes(i)) color = decoyColor;
      parts.push(`${darkGap} ${start.toFixed(2)}deg ${segStart.toFixed(2)}deg`);
      parts.push(`${color} ${segStart.toFixed(2)}deg ${segEnd.toFixed(2)}deg`);
      parts.push(`${darkGap} ${segEnd.toFixed(2)}deg ${(start+step).toFixed(2)}deg`);
    }

    // -step/2 делает центр нулевого сектора направленным ровно вверх.
    return `conic-gradient(from ${(-step/2).toFixed(2)}deg, ${parts.join(',')})`;
  }

  function massRingSolved(ring){
    return ring.pos === ring.solution;
  }

  function renderMassEffect(){
    $massRings.innerHTML = '';
    meRings.forEach((ring, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'massRing' + (i===meSelected ? ' selected' : '') + (massRingSolved(ring) ? ' ready' : '');
      btn.style.width = `${ring.size}px`;
      btn.style.height = `${ring.size}px`;
      btn.style.setProperty('--mass-thickness', `${ring.thickness}px`);
      btn.style.setProperty('--mass-marker-width', `${Math.max(14, Math.round(ring.thickness * .34))}px`);
      btn.style.setProperty('--mass-marker-height', `${Math.max(10, Math.round(ring.thickness * .24))}px`);
      btn.style.setProperty('--mass-marker-bottom', `${Math.max(8, Math.round(ring.thickness * .18))}px`);
      const ringNames = ['Внешнее кольцо','Среднее кольцо','Внутреннее кольцо'];
      btn.setAttribute('aria-label', ringNames[i] || `Кольцо ${i+1}`);

      const disc = document.createElement('div');
      disc.className = 'massRingDisc';
      disc.style.background = massGradientForRing(ring);
      disc.style.transform = `rotate(${(ring.pos * 360 / ring.count).toFixed(2)}deg)`;
      disc.style.webkitMask = disc.style.mask = `radial-gradient(circle, transparent calc(50% - ${ring.thickness}px), #000 calc(50% - ${ring.thickness}px + 1px), #000 calc(50% - 1px), transparent 50%)`;
      btn.appendChild(disc);

      btn.addEventListener('click', () => {
        if(solved) return;
        meSelected = i;
        SFX.select();
        renderMassEffect();
      });

      $massRings.appendChild(btn);
    });

    const ready = meRings.length && meRings.every(massRingSolved);
    $massCenter.classList.toggle('ready', ready && !solved);
    $massCenterText.textContent = solved ? 'ОТКРЫТО' : (ready ? 'ОТКРЫТЬ' : 'ПОВОРОТ');
  }

  function startMassRound(){
    solved = false;
    $lock.classList.remove('win');
    $mechanism.classList.remove('ready','opening','opened');
    picks = pickCapacity;
    moves = 0;
    brokenPicks = 0;
    runReward = 1000;
    const sectorCount = diffStep(10,12,14,'mass');
    const decoyCount = diffStep(2,3,4,'mass');
    const configs = [
      {count:sectorCount, size:310, thickness:28},
      {count:sectorCount, size:250, thickness:26},
      {count:sectorCount, size:190, thickness:24}
    ];
    meRings = configs.map(cfg => {
      const goodIndex = rand(0, cfg.count-1);
      const targetIndex = Math.floor(cfg.count / 2);
      const solution = (targetIndex - goodIndex + cfg.count) % cfg.count;
      const decoys = [];
      while(decoys.length < decoyCount){
        const d = rand(0, cfg.count-1);
        if(d !== goodIndex && !decoys.includes(d)) decoys.push(d);
      }
      let pos = rand(0, cfg.count-1);
      if(pos === solution) pos = (pos + 1) % cfg.count;
      return {...cfg, goodIndex, decoys, solution, pos};
    });
    meSelected = 0;
    meInitialPositions = meRings.map(r=>r.pos);
    generatedDistance = meRings.reduce((sum, r) => {
      const diff = Math.abs(r.pos - r.solution);
      return sum + Math.min(diff, r.count - diff);
    }, 0);
    updateEconomyUI();
    renderMassEffect();
  }

  function tryOpenMass(){
    if(shopOpen || solved) return;
    if(!meRings.every(massRingSolved)){
      SFX.wrongLock();
      damagePick({
        resetProgress:()=>meRings.forEach((r,i)=>{ r.pos=meInitialPositions[i] ?? r.pos; }),
        renderState:renderMassEffect,
        surviveText:'Кольца ещё не выстроены'
      });
      return;
    }
    solved = true;
    $lock.classList.add('win');
    SFX.open();
    renderMassEffect();
    setTimeout(() => celebrate(), 420);
  }

  function moveMass(dir){
    if(solved) return;
    const ring = meRings[meSelected];
    if(!ring) return;
    ring.pos = (ring.pos + dir + ring.count) % ring.count;
    registerMove();
    SFX.move();
    const wasReady = $massCenter.classList.contains('ready');
    renderMassEffect();
    const isReady = meRings.every(massRingSolved);
    if(isReady && !wasReady) SFX.ready();
  }

  function selectMass(delta){
    if(solved) return;
    // W / ArrowUp passes delta=-1: outer (0) -> middle (1) -> inner (2).
    // S / ArrowDown goes in the opposite direction.
    const step = delta < 0 ? 1 : -1;
    meSelected = (meSelected + step + meRings.length) % meRings.length;
    SFX.select();
    renderMassEffect();
  }

  function clamp(v,min,max){ return Math.max(min,Math.min(max,v)); }

  // ===== ANACHRONOX =====
  function anReadoutValue(){
    const distance=Math.abs(anState[0]-anTarget[0]) + Math.abs(anState[1]-anTarget[1]) + Math.abs(anState[2]-anTarget[2]);
    return Math.max(0, 100 - distance*2.5);
  }

  function anSolved(){
    return anState.every((v,i)=>v===anTarget[i]);
  }

  function renderAn(){
    const channels=[...document.querySelectorAll('.anChannel')];
    channels.forEach((ch,i)=>{
      ch.classList.toggle('selected',i===anSelected && !solved);
      const level=ch.querySelector('.anLevel');
      const value=ch.querySelector('.anValue');
      if(level) level.style.height = `${18 + anState[i]*18}px`;
      if(value) value.textContent = anState[i];
    });
    const score = anReadoutValue();
    $anReadout.textContent = score.toFixed(1);
    if($anSelectedHint) $anSelectedHint.textContent = `Выбран канал ${anSelected + 1} из 3 · текущее значение ${anState[anSelected]}`;
    const ready = !solved && anSolved();
    $anUnlock.classList.toggle('ready', ready);
    if(solved) $anActionLabel.textContent = 'Контур открыт';
    else if(ready) $anActionLabel.textContent = 'Сигнал 100.0 · нажми на панель';
    else $anActionLabel.textContent = 'Меняй выбранный канал W / S и добивайся роста числа сверху';
  }

  function startAnRound(){
    solved=false;
    $lock.classList.remove('win');
    $mechanism.classList.remove('ready','opening','opened');
    picks=pickCapacity;
    moves=0;
    brokenPicks=0;
    runReward=1000;
    const anMax=diffStep(6,8,9,'anach');
    const minDistance=diffStep(6,10,14,'anach');
    let dist=0;
    do{
      anTarget=[rand(0,anMax),rand(0,anMax),rand(0,anMax)];
      anState=[rand(0,anMax),rand(0,anMax),rand(0,anMax)];
      dist=Math.abs(anState[0]-anTarget[0]) + Math.abs(anState[1]-anTarget[1]) + Math.abs(anState[2]-anTarget[2]);
    }while(dist<minDistance || anSolved());
    anInitialState=[...anState];
    anSelected=0;
    generatedDistance = dist;
    updateEconomyUI();
    renderAn();
  }

  function moveAn(dir){
    if(solved) return;
    const next = Math.max(0, Math.min(2, anSelected + dir));
    if(next===anSelected){ SFX.blocked(); return; }
    anSelected = next;
    SFX.select();
    renderAn();
  }

  function adjustAn(step, forcedCol=null){
    if(solved) return;
    const col = forcedCol==null ? anSelected : Math.max(0,Math.min(2,forcedCol));
    if(forcedCol!=null && col!==anSelected){ anSelected=col; }
    const next = Math.max(0, Math.min(9, anState[col] + step));
    if(next===anState[col]){ SFX.blocked(); return; }
    anState[col]=next;
    registerMove();
    SFX.move();
    renderAn();
    if(anSolved()) SFX.ready();
  }

  function tryOpenAn(){
    if(shopOpen || solved) return;
    if(!anSolved()){
      SFX.wrongLock();
      damagePick({
        resetProgress:()=>{ anState=[...anInitialState]; },
        renderState:renderAn,
        surviveText:'Сигнал ещё не собран'
      });
      return;
    }
    solved=true;
    $lock.classList.add('win');
    SFX.open();
    renderAn();
    setTimeout(()=>celebrate(),420);
  }


  // ===== COMPOSITE PICK — CONTINUOUS BUILDER =====
  const CP_XS=[0,160,320,480,640];
  const CP_PIN_COUNT=5;
  function cpY(level){ return [14,24,34][level] ?? 24; }
  function cpSvgY(level){ return cpY(level) + 12; }
  function cpMiniY(level){ return [8,13,18][level] ?? 13; }

  function cpPathD(nodes){
    return nodes.map((level,i)=>`${i?'L':'M'} ${CP_XS[i]} ${cpSvgY(level)}`).join(' ');
  }

  function cpProfileD(nodes){
    const bottomY=74;
    let d=`M 0 ${bottomY} L 0 ${cpSvgY(nodes[0])}`;
    for(let i=1;i<nodes.length;i++) d+=` L ${CP_XS[i]} ${cpSvgY(nodes[i])}`;
    d+=` L 632 ${bottomY} L 0 ${bottomY} Z`;
    return d;
  }

  function cpBuiltNodes(vals=cpVals){
    return [cpNodes[0], ...vals];
  }

  function cpMatchesTarget(vals=cpVals){
    return vals.length===4 && vals.every((level,i)=>level===cpTarget[i]);
  }

  function cpSamplePoints(nodes,count=CP_PIN_COUNT){
    const pts=[];
    const totalSegments=nodes.length-1;
    for(let i=0;i<count;i++){
      const t = (i/(count-1))*totalSegments;
      const seg = Math.min(totalSegments-1, Math.floor(t));
      const local = Math.max(0, Math.min(1, t-seg));
      const x1=CP_XS[seg], x2=CP_XS[seg+1];
      const y1=cpY(nodes[seg]), y2=cpY(nodes[seg+1]);
      pts.push({
        x: x1 + (x2-x1)*local,
        y: y1 + (y2-y1)*local
      });
    }
    return pts;
  }

  function cpSetPath($el,d){
    if($el) $el.setAttribute('d',d);
  }

  function cpApplyProfile({shadow,fill,topLine,bevel,path,glow},nodes){
    const profileD=cpProfileD(nodes);
    const lineD=cpPathD(nodes);
    cpSetPath(shadow,profileD);
    cpSetPath(fill,profileD);
    cpSetPath(topLine,lineD);
    cpSetPath(bevel,lineD);
    cpSetPath(path,lineD);
    cpSetPath(glow,lineD);
  }

  function cpPartPreviewSvg(index,level){
    const leftLevel=index===0 ? cpNodes[0] : cpVals[index-1];
    const y1=cpMiniY(leftLevel), y2=cpMiniY(level);
    const gradId=`cpMiniMetal${index}`;
    const path=`M 6 26 L 6 ${y1} L 56 ${y1} L 104 ${y2} L 110 26 Z`;
    const line=`M 6 ${y1} L 56 ${y1} L 104 ${y2}`;
    return `
      <svg viewBox="0 0 116 32" aria-hidden="true">
        <defs>
          <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#ffe3a2"></stop>
            <stop offset="0.42" stop-color="#e3bd69"></stop>
            <stop offset="1" stop-color="#895821"></stop>
          </linearGradient>
        </defs>
        <rect x="1" y="3" width="114" height="28" rx="9" fill="rgba(0,0,0,.16)" stroke="rgba(219,175,88,.12)"></rect>
        <path d="${path}" fill="rgba(0,0,0,.28)" transform="translate(0,2)"></path>
        <path d="${path}" fill="url(#${gradId})" stroke="rgba(92,60,24,.55)" stroke-width="1"></path>
        <path d="${line}" stroke="rgba(255,245,213,.42)" stroke-width="1.15" fill="none" stroke-linecap="round"></path>
      </svg>`;
  }

  function cpRenderPinRail($rail,nodes){
    if(!$rail) return;
    const points=cpSamplePoints(nodes);
    const pinSkin=currentPinSkin();
    const frag=document.createDocumentFragment();
    points.forEach(pt=>{
      const pin=document.createElement('div');
      pin.className='cpPin';
      pin.style.left=`${(pt.x/640)*100}%`;
      pin.style.setProperty('--cp-pin-top', `${Math.round(pt.y - 36)}px`);

      const img=document.createElement('img');
      img.className='cpPinImg';
      img.src=pinSkin;
      img.alt='';
      pin.appendChild(img);
      frag.appendChild(pin);
    });
    $rail.replaceChildren(frag);
  }

  function cpRenderJoints(nodes){
    if(!$cpBuildJoints) return;
    $cpBuildJoints.innerHTML='';
    const svgBox=$cpBuildPath?.ownerSVGElement?.getBoundingClientRect();
    const canvasBox=$cpBuildJoints.getBoundingClientRect();
    if(!svgBox || !canvasBox.width) return;

    nodes.forEach((level,i)=>{
      const dot=document.createElement('div');
      dot.className='cpJoint'+(i===0?' start':'')+(i===cpSelected+1&&!cpReady?' selected':'');
      const px=(CP_XS[i]/640)*svgBox.width + (svgBox.left-canvasBox.left);
      const py=(cpSvgY(level)/90)*svgBox.height + (svgBox.top-canvasBox.top);
      dot.style.left=`${px}px`;
      dot.style.top=`${py}px`;
      $cpBuildJoints.appendChild(dot);
    });
  }

  function setCompositeLevel(i,level){
    if(solved||cpReady) return;
    level=clamp(level,0,2);
    cpSelected=i;
    if(cpVals[i]===level){
      renderComposite();
      return;
    }
    cpVals[i]=level;
    registerMove();
    SFX.select();
    renderComposite();
    if(cpReady) SFX.ready();
  }

  function renderComposite(){
    if(!$cpParts) return;

    cpRenderPinRail($cpPins, cpNodes);
    cpApplyProfile({
      shadow:$cpTargetShadow,
      fill:$cpTargetFill,
      topLine:$cpTargetTopLine,
      bevel:$cpTargetBevel,
      path:$cpTargetPath,
      glow:$cpTargetGlow
    },cpNodes);

    const builtNodes=cpBuiltNodes();
    cpRenderPinRail($cpBuildPins, builtNodes);
    cpApplyProfile({
      shadow:$cpBuildShadow,
      fill:$cpBuildFill,
      topLine:$cpBuildTopLine,
      bevel:$cpBuildBevel,
      path:$cpBuildPath,
      glow:$cpBuildGlow
    },builtNodes);

    $cpParts.innerHTML='';
    $cpParts.classList.add('has-selection');

    cpVals.forEach((level,i)=>{
      const wrap=document.createElement('div');
      wrap.className='cpPart'+(i===cpSelected&&!cpReady?' selected':'');
      wrap.setAttribute('role','group');
      wrap.setAttribute('aria-label',`Сегмент ${i+1}`);

      const buttons=CP_LEVEL_NAMES.map((name,buttonLevel)=>
        `<button class="cpLevelBtn${level===buttonLevel?' active':''}" data-level="${buttonLevel}" type="button" aria-label="Сегмент ${i+1}: ${name.toLowerCase()}">${name}</button>`
      ).join('');

      wrap.innerHTML=`
        <div class="cpPartPreview">${cpPartPreviewSvg(i,level)}</div>
        <div class="cpPartLabel">КОНЕЦ: ${CP_LEVEL_NAMES[level]}</div>
        <div class="cpLevelControls">${buttons}</div>
      `;

      wrap.addEventListener('click',e=>{
        if(solved||cpReady) return;
        if(!e.target.closest('.cpLevelBtn')){
          cpSelected=i;
          SFX.select();
          renderComposite();
        }
      });

      wrap.querySelectorAll('.cpLevelBtn').forEach(btn=>{
        btn.addEventListener('click',e=>{
          e.stopPropagation();
          setCompositeLevel(i,Number(btn.dataset.level));
        });
      });

      $cpParts.appendChild(wrap);
    });

    cpReady=cpMatchesTarget();
    $cpState.classList.remove('ready');

    if(solved) {
      $cpState.textContent='Замок открыт';
    } else {
      $cpState.textContent=`Сегмент ${cpSelected+1}/4 · конец: ${CP_LEVEL_NAMES[cpVals[cpSelected]].toLowerCase()}`;
    }

    requestAnimationFrame(()=>cpRenderJoints(builtNodes));
  }

  function startCompositeRound(){
    solved=false;
    picks=pickCapacity;
    moves=0;
    brokenPicks=0;
    runReward=1000;

    cpNodes=[rand(0,2)];
    for(let i=0;i<4;i++){
      const prev=cpNodes[i];
      const options=[prev-1,prev,prev+1].filter(v=>v>=0&&v<=2);
      cpNodes.push(options[rand(0,options.length-1)]);
    }
    cpTarget=cpNodes.slice(1);

    const minDistance=diffStep(2,4,6,'composite');
    do{ cpVals=Array.from({length:4},()=>rand(0,2)); }
    while(cpMatchesTarget(cpVals) || cpVals.reduce((sum,v,i)=>sum+Math.abs(v-cpTarget[i]),0) < minDistance);

    cpInitial=[...cpVals];
    cpSelected=0;
    cpReady=false;
    generatedDistance=cpVals.reduce((sum,v,i)=>sum+Math.abs(v-cpTarget[i]),0);
    updateEconomyUI();
    renderComposite();
  }

  function moveCompositeSelection(dir){
    if(solved||cpReady) return;
    const next=clamp(cpSelected+dir,0,3);
    if(next===cpSelected){
      SFX.blocked();
      return;
    }
    cpSelected=next;
    SFX.select();
    renderComposite();
  }

  function changeCompositeShape(i,delta){
    if(solved||cpReady) return;
    const next=clamp(cpVals[i]+delta,0,2);
    if(next===cpVals[i]){
      SFX.blocked();
      return;
    }
    setCompositeLevel(i,next);
  }

  function tryOpenComposite(){
    if(shopOpen||solved) return;
    cpReady=cpMatchesTarget();

    if(!cpReady){
      SFX.wrongLock();
      damagePick({
        resetProgress:()=>{
          cpVals=[...cpInitial];
          cpSelected=0;
          cpReady=false;
        },
        renderState:renderComposite,
        surviveText:'Профиль отмычки не подходит'
      });
      return;
    }

    solved=true;
    SFX.open();
    renderComposite();
    setTimeout(()=>celebrate(),420);
  }

  // ===== TENSION CONTROL =====
  function tnInBand(){ return Math.abs(tnTension-tnTarget)<=tnWidth/2; }
  function renderTension(){
    if(!$tnNeedle) return;
    $tnNeedle.style.left=`${tnTension}%`;
    $tnBand.style.left=`${tnTarget-tnWidth/2}%`;
    $tnBand.style.width=`${tnWidth}%`;
    const pinSkin=currentPinSkin();
    const frag=document.createDocumentFragment();
    for(let i=0;i<tnPinCount;i++){
      const p=document.createElement('div');
      p.className='tnPin'+(i===tnIndex&&!tnReady?' active':'')+(i<tnIndex?' set':'');
      p.innerHTML=`<div class="tnPinStem"></div><div class="tnPinHead"></div><img class="tnPinImg" src="${pinSkin}" alt="">`;
      frag.appendChild(p);
    }
    $tnPins.replaceChildren(frag);
    if(solved) $tnMessage.textContent='Замок открыт';
    else if(tnReady) $tnMessage.textContent='Все штифты выставлены — нажми на замок';
    else $tnMessage.textContent=tnInBand()?'Натяжение в рабочей зоне · W / ↑ / Space — поставить штифт':'A / D — удерживай натяжение в зелёной зоне';
  }
  function startTensionRound(){
    solved=false; picks=pickCapacity; moves=0; brokenPicks=0; runReward=1000;
    tnPinCount=diffStep(4,5,6,'tension');
    tnTension=rand(28,60); tnTarget=rand(25,75); tnWidth=rand(diffStep(22,14,10,'tension'),diffStep(32,22,16,'tension')); tnIndex=0; tnReady=false;
    tnDrift=(Math.random()>.5?1:-1)*(diffStep(.03,.05,.075,'tension')+Math.random()*diffStep(.02,.025,.03,'tension'));
    generatedDistance=tnPinCount; updateEconomyUI(); renderTension();
  }
  function moveTension(dir){
    if(solved||tnReady) return;
    tnTension=clamp(tnTension+dir*3,0,100);
    SFX.select(); renderTension();
  }
  function setTensionPin(){
    if(solved||tnReady) return;
    registerMove();
    if(tnInBand()){
      tnIndex++; SFX.move();
      if(tnIndex>=tnPinCount){ tnReady=true; SFX.ready(); }
      else { tnTarget=rand(18,82); tnWidth=rand(diffStep(18,12,9,'tension'),diffStep(28,20,15,'tension')); tnTension=clamp(tnTension+rand(-4,4),0,100); }
      renderTension(); return;
    }
    SFX.wrongLock();
    damagePick({
      resetProgress:()=>{tnIndex=0;tnReady=false;},
      renderState:renderTension,
      surviveText:'Неверное натяжение'
    });
    tnTension=clamp(tnTension-rand(7,15),0,100);
    renderTension();
  }
  function tryOpenTension(){
    if(shopOpen||solved) return;
    if(!tnReady){ SFX.wrongLock(); toast('Сначала выставь все штифты'); return; }
    solved=true; SFX.open(); renderTension(); setTimeout(()=>celebrate(),420);
  }

  // ===== RESONANCE =====
  function rsPos(i){ return 50+43*Math.sin((rsOffsets[i]||0)+(rsPhases[i]||0)); }
  function renderResonance(){
    if(!$rsLanes) return;
    rsLaneEls=[]; rsOrbEls=[];
    const frag=document.createDocumentFragment();
    $rsLanes.style.setProperty('--rs-lane-width', `${Math.max(46,Math.round(292/Math.max(1,rsPinCount)))}px`);
    for(let i=0;i<rsPinCount;i++){
      const lane=document.createElement('div');
      lane.className='rsLane'+(i===rsIndex&&!rsReady?' active':'')+(i<rsIndex?' set':'');
      const orb=document.createElement('div'); orb.className='rsOrb';
      orb.style.top=`${i<rsIndex?50:rsPos(i)}%`;
      lane.appendChild(orb);
      lane.addEventListener('pointerdown',()=>{if(i===rsIndex&&!rsReady) hitResonance();});
      frag.appendChild(lane); rsLaneEls.push(lane); rsOrbEls.push(orb);
    }
    $rsLanes.replaceChildren(frag);
  }
  function startResonanceRound(){
    solved=false; picks=pickCapacity; moves=0; brokenPicks=0; runReward=1000;
    rsPinCount=diffStep(4,5,6,'resonance');
    rsIndex=0; rsT=0; rsReady=false;
    const speedBase=diffStep(.72,.85,1.02,'resonance');
    const speedStep=diffStep(.10,.13,.16,'resonance');
    const randomAmp=diffStep(.16,.22,.28,'resonance');
    rsBaseSpeeds=Array.from({length:rsPinCount},(_,i)=>speedBase+i*speedStep+Math.random()*randomAmp);
    rsSpeeds=[...rsBaseSpeeds];
    rsSpeedTargets=[...rsBaseSpeeds];
    rsOffsets=Array.from({length:rsPinCount},()=>0);
    rsPhases=Array.from({length:rsPinCount},()=>Math.random()*Math.PI*2);
    const now=performance.now();
    rsSpeedChangeAt=Array.from({length:rsPinCount},()=>now+rand(900,1700));
    rsPauseUntil=Array.from({length:rsPinCount},()=>0);
    generatedDistance=rsPinCount; updateEconomyUI(); renderResonance();
  }
  function hitResonance(){
    if(solved||rsReady) return;
    registerMove();
    const p=rsPos(rsIndex);
    if(Math.abs(p-50)<=diffStep(10,7,5,'resonance')){
      rsIndex++; SFX.move();
      if(rsIndex>=rsPinCount){rsReady=true;SFX.ready();}
      renderResonance(); return;
    }
    SFX.wrongLock();
    damagePick({
      resetProgress:()=>{rsIndex=0;rsReady=false;},
      renderState:renderResonance,
      surviveText:'Мимо резонанса'
    });
  }
  function tryOpenResonance(){
    if(shopOpen||solved) return;
    if(!rsReady){SFX.wrongLock();toast('Сначала зафиксируй все штифты');return;}
    solved=true;SFX.open();renderResonance();setTimeout(()=>celebrate(),420);
  }

  // ===== KEY DEDUCTION =====
  function renderDeduction(){
    if(!$kdKey) return;
    const pinSkin=currentPinSkin();
    const frag=document.createDocumentFragment();
    kdVals.forEach((v,i)=>{
      const t=document.createElement('div');
      t.className='kdTooth'+(i===kdSelected&&!kdReady?' active':'');
      t.innerHTML=`<div class="kdNum">${v}</div><div class="kdBar" style="--h:${v}"><img class="kdPinImg" src="${pinSkin}" alt=""></div><div class="kdControls"><button class="kdMini" data-d="-1" type="button">−</button><button class="kdMini" data-d="1" type="button">+</button></div>`;
      t.querySelectorAll('.kdMini').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();changeDeduction(i,Number(b.dataset.d));}));
      t.addEventListener('click',()=>{if(!kdReady){kdSelected=i;SFX.select();renderDeduction();}});
      frag.appendChild(t);
    });
    $kdKey.replaceChildren(frag);
    $kdPanel.classList.toggle('ready',kdReady&&!solved);
    $kdHistory.textContent=kdLogs.slice(-3).join(' · ');
    if(solved) $kdFeedback.textContent='Замок открыт';
    else if(kdReady) $kdFeedback.textContent=`Профиль совпал за ${kdTests} проверок — нажми на замок`;
  }
  function startDeductionRound(){
    solved=false;picks=pickCapacity;moves=0;brokenPicks=0;runReward=1000;
    kdToothCount=diffStep(4,5,6,'deduction');
    const maxTooth=diffStep(3,4,4,'deduction');
    kdVals=Array.from({length:kdToothCount},()=>2);kdTarget=Array.from({length:kdToothCount},()=>rand(0,maxTooth));kdSelected=0;kdTests=0;kdFailures=0;kdLogs=[];kdReady=false;
    generatedDistance=kdToothCount;updateEconomyUI();
    $kdFeedback.textContent='A / D — выбрать зубец · W / S — изменить высоту. Проверка сообщает только о первом неправильном зубце.';
    renderDeduction();
  }
  function moveDeductionSelection(dir){
    if(solved||kdReady) return;
    const next=clamp(kdSelected+dir,0,kdVals.length-1);
    if(next===kdSelected){SFX.blocked();return;}
    kdSelected=next;SFX.select();renderDeduction();
  }
  function changeDeduction(i,delta){
    if(solved||kdReady) return;
    kdSelected=i;
    const next=clamp(kdVals[i]+delta,0,4);
    if(next===kdVals[i]){SFX.blocked();return;}
    kdVals[i]=next;SFX.select();renderDeduction();
  }
  function checkDeduction(){
    if(solved||kdReady) return;
    kdTests++;registerMove();
    let wrong=-1;
    for(let i=0;i<kdVals.length;i++) if(kdVals[i]!==kdTarget[i]){wrong=i;break;}
    if(wrong<0){kdReady=true;SFX.ready();$kdFeedback.textContent=`Точный профиль найден за ${kdTests} проверок — нажми на замок`;kdLogs.push('Профиль совпал');renderDeduction();return;}
    const low=kdVals[wrong]<kdTarget[wrong];
    $kdFeedback.textContent=`Зубец ${wrong+1} ${low?'слишком низкий':'слишком высокий'}. Остальные пока не проверяются.`;
    kdLogs.push(`${wrong+1}: ${low?'↑':'↓'}`);kdFailures++;
    SFX.wrongLock();
    if(kdFailures%3===0){
      damagePick({
        resetProgress:()=>{kdVals=Array.from({length:kdToothCount},()=>2);kdSelected=0;},
        renderState:renderDeduction,
        surviveText:'Три неудачные пробные вставки'
      });
    } else renderDeduction();
  }
  function tryOpenDeduction(){
    if(shopOpen||solved) return;
    if(!kdReady){SFX.wrongLock();toast('Сначала восстанови профиль ключа');return;}
    solved=true;SFX.open();renderDeduction();setTimeout(()=>celebrate(),420);
  }

  // ===== SKYRIM =====
  function skAngleDiff(){
    return Math.abs(skPickAngle-skTargetAngle);
  }

  function renderSkyrim(){
    $skBoard.style.setProperty('--pick-angle',`${skPickAngle.toFixed(1)}deg`);
    $skBoard.style.setProperty('--cylinder-angle',`${skCylinderAngle.toFixed(1)}deg`);
    const diff=skAngleDiff();
    const ready=diff<=skSolveTolerance && !solved;
    $skMode.classList.toggle('ready',ready);

    if(solved){
      $skFeedbackText.textContent='Замок открыт';
    }else if(ready){
      $skFeedbackText.textContent='Почти без сопротивления — проверни замок';
    }else if(diff<=skSolveTolerance*2.5){
      $skFeedbackText.textContent='Механизм поддаётся';
    }else if(diff<=skSolveTolerance*5){
      $skFeedbackText.textContent='Есть сопротивление';
    }else{
      $skFeedbackText.textContent='Сильное сопротивление';
    }
  }

  function startSkyrimRound(){
    solved=false;
    $lock.classList.remove('win');
    $mechanism.classList.remove('ready','opening','opened');
    picks=pickCapacity;
    moves=0;
    brokenPicks=0;
    runReward=1000;
    skSolveTolerance=diffStep(10,6,4,'skyrim');
    const angleRange=diffStep(42,60,72,'skyrim');
    skTargetAngle=rand(-angleRange,angleRange);
    skPickAngle=0;
    if(Math.abs(skTargetAngle)<14) skPickAngle = skTargetAngle>0 ? -28 : 28;
    skCylinderAngle=0;
    skTorqueBusy=false;
    generatedDistance=Math.max(3,Math.round(Math.abs(skTargetAngle-skPickAngle)/8)+1);
    updateEconomyUI();
    updatePickUI();
    renderSkyrim();
  }

  function setSkyrimAngle(angle){
    if(solved || skTorqueBusy) return;
    skPickAngle=clamp(angle,-80,80);
    SFX.select();
    renderSkyrim();
  }

  function moveSkyrim(dir){
    if(solved || skTorqueBusy) return;
    skPickAngle=clamp(skPickAngle+dir*4,-80,80);
    SFX.select();
    renderSkyrim();
  }

  function skyrimBreakPick(){
    return damagePick({
      resetProgress:()=>{ skPickAngle=0; },
      renderState:renderSkyrim,
      surviveText:'Слишком сильное сопротивление'
    }).broke;
  }

  function tryTorqueSkyrim(){
    if(shopOpen || solved || skTorqueBusy) return;
    skTorqueBusy=true;
    registerMove();

    const diff=skAngleDiff();
    const normalized=clamp(1-diff/48,0,1);
    const maxTurn=diff<=6 ? 90 : 10+62*normalized;
    skCylinderAngle=maxTurn;
    SFX.move();
    renderSkyrim();

    if(diff<=skSolveTolerance){
      solved=true;
      $lock.classList.add('win');
      SFX.open();
      setTimeout(()=>{
        renderSkyrim();
        celebrate();
        skTorqueBusy=false;
      },430);
      return;
    }

    $skMode.classList.remove('torque-fail');
    void $skMode.offsetWidth;
    $skMode.classList.add('torque-fail');

    skyrimBreakPick();

    setTimeout(()=>{
      if(!solved){
        skCylinderAngle=0;
        renderSkyrim();
      }
      skTorqueBusy=false;
    },390);
  }

  function skyrimAngleFromPointer(e){
    const r=$skBoard.getBoundingClientRect();
    const cx=r.left+r.width/2;
    const cy=r.top+r.height/2;
    const dx=e.clientX-cx;
    const dy=e.clientY-cy;
    const angle=Math.atan2(dx,-dy)*180/Math.PI;
    return clamp(angle,-80,80);
  }

  // ===== RISEN 2 =====
  function getR2Layout(){
    const count = r2PinCount;
    const pinGap = count >= 8 ? 12 : 18;
    const pinsWidth = 540;
    const pinWidth = Math.floor((pinsWidth - pinGap * (count - 1)) / count);
    const pinsLeft = (780 - pinsWidth) / 2;
    const pinXs = Array.from({length:count},(_,i)=>18 + i * (pinWidth + pinGap));
    const pinCenters = pinXs.map(x => pinsLeft + x + pinWidth / 2);
    const imported = document.body.classList.contains('importedMode');
    const pickTipCenter = imported ? 308 : 276;
    return { pinWidth, pinGap, pinsWidth, pinsLeft, pinXs, pinCenters, pickTipCenter };
  }

  function startR2Round(){
    solved=false;
    $lock.classList.remove('win');
    $mechanism.classList.remove('ready','opening','opened');
    picks=pickCapacity;
    moves=0;
    brokenPicks=0;
    runReward=1000;
    r2PinCount=diffStep(4,6,8,'r2');
    r2ProgressCount=0;
    r2PickPos=rand(0,r2PinCount-1);
    r2Sequence=shuffle(Array.from({length:r2PinCount},(_,i)=>i));
    generatedDistance=r2PinCount;
    renderR2();
    updateEconomyUI();
  }

  function renderR2(){
    const layout = getR2Layout();
    const raised = new Set(r2Sequence.slice(0,r2ProgressCount));
    const pinSkin=currentPinSkin();
    const frag=document.createDocumentFragment();
    r2PinEls=[];

    for(let i=0;i<r2PinCount;i++){
      const pin=document.createElement('div');
      const isRaised = raised.has(i);
      pin.className='r2Pin' + (i===r2PickPos?' current':'') + (isRaised?' up':'');
      pin.dataset.index=i;
      pin.style.left=`${layout.pinXs[i]}px`;
      pin.style.setProperty('--pin-lift', isRaised ? '-36px' : '0px');

      const stem=document.createElement('div');
      stem.className='r2PinStem';
      const head=document.createElement('div');
      head.className='r2PinHead';
      const skin=document.createElement('img');
      skin.className='r2PinImg';
      skin.src=pinSkin;
      skin.alt='';
      pin.append(stem,head,skin);

      pin.addEventListener('click',()=>{
        if(solved) return;
        r2PickPos=i;
        SFX.select();
        renderR2();
        setTimeout(()=>attemptR2Pin(),90);
      });

      frag.appendChild(pin);
      r2PinEls.push(pin);
    }
    $r2Pins.replaceChildren(frag);

    const targetX = layout.pinCenters[r2PickPos] - layout.pickTipCenter;
    $r2Pick.style.setProperty('--r2x',`${targetX.toFixed(1)}px`);

    $r2Progress.textContent=`${r2ProgressCount} / ${r2PinCount}`;
    $r2Message.textContent = r2ProgressCount===r2PinCount
      ? 'Все штифты подняты — нажми на картинку замка'
      : 'A / D — двигать отмычку, W — поднять штифт';
  }

  function moveR2(dir){
    if(solved) return;
    const next=Math.max(0,Math.min(r2PinCount-1,r2PickPos+dir));
    if(next===r2PickPos){ SFX.blocked(); return; }
    r2PickPos=next;
    SFX.move();
    renderR2();
  }

  function attemptR2Pin(){
    if(solved) return;
    registerMove();
    const expected=r2Sequence[r2ProgressCount];
    const pin=r2PinEls[r2PickPos];

    if(r2PickPos===expected){
      r2ProgressCount++;
      SFX.move();
      renderR2();
      if(r2ProgressCount===r2PinCount) SFX.ready();
      return;
    }

    if(pin){
      pin.classList.add('wrong');
      setTimeout(()=>pin.classList.remove('wrong'),340);
    }
    const outcome=damagePick({
      resetProgress:()=>{ r2ProgressCount=0; },
      renderState:renderR2,
      surviveText:'Неверный штифт'
    });
    if(!outcome.broke || outcome.kept){
      renderR2();
    }
  }

  function tryOpenR2(){
    if(shopOpen || solved) return;
    if(r2ProgressCount!==r2PinCount){
      SFX.wrongLock();
      toast('Сначала подними все штифты в правильном порядке');
      return;
    }
    solved=true;
    $lock.classList.add('win');
    SFX.open();
    renderR2();
    setTimeout(()=>celebrate(),420);
  }

  // ===== GOTHIC 1 =====
  function renderG1Row(container, arr, size=4){
    container.innerHTML = '';
    for(let i=0;i<size;i++){
      const slot=document.createElement('div');
      const val = arr[i];
      slot.className = 'g1Slot ' + (val==null ? 'empty' : (val < 0 ? 'left' : 'right'));
      container.appendChild(slot);
    }
  }

  function renderG1(){
    renderG1Row($g1ProgressRow, g1Input, g1Length);
    const ready = g1Input.length === g1Length && g1Input.every((v,i)=>v===g1Sequence[i]);
  }

  function startG1Round(){
    solved=false;
    $lock.classList.remove('win');
    $mechanism.classList.remove('ready','opening','opened');
    picks=pickCapacity;
    moves=0;
    brokenPicks=0;
    runReward=1000;
    g1Length=diffStep(3,4,5,'g1');
    g1Input=[];
    g1Sequence = Array.from({length:g1Length}, ()=> Math.random() < .5 ? -1 : 1);
    if(g1Sequence.every(v=>v===g1Sequence[0])) g1Sequence[rand(0,g1Length-1)] *= -1;
    generatedDistance = g1Length;
    updateEconomyUI();
    renderG1();
  }

  function g1Press(dir){
    if(shopOpen || solved) return;
    const expected = g1Sequence[g1Input.length];
    registerMove();
    if(dir === expected){
      g1Input.push(dir);
      SFX.move();
      renderG1();
      if(g1Input.length === g1Length){
        SFX.ready();
        toast('Последовательность верна · нажми на замок');
      }
    }else{
      damagePick({
        resetProgress:()=>{ g1Input=[]; },
        renderState:renderG1,
        surviveText:'Неверная команда'
      });
    }
  }

  function tryOpenG1(auto=false){
    if(shopOpen || solved) return;
    const ready = g1Input.length === g1Length && g1Input.every((v,i)=>v===g1Sequence[i]);
    if(!ready){
      if(!auto){
        SFX.wrongLock();
        toast('Сначала собери правильную последовательность');
      }
      return;
    }
    solved = true;
    $lock.classList.add('win');
    SFX.open();
    renderG1();
    setTimeout(()=>celebrate(), 420);
  }


  // ===== HILLSFAR =====
  function clearHillsfarTimer(){
    hfTimerHandle=null;
    hfLastTick=0;
  }

  function renderHillsfarHud(){
    setGlobalTimer(mode==='hillsfar', hfTimeLeft, hfTimeMax, 'ТАЙМЕР');
  }

  function startHillsfarTimer(){
    clearHillsfarTimer();
    hfTimeLeft = hfTimeMax;
    renderHillsfarHud();
    hfLastTick = performance.now();
    hfTimerHandle = true;
  }

  function failHillsfarAttempt(message){
    if(solved) return;
    registerMove();
    hfSelected=-1;
    const outcome=damagePick({
      resetProgress:()=>{},
      renderState:renderHillsfar,
      surviveText:message
    });
    if(!outcome.depleted){
      startHillsfarTimer();
      renderHillsfar();
    }

  }

  function hillsfarSegmentShape(type, x, baseY, step){
    if(type===0){ // low rectangular shelf
      return `L ${x+step*.16} ${baseY} L ${x+step*.16} ${baseY-10} L ${x+step*.72} ${baseY-10} L ${x+step*.72} ${baseY} L ${x+step} ${baseY}`;
    }
    if(type===1){ // single modest tooth
      return `L ${x+step*.18} ${baseY} L ${x+step*.48} ${baseY-20} L ${x+step*.76} ${baseY} L ${x+step} ${baseY}`;
    }
    if(type===2){ // rectangular step
      return `L ${x+step*.16} ${baseY} L ${x+step*.16} ${baseY-17} L ${x+step*.46} ${baseY-17} L ${x+step*.46} ${baseY-7} L ${x+step*.78} ${baseY-7} L ${x+step*.78} ${baseY} L ${x+step} ${baseY}`;
    }
    if(type===3){ // two short teeth
      return `L ${x+step*.12} ${baseY} L ${x+step*.29} ${baseY-14} L ${x+step*.45} ${baseY} L ${x+step*.58} ${baseY} L ${x+step*.72} ${baseY-18} L ${x+step*.86} ${baseY} L ${x+step} ${baseY}`;
    }
    if(type===4){ // taller rectangular tab
      return `L ${x+step*.18} ${baseY} L ${x+step*.18} ${baseY-8} L ${x+step*.38} ${baseY-8} L ${x+step*.38} ${baseY-22} L ${x+step*.67} ${baseY-22} L ${x+step*.67} ${baseY} L ${x+step} ${baseY}`;
    }
    // shallow shelf + tooth
    return `L ${x+step*.16} ${baseY} L ${x+step*.32} ${baseY-9} L ${x+step*.54} ${baseY-9} L ${x+step*.54} ${baseY-19} L ${x+step*.78} ${baseY-19} L ${x+step*.78} ${baseY} L ${x+step} ${baseY}`;
  }

  function hillsfarLockShape(type, x, baseY, step){
    if(type===0){
      return `L ${x+step*.16} ${baseY} L ${x+step*.16} ${baseY+10} L ${x+step*.72} ${baseY+10} L ${x+step*.72} ${baseY} L ${x+step} ${baseY}`;
    }
    if(type===1){
      return `L ${x+step*.18} ${baseY} L ${x+step*.48} ${baseY+20} L ${x+step*.76} ${baseY} L ${x+step} ${baseY}`;
    }
    if(type===2){
      return `L ${x+step*.16} ${baseY} L ${x+step*.16} ${baseY+17} L ${x+step*.46} ${baseY+17} L ${x+step*.46} ${baseY+7} L ${x+step*.78} ${baseY+7} L ${x+step*.78} ${baseY} L ${x+step} ${baseY}`;
    }
    if(type===3){
      return `L ${x+step*.12} ${baseY} L ${x+step*.29} ${baseY+14} L ${x+step*.45} ${baseY} L ${x+step*.58} ${baseY} L ${x+step*.72} ${baseY+18} L ${x+step*.86} ${baseY} L ${x+step} ${baseY}`;
    }
    if(type===4){
      return `L ${x+step*.18} ${baseY} L ${x+step*.18} ${baseY+8} L ${x+step*.38} ${baseY+8} L ${x+step*.38} ${baseY+22} L ${x+step*.67} ${baseY+22} L ${x+step*.67} ${baseY} L ${x+step} ${baseY}`;
    }
    return `L ${x+step*.16} ${baseY} L ${x+step*.32} ${baseY+9} L ${x+step*.54} ${baseY+9} L ${x+step*.54} ${baseY+19} L ${x+step*.78} ${baseY+19} L ${x+step*.78} ${baseY} L ${x+step} ${baseY}`;
  }

function hillsfarPattern(len=6){
    const arr=[];
    for(let i=0;i<len;i++) arr.push(rand(0,5));
    if(arr.every(v=>v===arr[0])) arr[rand(0,len-1)] = (arr[0]+1)%4;
    return arr;
  }

  function hillsfarMutate(base){
    const out=[...base];
    const changes=rand(1,2);
    for(let k=0;k<changes;k++){
      const i=rand(0,out.length-1);
      out[i]=(out[i]+rand(1,5))%6;
    }
    return out;
  }

  function samePattern(a,b){
    return a.length===b.length && a.every((v,i)=>v===b[i]);
  }

  function hillsfarSvg(pattern, width=189, height=64){
    const baseY = height * 0.70;
    const shankH = Math.max(12, Math.round(height * 0.14));
    const left = 1;
    const right = 1;
    const usable = width - left - right;
    const step = usable / pattern.length;
    let d = `M ${left} ${baseY}`;
    for(let i=0;i<pattern.length;i++){
      d += ' ' + hillsfarSegmentShape(pattern[i], left + i*step, baseY, step);
    }
    d += ` L ${width - right} ${baseY} L ${width - right} ${height - 10} L ${left} ${height - 10} Z`;

    const metal = '#eadc93';
    const shadow = '#8d7841';
    const body = `<path d="${d}" fill="${metal}"/>`;
    const spine = `<rect x="${left}" y="${height - 10 - shankH}" width="${width - left - right}" height="${shankH}" rx="2" fill="${metal}"/>`;
    const tip = `<rect x="${width - 10}" y="${height - 30}" width="9" height="20" fill="${metal}"/>`;
    const grooves = [0.28,0.56].map(k=>{
      const y = baseY + k * (height - baseY - 16);
      return `<path d="M ${left + 3} ${y} L ${width - right - 3} ${y}" stroke="${shadow}" stroke-opacity="0.28" stroke-width="1.5"/>`;
    }).join('');
    const bevel = `<path d="${d}" fill="none" stroke="rgba(255,247,206,.35)" stroke-width="1.6" stroke-linejoin="round"/>`;
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true">${body}${spine}${tip}${grooves}${bevel}</svg>`;
  }

  function hillsfarLockSvg(pattern, width=760, height=64){
    const baseY = 22;
    const step = width / pattern.length;
    let d = `M 0 ${baseY}`;
    for(let i=0;i<pattern.length;i++){
      d += ' ' + hillsfarLockShape(pattern[i], i*step, baseY, step);
    }
    d += ` L ${width} ${baseY} L ${width} ${height} L 0 ${height} Z`;
    const bg = `<rect x="0" y="0" width="${width}" height="${height}" fill="url(#hfBg)"/>`;
    const cut = `<path d="${d}" fill="#e8d88e"/>`;
    const defs = `<defs><linearGradient id="hfBg" x1="0" x2="1"><stop offset="0" stop-color="#8f8f8f"/><stop offset="0.55" stop-color="#9b9b9b"/><stop offset="1" stop-color="#8f8f8f"/></linearGradient></defs>`;
    const bevels = `<path d="M 0 ${baseY} H ${width}" stroke="rgba(255,255,255,.12)" stroke-width="1.5"/>`;
    return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" preserveAspectRatio="none">${defs}${bg}${cut}${bevels}</svg>`;
  }

  function renderHillsfar(){
    $hfLockCut.innerHTML = hillsfarLockSvg(hfTarget);
    $hfCandidates.innerHTML = '';
    $hfCandidates.classList.toggle('has-selection', hfSelected !== -1);
    hfOptions.forEach((opt,i)=>{
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='hfCandidate' + (i===hfSelected ? ' selected' : '');
      btn.innerHTML = hillsfarSvg(opt, 189, 64);
      btn.addEventListener('click', ()=>{
        if(solved) return;
        hfSelected=i;
        SFX.select();
        renderHillsfar();
      });
      $hfCandidates.appendChild(btn);
    });
  }

  function startHillsfarRound(){
    clearHillsfarTimer();
    solved=false;
    $lock.classList.remove('win');
    $mechanism.classList.remove('ready','opening','opened');
    picks=pickCapacity;
    moves=0;
    brokenPicks=0;
    runReward=1000;
    picks=pickCapacity;
    updatePickUI();
    hfTimeMax=diffStep(70,45,30,'hillsfar');
    hfTarget=hillsfarPattern(diffStep(4,5,6,'hillsfar'));

    const optionCount=diffStep(6,8,9,'hillsfar');
    const options=[hfTarget];
    while(options.length<optionCount){
      const candidate=hillsfarMutate(hfTarget);
      if(!options.some(o=>samePattern(o,candidate))) options.push(candidate);
    }
    hfOptions=shuffle(options);
    hfSelected=-1;
    generatedDistance=1;
    updateEconomyUI();
    renderHillsfar();
    startHillsfarTimer();
  }

  function tryOpenHillsfar(){
    if(shopOpen || solved) return;
    if(hfSelected<0){
      SFX.wrongLock();
      toast('Сначала выбери ключ');
      return;
    }
    if(samePattern(hfOptions[hfSelected], hfTarget)){
      solved=true;
      clearHillsfarTimer();
      $lock.classList.add('win');
      const candidate=$hfCandidates.children[hfSelected];
      if(candidate) candidate.classList.add('correctFlash');
      SFX.open();
      setTimeout(()=>celebrate(),420);
      return;
    }

    SFX.wrongLock();
    failHillsfarAttempt('Ключ не подходит');
  }

  // ===== BASE / SPECIAL LOCKS =====
  function buildSpecialLinks(type){
    links=Array.from({length:n},()=>Array(n).fill(0));

    if(type==='chain'){
      for(let i=0;i<n;i++){
        links[i][i]=1;
        if(i>0) links[i][i-1]=1;
        if(i<n-1) links[i][i+1]=1;
      }
      return;
    }

    if(type==='mirror'){
      for(let i=0;i<n;i++){
        links[i][i]=1;
        const m=n-1-i;
        if(m!==i) links[i][m]=-1;
      }
      return;
    }

    // "wave": selected pin + next pin same direction + previous pin opposite.
    for(let i=0;i<n;i++){
      links[i][i]=1;
      links[i][(i+1)%n]=1;
      links[i][(i-1+n)%n]=-1;
    }
  }

  function specialTypeName(){
    return specialType==='chain' ? 'Цепной' : (specialType==='mirror' ? 'Зеркальный' : 'Волновой');
  }

  function makeLinks(){
    links=Array.from({length:n},()=>Array(n).fill(0));
    for(let i=0;i<n;i++){
      links[i][i]=1;
      let count = n<=3 ? rand(0,1) : rand(1,Math.min(2,n-1));
      let candidates=shuffle([...Array(n).keys()].filter(j=>j!==i));
      for(let k=0;k<count;k++) links[i][candidates[k]]=Math.random()<.68?1:-1;
    }
  }

  function deltaFor(i,dir){return links[i].map(v=>v*dir)}
  function legal(st,i,dir){
    const d=deltaFor(i,dir);
    return st.every((v,j)=>v+d[j]>=MIN && v+d[j]<=MAX);
  }
  function applyRaw(st,i,dir){
    const d=deltaFor(i,dir); return st.map((v,j)=>v+d[j]);
  }
let plateEls=[], pinTopPlateEls=[];

  function rebuildPlates(){
    plateEls=[];
    pinTopPlateEls=[];
    const spacing = n===3 ? 106 : n===4 ? 78 : n===5 ? 78 : 74;
    const pinSkin=currentPinSkin();
    const plateSkin=currentPlateSkin();
    const pinImage=`url("${pinSkin}")`;
    const plateImage=`url("${plateSkin}")`;
    const frag=document.createDocumentFragment();
    const pinTopFrag=document.createDocumentFragment();
    const pinTopRoot=document.querySelector('#pinTopPlates');
    state.forEach((pos,i)=>{
      const p=document.createElement('div');
      p.className='plate';
      if(mode==='target') p.classList.add('mode-target');
      p.dataset.index=i;
      p.setAttribute('role','button');
      p.setAttribute('tabindex','0');
      p.setAttribute('aria-label',`Выбрать пластину ${i+1}`);

      const x=0, y=i*spacing;
      p.style.setProperty('--dx',`${x}px`);
      p.style.setProperty('--dy',`${y}px`);
      p.style.setProperty('--parx', `${(0.55 + i*0.08).toFixed(2)}`);
      p.style.setProperty('--pary', `${(0.28 + i*0.05).toFixed(2)}`);
      p.style.zIndex=20+i;

      const plateH=97;
      const holeY=currentPlateHoleY()*plateH;

      const pin=document.createElement('div');
      pin.className='pin';
      pin.style.backgroundImage=pinImage;
      pin.style.setProperty('--pin-image',pinImage);
      pin.style.bottom=`${(plateH-holeY-17).toFixed(2)}px`;

      const pinTopPlate=document.createElement('div');
      pinTopPlate.className='pinTopPlate';
      pinTopPlate.dataset.index=i;
      pinTopPlate.style.setProperty('--dx',`${x}px`);
      pinTopPlate.style.setProperty('--dy',`${y}px`);
      pinTopPlate.style.setProperty('--parx', `${(0.55 + i*0.08).toFixed(2)}`);
      pinTopPlate.style.setProperty('--pary', `${(0.28 + i*0.05).toFixed(2)}`);
      const pinTop=document.createElement('div');
      pinTop.className='pinTopPin';
      pinTop.style.backgroundImage=pinImage;
      pinTop.style.setProperty('--pin-image',pinImage);
      pinTop.style.bottom=`${(plateH-holeY-17).toFixed(2)}px`;
      pinTopPlate.appendChild(pinTop);

      const face=document.createElement('div');
      face.className='plateFace';
      face.style.backgroundImage=plateImage;

      const target=document.createElement('div');
      target.className='target';

      const idx=document.createElement('div');
      idx.className='index';
      idx.textContent=String(i+1).padStart(2,'0');

      p.append(pin,face,target,idx);
      p._pin=pin;
      p._pinTop=pinTop;
      p._pinTopPlate=pinTopPlate;
      p._target=target;
      p._pinState=null;
      p.addEventListener('pointerdown',e=>e.preventDefault());
      p.addEventListener('mousedown',e=>e.preventDefault());
      p.addEventListener('click',()=>{
        if(solved) return;
        selected=i;
        SFX.select();
        render();
      });
      p.addEventListener('keydown',e=>{
        if(e.key==='Enter'||e.key===' '){
          e.preventDefault();
          if(!solved){selected=i;SFX.select();render();}
        }
      });
      frag.appendChild(p);
      pinTopFrag.appendChild(pinTopPlate);
      plateEls.push(p);
      pinTopPlateEls.push(pinTopPlate);
    });
    $plates.replaceChildren(frag);
    if(pinTopRoot) pinTopRoot.replaceChildren(pinTopFrag);
  }

  function pinXForState(pos){
    const i=Math.max(0,Math.min(6,pos-1));
    return PLATE_HOLE_X[i]*520;
  }

  function targetLineFor(i){
    if(mode==='classic' || mode==='special') return GOAL;
    if(mode==='target' || mode==='sequence') return targets[i] || GOAL;
    return goalLine;
  }

  function pinScaleFor(i, pos){
    if(mode==='sequence') return goalMet() ? 0.70 : 0.56;
    const target = targetLineFor(i);
    return pos === target ? 0.70 : 0.56;
  }

  function pinTransform(x, scale=1){
    const xShift=(520*0.01);
    const yShift=(scale>=0.70 ? -5 : 0);
    return `translate3d(${(x-23-xShift).toFixed(2)}px,${yShift.toFixed(2)}px,0) scaleX(1) scaleY(${scale})`;
  }

  function animatePinTo(p, nextState){
    const pins=[p._pin,p._pinTop].filter(Boolean);
    if(!pins.length) return;
    const row=+p.dataset.index;
    const prevState=p._pinState;
    const nextX=pinXForState(nextState);
    const nextScale=pinScaleFor(row,nextState);

    if(prevState==null || prevState===nextState){
      const nextTransform=pinTransform(nextX,nextScale);
      pins.forEach(pin=>{ pin.style.transform=nextTransform; });
      p._pinState=nextState;
      return;
    }

    const prevX=pinXForState(prevState);
    const prevScale=pinScaleFor(row,prevState);
    pins.forEach(pin=>{
      pin.getAnimations().forEach(a=>a.cancel());
      const anim=pin.animate([
        {transform:pinTransform(prevX,prevScale),offset:0},
        {transform:pinTransform(prevX,.28),offset:.28},
        {transform:pinTransform(nextX,.28),offset:.64},
        {transform:pinTransform(nextX,nextScale),offset:1}
      ],{duration:616,easing:'cubic-bezier(.2,.82,.2,1)',fill:'forwards'});
      pin.style.transform=pinTransform(nextX,nextScale);
      anim.onfinish=()=>anim.cancel();
    });
    p._pinState=nextState;
  }

  function updatePlateVisual(i){
    const p=plateEls[i];
    if(!p) return;
    const isSelected = i===selected;
    const codeSolved = mode==='sequence' && goalMet();
    const isSolved = (mode==='classic' || mode==='special') ? state[i]===GOAL : (mode==='target' ? state[i]===targets[i] : (mode==='line' ? state[i]===goalLine : codeSolved));
    p.classList.toggle('selected',isSelected);
    p.classList.toggle('solved',isSolved);
    p.classList.toggle('mode-target', mode==='target');
    if(p._pinTopPlate){
      p._pinTopPlate.classList.toggle('selected',isSelected);
      p._pinTopPlate.classList.toggle('solved',isSolved);
    }
    p.style.zIndex = 20 + i;
    if(p._target){
      const tx = pinXForState((targets[i]||1)) - 8;
      p._target.style.transform = `translate3d(${tx.toFixed(2)}px,0,0)`;
      p._target.style.opacity = mode==='target' ? '1' : '0';
    }
    animatePinTo(p,state[i]);
  }

  function newLock(notify=true){
    setGameInactive(false);
    $toast.classList.remove('show','actionable');
    chooseRoundPinSkin();
    chooseRoundPlateSkin();
    chooseRoundMechanismSkin();
    $lock.classList.remove('win');
    $mechanism.classList.remove('ready','opening','opened');
    const baseDifficulty = getModeDifficulty(mode);
    n=((mode==='classic' || mode==='target' || mode==='line' || mode==='sequence' || mode==='special') && baseDifficulty===1) ? 4 : 5;
    selected=0; solved=false; picks=pickCapacity; moves=0; brokenPicks=0; runReward=1000;

    if(mode==='classic'){
      goalLine=GOAL;
      targets=[];
      makeLinks();
      state=generateLinkedPuzzle(GOAL,diffStep(6,8,11),diffStep(9,12,15));
      initial=[...state];
      rebuildPlates();
      render();
    }else if(mode==='target'){
      goalLine=GOAL;
      links=[];
      makeSmartTargetModeStart(diffStep(6,8,12),diffStep(10,14,18));
      initial=[...state];
      rebuildPlates();
      render();
    }else if(mode==='line'){
      targets=[];
      goalLine=shuffle([2,3,5,6])[0];
      makeLinks();
      state=generateLinkedPuzzle(goalLine,diffStep(6,8,11),diffStep(9,12,15));
      initial=[...state];
      rebuildPlates();
      render();
    }else if(mode==='sequence'){
      goalLine=GOAL;
      links=[];
      makeSmartTargetModeStart(diffStep(6,8,12),diffStep(10,14,18));
      initial=[...state];
      rebuildPlates();
      render();
    }else if(mode==='special'){
      targets=[];
      goalLine=GOAL;
      const specialDifficulty=getModeDifficulty('special');
      specialType=shuffle(specialDifficulty===1 ? ['chain'] : (specialDifficulty===2 ? ['chain','mirror'] : ['chain','mirror','wave']))[0];
      buildSpecialLinks(specialType);
      state=generateLinkedPuzzle(GOAL,diffStep(5,7,10,'special'),diffStep(8,11,14,'special'));
      initial=[...state];
      rebuildPlates();
      render();
    }else if(mode==='hillsfar'){
      startHillsfarRound();
    }else if(mode==='mass'){
      startMassRound();
    }else if(mode==='g1'){
      startG1Round();
    }else if(mode==='r2'){
      startR2Round();
    }else if(mode==='skyrim'){
      startSkyrimRound();
    }else if(mode==='anach'){
      startAnRound();
    }else if(mode==='tension'){
      startTensionRound();
    }else if(mode==='resonance'){
      startResonanceRound();
    }else if(mode==='deduction'){
      startDeductionRound();
    }else if(mode==='composite'){
      startCompositeRound();
    }else if(mode==='heatcold'){
      startHeatColdRound();
    }else if(mode==='drum'){
      startDrumRound();
    }else if(mode==='scope'){
      startScopeRound();
    }

    updateModeUI();
    updateEconomyUI();
    if(mode==='r2') requestAnimationFrame(renderR2);

    const msg =
      mode==='classic' ? 'Новый замок' :
      mode==='target' ? 'Новая цель' :
      mode==='line' ? `Новая линия: ${goalLine}` :
      mode==='sequence' ? `Новый код: ${targets.join(', ')}` :
      mode==='special' ? `Особый замок: ${specialTypeName()}` :
      mode==='hillsfar' ? 'Новый набор ключей' :
      mode==='mass' ? 'Новый круговой замок' :
      mode==='g1' ? 'Новая последовательность' :
      mode==='r2' ? 'Новый замок Risen 2' :
      mode==='skyrim' ? 'Новый замок Skyrim' :
      mode==='anach' ? 'Новый контур Anachronox' :
      mode==='tension' ? 'Новый замок с натяжением' :
      mode==='resonance' ? 'Новый резонансный замок' :
      mode==='deduction' ? 'Новый слепок ключа' :
      mode==='composite' ? 'Новая составная отмычка' :
      mode==='heatcold' ? 'Новый цифровой код' :
      mode==='drum' ? 'Новый барабанный замок' :
      'Новый сигнал осциллографа';
    if(notify){
      toast(msg);
      SFX.newRound();
    }
  }

  function reset(){
    setGameInactive(false);
    if(mode==='hillsfar'){ startHillsfarRound(); toast('Набор ключей обновлён'); return; }
    if(mode==='mass'){ startMassRound(); toast('Круговой замок обновлён'); return; }
    if(mode==='g1'){ startG1Round(); toast('Последовательность обновлена'); return; }
    if(mode==='r2'){ startR2Round(); toast('Замок Risen 2 обновлён'); return; }
    if(mode==='skyrim'){ startSkyrimRound(); toast('Замок Skyrim обновлён'); return; }
    if(mode==='anach'){ startAnRound(); toast('Контур Anachronox обновлён'); return; }
    if(mode==='tension'){ startTensionRound(); toast('Натяжение обновлено'); return; }
    if(mode==='resonance'){ startResonanceRound(); toast('Резонанс обновлён'); return; }
    if(mode==='deduction'){ startDeductionRound(); toast('Слепок обновлён'); return; }
    if(mode==='composite'){ startCompositeRound(); toast('Профиль штифтов обновлён'); return; }
    if(mode==='heatcold'){ startHeatColdRound(); toast('Цифровой код обновлён'); return; }
    if(mode==='drum'){ startDrumRound(); toast('Барабанный замок обновлён'); return; }
    if(mode==='scope'){ startScopeRound(); toast('Сигнал обновлён'); return; }
    state=[...initial]; solved=false; $lock.classList.remove('win');
    $mechanism.classList.remove('ready','opening','opened');
    render(); toast('Механизм сброшен');
  }

  function failMove(){
    nudgeTools();
    document.body.classList.remove('flash');
    void document.body.offsetWidth;
    document.body.classList.add('flash');

    const info=PICK_TYPES[pickType];
    const breaks=Math.random()<info.breakChance;
    if(!breaks){
      SFX.survive();
      toast(`Ошибка · ${info.name.toLowerCase()} выдержала`);
      render();
      return;
    }

    const previousVisiblePicks=Math.max(0, Math.min(pickCapacity, picks));
    picks=Math.max(0,picks-1);
    if(previousVisiblePicks>0) triggerInventoryBreakAnimation(previousVisiblePicks);
    brokenPicks++;
    SFX.break();
    const keepsPosition=Math.random()<info.saveChance;
    if(!keepsPosition) state=[...initial];

    if(picks<=0){
      solved=true;
      render();
      toast('Отмычки закончились · проигрыш');
      setTimeout(()=>newLock(),1320);
      return;
    }

    toast(keepsPosition?'Отмычка сломалась · позиция сохранена':'Отмычка сломалась · замок сброшен');
    render();
    $mechanism.classList.toggle('ready',goalMet());
  }

  function move(dir){
    if(mode==='tension') return moveTension(dir);
    if(mode==='resonance') return;
    if(mode==='deduction') return moveDeductionSelection(dir);
    if(mode==='composite') return moveCompositeSelection(dir);
    if(mode==='anach') return moveAn(dir);
    if(mode==='skyrim') return moveSkyrim(dir);
    if(mode==='r2') return moveR2(dir);
    if(mode==='g1') return g1Press(dir);
    if(mode==='mass') return moveMass(dir);
    if(mode==='hillsfar') return;
    if(mode==='heatcold'||mode==='drum'||mode==='scope') return;
    if(solved) return;
    nudgeTools();
    if(mode==='classic' || mode==='line' || mode==='special'){
      if(!legal(state,selected,dir)){SFX.blocked();failMove();return}
      state=applyRaw(state,selected,dir);
      registerMove();
    }else{
      const next = state[selected] + dir;
      if(next<MIN || next>MAX){SFX.blocked();failMove();return}
      state[selected] = next;
      registerMove();
    }
    SFX.move();
    const wasReady=$mechanism.classList.contains('ready');
    render();
    const isReady=goalMet();
    $mechanism.classList.toggle('ready',isReady);
    if(isReady&&!wasReady) SFX.ready();
  }

  function shakeUniversalLock(){
    if(!$mechanism || solved) return;
    $mechanism.classList.remove('shake-fail');
    void $mechanism.offsetWidth;
    $mechanism.classList.add('shake-fail');
    setTimeout(()=> $mechanism.classList.remove('shake-fail'), 380);
  }

  function handleUniversalLockClick(){
    if(shopOpen || solved) return;
    const solvedBefore = solved;
    tryOpenLock();
    if(!solved && !solvedBefore) shakeUniversalLock();
  }

  function tryOpenLock(){
    if(mode==='tension') return tryOpenTension();
    if(mode==='resonance') return tryOpenResonance();
    if(mode==='deduction') return tryOpenDeduction();
    if(mode==='composite') return tryOpenComposite();
    if(mode==='heatcold') return scanHeatCold();
    if(mode==='drum') return checkDrum();
    if(mode==='scope') return checkScope();
    if(mode==='anach') return tryOpenAn();
    if(mode==='skyrim') return tryTorqueSkyrim();
    if(mode==='r2') return tryOpenR2();
    if(mode==='g1') return tryOpenG1();
    if(mode==='hillsfar') return tryOpenHillsfar();
    if(mode==='mass') return tryOpenMass();
    if(solved || shopOpen) return;

    if(!goalMet()){
      $mechanism.classList.remove('ready');
      nudgeTools();
      SFX.wrongLock();
      toast('Замок ещё не выставлен');
      return;
    }

    solved=true;
    SFX.open();
    $mechanism.classList.remove('ready');
    $mechanism.classList.add('opening');
    $lock.classList.add('win');
    render();

    setTimeout(()=>{
      $mechanism.classList.remove('opening');
      $mechanism.classList.add('opened');
      celebrate();
    },4300);
  }

  function select(delta){
    if(mode==='tension'){ if(delta<0) setTensionPin(); return; }
    if(mode==='resonance'){ if(delta<0) hitResonance(); return; }
    if(mode==='deduction') return changeDeduction(kdSelected,delta<0?1:-1);
    if(mode==='composite') return changeCompositeShape(cpSelected,delta);
    if(mode==='anach') return adjustAn(delta<0?1:-1);
    if(mode==='skyrim'){ if(delta<0) tryTorqueSkyrim(); return; }
    if(mode==='r2'){
      if(delta<0) return attemptR2Pin();
      return;
    }
    if(mode==='g1') return;
    if(mode==='heatcold'||mode==='drum'||mode==='scope') return;
    if(mode==='mass') return selectMass(delta);
    if(solved||mode==='hillsfar')return;
    selected=(selected+delta+n)%n;
    SFX.select();
    render();
  }

  function render(){
    if(plateEls.length!==n) rebuildPlates();
    for(let i=0;i<n;i++) updatePlateVisual(i);

    updatePickUI();
    if(mode==='tension'||mode==='resonance'||mode==='deduction'||mode==='composite'){ $mechanism.classList.remove('ready'); }
    else if(mode==='anach'){ $mechanism.classList.remove('ready'); }
    else if(mode==='skyrim'){ $mechanism.classList.remove('ready'); }
    else if(mode==='r2'){ $mechanism.classList.remove('ready'); }
    else if(mode==='g1'){ $mechanism.classList.remove('ready'); }
    else if(mode==='mass'){ $mechanism.classList.remove('ready'); }
    else if(mode!=='hillsfar') $mechanism.classList.toggle('ready',!solved && goalMet());
    else $mechanism.classList.remove('ready');
    $status.innerHTML = '';
  }

  // Все динамические эффекты идут через requestAnimationFrame:
  // на дисплее 120 Гц браузер отрисовывает их до 120 кадров/с.
  let lastFrame=performance.now();
  function animationLoop(now){
    const dt=Math.min(32,now-lastFrame);
    lastFrame=now;
    const lerp = 1 - Math.pow(0.001, dt/1000);
    pointerX += (pointerTargetX - pointerX) * lerp;
    pointerY += (pointerTargetY - pointerY) * lerp;
    bgParallaxX += (bgParallaxTargetX - bgParallaxX) * lerp;
    bgParallaxY += (bgParallaxTargetY - bgParallaxY) * lerp;
    document.body.style.setProperty('--bg-parallax-x', `${bgParallaxX.toFixed(2)}px`);
    document.body.style.setProperty('--bg-parallax-y', `${bgParallaxY.toFixed(2)}px`);
    const idleSway = Math.sin(now * 0.0016) * 0.55;
    toolMotionKick += (0 - toolMotionKick) * (1 - Math.pow(0.001, dt / 420));
    const toolProfile = computeToolMotionProfile();
    const movePulse = toolMotionKick;
    const pulseSin = Math.sin(now * 0.024) * movePulse;

    const pickRotDrift = idleSway * 1.15 + pointerX * 0.18 - pointerY * 0.14;
    const tensionRotDrift = idleSway * 0.95 + pointerX * 0.12 + pointerY * 0.12;

    const pickReactX = toolProfile.rowBias * -8 + pulseSin * 2.2;
    const pickReactY = toolProfile.posBias * 6 - movePulse * 2.4;
    const pickReactRot = toolProfile.rowBias * 2.2 + toolProfile.posBias * 1.5 + pulseSin * 1.8;

    const tensionReactX = toolProfile.rowBias * 4 + pulseSin * 1.1;
    const tensionReactY = toolProfile.posBias * 3 - movePulse * 1.2;
    const tensionReactRot = toolProfile.rowBias * -1.4 + toolProfile.posBias * 1.1 + pulseSin * 1.1;

    document.documentElement.style.setProperty('--pick-rot-drift', `${pickRotDrift.toFixed(2)}deg`);
    document.documentElement.style.setProperty('--tension-rot-drift', `${tensionRotDrift.toFixed(2)}deg`);
    document.documentElement.style.setProperty('--pick-react-x', `${pickReactX.toFixed(2)}px`);
    document.documentElement.style.setProperty('--pick-react-y', `${pickReactY.toFixed(2)}px`);
    document.documentElement.style.setProperty('--pick-react-rot', `${pickReactRot.toFixed(2)}deg`);
    document.documentElement.style.setProperty('--tension-react-x', `${tensionReactX.toFixed(2)}px`);
    document.documentElement.style.setProperty('--tension-react-y', `${tensionReactY.toFixed(2)}px`);
    document.documentElement.style.setProperty('--tension-react-rot', `${tensionReactRot.toFixed(2)}deg`);

    $lock.style.setProperty('--px', `${pointerX.toFixed(2)}px`);
    $lock.style.setProperty('--py', `${pointerY.toFixed(2)}px`);
    if(plateEls.length){
      for(const p of plateEls){
        const px=`${pointerX.toFixed(2)}px`;
        const py=`${pointerY.toFixed(2)}px`;
        p.style.setProperty('--px',px);
        p.style.setProperty('--py',py);
        if(p._pinTopPlate){
          p._pinTopPlate.style.setProperty('--px',px);
          p._pinTopPlate.style.setProperty('--py',py);
        }
      }
    }
    if(hfTimerHandle && mode==='hillsfar' && !solved){
      const hfDt = Math.max(0, now - (hfLastTick || now)) / 1000;
      hfLastTick = now;
      hfTimeLeft = Math.max(0, hfTimeLeft - hfDt);
      renderHillsfarHud();
      if(hfTimeLeft <= 0){
        clearHillsfarTimer();
        failHillsfarAttempt('Время вышло');
      }
    }
    if(mode==='resonance' && !solved && !rsReady && rsLaneEls.length){
      rsT += dt * .001;
      const rsLevel=getModeDifficulty('resonance');
      rsLaneEls.forEach((lane,i)=>{
        const orb=rsOrbEls[i];
        if(!orb || i<rsIndex) return;
        if(rsLevel>=2){
          if(now >= (rsSpeedChangeAt[i]||0)){
            const base=rsBaseSpeeds[i] || rsSpeeds[i] || 1;
            const vary=rsLevel===2 ? .18 : .24;
            rsSpeedTargets[i]=Math.max(.28, base*(1 + rand(Math.round(-vary*100), Math.round(vary*100))/100));
            rsSpeedChangeAt[i]=now + rand(rsLevel===2 ? 1100 : 900, rsLevel===2 ? 2300 : 1800);
            if(rsLevel===3 && Math.random()<.34){
              rsPauseUntil[i]=now + rand(180,420);
            }
          }
          rsSpeeds[i] += (rsSpeedTargets[i]-rsSpeeds[i]) * Math.min(1, dt/900);
        }
        if(!(rsLevel===3 && now < (rsPauseUntil[i]||0))){
          rsOffsets[i] = (rsOffsets[i]||0) + dt * .001 * (rsSpeeds[i]||1);
        }
        orb.style.top=`${rsPos(i)}%`;
      });
    }
    if(mode==='tension' && !solved && !tnReady){
      tnTension += tnDrift * (dt/16.67);
      if(tnTension<2){tnTension=2;tnDrift=Math.abs(tnDrift);}
      if(tnTension>98){tnTension=98;tnDrift=-Math.abs(tnDrift);}
      if($tnNeedle) $tnNeedle.style.left=`${tnTension}%`;
    }
    requestAnimationFrame(animationLoop);
  }
  requestAnimationFrame(animationLoop);

  function tablerIcon(name, size=18){
    const icons={
      lock:'<path d="M5 11m-2 0a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z"/><path d="M8 9v-4a4 4 0 0 1 8 0v4"/><path d="M12 15l0 .01"/>',
      adjustments:'<path d="M4 6h16"/><path d="M4 18h16"/><path d="M4 12h16"/><path d="M8 4v4"/><path d="M16 10v4"/><path d="M10 16v4"/>',
      route:'<path d="M3 17l4 4l4 -4"/><path d="M7 21v-11a3 3 0 0 1 3 -3h7"/><path d="M14 4l3 3l-3 3"/>',
      list:'<path d="M9 6h11"/><path d="M9 12h11"/><path d="M9 18h11"/><path d="M5 6v.01"/><path d="M5 12v.01"/><path d="M5 18v.01"/>',
      sparkles:'<path d="M12 3l1.7 4.3l4.3 1.7l-4.3 1.7l-1.7 4.3l-1.7 -4.3l-4.3 -1.7l4.3 -1.7z"/><path d="M5 17l.8 2.2l2.2 .8l-2.2 .8l-.8 2.2l-.8 -2.2l-2.2 -.8l2.2 -.8z"/>',
      key:'<circle cx="8" cy="15" r="4"/><path d="M11 12l8 -8"/><path d="M15 8l3 3"/><path d="M17 6l3 3"/>',
      circles:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
      arrows:'<path d="M7 7l-4 4l4 4"/><path d="M3 11h14"/><path d="M17 5l4 4l-4 4"/><path d="M21 9h-14"/>',
      tool:'<path d="M14.7 6.3a4 4 0 0 0 -5 -5l2.2 2.2l-2.8 2.8l-2.2 -2.2a4 4 0 0 0 5 5l7.6 7.6a2 2 0 0 1 -2.8 2.8l-7.6 -7.6"/>',
      unlock:'<rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11v-4a5 5 0 0 1 9.8 -1"/><path d="M12 16v.01"/>',
      binary:'<path d="M8 9h8"/><path d="M8 15h8"/><circle cx="5" cy="9" r="1"/><circle cx="19" cy="15" r="1"/>',
      bag:'<path d="M6 8h12l1 13h-14z"/><path d="M9 8v-2a3 3 0 0 1 6 0v2"/>',
      coin:'<circle cx="12" cy="12" r="9"/><path d="M14.8 9a3 3 0 0 0 -2.8 -1.5c-1.7 0 -3 1 -3 2.3c0 3.2 6 1.7 6 5c0 1.3 -1.3 2.2 -3 2.2a3 3 0 0 1 -2.8 -1.5"/><path d="M12 5v2.5"/><path d="M12 17v2"/>',
      x:'<path d="M18 6l-12 12"/><path d="M6 6l12 12"/>',
      up:'<path d="M6 15l6 -6l6 6"/>',
      down:'<path d="M6 9l6 6l6 -6"/>',
      left:'<path d="M15 6l-6 6l6 6"/>',
      right:'<path d="M9 6l6 6l-6 6"/>',
      refresh:'<path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"/>',
      plus:'<path d="M12 5v14"/><path d="M5 12h14"/>',
      diamond:'<path d="M12 3l8 6l-8 12l-8 -12z"/><path d="M4 9h16"/>',
      tree:'<path d="M12 3l-5 7h3l-4 6h5v5h2v-5h5l-4 -6h3z"/>',
      hammer:'<path d="M8 4l8 8"/><path d="M12 4l4 4l-3 3l-4 -4z"/><path d="M11 13l-7 7"/>',
      briefcase:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7v-2h8v2"/><path d="M3 12h18"/>'
    };
    const body=icons[name]||icons.lock;
    return `<svg class="ti-svg" data-tabler-icon="${name}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  }

  function setIconLabel(el, icon, label){
    if(!el) return;
    el.innerHTML=`${tablerIcon(icon,17)}<span>${label}</span>`;
  }

  function applyTablerIcons(){
    setIconLabel($tabClassic,'lock','Классика');
    setIconLabel($tabTarget,'adjustments','Альтернатива');
    setIconLabel($tabLine,'route','Другая линия');
    setIconLabel($tabAlt2,'list','Альтернатива 2');
    setIconLabel($tabSpecial,'sparkles','Особые замки');
    setIconLabel($tabHillsfar,'key','Hillsfar');
    setIconLabel($tabMass,'circles','Mass Effect');
    setIconLabel($tabG1,'arrows','Gothic 1');
    setIconLabel($tabR2,'tool','Risen 2');
    setIconLabel($tabSkyrim,'unlock','Skyrim');
    setIconLabel($tabAnach,'binary','Anachronox');
    setIconLabel($tabTension,'adjustments','Натяжение');
    setIconLabel($tabResonance,'circles','Резонанс');
    setIconLabel($tabDeduction,'key','Слепок ключа');
    setIconLabel($tabComposite,'key','Составная');
    setIconLabel($shopTab,'bag','Магазин');

    const coinIcon=document.querySelector('.coinIcon');
    if(coinIcon) coinIcon.innerHTML=tablerIcon('coin',16);
    const headerPickIcon=document.querySelector('.headerPickIcon');
    if(headerPickIcon) headerPickIcon.innerHTML=tablerIcon('key',18);
    if($shopClose) $shopClose.innerHTML=tablerIcon('x',20);
    if($toastAction) $toastAction.innerHTML=`${tablerIcon('refresh',16)}<span>Новый замок</span>`;

    const woodName=$shopWood?.querySelector('.shopCardName');
    const ironName=$shopIron?.querySelector('.shopCardName');
    const diamondName=$shopDiamond?.querySelector('.shopCardName');
    if(woodName) woodName.innerHTML=`${tablerIcon('tree',18)}<span>Деревянная</span>`;
    if(ironName) ironName.innerHTML=`${tablerIcon('hammer',18)}<span>Железная</span>`;
    if(diamondName) diamondName.innerHTML=`${tablerIcon('diamond',18)}<span>Алмазная</span>`;
    const pouchName=document.querySelector('#pouchTitle');
    if(pouchName) pouchName.dataset.iconReady='1';

    document.querySelectorAll('.anBtn.anUp').forEach(b=>b.innerHTML=tablerIcon('up',18));
    document.querySelectorAll('.anBtn.anDown').forEach(b=>b.innerHTML=tablerIcon('down',18));
    document.querySelectorAll('.btn.up').forEach(b=>b.innerHTML=tablerIcon('up',20));
    document.querySelectorAll('.btn.down').forEach(b=>b.innerHTML=tablerIcon('down',20));
    document.querySelectorAll('.btn.left').forEach(b=>b.innerHTML=tablerIcon('left',20));
    document.querySelectorAll('.btn.right').forEach(b=>b.innerHTML=tablerIcon('right',20));
    const actions=document.querySelectorAll('.actions .action');
    if(actions[0]) actions[0].innerHTML=tablerIcon('refresh',18);
    if(actions[1]) actions[1].innerHTML=tablerIcon('plus',18);
  }

  document.addEventListener('selectstart', e=>e.preventDefault());
  addEventListener('pointerdown',ensureAudio,{once:true});
  addEventListener('keydown',ensureAudio,{once:true});
  document.addEventListener('dragstart', e=>e.preventDefault());

  function input(k){
    if(shopOpen) return;
    k=String(k).toLowerCase();
    if(k==='a'||k==='arrowleft')move(-1);
    else if(k==='d'||k==='arrowright')move(1);
    else if(k==='w'||k==='arrowup')select(-1);
    else if(k==='s'||k==='arrowdown')select(1);
    else if(k==='r')reset();
    else if(k==='n')newLock();
  }

  addEventListener('resize',()=>{
    if(mode==='composite' && !$compositeMode.hidden){
      requestAnimationFrame(()=>{
        cpRenderPinRail($cpPins, cpNodes);
        cpRenderPinRail($cpBuildPins, cpBuiltNodes());
        cpRenderJoints(cpBuiltNodes());
      });
    }
  },{passive:true});

  const KEY_ACTIONS={
    KeyA:'a', KeyD:'d', KeyW:'w', KeyS:'s', KeyR:'r', KeyN:'n', KeyT:'t',
    ArrowLeft:'arrowleft', ArrowRight:'arrowright', ArrowUp:'arrowup', ArrowDown:'arrowdown'
  };

  addEventListener('keydown',e=>{
    const action=KEY_ACTIONS[e.code];
    if(!action) return;
    e.preventDefault();
    input(action);
  });
  document.querySelectorAll('[data-key]').forEach(b=>b.addEventListener('pointerdown',()=>input(b.dataset.key)));

  addEventListener('pointermove', e=>{
    const nx=(e.clientX / Math.max(1, innerWidth) - 0.5) * 2;
    const ny=(e.clientY / Math.max(1, innerHeight) - 0.5) * 2;
    bgParallaxTargetX = -nx * innerWidth * 0.025;
    bgParallaxTargetY = -ny * innerHeight * 0.025;
  }, {passive:true});
  document.documentElement.addEventListener('mouseleave', ()=>{
    bgParallaxTargetX = 0;
    bgParallaxTargetY = 0;
  });

  $scene.addEventListener('pointermove', e=>{
    const r=$scene.getBoundingClientRect();
    const nx=((e.clientX-r.left)/r.width - 0.5) * 2;
    const ny=((e.clientY-r.top)/r.height - 0.5) * 2;
    pointerTargetX = nx * 13;
    pointerTargetY = ny * 11;
  });
  $scene.addEventListener('pointerleave', ()=>{
    pointerTargetX = 0;
    pointerTargetY = 0;
  });

  $skBoard.addEventListener('pointerdown',e=>{
    if(mode!=='skyrim' || e.target.closest('.skTorqueButton')) return;
    skDragging=true;
    $skBoard.setPointerCapture?.(e.pointerId);
    setSkyrimAngle(skyrimAngleFromPointer(e));
  });
  $skBoard.addEventListener('pointermove',e=>{
    if(mode!=='skyrim' || !skDragging) return;
    setSkyrimAngle(skyrimAngleFromPointer(e));
  });
  $skBoard.addEventListener('pointerup',e=>{
    if(mode!=='skyrim') return;
    skDragging=false;
    $skBoard.releasePointerCapture?.(e.pointerId);
  });
  $skBoard.addEventListener('pointercancel',()=>{ skDragging=false; });

  $lockHitArea.addEventListener('click',handleUniversalLockClick);
  $massCenter.addEventListener('click',tryOpenMass);
  $kdCheck?.addEventListener('click',checkDeduction);
  $skTorqueButton.addEventListener('click',tryTorqueSkyrim);
  $anUnlock.addEventListener('click',e=>{ if(e.target.closest('.anBtn')) return; tryOpenAn(); });
  $anUnlock.addEventListener('keydown',e=>{ if((e.key==='Enter'||e.key===' ')&&!e.target.closest('.anBtn')){ e.preventDefault(); tryOpenAn(); } });
  document.querySelectorAll('[data-an-col]').forEach(btn=>btn.addEventListener('click',e=>{ e.stopPropagation(); adjustAn(btn.dataset.anDir==='up'?1:-1, Number(btn.dataset.anCol)); }));
  document.querySelectorAll('.anChannel').forEach(ch=>ch.addEventListener('click',e=>{ if(e.target.closest('.anBtn')) return; anSelected=Number(ch.dataset.col); SFX.select(); renderAn(); }));
  $tnGauge?.addEventListener('pointerdown',e=>{
    if(mode!=='tension'||solved||tnReady) return;
    tnDragging=true;$tnGauge.setPointerCapture?.(e.pointerId);
    const r=$tnGauge.getBoundingClientRect();tnTension=clamp((e.clientX-r.left)/r.width*100,0,100);renderTension();
  });
  $tnGauge?.addEventListener('pointermove',e=>{if(!tnDragging||mode!=='tension')return;const r=$tnGauge.getBoundingClientRect();tnTension=clamp((e.clientX-r.left)/r.width*100,0,100);if($tnNeedle)$tnNeedle.style.left=`${tnTension}%`;});
  $tnGauge?.addEventListener('pointerup',()=>{tnDragging=false;});
  $tnGauge?.addEventListener('pointercancel',()=>{tnDragging=false;});
  addEventListener('keydown',e=>{if(mode==='resonance'&&e.code==='Space'){e.preventDefault();hitResonance();}});
  addEventListener('keydown',e=>{if(mode==='tension'&&e.code==='Space'){e.preventDefault();setTensionPin();}});
  addEventListener('keydown',e=>{if(mode==='deduction'&&e.code==='Space'){e.preventDefault();checkDeduction();}});
  document.querySelector('#shopHudButton')?.addEventListener('click',()=>{
    if(lairOpen) closeLair();
    if(mapOpen) closeMap();
    openShop();
  });
  document.querySelector('#lairHudButton')?.addEventListener('click',openLairFromHud);
  document.querySelector('#newPuzzleButton')?.addEventListener('click',restartCurrentRound);
  $mapTab.onclick=openMap;
  document.querySelector('#worldMapClose')?.addEventListener('click',closeMap);
  $worldMapScreen?.addEventListener('pointerdown',e=>{
    if(e.target===$worldMapScreen) closeMap();
  });
  $worldMapCanvas?.querySelectorAll('.mapNode').forEach(node=>{
    node.addEventListener('click',()=>travelToMapLocation(node.dataset.location));
  });
  document.querySelectorAll('.lairHotspot').forEach(btn=>{
    btn.addEventListener('click',()=>openLairModule(btn.dataset.lairOpen));
  });
  document.querySelector('#lairWorkbenchHotspot')?.addEventListener('click',openLairWorkbench);
  document.querySelector('#lairWorkbenchClose')?.addEventListener('click',closeLairWorkbench);
  document.querySelector('#lairWorkbenchModal')?.addEventListener('pointerdown',e=>{
    if(e.target===e.currentTarget) closeLairWorkbench();
  });
  $lairModuleClose?.addEventListener('click',closeLairModule);
  $lairClose?.addEventListener('click',closeLair);

  if($shopTab) $shopTab.onclick=null;
  $shopClose.onclick=closeShop;
  $shopOverlay.addEventListener('pointerdown',e=>{ if(e.target===$shopOverlay) closeShop(); });
  $shopWood.onclick=()=>buyOrEquipPick('wood');
  $shopIron.onclick=()=>buyOrEquipPick('iron');
  $shopDiamond.onclick=()=>buyOrEquipPick('diamond');
  $pouchBuy.onclick=buyPouch;
  addEventListener('keydown',e=>{
    if(e.code!=='Escape') return;
    if(shopOpen){ e.preventDefault(); closeShop(); return; }
    const workbenchModal=document.querySelector('#lairWorkbenchModal');
    if(lairOpen && workbenchModal && !workbenchModal.hidden){ e.preventDefault(); closeLairWorkbench(); return; }
    if(lairOpen && $lairModuleWindow && !$lairModuleWindow.hidden){ e.preventDefault(); closeLairModule(); return; }
    if(lairOpen){ e.preventDefault(); closeLair(); return; }
    if(mapOpen){ e.preventDefault(); closeMap(); }
  });

  const $mobileModeMenuButton=document.querySelector('#mobileModeMenuButton');
  const $mobileModeBackdrop=document.querySelector('#mobileModeBackdrop');
  const $modeTabsPanel=document.querySelector('.modeTabs');
  const mobileLayoutQuery=window.matchMedia('(max-width:760px), (max-height:560px) and (orientation:landscape)');

  function setMobileModeMenu(open){
    const enabled=mobileLayoutQuery.matches;
    const next=Boolean(open && enabled);
    document.body.classList.toggle('mobile-mode-menu-open',next);
    $mobileModeMenuButton?.setAttribute('aria-expanded',next?'true':'false');
    $mobileModeBackdrop?.setAttribute('aria-hidden',next?'false':'true');
  }
  function closeMobileModeMenu(){ setMobileModeMenu(false); }

  $mobileModeMenuButton?.addEventListener('click',()=>setMobileModeMenu(!document.body.classList.contains('mobile-mode-menu-open')));
  $mobileModeBackdrop?.addEventListener('click',closeMobileModeMenu);
  $modeTabsPanel?.addEventListener('click',e=>{
    if(e.target.closest('.tab')) closeMobileModeMenu();
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape') closeMobileModeMenu();
  });
  mobileLayoutQuery.addEventListener?.('change',()=>closeMobileModeMenu());

  $toastAction.onclick=()=>{ newLock(); $toast.classList.remove('show','actionable'); };
  $tabClassic.onclick=()=>switchMode('classic');
  $tabTarget.onclick=()=>switchMode('target');
  $tabLine.onclick=()=>switchMode('line');
  $tabAlt2.onclick=()=>switchMode('sequence');
  $tabSpecial.onclick=()=>switchMode('special');
  $tabHillsfar.onclick=()=>switchMode('hillsfar');
  $tabMass.onclick=()=>switchMode('mass');
  $tabG1.onclick=()=>switchMode('g1');
  $tabR2.onclick=()=>switchMode('r2');
  $tabSkyrim.onclick=()=>switchMode('skyrim');
  $tabAnach.onclick=()=>switchMode('anach');
  $tabTension.onclick=()=>switchMode('tension');
  $tabResonance.onclick=()=>switchMode('resonance');
  $tabDeduction.onclick=()=>switchMode('deduction');
  $tabComposite.onclick=()=>{
    if(lairOpen) closeLair();
    if(mapOpen) closeMap();
    if(shopOpen) closeShop();
    mode='composite';
    chooseRoundPinSkin();
    chooseRoundPlateSkin();
    syncModePanels('composite');
    updateModeUI();
    startCompositeRound();
    syncModePanels('composite');
    $compositeMode.hidden=false;
    $compositeMode.inert=false;
    $compositeMode.style.setProperty('display','flex','important');
    $compositeMode.style.setProperty('visibility','visible','important');
    $compositeMode.style.setProperty('opacity','1','important');
    renderComposite();
  };
  $tabHeatCold.onclick=()=>switchMode('heatcold');
  $tabDrum.onclick=()=>switchMode('drum');
  $tabScope.onclick=()=>switchMode('scope');
  $hcInput?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();scanHeatCold();}});
  $hcInput?.addEventListener('input',()=>{$hcInput.value=$hcInput.value.replace(/\D/g,'').slice(0,4);});
  document.addEventListener('keydown',handleHeatColdKey);
  $drumWheels?.addEventListener('click',e=>{const b=e.target.closest('[data-drum-i]');if(!b)return;changeDrum(Number(b.dataset.drumI),Number(b.dataset.dir));});
  $drumCheck?.addEventListener('click',checkDrum);
  $drumNew?.addEventListener('click',()=>newLock());
  $drumSound?.addEventListener('click',()=>{drumSoundOn=!drumSoundOn;$drumSound.textContent='Звук: '+(drumSoundOn?'вкл':'выкл');});
  $scopeWheels?.addEventListener('click',e=>{const b=e.target.closest('[data-scope-i]');if(!b)return;changeScope(Number(b.dataset.scopeI),Number(b.dataset.dir));});
  $scopeCheck?.addEventListener('click',checkScope);
  $scopeNew?.addEventListener('click',()=>newLock());
  $hcDialRow?.addEventListener('click',e=>{
    const btn=e.target.closest('[data-hc-step]');
    if(btn){
      adjustHeatColdDigit(Number(btn.dataset.hcIndex),Number(btn.dataset.hcStep));
      return;
    }
    const col=e.target.closest('[data-hc-col]');
    if(col) setHeatColdActive(Number(col.dataset.hcCol));
  });
  $hcDialRow?.addEventListener('focusin',e=>{
    const col=e.target.closest('[data-hc-col]');
    if(col && Number(col.dataset.hcCol)!==hcActiveIndex){
      hcActiveIndex=Number(col.dataset.hcCol);
      renderHeatColdControls();
      focusHeatColdDigit(hcActiveIndex);
    }
  });
  document.querySelectorAll('.difficultyBtn').forEach(btn=>{
    btn.addEventListener('click',()=>setModeDifficulty(Number(btn.dataset.difficulty)));
  });
  addEventListener('resize',()=>renderDifficultyDock(),{passive:true});
  applyPickSkin();
  applyTensionSkin();
  initPickSkinShop();
  initTensionSkinShop();
  initInventoryDrawer();
  applyTablerIcons();
  updateModeUI();
  updateEconomyUI();
  updatePickUI();
  updateShopUI();
  newLock(false);
})();


/* Inventory visual hit testing */
(function(){
  const PAD=14;
  function root(){ return document.querySelector('#inventoryDrawer'); }
  function candidates(x,y){
    const r=root();
    if(!r) return [];
    return [...r.querySelectorAll('.inventoryTool:not(.hidden-slot):not(.breaking-out):not(:disabled)')]
      .map(btn=>{
        const img=btn.querySelector('img');
        if(!img) return null;
        const b=img.getBoundingClientRect();
        const inside=x>=b.left-PAD && x<=b.right+PAD && y>=b.top-PAD && y<=b.bottom+PAD;
        if(!inside) return null;
        const cx=(b.left+b.right)/2, cy=(b.top+b.bottom)/2;
        const dx=x-cx, dy=y-cy;
        return {btn,dist:dx*dx+dy*dy};
      })
      .filter(Boolean)
      .sort((a,b)=>a.dist-b.dist);
  }
  function clearVisualHover(){
    root()?.querySelectorAll('.inventoryTool.visual-hover').forEach(el=>el.classList.remove('visual-hover'));
  }
  document.addEventListener('pointermove',e=>{
    const r=root();
    if(!r){ return; }
    clearVisualHover();
    const hit=candidates(e.clientX,e.clientY)[0];
    if(hit) hit.btn.classList.add('visual-hover');
  },{passive:true});
  document.addEventListener('pointerleave',clearVisualHover,{passive:true});

  // Keep enlarged tool images clickable outside their narrow grid cells.
  document.addEventListener('pointerdown',e=>{
    const r=root();
    if(!r || !r.contains(e.target)) return;
    if(e.target.closest('.inventoryToggle')) return;
    if(e.target.closest('.inventoryTool')) return;
    const hit=candidates(e.clientX,e.clientY)[0];
    if(hit){
      e.preventDefault();
      e.stopPropagation();
      hit.btn.click();
    }
  },true);
})();
