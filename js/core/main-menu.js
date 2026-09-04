(function(){
  'use strict';

  const STORE=window.KeynlockSaveStore;
  const SAVE_KEY='keynlockSaveSlots';
  const STARTED_KEY='keynlockGameStarted';
  const SESSION_KEY='keynlockSessionActive';
  const PENDING_KEY='keynlockPendingStart';
  const REDUCE_MOTION_KEY='keynlockReduceMotion';
  const PRESERVED_ON_NEW=new Set([
    SAVE_KEY,
    'keynlockMusicVolume',
    REDUCE_MOTION_KEY,
    'lockpickGameCatalogOverrides',
    'keynlockRecentlyOpenedGames'
  ]);
  const loader=document.querySelector('#bootLoader');
  const menu=document.querySelector('#mainMenu');
  const slotPanel=document.querySelector('#mainMenuSlots');
  const slotTitle=document.querySelector('#mainMenuSlotsTitle');
  const slotList=document.querySelector('#mainMenuSlotList');
  const settingsPanel=document.querySelector('#mainMenuSettingsPanel');
  const continueButton=document.querySelector('#mainMenuContinue');
  const saveButton=document.querySelector('#mainMenuSave');
  const music=document.querySelector('#mainMenuMusicVolume');
  const musicValue=document.querySelector('#mainMenuMusicVolumeValue');
  const reduceMotion=document.querySelector('#mainMenuReduceMotion');
  let ready=false;
  let slotMode='load';
  let openedAt=0;

  function readSlots(){
    try{
      const parsed=STORE.getJSON(SAVE_KEY,[]);
      return Array.from({length:3},(_,index)=>parsed[index]||null);
    }catch(_){ return [null,null,null]; }
  }

  function writeSlots(slots){
    STORE.setJSON(SAVE_KEY,slots);
  }

  function isGameKey(key){
    return (key.startsWith('lockpick')||key.startsWith('keynlock'))&&!PRESERVED_ON_NEW.has(key);
  }

  function gameSnapshot(){
    const state={};
    STORE.keys().filter(isGameKey).forEach(key=>{state[key]=STORE.getItem(key);});
    state[STARTED_KEY]='1';
    return state;
  }

  function hasProgress(){
    if(STORE.getItem(STARTED_KEY)==='1')return true;
    return ['lockpickBalance','keynlockResources','lockpickMissionsDone','lockpickMapLocation']
      .some(key=>STORE.getItem(key)!==null);
  }

  function applyMotionSetting(){
    const reduced=STORE.getItem(REDUCE_MOTION_KEY)==='1';
    document.documentElement.classList.toggle('reduce-motion',reduced);
    if(reduceMotion)reduceMotion.checked=reduced;
  }

  function syncButtons(){
    const active=sessionStorage.getItem(SESSION_KEY)==='1';
    if(continueButton)continueButton.disabled=!hasProgress();
    if(saveButton)saveButton.disabled=!active;
  }

  function showRoot(){
    if(menu)menu.hidden=false;
    if(slotPanel)slotPanel.hidden=true;
    if(settingsPanel)settingsPanel.hidden=true;
    syncButtons();
  }

  function hideMenu(){
    if(!ready)return;
    STORE.setItem(STARTED_KEY,'1');
    sessionStorage.setItem(SESSION_KEY,'1');
    document.body.classList.remove('assets-loading','main-menu-open');
    loader?.classList.add('bootLoaderHidden');
    window.dispatchEvent(new CustomEvent('keynlock:play'));
    const finish=()=>{
      if(loader?.classList.contains('bootLoaderHidden'))loader.hidden=true;
    };
    loader?.addEventListener('transitionend',finish,{once:true});
    setTimeout(finish,550);
  }

  function openMenu(){
    if(!ready||!loader)return;
    loader.hidden=false;
    loader.classList.remove('bootLoaderHidden');
    document.body.classList.add('assets-loading','main-menu-open');
    openedAt=performance.now();
    showRoot();
  }

  function resetGameState(){
    STORE.keys().filter(isGameKey).forEach(key=>STORE.removeItem(key));
  }

  function startNewGame(){
    if(hasProgress()&&!confirm('Начать новую игру? Несохранённый прогресс будет потерян.'))return;
    resetGameState();
    sessionStorage.setItem(PENDING_KEY,'new');
    sessionStorage.setItem(SESSION_KEY,'1');
    location.reload();
  }

  function renderSlots(mode){
    slotMode=mode;
    if(menu)menu.hidden=true;
    if(settingsPanel)settingsPanel.hidden=true;
    if(slotPanel)slotPanel.hidden=false;
    if(slotTitle)slotTitle.textContent=mode==='save'?'Сохранить игру':'Загрузить игру';
    if(!slotList)return;
    const slots=readSlots();
    slotList.replaceChildren();
    slots.forEach((slot,index)=>{
      const button=document.createElement('button');
      button.type='button';
      button.className='mainMenuSlot';
      button.dataset.slot=String(index);
      button.disabled=mode==='load'&&!slot;
      const date=slot?.savedAt?new Date(slot.savedAt):null;
      const stamp=date&&!Number.isNaN(date.valueOf())?date.toLocaleString('ru-RU',{dateStyle:'short',timeStyle:'short'}):'';
      const coins=Number(slot?.summary?.coins)||0;
      button.innerHTML=`<strong>Слот ${index+1}</strong><time>${stamp}</time><small>${slot?`${slot.summary?.place||'Кийенлок'} · ${coins} монет`:'Пустой слот'}</small>`;
      slotList.appendChild(button);
    });
  }

  function saveToSlot(index){
    const slots=readSlots();
    if(slots[index]&&!confirm(`Перезаписать слот ${index+1}?`))return;
    const place=STORE.getItem('lockpickMapLocation')||'lair';
    slots[index]={
      version:1,
      savedAt:new Date().toISOString(),
      summary:{place:place==='lair'?'Логово':place,coins:Number(STORE.getItem('lockpickBalance'))||0},
      state:gameSnapshot()
    };
    writeSlots(slots);
    renderSlots('save');
  }

  function loadFromSlot(index){
    const slot=readSlots()[index];
    if(!slot?.state)return;
    resetGameState();
    STORE.restore(slot.state);
    sessionStorage.setItem(PENDING_KEY,'load');
    sessionStorage.setItem(SESSION_KEY,'1');
    location.reload();
  }

  function openSettings(){
    if(menu)menu.hidden=true;
    if(slotPanel)slotPanel.hidden=true;
    if(settingsPanel)settingsPanel.hidden=false;
    const value=window.KeynlockAudio?.getMusicVolume?.() ?? Number(STORE.getItem('keynlockMusicVolume')||28);
    if(music)music.value=String(value);
    if(musicValue)musicValue.value=`${value}%`;
    applyMotionSetting();
  }

  document.querySelector('#mainMenuNew')?.addEventListener('click',startNewGame);
  continueButton?.addEventListener('click',hideMenu);
  saveButton?.addEventListener('click',()=>renderSlots('save'));
  document.querySelector('#mainMenuLoad')?.addEventListener('click',()=>renderSlots('load'));
  document.querySelector('#mainMenuSettings')?.addEventListener('click',openSettings);
  document.querySelector('#gameSettingsButton')?.addEventListener('click',openMenu);
  document.querySelectorAll('[data-main-menu-back]').forEach(button=>button.addEventListener('click',showRoot));
  slotList?.addEventListener('click',event=>{
    const button=event.target.closest?.('[data-slot]');
    if(!button)return;
    const index=Number(button.dataset.slot);
    if(slotMode==='save')saveToSlot(index);else loadFromSlot(index);
  });
  music?.addEventListener('input',()=>{
    const value=window.KeynlockAudio?.setMusicVolume?.(Number(music.value)/100)??Number(music.value);
    STORE.setItem('keynlockMusicVolume',String(value));
    if(musicValue)musicValue.value=`${value}%`;
  });
  reduceMotion?.addEventListener('change',()=>{
    STORE.setItem(REDUCE_MOTION_KEY,reduceMotion.checked?'1':'0');
    applyMotionSetting();
  });
  addEventListener('keydown',event=>{
    if(event.code!=='Escape')return;
    if(document.body.classList.contains('main-menu-open')){
      event.preventDefault();
      event.stopImmediatePropagation();
      if(performance.now()-openedAt<300)return;
      if(!menu?.hidden&&sessionStorage.getItem(SESSION_KEY)==='1')hideMenu();else showRoot();
      return;
    }
    const blocked=['lair-open','map-open','prototype-mechanic-open','game-settings-open','game-defeat'];
    if(blocked.some(name=>document.body.classList.contains(name)))return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openMenu();
  },true);

  applyMotionSetting();
  window.KeynlockMainMenu={
    assetsReady(){
      ready=true;
      showRoot();
      const pending=sessionStorage.getItem(PENDING_KEY);
      if(pending){
        sessionStorage.removeItem(PENDING_KEY);
        hideMenu();
      }else{
        document.body.classList.add('main-menu-open');
      }
    },
    open:openMenu
  };
})();
