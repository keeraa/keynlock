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

