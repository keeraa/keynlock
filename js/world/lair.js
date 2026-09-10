  function saveLairIntel(){
    STORE.setJSON('lockpickLairIntel',lairIntel);
  }

  const LAIR_MODULE_TITLES={team:'Выбор персонажа',dialogue:'Диалоги',city:'Анализ города',alchemy:'Алхимия',collection:'Коллекция',restoration:'Мастерская'};
  const LAIR_WORKSPACES=new Set(['alchemy','collection','restoration']);
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
    const workspaceOpen=!!activeDialog?.classList.contains('lairWorkspace');
    document.querySelectorAll('#campaignButton,.hudHelpButton,#lairTraining').forEach(control=>{
      control.inert=workspaceOpen;
    });
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
    const selector='button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const workspace=dialog.classList.contains('lairWorkspace');
    const header=workspace&&document.querySelector(`#${dialog.dataset.module}TopHudClose`)?.closest('.screenTopHud');
    const items=[...(header?.querySelectorAll(selector)||[]),...dialog.querySelectorAll(selector),...document.querySelectorAll('#saveFailureNotice:not([hidden]) button')]
      .filter(el=>el.getClientRects().length&&!el.closest('[inert]')&&getComputedStyle(el).visibility!=='hidden');
    if(!items.length){ event.preventDefault(); dialog.focus?.(); return; }
    if(workspace){
      const index=items.indexOf(document.activeElement);
      const next=index<0?(event.shiftKey?items.length-1:0):(index+(event.shiftKey?-1:1)+items.length)%items.length;
      event.preventDefault();
      items[next].focus({preventScroll:true});
      return;
    }
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
    const activeCharacter=LAIR_CHARACTERS[lairCharacter]||LAIR_CHARACTERS.sai;
    const activePortrait=document.querySelector('#lairActiveCharacterPortrait');
    const teamHotspot=document.querySelector('.lairHotspotTeam');
    if(activePortrait){
      activePortrait.src=activeCharacter.portrait;
      activePortrait.alt=activeCharacter.name;
    }
    if(teamHotspot)teamHotspot.dataset.character=lairCharacter;
    teamHotspot?.setAttribute('aria-label',`Выбор персонажа: ${activeCharacter.name}`);
    if(!$lairSceneCharacters.children.length){
      $lairSceneCharacters.innerHTML=['kai','sai','tik'].map(id=>{
        const ch=LAIR_CHARACTERS[id];
        return `<div class="lairSceneCharacter ${id}" data-lair-character="${id}"><img src="${ch.full}" alt=""></div>`;
      }).join('');
    }
    // Kai stands behind the restoration table, within the room's layers.
    const kai=$lairSceneCharacters.querySelector('[data-lair-character="kai"]');
    if(kai)$lairOverlay.querySelector('.lairRoom').append(kai);
    $lairOverlay.querySelectorAll('[data-lair-character]').forEach(character=>{
      character.classList.toggle('active',character.dataset.lairCharacter===lairCharacter);
    });
  }

  function openLairModule(next){
    if(!$lairModuleWindow||!Object.hasOwn(LAIR_MODULE_TITLES,next)) return false;
    closeLairWorkbench({restoreFocus:false});
    lairReturnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
    $lairModuleTitle.textContent=LAIR_MODULE_TITLES[next];
    $lairModuleWindow.dataset.module=next;
    $lairModuleWindow.classList.toggle('lairWorkspace',LAIR_WORKSPACES.has(next));
    $lairModuleWindow.hidden=false;
    $lairModuleWindow.classList.add('open');
    setLairBackgroundInert($lairModuleWindow);
    // Alchemy measures and creates part of its scene during the first start.
    // Make the window measurable before booting it; starting while [hidden]
    // produced a zero-size first layout that jumped into place one frame later.
    setLairTab(next);
    focusLairDialog($lairModuleWindow,LAIR_WORKSPACES.has(next)
      ?document.querySelector(`#${next}TopHudClose`):$lairModuleClose);
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
    const wasOpen=!$lairModuleWindow.hidden;
    $lairModuleWindow.classList.remove('open');
    $lairModuleWindow.hidden=true;
    setLairBackgroundInert(null);
    if(restoreFocus&&lairReturnFocus?.isConnected) lairReturnFocus.focus({preventScroll:true});
    lairReturnFocus=null;
    if(wasOpen)window.dispatchEvent(new Event('keynlock-lair-opened'));
  }

  function openLairWorkbench(){
    const modal=document.querySelector('#lairWorkbenchModal');
    if(!modal) return;
    closeLairModule({restoreFocus:false});
    workbenchReturnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
    window.KeynlockResources?.render();
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
    window.dispatchEvent(new Event('keynlock-lair-opened'));
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
    if(gameDefeat.isActive()){
      gameDefeat.reset();
      setGameInactive(false);
    }
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
    window.dispatchEvent(new Event('keynlock-lair-opened'));
  }

  function closeLair(){
    if(!lairOpen || !$lairOverlay) return;
    closeLairWorkbench();
    closeLairModule();
    const supply=window.KeynlockResources?.prepareRound?.();
    if(supply && picks>0 && !solved){picks=supply.picks;pickCapacity=Math.max(pickCapacity,picks);updatePickUI();}
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


  // Only the distant view moves. The room masks both scenery and rain so they
  // cannot leak over the sill, even while the whole room is panned on mobile.
  (function bindWindowWeather(){
    const scene=document.querySelector('.lairScene');
    const room=scene?.querySelector('.lairRoom');
    const viewport=room?.querySelector('.lairWindow');
    const view=viewport?.querySelector('.lairWindowView');
    const canvas=viewport?.querySelector('canvas');
    const ctx=canvas?.getContext('2d');
    if(!ctx||!view)return;
    const motionQuery=window.matchMedia('(prefers-reduced-motion: reduce)');
    const drops=Array.from({length:130},()=>({
      x:Math.random(),y:Math.random(),speed:.65+Math.random()*.7,
      length:.025+Math.random()*.045,alpha:.24+Math.random()*.30
    }));
    let width=0,height=0,frame=0,last=0,x=0,y=0,targetX=0,targetY=0;
    // Reduced motion softens the requested weather rather than removing it.
    const reduced=()=>motionQuery.matches||document.documentElement.classList.contains('reduce-motion');
    const visible=()=>lairOpen&&!$lairOverlay.hidden&&!room.inert&&!document.hidden&&!document.body.classList.contains('main-menu-open');

    function paintRain(dt){
      ctx.clearRect(0,0,width,height);
      ctx.lineWidth=1.15;
      for(const drop of drops){
        drop.y+=dt*drop.speed;
        drop.x-=dt*drop.speed*.13;
        if(drop.y>1.08){drop.y=-.08;drop.x=Math.random();}
        if(drop.x<-.03)drop.x=1.03;
        ctx.strokeStyle=`rgba(183,216,242,${drop.alpha})`;
        ctx.beginPath();
        ctx.moveTo(drop.x*width,drop.y*height);
        ctx.lineTo((drop.x+.13*drop.length)*width,(drop.y-drop.length)*height);
        ctx.stroke();
      }
    }
    function tick(now){
      frame=0;
      if(!visible()){last=0;return;}
      const dt=last?Math.min((now-last)/1000,.05):0;
      last=now;
      const gentle=reduced();
      const ease=1-Math.exp(-dt*(gentle?4:7));
      x+=(targetX-x)*ease;y+=(targetY-y)*ease;
      const distance=gentle?.6:1;
      view.style.transform=`translate3d(${x*width*.032*distance}px,${y*height*.024*distance}px,0)`;
      paintRain(dt*(gentle?.55:1));
      frame=requestAnimationFrame(tick);
    }
    function refresh(){
      if(frame)cancelAnimationFrame(frame);
      frame=0;last=0;
      if(visible())frame=requestAnimationFrame(tick);
    }
    new ResizeObserver(()=>{
      width=viewport.clientWidth;height=viewport.clientHeight;
      const dpr=Math.min(window.devicePixelRatio||1,1.5);
      canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
      ctx.setTransform(dpr,0,0,dpr,0,0);
      refresh();
    }).observe(viewport);
    scene.addEventListener('pointermove',event=>{
      if(event.pointerType==='touch'||!visible())return;
      targetX=1-2*Math.max(0,Math.min(1,event.clientX/window.innerWidth));
      targetY=1-2*Math.max(0,Math.min(1,event.clientY/window.innerHeight));
    },{passive:true});
    scene.addEventListener('pointerleave',()=>{targetX=targetY=0;});
    window.addEventListener('keynlock-lair-opened',refresh);
    document.addEventListener('visibilitychange',refresh);
    motionQuery.addEventListener('change',refresh);
    const observer=new MutationObserver(refresh);
    observer.observe(room,{attributes:true,attributeFilter:['inert']});
    observer.observe($lairOverlay,{attributes:true,attributeFilter:['hidden']});
    observer.observe(document.body,{attributes:true,attributeFilter:['class']});
    observer.observe(document.documentElement,{attributes:true,attributeFilter:['class']});
  })();

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
        if(!range())return;
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
      return { set(v){ pan = v; paint(); }, shift(v){ const before=pan; pan += v; paint(); return pan!==before; }, paint };
    }

    // Run only while a mouse is near an overflowing edge. Pressing stops the
    // camera before pointerup so an object cannot slide out from under a click.
    function enableEdgePan(surface,available,shift){
      if(!surface)return;
      let frame=0,lastTime=0,speed=0,remainder=0;
      const stop=()=>{cancelAnimationFrame(frame);frame=0;lastTime=0;speed=0;remainder=0;};
      const tick=time=>{
        frame=0;
        if(!available()){stop();return;}
        const dt=lastTime?Math.min(32,time-lastTime)/1000:0;
        lastTime=time;
        const distance=speed*dt+remainder;
        const pixels=Math.trunc(distance);
        remainder=distance-pixels;
        if(pixels&&!shift(pixels)){stop();return;}
        frame=requestAnimationFrame(tick);
      };
      surface.addEventListener('pointermove',event=>{
        if(event.pointerType!=='mouse'||event.buttons||!available()){stop();return;}
        const rect=surface.getBoundingClientRect();
        const edge=Math.min(80,rect.width*.15);
        const x=event.clientX-rect.left;
        const strength=x<edge?-(1-x/edge):x>rect.width-edge?1-(rect.width-x)/edge:0;
        if(!strength){stop();return;}
        speed=Math.sign(strength)*Math.min(1,Math.abs(strength))**2*420;
        if(!frame)frame=requestAnimationFrame(tick);
      },{passive:true});
      surface.addEventListener('pointerleave',stop);
      window.addEventListener('pointerdown',stop,{capture:true,passive:true});
      window.addEventListener('keydown',stop,{capture:true});
      window.addEventListener('blur',stop);
      window.addEventListener('resize',stop,{passive:true});
      document.addEventListener('visibilitychange',stop);
    }

    // --- the lair room ---
    const scene = document.querySelector('.lairScene');
    if(scene){
      const room=scene.querySelector('.lairRoom');
      // How far the cover-fitted backdrop hangs off each side.
      const roomRange = () => {
        const vw = scene.clientWidth, vh = scene.clientHeight;
        if(!vw || !vh) return 0;
        const scale = Math.max(vw / 1672, vh / 941);
        return Math.max(0, (1672 * scale - vw) / 2);
      };
      const roomPan = enablePan(room, v => {
        // Through a custom property: the rule that places this backdrop is
        // !important, so an inline background-position would lose to it.
        scene.style.setProperty('--lair-pan', `${v.toFixed(0)}px`);
        if($lairSceneCharacters)$lairSceneCharacters.style.transform=`translateX(${v.toFixed(0)}px)`;
        // Room children already inherit its camera movement. Only scene-level
        // hotspots need an additional translation.
        scene.querySelectorAll(':scope > .lairHotspot:not(.lairHotspotTeam)').forEach(spot=>{spot.style.transform=`translateX(${v.toFixed(0)}px)`;});

      }, roomRange);

      enableEdgePan(scene,()=>lairOpen&&!room.inert&&!document.hidden&&!document.body.classList.contains('main-menu-open')&&roomRange()>1,delta=>roomPan.shift(-delta));

      room?.addEventListener('focusin',event=>{
        const object=event.target.closest('.lairRoomObject');
        // Pointer focus must not move the pressed object before its click.
        if(!object?.matches(':focus-visible'))return;
        const rect=object.getBoundingClientRect();
        if(rect.left<0||rect.right>scene.clientWidth)roomPan?.shift(scene.clientWidth/2-(rect.left+rect.width/2));
      });

      // Open with the room shifted a fifth of a screen to the left, which walks
      // the camera right — that half of the room is where the tables and the
      // board are going, and it is off-screen on a phone when centred.
      window.resetLairPan = () => {
        if(!roomPan || !scene.clientWidth) return false;
        roomPan.set(panQuery.matches ? -scene.clientWidth * 0.2 : 0);
        return true;
      };
    }

    // Native scrolling clamps touch panning to the artwork edges. Mouse drag
    // uses the same scroll offsets, so it cannot reveal empty side bands.
    const mapViewport=document.querySelector('.worldMapDialog');
    if(mapViewport){
      enableEdgePan(mapViewport,()=>mapOpen&&!document.hidden&&mapViewport.scrollWidth>mapViewport.clientWidth+1,delta=>{
        const before=mapViewport.scrollLeft;
        mapViewport.scrollLeft+=delta;
        return mapViewport.scrollLeft!==before;
      });
      let drag=null;
      mapViewport.addEventListener('pointerdown',event=>{
        if(event.pointerType!=='mouse'||event.button!==0||event.target.closest('button'))return;
        drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:mapViewport.scrollLeft,top:mapViewport.scrollTop,moved:false};
      });
      mapViewport.addEventListener('pointermove',event=>{
        if(!drag||drag.id!==event.pointerId)return;
        const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
        if(!drag.moved&&Math.hypot(dx,dy)<DRAG_SLOP)return;
        drag.moved=true;event.preventDefault();mapViewport.setPointerCapture(event.pointerId);
        mapViewport.classList.add('is-panning');
        mapViewport.scrollLeft=drag.left-dx;mapViewport.scrollTop=drag.top-dy;
      });
      const endPan=event=>{
        if(!drag||drag.id!==event.pointerId)return;
        drag=null;mapViewport.classList.remove('is-panning');
        if(mapViewport.hasPointerCapture(event.pointerId))mapViewport.releasePointerCapture(event.pointerId);
      };
      ['pointerup','pointercancel','lostpointercapture'].forEach(type=>mapViewport.addEventListener(type,endPan));
    }
  })();

  window.KeynlockLair={open:openLairFromHud,workbench:()=>{openLairFromHud();openLairWorkbench();},module:next=>{openLairFromHud();openLairModule(next);}};
