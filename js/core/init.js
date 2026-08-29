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
  }

  document.addEventListener('selectstart', e=>e.preventDefault());
  addEventListener('pointerdown',ensureAudio,{once:true});
  addEventListener('keydown',ensureAudio,{once:true});
  document.addEventListener('dragstart', e=>e.preventDefault());

  // The game owns many single-key shortcuts, but browser refresh must always
  // remain available in the desktop shell and in a regular browser.
  addEventListener('keydown',e=>{
    if(e.code!=='KeyR'||(!e.metaKey&&!e.ctrlKey)||e.altKey) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    location.reload();
  },true);

  function gameplayInputBlocked(){
    return shopOpen || mapOpen || lairOpen || document.body.classList.contains('game-inactive');
  }

  function input(k){
    if(gameplayInputBlocked()) return;
    k=String(k).toLowerCase();
    if(k==='a'||k==='arrowleft')move(-1);
    else if(k==='d'||k==='arrowright')move(1);
    else if(k==='w'||k==='arrowup')select(-1);
    else if(k==='s'||k==='arrowdown')select(1);
    else if(k==='r')newLock();
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
    if(e.target?.closest?.('input,textarea,select,[contenteditable="true"]')) return;
    if(e.metaKey||e.ctrlKey||e.altKey) return;
    const action=KEY_ACTIONS[e.code];
    if(!action) return;
    e.preventDefault();
    input(action);
  });
  document.querySelectorAll('[data-key]').forEach(b=>b.addEventListener('pointerdown',()=>input(b.dataset.key)));

  addEventListener('pointermove', e=>{
    if(e.pointerType !== 'mouse') return;
    const nx=(e.clientX / Math.max(1, innerWidth) - 0.5) * 2;
    const ny=(e.clientY / Math.max(1, innerHeight) - 0.5) * 2;
    bgParallaxTargetX = -nx * innerWidth * 0.025;
    bgParallaxTargetY = -ny * innerHeight * 0.025;
  }, {passive:true});
  document.documentElement.addEventListener('mouseleave', ()=>{
    bgParallaxTargetX = 0;
    bgParallaxTargetY = 0;
  });

  // How far a mouse at the viewport edge, relative to the lock, pushes it. The bird measures
  // "looking up" against whichever sweep is in play.
  const POINTER_SWEEP_X = 13, POINTER_SWEEP_Y = 11;
  window.POINTER_SWEEP_Y = POINTER_SWEEP_Y;

  addEventListener('pointermove', e=>{
    // Only a mouse aims the scene. A finger tapping a plate used to slam the
    // parallax target across to wherever it landed, which jolted the view and
    // whipped the pick and tensioner round with it.
    if(e.pointerType !== 'mouse') return;
    const r=$lock.getBoundingClientRect();
    const centerX=r.left+r.width/2,centerY=r.top+r.height/2;
    const dx=e.clientX-centerX,dy=e.clientY-centerY;
    const nx=Math.max(-1,Math.min(1,dx/Math.max(1,dx<0?centerX:innerWidth-centerX)));
    const ny=Math.max(-1,Math.min(1,dy/Math.max(1,dy<0?centerY:innerHeight-centerY)));
    pointerTargetX = nx * POINTER_SWEEP_X;
    pointerTargetY = ny * POINTER_SWEEP_Y;
    toolMotionController.setPointer(pointerTargetX,pointerTargetY);
  },{passive:true});
  document.documentElement.addEventListener('mouseleave', ()=>{
    pointerTargetX = 0;
    pointerTargetY = 0;
    toolMotionController.setPointer(0,0);
  });

  // Tilt parallax. A phone has no cursor to drive the scene, so the gyroscope
  // does it — and harder than the mouse does, since tilting is a deliberate
  // gesture rather than an incidental one.
  (function bindTiltParallax(){
    const TILT_SPAN = 22;   // degrees, for the Euler fallback
    // Vertical gets the longer throw and the shorter span: looking up and
    // ducking are the deliberate moves, so they should cost less tilt and show
    // more travel than an idle sideways lean.
    const SPAN_X = 0.34;    // fraction of g that reaches the full sweep
    const SPAN_Y = 0.24;
    const TILT_X = 38, TILT_Y = 58;
    // The bird check needs to know how far up "all the way up" is.
    window.TILT_SWEEP_Y = TILT_Y;
    let rest = null;
    const clamp = v => v < -1 ? -1 : v > 1 ? 1 : v;

    // Read the tilt off gravity rather than off Euler angles. Held upright a
    // phone sits at beta ~90deg, where gamma is degenerate — which is why the
    // left/right axis reads as dead while up/down works fine. The gravity
    // vector has no such singularity.
    const G = 9.81;
    function apply(nx, ny){
      pointerTargetX = clamp(nx) * TILT_X;
      pointerTargetY = clamp(ny) * TILT_Y;
      toolMotionController.setPointer(pointerTargetX,pointerTargetY,{touch:true});
      bgParallaxTargetX = -clamp(nx) * innerWidth * 0.055;
      bgParallaxTargetY = -clamp(ny) * innerHeight * 0.090;
    }
    // Device axes are fixed to the hardware, so undo the screen rotation.
    function screenAngle(){
      const a = (screen.orientation && screen.orientation.angle);
      return ((a == null ? (window.orientation || 0) : a) * Math.PI) / 180;
    }
    // accelerationIncludingGravity carries the hand as well as the planet, and
    // a hand shakes. Low-pass it so only the slow part — which is gravity, i.e.
    // how the phone is actually being held — reaches the scene.
    const SMOOTH = 0.09;     // share of each new sample that gets through
    const DEADZONE = 0.022;  // fraction of g around rest that counts as still
    const REST_DRIFT = 0.0015; // how fast neutral follows the way you hold it
    let held = null;
    const stillness = v => {
      if(v > DEADZONE) return v - DEADZONE;
      if(v < -DEADZONE) return v + DEADZONE;
      return 0;
    };
    function onMotion(e){
      const g = e.accelerationIncludingGravity;
      if(!g || g.x == null || g.z == null) return;
      const a = screenAngle(), cos = Math.cos(a), sin = Math.sin(a);
      const x = (g.x * cos + g.y * sin) / G;
      const z = -g.z / G;
      if(!held) held = { x, z };
      held.x += (x - held.x) * SMOOTH;
      held.z += (z - held.z) * SMOOTH;
      if(!rest) rest = { x: held.x, z: held.z };
      apply(stillness(held.x - rest.x) / SPAN_X, stillness(held.z - rest.z) / SPAN_Y);
      // Neutral creeps towards however the phone is being held now. Fixed once
      // at the first sample it would be wrong for the whole session if that
      // sample caught a movement, or if the player later sits up or lies down —
      // the scene would hang off-centre with no way back. Slow enough that a
      // deliberate look lasting a second or two survives it.
      rest.x += (held.x - rest.x) * REST_DRIFT;
      rest.z += (held.z - rest.z) * REST_DRIFT;
    }
    // Fallback for anything without motion events.
    function onTilt(e){
      if(e.gamma == null || e.beta == null) return;
      if(!rest) rest = { g: e.gamma, b: e.beta };
      apply((e.gamma - rest.g) / TILT_SPAN, (e.beta - rest.b) / TILT_SPAN);
    }

    const hasMotion = typeof DeviceMotionEvent !== 'undefined';
    function listen(){
      if(hasMotion) addEventListener('devicemotion', onMotion, { passive:true });
      else addEventListener('deviceorientation', onTilt, { passive:true });
    }

    // iOS hands these out only after an explicit grant, and only from a
    // gesture, so ask on the first touch and never nag again.
    const gate = (hasMotion && typeof DeviceMotionEvent.requestPermission === 'function')
      ? DeviceMotionEvent
      : (typeof DeviceOrientationEvent !== 'undefined'
         && typeof DeviceOrientationEvent.requestPermission === 'function' ? DeviceOrientationEvent : null);
    if(!gate){ listen(); return; }
    const ask = () => {
      removeEventListener('touchend', ask);
      removeEventListener('click', ask);
      gate.requestPermission().then(r => { if(r === 'granted') listen(); }).catch(()=>{});
    };
    addEventListener('touchend', ask, { passive:true });
    addEventListener('click', ask);
  })();

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
  $massCenter.addEventListener('click',()=>GameActions.attemptOpen({modeId:'mass',source:'puzzle-control'}));
  $kdCheck?.addEventListener('click',checkDeduction);
  $skTorqueButton.addEventListener('click',()=>GameActions.attemptOpen({modeId:'skyrim',source:'puzzle-control'}));
  $anUnlock.addEventListener('click',e=>{ if(e.target.closest('.anBtn')) return; GameActions.attemptOpen({modeId:'anach',source:'puzzle-control'}); });
  $anUnlock.addEventListener('keydown',e=>{ if((e.key==='Enter'||e.key===' ')&&!e.target.closest('.anBtn')){ e.preventDefault(); GameActions.attemptOpen({modeId:'anach',source:'keyboard'}); } });
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
  addEventListener('keydown',e=>{if(!gameplayInputBlocked()&&mode==='resonance'&&e.code==='Space'){e.preventDefault();hitResonance();}});
  addEventListener('keydown',e=>{if(!gameplayInputBlocked()&&mode==='tension'&&e.code==='Space'){e.preventDefault();setTensionPin();}});
  addEventListener('keydown',e=>{if(!gameplayInputBlocked()&&mode==='deduction'&&e.code==='Space'){e.preventDefault();checkDeduction();}});
  addEventListener('keydown',e=>{if(!gameplayInputBlocked()&&mode==='oblivion'&&e.code==='Space'){e.preventDefault();obClick(obSelected);}});
  addEventListener('keydown',e=>{if(!gameplayInputBlocked()&&mode==='watchmen'&&e.code==='Space'){e.preventDefault();wmTryLock();}});
  $wmOpenBtn?.addEventListener('click',()=>GameActions.attemptOpen({modeId:'watchmen',source:'puzzle-control'}));
  addEventListener('keydown',e=>{if(!gameplayInputBlocked()&&mode==='museum'&&e.code==='Space'){e.preventDefault();hmPick(hmKb);}});
  addEventListener('keydown',e=>{if(!gameplayInputBlocked()&&mode==='mass2'&&e.code==='Space'){e.preventDefault();m2Click(m2Kb);}});
  addEventListener('keydown',e=>{if(!gameplayInputBlocked()&&mode==='pipeline'&&e.code==='Space'){e.preventDefault();plKeyboardAction();}});
  $plBoostBtn?.addEventListener('click',()=>plBoost());
  document.querySelector('#shopHudButton')?.addEventListener('click',()=>{
    if(lairOpen) closeLair();
    if(mapOpen) closeMap(false);
    openShop();
  });
  document.querySelector('#lairHudButton')?.addEventListener('click',openLairFromHud);
  document.querySelector('#newPuzzleButton')?.addEventListener('click',restartCurrentRound);
  $mapTab.onclick=openMap;
  document.querySelector('#worldMapClose')?.addEventListener('click',()=>closeMap(true));
  $worldMapScreen?.addEventListener('pointerdown',e=>{
    if(e.target===$worldMapScreen) closeMap(true);
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
  document.querySelector('#alchemyTopHudClose')?.addEventListener('click',closeLairModule);
  document.querySelector('#collectionTopHudClose')?.addEventListener('click',closeLairModule);

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
    if(mapOpen){ e.preventDefault(); closeMap(true); }
  });

  $hcInput?.addEventListener('keydown',e=>{if(!gameplayInputBlocked()&&e.key==='Enter'){e.preventDefault();GameActions.attemptOpen({modeId:'heatcold',source:'keyboard'});}});
  $hcInput?.addEventListener('input',()=>{$hcInput.value=$hcInput.value.replace(/\D/g,'').slice(0,4);});
  document.addEventListener('keydown',handleHeatColdKey);
  $drumWheels?.addEventListener('click',e=>{const b=e.target.closest('[data-drum-i]');if(!b)return;changeDrum(Number(b.dataset.drumI),Number(b.dataset.dir));});
  $drumCheck?.addEventListener('click',()=>GameActions.attemptOpen({modeId:'drum',source:'puzzle-control'}));
  $drumNew?.addEventListener('click',()=>newLock());
  $drumSound?.addEventListener('click',()=>{drumSoundOn=!drumSoundOn;$drumSound.textContent='Звук: '+(drumSoundOn?'вкл':'выкл');});
  $scopeWheels?.addEventListener('click',e=>{const b=e.target.closest('[data-scope-i]');if(!b)return;changeScope(Number(b.dataset.scopeI),Number(b.dataset.dir));});
  $scopeCheck?.addEventListener('click',()=>GameActions.attemptOpen({modeId:'scope',source:'puzzle-control'}));
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
  // The game doesn't actually start (first puzzle generated, lair shown)
  // until every image asset has preloaded — js/core/asset-preload.js drives
  // the #bootLoader overlay covering/blurring everything until then.
  function bootGame(){
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
    openLairFromHud();
  }
  (window.KeynlockAssetsReady || Promise.resolve()).then(bootGame);
