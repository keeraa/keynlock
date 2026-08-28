  function saveLairIntel(){
    STORE.setItem('lockpickLairIntel',JSON.stringify(lairIntel));
  }

  function setLairTab(next){
    lairTab=next;
    document.querySelectorAll('.lairPanel').forEach(panel=>panel.classList.toggle('active',panel.dataset.lairPanel===next));
    if(next==='team') renderLairTeam();
    if(next==='dialogue') renderLairDialogue();
    if(next==='city') renderLairIntel();
    // The stations boot on first open and park their loops when they close.
    if(next==='alchemy') window.Alchemy?.start(); else window.Alchemy?.stop();
  }

  function renderLairScene(){
    if(!$lairSceneCharacters) return;
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
    const titles={team:'Выбор персонажа',dialogue:'Диалоги',city:'Анализ города',alchemy:'Алхимия',collection:'Коллекция'};
    setLairTab(next);
    $lairModuleTitle.textContent=titles[next]||'Логово';
    $lairModuleWindow.hidden=false;
    $lairModuleWindow.classList.add('open');
  }

  function closeLairModule(){
    window.Alchemy?.stop();
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
    // The scene only has a size once the overlay is up, so the opening view is
    // set here rather than at load. Straight away if layout is already there,
    // and on the next frame if it is not — waiting for a frame unconditionally
    // let a fast first touch get overwritten.
    if(!window.resetLairPan?.()) requestAnimationFrame(() => window.resetLairPan?.());
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


  // ===== DRAG TO PAN =====
  // A phone crops both the lair room and the city map hard: the room renders
  // about 1440px wide inside a 375px screen, so most of it is simply unreachable
  // without a way to move the view.
  (function bindPanning(){
    const panQuery = window.matchMedia('(max-width:760px), (pointer:coarse)');
    const DRAG_SLOP = 6;   // px before a press counts as a drag rather than a tap

    function enablePan(surface, apply, range){
      if(!surface) return;
      let pan = 0, startX = 0, startPan = 0, id = null, dragging = false;
      const clamp = () => {
        const limit = range();
        pan = Math.max(-limit, Math.min(limit, pan));
      };
      const paint = () => { clamp(); apply(pan); };
      surface.addEventListener('pointerdown', e => {
        if(!panQuery.matches || e.pointerType === 'mouse') return;
        id = e.pointerId; startX = e.clientX; startPan = pan; dragging = false;
      }, { passive:true });
      surface.addEventListener('pointermove', e => {
        if(id !== e.pointerId) return;
        const dx = e.clientX - startX;
        if(!dragging && Math.abs(dx) < DRAG_SLOP) return;
        dragging = true;
        pan = startPan + dx;
        paint();
      }, { passive:true });
      const release = e => {
        if(id !== e.pointerId) return;
        id = null;
        // Swallow the click a drag would otherwise fire on whatever is beneath.
        if(dragging) surface.addEventListener('click', ev => {
          ev.preventDefault(); ev.stopPropagation();
        }, { capture:true, once:true });
      };
      surface.addEventListener('pointerup', release, { passive:true });
      surface.addEventListener('pointercancel', release, { passive:true });
      addEventListener('resize', paint, { passive:true });
      return { set(v){ pan = v; paint(); }, paint };
    }

    // --- the lair room ---
    const scene = document.querySelector('.lairScene');
    if(scene){
      const chars = document.querySelector('.lairSceneCharacters');
      const spots = () => document.querySelectorAll('.lairHotspot');
      // How far the cover-fitted backdrop hangs off each side.
      const roomRange = () => {
        const vw = scene.clientWidth, vh = scene.clientHeight;
        if(!vw || !vh) return 0;
        const scale = Math.max(vw / 1672, vh / 941);
        return Math.max(0, (1672 * scale - vw) / 2);
      };
      const roomPan = enablePan(scene, v => {
        // Through a custom property: the rule that places this backdrop is
        // !important, so an inline background-position would lose to it.
        scene.style.setProperty('--lair-pan', `${v.toFixed(0)}px`);
        if(chars) chars.style.transform = `translateX(${v.toFixed(0)}px)`;
        spots().forEach(s => { s.style.transform = `translateX(${v.toFixed(0)}px)`; });
      }, roomRange);

      // Open with the room shifted a fifth of a screen to the left, which walks
      // the camera right — that half of the room is where the tables and the
      // board are going, and it is off-screen on a phone when centred.
      window.resetLairPan = () => {
        if(!roomPan || !scene.clientWidth) return false;
        roomPan.set(panQuery.matches ? -scene.clientWidth * 0.2 : 0);
        return true;
      };
    }

    // --- the city map ---
    const canvas = document.querySelector('#worldMapCanvas');
    if(canvas){
      const mapRange = () => {
        const shown = canvas.parentElement ? canvas.parentElement.clientWidth : 0;
        return Math.max(0, (canvas.clientWidth - shown) / 2);
      };
      enablePan(canvas, v => {
        canvas.style.transform = `translateX(${v.toFixed(0)}px)`;
      }, mapRange);
    }
  })();
