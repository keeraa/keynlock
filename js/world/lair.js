  function saveLairIntel(){
    STORE.setJSON('lockpickLairIntel',lairIntel);
  }

  const LAIR_MODULE_TITLES={team:'Выбор персонажа',dialogue:'Диалоги',city:'Анализ города',alchemy:'Алхимия',collection:'Коллекция',restoration:'Мастерская'};
  let lairReturnFocus=null;
  let workbenchReturnFocus=null;

  function pauseLairPortraitVideos(){
    $lairCharacters?.querySelectorAll('video').forEach(video=>video.pause());
  }

  function playLairPortraitVideos(){
    $lairCharacters?.querySelectorAll('video').forEach(video=>video.play().catch(()=>{}));
  }

  function focusLairDialog(dialog,preferred){
    requestAnimationFrame(()=>{
      const target=preferred||dialog?.querySelector('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])');
      target?.focus({preventScroll:true});
    });
  }

  function setLairBackgroundInert(activeDialog){
    const scene=$lairOverlay?.querySelector('.lairScene');
    if(!scene) return;
    [...scene.children].forEach(child=>{
      if(child===activeDialog) child.removeAttribute('inert');
      else if(activeDialog) child.setAttribute('inert','');
      else child.removeAttribute('inert');
    });
  }

  function trapLairDialogFocus(event,dialog){
    if(event.key!=='Tab'||!dialog||dialog.hidden) return;
    const items=[...dialog.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      .filter(el=>el.getClientRects().length);
    if(!items.length){ event.preventDefault(); dialog.focus?.(); return; }
    const first=items[0],last=items.at(-1);
    if(event.shiftKey&&document.activeElement===first){ event.preventDefault(); last.focus(); }
    else if(!event.shiftKey&&document.activeElement===last){ event.preventDefault(); first.focus(); }
  }

  function setLairTab(next){
    if(!Object.hasOwn(LAIR_MODULE_TITLES,next)) return false;
    lairTab=next;
    document.querySelectorAll('.lairPanel').forEach(panel=>panel.classList.toggle('active',panel.dataset.lairPanel===next));
    pauseLairPortraitVideos();
    if(next==='team'){ renderLairTeam(); playLairPortraitVideos(); }
    if(next==='dialogue') renderLairDialogue();
    if(next==='city') renderLairIntel();
    if(next==='restoration') window.KeynlockRestoration?.start();
    // The stations boot on first open and park their loops when they close.
    if(next==='alchemy') window.Alchemy?.start(); else window.Alchemy?.stop();
    return true;
  }

  function renderLairScene(){
    if(!$lairSceneCharacters) return;
    renderInventoryAvatar();
    const activeCharacter=LAIR_CHARACTERS[lairCharacter]||LAIR_CHARACTERS.kai;
    const activePortrait=document.querySelector('#lairActiveCharacterPortrait');
    const teamHotspot=document.querySelector('.lairHotspotTeam');
    const activeName=document.querySelector('#lairActiveCharacterName');
    if(activePortrait){
      activePortrait.src=activeCharacter.portrait;
      activePortrait.alt=activeCharacter.name;
    }
    if(activeName)activeName.textContent=activeCharacter.name;
    if(teamHotspot)teamHotspot.dataset.character=lairCharacter;
    teamHotspot?.setAttribute('aria-label',`Выбор персонажа: ${activeCharacter.name}`);
    if(!$lairSceneCharacters.children.length){
      $lairSceneCharacters.innerHTML=['kai','sai','tik'].map(id=>{
        const ch=LAIR_CHARACTERS[id];
        return `<div class="lairSceneCharacter ${id}" data-lair-character="${id}"><img src="${ch.full}" alt=""></div>`;
      }).join('');
    }
    $lairSceneCharacters.querySelectorAll('[data-lair-character]').forEach(character=>{
      character.classList.toggle('active',character.dataset.lairCharacter===lairCharacter);
    });
  }

  function openLairModule(next){
    if(!$lairModuleWindow||!Object.hasOwn(LAIR_MODULE_TITLES,next)) return false;
    closeLairWorkbench({restoreFocus:false});
    lairReturnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
    $lairModuleTitle.textContent=LAIR_MODULE_TITLES[next];
    $lairModuleWindow.dataset.module=next;
    $lairModuleWindow.hidden=false;
    $lairModuleWindow.classList.add('open');
    setLairBackgroundInert($lairModuleWindow);
    // Alchemy measures and creates part of its scene during the first start.
    // Make the window measurable before booting it; starting while [hidden]
    // produced a zero-size first layout that jumped into place one frame later.
    setLairTab(next);
    focusLairDialog($lairModuleWindow,$lairModuleClose);
    if(next==='alchemy'){
      const stabilize=()=>{
        const moduleBody=$lairModuleWindow.querySelector('.lairModuleBody');
        if(moduleBody) moduleBody.scrollTop=0;
        window.dispatchEvent(new Event('resize'));
      };
      requestAnimationFrame(()=>requestAnimationFrame(stabilize));
      document.fonts?.ready.then(stabilize);
    }
    return true;
  }

  function closeLairModule({restoreFocus=true}={}){
    window.Alchemy?.stop();
    pauseLairPortraitVideos();
    if(!$lairModuleWindow) return;
    $lairModuleWindow.classList.remove('open');
    $lairModuleWindow.hidden=true;
    setLairBackgroundInert(null);
    if(restoreFocus&&lairReturnFocus?.isConnected) lairReturnFocus.focus({preventScroll:true});
    lairReturnFocus=null;
  }

  function openLairWorkbench(){
    const modal=document.querySelector('#lairWorkbenchModal');
    if(!modal) return;
    closeLairModule({restoreFocus:false});
    workbenchReturnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
    modal.hidden=false;
    setLairBackgroundInert(modal);
    focusLairDialog(modal,document.querySelector('#lairWorkbenchClose'));
  }

  function closeLairWorkbench({restoreFocus=true}={}){
    const modal=document.querySelector('#lairWorkbenchModal');
    if(!modal || modal.hidden) return;
    modal.hidden=true;
    setLairBackgroundInert(null);
    if(restoreFocus&&workbenchReturnFocus?.isConnected) workbenchReturnFocus.focus({preventScroll:true});
    workbenchReturnFocus=null;
  }

  document.addEventListener('keydown',event=>{
    if(!$lairModuleWindow?.hidden) trapLairDialogFocus(event,$lairModuleWindow);
    const workbench=document.querySelector('#lairWorkbenchModal');
    if(workbench&&!workbench.hidden) trapLairDialogFocus(event,workbench);
  });

  function lairPortraitMarkup(ch,{small=false}={}){
    if(!ch?.portrait){
      return small
        ? `<span class="lairPersonThumb">${ch.name[0]}</span>`
        : `<div class="lairPortrait"><div class="lairPortraitMark">${ch.name[0]}</div></div>`;
    }
    if(small){
      return `<span class="lairPersonThumb"><img src="${ch.portrait}" alt="${ch.name}"></span>`;
    }
    const art=ch.portraitVideo
      ? `<video class="lairPortraitArt" src="${ch.portraitVideo}" poster="${ch.portrait}" muted loop playsinline preload="metadata" aria-label="${ch.name}"></video>`
      : `<img class="lairPortraitArt" src="${ch.portrait}" alt="${ch.name}">`;
    return `<div class="lairPortrait hasArt"><div class="lairPortraitInner">${art}</div></div>`;
  }

  function renderLairTeam(){
    if(!$lairCharacters) return;
    if(!$lairCharacters.children.length){
      $lairCharacters.innerHTML=Object.entries(LAIR_CHARACTERS).map(([id,ch])=>`
        <button type="button" class="lairCharacter" data-character="${id}">
          ${lairPortraitMarkup(ch)}
          <div class="lairCharacterName">${ch.name}</div>
          <div class="lairCharacterRole">${ch.role}</div>
          <div class="lairCharacterDesc">${ch.desc}</div>
          <div class="lairCharacterSelect"></div>
        </button>`).join('');
      $lairCharacters.addEventListener('click',event=>{
        const card=event.target.closest('[data-character]');
        const id=card?.dataset.character;
        if(!LAIR_CHARACTERS[id]) return;
        lairCharacter=id;
        STORE.setItem('lockpickLairCharacter',id);
        renderLairTeam();
        renderLairScene();
        renderWorldMap();
        renderInventoryAvatar();
      });
    }
    $lairCharacters.querySelectorAll('[data-character]').forEach(card=>{
      const active=card.dataset.character===lairCharacter;
      card.classList.toggle('active',active);
      card.setAttribute('aria-pressed',String(active));
      const label=card.querySelector('.lairCharacterSelect');
      if(label) label.textContent=active?'Активный персонаж':'Выбрать';
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
    if(!info) return;
    const level=lairIntel[lairIntelSelected]||0;
    const revealed=level ? info.notes[Math.min(level-1,info.notes.length-1)] : 'Достоверных сведений пока нет.';
    const maxed=level>=3;
    $lairIntelDetail.innerHTML=`
      <div class="lairIntelDetailTitle">${info.name}</div>
      <div class="lairIntelDistrictColor" style="--district-color:${info.hex}"><i></i>${info.colorName}</div>
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
    DISTRICT_IDS.forEach(id=>{
      const info=LAIR_INTEL_INFO[id];
      const level=lairIntel[id]||0;
      const card=document.createElement('button');
      card.type='button';
      card.className='lairIntelCard'+(id===lairIntelSelected?' active':'');
      card.style.setProperty('--district-color',info.hex);
      const pips=[0,1,2].map(i=>`<span class="${i<level?'on':''}"></span>`).join('');
      card.innerHTML=`
        <div class="lairIntelName"><small>${String(info.order).padStart(2,'0')}</small>${info.name}</div>
        <div class="lairIntelColor"><i></i>${info.colorName}</div>
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
    if(mapOpen){
      mapOpen=false;
      document.body.classList.remove('map-open');
      if($worldMapScreen) $worldMapScreen.hidden=true;
    }
    lairOpen=true;
    document.body.classList.add('lair-open');
    $lairOverlay.hidden=false;
    $lairOverlay.classList.add('open');
    closeLairWorkbench({restoreFocus:false});
    closeLairModule({restoreFocus:false});
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
      const spots = () => document.querySelectorAll('.lairHotspot:not(.lairHotspotTeam)');
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
