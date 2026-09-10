  // One medallion per mission. Artwork coordinates and icons live in world.js;
  // difficulty and completion stay shared with the order progression.

  // Free exploration is a game rule, independent of the guided journal.
  const FREE_MISSION_ACCESS=window.KeynlockContent.world.missionAccess==='free';
  const MISSION_TIERS=window.KeynlockContent.world.missionTiers;
  const MISSION_PLACES=window.KeynlockContent.world.missionPlaces;

  const MISSION_STORAGE_KEY = 'lockpickMissions';
  const CHAPTER_STORAGE_KEY = 'lockpickChapter';

  function missionNodeId(mode) { return `mission-${mode}`; }
  function missionRunId(mode, tier) { return `${mode}-${tier}`; }
  function missionLabel(place) { return window.KeynlockContent.chapterStory?.orders?.[`${place.mode}-1`]?.title || GameCatalog.get(place.mode)?.title || place.mode; }
  function gameSupportsTier(mode,tier){ return GameCatalog.get(mode)?.difficulty.levels.includes(tier)??false; }

  function preloadMapMission(mode,tier=mapChapter){
    const game=GameCatalog.get(mode);
    if(!game || typeof window.KeynlockPreloadImages!=='function') return Promise.resolve([]);
    const panel=MODE_PANELS[mode];
    const sources=[
      game.location,
      'assets/lock-shell/lock-bg-01.png',
      'assets/lock-shell/locker-up-01.png',
      ...(panel?[...panel.querySelectorAll('img[src]')].map(img=>img.getAttribute('src')):[]),
      ...(LOCK_BODY_SKINS_BY_LEVEL[tier]||[]).map(item=>item.data),
      ...(LOCKER_SKINS_BY_LEVEL[tier]||[]).map(item=>item.data),
      ...pinSkinPoolForLevel(tier),
    ];
    return window.KeynlockPreloadImages(sources);
  }
  window.preloadMapMission=preloadMapMission;

  let missionsDone = {};
  try {
    const saved=STORE.getJSON(MISSION_STORAGE_KEY);
    if (saved && typeof saved === 'object') missionsDone = saved;
  } catch (e) { missionsDone = {}; }
  function saveMissionsDone(){STORE.setJSON(MISSION_STORAGE_KEY,missionsDone);}

  function awardMissionPainting(){
    return window.KeynlockPaintingRewards.award({
      run:activeMissionRun,
      currentRoundId:activeRoundId,
      currentMode:mode,
      missionsDone,
      missionPlaces:MISSION_PLACES,
      paintings:window.KeynlockRestoration?.paintings||[],
      lootTable:window.KeynlockResources?.lootTable
    });
  }

  let mapChapter = Number(STORE.getItem(CHAPTER_STORAGE_KEY)) || 1;
  if (!MISSION_TIERS.includes(mapChapter)) mapChapter = 1;

  function missionCleared(mode, tier) { return !!missionsDone[missionRunId(mode, tier)]; }
  function missionRequiresPicks(mode){return !!GameCatalog.feature(mode,'lock.requiresPick');}
  function playerHasPicks(){return Number(window.KeynlockResources?.state?.picks)>0;}
  function chapterCleared(tier) { return MISSION_PLACES.filter(p=>gameSupportsTier(p.mode,tier)).every(p => missionCleared(p.mode, tier)); }
  // Ordered map variants open a difficulty after the previous one is cleared.
  // The free-play map exposes every supported difficulty from the start.
  function chapterUnlocked(tier) {
    return FREE_MISSION_ACCESS || tier === 1 || chapterCleared(tier - 1);
  }
  function missionUnlocked() { return FREE_MISSION_ACCESS || chapterUnlocked(mapChapter); }

  // Register every place as a map location so travel, the player dot and the
  // info panel all keep working unchanged.
  for (const place of MISSION_PLACES) {
    MAP_LOCATIONS[missionNodeId(place.mode)] = {
      name: missionLabel(place),
      x: place.x,
      y: place.y,
      text: '',
      action: 'mission',
      mode: place.mode,
      district:place.district
    };
  }

  // Adjacency was written for four hand-placed points and does not survive
  // eighteen. While everything is unlocked, anywhere reaches anywhere.
  function rebuildMapConnections() {
    const ids = Object.keys(MAP_LOCATIONS).filter(id => !MAP_LOCATIONS[id].locked);
    for (const id of ids) MAP_CONNECTIONS[id] = ids.filter(other => other !== id);
  }
  rebuildMapConnections();

  function startMapMission(id, options={}) {
    if(options.guided&&window.KeynlockOnboarding?.active){toast('Сначала заверши обучение в логове. Продолжить его можно в «Заказах».');return false;}
    const loc = MAP_LOCATIONS[id];
    if (!loc || loc.action !== 'mission') return;
    if(options.tier!==undefined){
      if(!MISSION_TIERS.includes(options.tier)||!chapterUnlocked(options.tier))return false;
      mapChapter=options.tier;
    }
    if (!missionUnlocked()) { toast('Этот уровень пока закрыт'); return; }
    if(!gameSupportsTier(loc.mode,mapChapter)){toast(`${loc.name}: уровень ${mapChapter} ещё не готов`);return;}
    if(missionRequiresPicks(loc.mode)&&!playerHasPicks()){toast('Нет отмычек · вернись в логово и подготовь новые');return;}

    if (lairOpen) closeLair();
    if (mapOpen) {
      mapOpen = false;
      document.body.classList.remove('map-open');
      $worldMapScreen.hidden = true;
    }

    mapLocation=id;
    STORE.setItem('lockpickMapLocation',id);
    STORE.setItem('lockpickCurrentMode',loc.mode);
    STORE.setItem(CHAPTER_STORAGE_KEY,String(mapChapter));
    // Build the mission round directly. Clicking the active tab is intentionally
    // a no-op during play, so it cannot be used as a reliable round launcher.
    setModeDifficulty(mapChapter, loc.mode, false);
    mode=loc.mode;
    syncModePanels(mode);
    updateModeUI();
    window.KeynlockCampaign?.prepare(loc.mode,options.guided===true,mapChapter);
    newLock(false);
    activeMissionRun = { id: missionRunId(loc.mode, mapChapter), mode: loc.mode, tier: mapChapter, roundId: activeRoundId, guided:options.guided===true, orderId:options.orderId||null, stepId:options.stepId||null };
    window.dispatchEvent(new CustomEvent('keynlock-mission-started',{detail:{...activeMissionRun}}));
    toast(`${loc.name} · уровень ${mapChapter}`);
    return true;
  }
  window.startMapMission = startMapMission;

  // Set when a mission is launched from the map, cleared once it is banked, so a
  // lock opened from the mode tabs does not count as a mission run. The run also
  // has to still match what is on screen: leaving for another game or another
  // difficulty and winning there used to credit the mission you walked away from.
  let activeMissionRun = null;
  function markMissionCleared() {
    const run = activeMissionRun;
    if (!run) return;
    if (gameDefeat.isActive() || !solved || run.roundId !== activeRoundId || mode !== run.mode || getModeDifficulty(run.mode) !== run.tier) { activeMissionRun = null; return; }
    activeMissionRun = null;
    window.dispatchEvent(new CustomEvent('keynlock-mission-cleared',{detail:{...run}}));
    if (missionsDone[run.id]) return;
    missionsDone[run.id] = true;
    saveMissionsDone();
    renderMissionNodes();
  }
  window.markMissionCleared = markMissionCleared;
  window.onKeynlockRoundStarted = roundId => {
    if(activeMissionRun && activeMissionRun.roundId !== roundId) activeMissionRun=null;
  };

  let selectedMapMission=null;

  function renderMissionNodes() {
    const canvas = document.querySelector('#worldMapCanvas');
    if (!canvas) return;
    canvas.querySelectorAll('.missionNode').forEach(n => n.remove());
    const fragment=document.createDocumentFragment();
    for (const place of MISSION_PLACES) {
      const id=missionNodeId(place.mode);
      const open=missionUnlocked()&&gameSupportsTier(place.mode,mapChapter);
      const node=document.createElement('button');
      node.type='button';
      node.className='mapNode mapIconNode missionNode';
      node.classList.toggle('locked',!open);
      node.classList.toggle('no-picks',missionRequiresPicks(place.mode)&&!playerHasPicks());
      node.classList.toggle('selected',id===selectedMapMission);
      node.dataset.location=id;
      node.setAttribute('aria-label',missionLabel(place));
      node.setAttribute('aria-expanded',String(id===selectedMapMission));
      node.setAttribute('aria-controls','mapMissionCard');
      node.style.setProperty('--mx',`${place.x}%`);
      node.style.setProperty('--my',`${place.y}%`);
      const icon=document.createElement('img');
      icon.className='mapMissionIcon';
      icon.src=place.icon;
      icon.alt='';
      icon.draggable=false;
      const label=document.createElement('span');
      label.className='mapNodeLabel';
      label.textContent=missionLabel(place);
      const tiers=document.createElement('span');
      tiers.className='mapNodeTiers';
      for(const tier of MISSION_TIERS){
        const pip=document.createElement('i');
        const supported=gameSupportsTier(place.mode,tier),done=missionCleared(place.mode,tier);
        pip.className='mapTierPip'+(!supported?' unsupported':done?' done':'')+(supported&&tier===mapChapter?' current':'');
        pip.textContent=supported&&done?'✓':'';
        pip.title=`Уровень ${tier}${!supported?' · ещё не готов':done?' · пройден':''}`;
        pip.setAttribute('aria-label',pip.title);
        tiers.append(pip);
      }
      node.append(icon,label,tiers);
      fragment.append(node);
    }
    canvas.append(fragment);
    if(mapOpen)renderWorldMap();
  }

  function selectMapMission(id){
    selectedMapMission=id;
    renderWorldMap();
    if(id){
      const node=document.querySelector(`.missionNode[data-location="${id}"]`);
      node?.scrollIntoView({block:'nearest',inline:'nearest'});
      document.querySelector('#mapMissionCard').scrollTop=0;
    }
  }

  function renderMapLoot(loc,bonus){
    const table=window.KeynlockContent.economy.lockLoot[mapChapter];
    const range=([min,max])=>min===max?String(min):`${min}–${max}`;
    const owned=window.KeynlockPaintingRewards.ownedIds();
    const available=window.KeynlockRestoration.paintings.some(p=>p.district===loc.district&&!owned.includes(p.id));
    const firstClear=!missionCleared(loc.mode,mapChapter);
    const paintingChance=available?(firstClear?100:Math.round(table.paintingChance*100)):0;
    const maxCoins=Math.round(125*table.coinMultiplier)+bonus;
    const root=document.querySelector('#mapCardLoot');
    root.replaceChildren();
    function block(image,value,label,tip){
      const item=document.createElement('div');
      item.className='lootRow mapLootItem';item.tabIndex=0;
      item.dataset.tip=`${label}. ${tip}`;item.setAttribute('aria-label',`${label}: ${value}. ${tip}`);
      const icon=document.createElement('img');icon.className='lootResourceIcon';icon.src=image;icon.alt='';
      const amount=document.createElement('b');
      amount.textContent=value;item.append(icon,amount);root.append(item);
    }
    block('assets/ui/money-ico.png',`до ${maxCoins}`,'Монеты',`Сумма зависит от числа действий. Максимум включает 25 монет за взлом без поломок с множителем уровня.${bonus?` Премия за первое прохождение: ${bonus} монет.`:''}`);
    block('assets/ui/details-ico.png',range(table.parts),'Детали','Из двух деталей можно создать одну отмычку.');
    block('assets/ui/portrait-ico.png',`${paintingChance}%`,'Картина',!available?'Все картины этого района уже найдены.':firstClear?'При первом прохождении гарантирована новая картина из этого района.':'Шанс найти новую картину при повторном прохождении.');
    const reward=window.KeynlockCollection.handleRewardPreview(missionRunId(loc.mode,mapChapter),mapChapter);
    const handleBlock=document.createElement('div');handleBlock.className='mapLootHandle';handleBlock.tabIndex=0;handleBlock.dataset.tip=reward.tip;
    const handleCopy=document.createElement('span'),handleChance=document.createElement('b');
    handleChance.textContent=reward.complete?'Все рукоятки собраны':`Шанс рукоятки ${reward.chance}%`;
    handleCopy.append(handleChance);
    if(!reward.complete){
      const art=document.createElement('span');art.className='lootHandleArt';
      const image=document.createElement('img');image.src=reward.image;image.alt=`Возможная рукоятка: ${reward.name}`;
      art.append(image);handleBlock.append(art);
      const pool=document.createElement('small');pool.textContent=`${reward.collection} · одна из ${reward.count}`;handleCopy.append(pool);
    }
    handleBlock.append(handleCopy);root.append(handleBlock);
    const colors=document.createElement('div');colors.className='mapLootColors';
    const caption=document.createElement('span');caption.textContent=`Компоненты: ${range(table.components)} · случайный цвет`;
    const palette=document.createElement('span');palette.className='mapLootPalette';
    for(const color of window.KeynlockContent.economy.components){
      const dot=document.createElement('img');dot.className='componentIcon';dot.src=color.image;dot.alt='';dot.draggable=false;
      dot.tabIndex=0;dot.title=`${color.material} · ${color.name} компонент`;dot.dataset.tip=dot.title;dot.setAttribute('aria-label',dot.title);palette.append(dot);
    }
    colors.append(caption,palette);root.append(colors);
  }

  document.querySelector('#worldMapCanvas')?.addEventListener('click',event=>{
    const node=event.target.closest?.('.missionNode');
    if(node)selectMapMission(node.dataset.location);
    else if(!event.target.closest?.('.mapNode'))selectMapMission(null);
  });
  document.querySelector('#mapCardClose')?.addEventListener('click',()=>{
    const id=selectedMapMission;
    selectMapMission(null);
    document.querySelector(`.missionNode[data-location="${id}"]`)?.focus();
  });
  document.querySelector('#mapLocationAction')?.addEventListener('click',()=>{
    if(selectedMapMission)startMapMission(selectedMapMission);
  });

  const baseRenderWorldMap=renderWorldMap;
  renderWorldMap=function(){
    baseRenderWorldMap();
    const card=document.querySelector('#mapMissionCard');
    const loc=MAP_LOCATIONS[selectedMapMission];
    card.hidden=!loc;
    $worldMapScreen.classList.toggle('has-mission',!!loc);
    document.querySelectorAll('.missionNode').forEach(node=>{
      const selected=node.dataset.location===selectedMapMission;
      const name=missionLabel(MAP_LOCATIONS[node.dataset.location]);
      node.querySelector('.mapNodeLabel').textContent=name;
      node.setAttribute('aria-label',name);
      node.classList.toggle('selected',selected);
      node.setAttribute('aria-expanded',String(selected));
    });
    if(!loc)return;
    const game=GameCatalog.get(loc.mode);
    const supported=gameSupportsTier(loc.mode,mapChapter);
    const missingPicks=missionRequiresPicks(loc.mode)&&!playerHasPicks();
    const rewardId=missionRunId(loc.mode,mapChapter);
    const bonus=window.KeynlockRewardPolicy.firstClearBonus(rewardId,STORE.getJSON('keynlockFirstClearBonuses',STORE.getJSON('lockpickMissions',{})));
    const artwork=document.querySelector('#mapCardArtwork');
    if(artwork.getAttribute('src')!==game.location)artwork.src=game.location;
    document.querySelector('#mapCardDistrict').textContent=`${DISTRICTS[loc.district].name} · Уровень ${mapChapter}`;
    $mapInfoTitle.textContent=missionLabel(loc);
    const narrative=window.KeynlockContent.chapterStory?.orders?.[rewardId];
    const description=game.description||'Открой механизм, используя подсказки на замке.';
    $mapInfoText.textContent=narrative?.brief||description;
    const mechanic=document.querySelector('#mapCardMechanic');
    mechanic.hidden=!narrative?.brief;
    mechanic.textContent=narrative?.brief?description:'';
    const preview=document.querySelector('#mapPuzzlePreview');
    const previewSource=`assets/map/mechanics/${loc.mode}.${loc.mode==='silhouettes'?'svg':'png'}`;
    if(preview.getAttribute('src')!==previewSource)preview.src=previewSource;
    preview.alt=`Превью головоломки «${game.title}»`;
    renderMapLoot(loc,bonus);
    const status=document.querySelector('#mapCardStatus');
    status.textContent=!supported?'Этот уровень ещё не готов.':!missionUnlocked()?'Этот уровень пока закрыт.':missingPicks?'':missionCleared(loc.mode,mapChapter)?'✓ Уровень пройден. Можно сыграть снова.':missionRequiresPicks(loc.mode)?'Для взлома нужна отмычка.':'Отмычка не требуется.';
    status.hidden=!status.textContent;
    $mapLocationAction.textContent=missingPicks?'Нет отмычек. Подготовь их на верстаке':'Начать взлом';
    $mapLocationAction.hidden=false;
    $mapLocationAction.disabled=!supported||!missionUnlocked()||missingPicks;
  };

  // Banking a mission happens on the solve, which every game funnels through.
  const baseCelebrateForMissions = celebrate;
  celebrate = function () {
    const result=baseCelebrateForMissions();
    if(solved && document.body.classList.contains('game-inactive')) markMissionCleared();
    return result;
  };

  // state.js validated the saved location before these places existed, so a
  // player standing on a mission node was sent home on every reload.
  const savedLocation = STORE.getItem('lockpickMapLocation');
  if (savedLocation && MAP_LOCATIONS[savedLocation] && mapLocation !== savedLocation) {
    mapLocation = savedLocation;
  }

  renderMissionNodes();
  window.addEventListener('keynlock-game-catalog-change',event=>{
    if(event.detail?.path==='readiness'||event.detail?.path==='reset')renderMissionNodes();
  });
  window.addEventListener('keynlock-resources-change',renderMissionNodes);

  window.KeynlockMissions={
    protectsLastPick(){
      const run=activeMissionRun;
      return !!run&&run.id==='wharf-1'&&run.roundId===activeRoundId&&mode==='wharf'&&getModeDifficulty(mode)===1&&!missionCleared('wharf',1);
    },
    start:(mode,tier=1,options={})=>startMapMission(missionNodeId(mode),{...options,tier}),
    resume(){if(!activeMissionRun)return false;if(gameDefeat.isActive()||solved||(missionRequiresPicks(activeMissionRun.mode)&&picks<=0))return this.retry();if(lairOpen)closeLair();if(mapOpen)closeMap(false);return true;},
    retry(){const run=activeMissionRun;return run?startMapMission(missionNodeId(run.mode),{tier:run.tier,guided:run.guided,orderId:run.orderId,stepId:run.stepId}):false;},
    get active(){return activeMissionRun?{...activeMissionRun}:null;}
  };
