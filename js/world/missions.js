  // ===== MAP MISSIONS =====
  // One node per lock game, difficulty as a chapter: chapter 1 plays every place
  // at difficulty 1, chapter 2 replays the same places at 2, and so on. Keeping
  // the map to one node per game is what makes 18 games x 3 difficulties fit on
  // a single drawing at all.

  // Open everything while the game is being built. Flip this off to let the
  // chapter gate below decide.
  const MISSIONS_UNLOCK_ALL = true;

  const MISSION_TIERS = [1, 2, 3];
  // Position is the only thing authored per game; labels come from the catalog.
  const MISSION_PLACES = [
    { mode: 'classic',   x: 28, y: 62 },
    { mode: 'sequence',  x: 38, y: 30 },
    { mode: 'special',   x: 34, y: 47 },
    { mode: 'hillsfar',  x: 26, y: 28 },
    { mode: 'mass',      x: 42, y: 24 },
    { mode: 'g1',        x: 44, y: 44 },
    { mode: 'skyrim',    x: 44, y: 64 },
    { mode: 'anach',     x: 55, y: 63 },
    { mode: 'tension',   x: 62, y: 33 },
    { mode: 'resonance', x: 70, y: 28 },
    { mode: 'deduction', x: 78, y: 38 },
    { mode: 'composite', x: 72, y: 52 },
    { mode: 'heatcold',  x: 80, y: 60 },
    { mode: 'drum',      x: 64, y: 72 },
    { mode: 'scope',     x: 56, y: 80 },
    { mode: 'oblivion',  x: 79, y: 20 },
    { mode: 'watchmen',  x: 86, y: 34 },
    { mode: 'museum',    x: 25, y: 82 },
    { mode: 'mass2',     x: 76, y: 82 },
    { mode: 'pipeline',  x: 14, y: 40 },
    { mode: 'wharf',     x: 11, y: 61 },
    { mode: 'thiefds',   x: 48, y: 15 },
    { mode: 'kingdomcome', x: 64, y: 16 },
    { mode: 'thief12',   x: 88, y: 49 },
    { mode: 'fallout',   x: 88, y: 70 },
    { mode: 'anachlab',  x: 57, y: 86 },
    { mode: 'masshack',  x: 96, y: 59 },
    { mode: 'pathologic', x: 40, y: 82 },
    { mode: 'bioshock2', x: 17, y: 23 },
    { mode: 'alphaprotocol', x: 31, y: 17 }
  ];

  const MISSION_STORAGE_KEY = 'lockpickMissions';
  const CHAPTER_STORAGE_KEY = 'lockpickChapter';

  function missionNodeId(mode) { return `mission-${mode}`; }
  function missionRunId(mode, tier) { return `${mode}-${tier}`; }
  function missionLabel(place) { return GameCatalog.get(place.mode)?.title || place.mode; }
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
    const saved = JSON.parse(STORE.getItem(MISSION_STORAGE_KEY) || 'null');
    if (saved && typeof saved === 'object') missionsDone = saved;
  } catch (e) { missionsDone = {}; }
  function saveMissionsDone() { STORE.setItem(MISSION_STORAGE_KEY, JSON.stringify(missionsDone)); }

  let mapChapter = Number(STORE.getItem(CHAPTER_STORAGE_KEY)) || 1;
  if (!MISSION_TIERS.includes(mapChapter)) mapChapter = 1;

  function missionCleared(mode, tier) { return !!missionsDone[missionRunId(mode, tier)]; }
  function chapterCleared(tier) { return MISSION_PLACES.filter(p=>gameSupportsTier(p.mode,tier)).every(p => missionCleared(p.mode, tier)); }
  // A chapter opens once the one before it is finished. With the dev flag on,
  // every chapter and every place is reachable from the start.
  function chapterUnlocked(tier) {
    return MISSIONS_UNLOCK_ALL || tier === 1 || chapterCleared(tier - 1);
  }
  function missionUnlocked() { return MISSIONS_UNLOCK_ALL || chapterUnlocked(mapChapter); }

  function setMapChapter(tier) {
    if (!MISSION_TIERS.includes(tier) || !chapterUnlocked(tier)) {
      if (!chapterUnlocked(tier)) toast('Эта глава ещё закрыта');
      return;
    }
    mapChapter = tier;
    STORE.setItem(CHAPTER_STORAGE_KEY, String(tier));
    renderMissionNodes();
    renderWorldMap();
  }

  // Register every place as a map location so travel, the player dot and the
  // info panel all keep working unchanged.
  for (const place of MISSION_PLACES) {
    MAP_LOCATIONS[missionNodeId(place.mode)] = {
      name: missionLabel(place),
      x: place.x,
      y: place.y,
      text: '',
      action: 'mission',
      mode: place.mode
    };
  }

  // Adjacency was written for four hand-placed points and does not survive
  // eighteen. While everything is unlocked, anywhere reaches anywhere.
  function rebuildMapConnections() {
    const ids = Object.keys(MAP_LOCATIONS).filter(id => !MAP_LOCATIONS[id].locked);
    for (const id of ids) MAP_CONNECTIONS[id] = ids.filter(other => other !== id);
  }
  rebuildMapConnections();

  function startMapMission(id) {
    const loc = MAP_LOCATIONS[id];
    if (!loc || loc.action !== 'mission') return;
    if (!missionUnlocked()) { toast('Эта глава ещё закрыта'); return; }
    if(!gameSupportsTier(loc.mode,mapChapter)){toast(`${loc.name}: уровень ${mapChapter} ещё не готов`);return;}

    if (lairOpen) closeLair();
    if (mapOpen) {
      mapOpen = false;
      document.body.classList.remove('map-open');
      $worldMapScreen.hidden = true;
    }

    // Build the mission round directly. Clicking the active tab is intentionally
    // a no-op during play, so it cannot be used as a reliable round launcher.
    setModeDifficulty(mapChapter, loc.mode, false);
    mode=loc.mode;
    syncModePanels(mode);
    updateModeUI();
    newLock(false);
    activeMissionRun = { id: missionRunId(loc.mode, mapChapter), mode: loc.mode, tier: mapChapter, roundId: activeRoundId };
    toast(`${loc.name} · глава ${mapChapter}`);
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
    if (!solved || run.roundId !== activeRoundId || mode !== run.mode || getModeDifficulty(run.mode) !== run.tier) { activeMissionRun = null; return; }
    activeMissionRun = null;
    if (missionsDone[run.id]) return;
    missionsDone[run.id] = true;
    saveMissionsDone();
    renderMissionNodes();
  }
  window.markMissionCleared = markMissionCleared;
  window.onKeynlockRoundStarted = roundId => {
    if(activeMissionRun && activeMissionRun.roundId !== roundId) activeMissionRun=null;
  };

  function renderMissionNodes() {
    const canvas = document.querySelector('#worldMapCanvas');
    if (!canvas) return;
    canvas.querySelectorAll('.mapNode.missionNode').forEach(n => n.remove());
    const player = canvas.querySelector('#mapPlayer');

    for (const place of MISSION_PLACES) {
      const id = missionNodeId(place.mode);
      const supported=gameSupportsTier(place.mode,mapChapter);
      const open = missionUnlocked()&&supported;
      const node = document.createElement('button');
      node.type = 'button';
      node.className = 'mapNode mapPreviewNode missionNode mission ' + (open ? 'accessible' : 'locked');
      node.dataset.location = id;
      node.disabled=!open;
      node.setAttribute('aria-disabled', open?'false':'true');
      node.style.setProperty('--mx', `${place.x}%`);
      node.style.setProperty('--my', `${place.y}%`);

      const preview=document.createElement('span');
      preview.className='mapMissionPreview';
      const previewImage=document.createElement('img');
      previewImage.src=`assets/map/mechanics/${place.mode}.png`;
      previewImage.addEventListener('error',()=>{
        previewImage.src=GameCatalog.get(place.mode).location;
      },{once:true});
      previewImage.alt='';
      previewImage.loading='lazy';
      const readiness=document.createElement('span');
      readiness.className='mapMissionReadiness';
      readiness.textContent=String(GameCatalog.get(place.mode).readiness);
      readiness.title='Готовность игры';
      preview.append(previewImage,readiness);
      const label = document.createElement('span');
      label.className = 'mapNodeLabel';
      label.textContent = missionLabel(place).toLocaleUpperCase('ru-RU');
      const tiers = document.createElement('span');
      tiers.className = 'mapNodeTiers';
      for (const tier of MISSION_TIERS) {
        const pip = document.createElement('i');
        const tierSupported=gameSupportsTier(place.mode,tier);
        pip.className = 'mapTierPip' + (!tierSupported?' unsupported':missionCleared(place.mode,tier) ? ' done' : '')
          + (tierSupported&&tier === mapChapter ? ' current' : '');
        pip.title=tierSupported?`Уровень ${tier}`:`Уровень ${tier} не готов`;
        tiers.appendChild(pip);
      }
      preview.appendChild(tiers);
      node.append(preview,label);
      canvas.insertBefore(node, player || null);
    }
  }

  function renderChapterPicker() {
    const canvas = document.querySelector('#worldMapCanvas');
    if (!canvas || canvas.querySelector('.mapChapterPicker')) return;
    const box = document.createElement('div');
    box.className = 'mapChapterPicker';
    const caption = document.createElement('span');
    caption.className = 'mapChapterCaption';
    caption.textContent = 'Глава';
    box.appendChild(caption);
    for (const tier of MISSION_TIERS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mapChapterBtn';
      btn.dataset.chapter = String(tier);
      btn.textContent = String(tier);
      btn.addEventListener('click', () => setMapChapter(tier));
      box.appendChild(btn);
    }
    canvas.appendChild(box);
  }

  function syncChapterPicker() {
    document.querySelectorAll('.mapChapterBtn').forEach(btn => {
      const tier = Number(btn.dataset.chapter);
      btn.classList.toggle('active', tier === mapChapter);
      btn.classList.toggle('locked', !chapterUnlocked(tier));
    });
  }

  // Nodes are built after init.js binds its handlers, so the map delegates.
  document.querySelector('#worldMapCanvas')?.addEventListener('click', e => {
    const node = e.target.closest?.('.mapNode.missionNode');
    if (node) travelToMapLocation(node.dataset.location);
  });

  const baseRenderWorldMap = renderWorldMap;
  renderWorldMap = function () {
    baseRenderWorldMap();
    const loc = MAP_LOCATIONS[mapLocation];
    if (loc?.action === 'mission' && $mapInfoText) {
      const supported=gameSupportsTier(loc.mode,mapChapter);
      const cleared = missionCleared(loc.mode, mapChapter);
      const description=GameCatalog.get(loc.mode)?.description;
      $mapInfoText.textContent = supported?`${description||'Головоломка с замком.'} Сложность ${mapChapter}. `
        + (cleared ? 'Уже пройден в этой главе. ' : '')
        + 'Нажми на точку ещё раз, чтобы начать.':`Уровень ${mapChapter} для этой игры ещё не готов.`;
    }
    syncChapterPicker();
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

  renderChapterPicker();
  renderMissionNodes();
  window.addEventListener('keynlock-game-catalog-change',event=>{
    if(event.detail?.path==='readiness'||event.detail?.path==='reset')renderMissionNodes();
  });

  // Dev helper: shift-click the artwork to print map coordinates for a node.
  document.querySelector('#worldMapCanvas')?.addEventListener('click', e => {
    if (!e.shiftKey) return;
    const canvas = document.querySelector('#worldMapCanvas');
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    console.log(`x: ${x.toFixed(0)}, y: ${y.toFixed(0)}`);
  }, true);
