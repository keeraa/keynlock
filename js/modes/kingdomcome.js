(function(){
  // ===== KINGDOM COME =====
  let kcdSweetR=.25, kcdSweetA=0, kcdRot=0, kcdStress=0, kcdTurning=false, kcdPointerX=.5, kcdPointerY=.5, kcdTolerance=.082, kcdTargetRot=220;
  // A hidden "sweet spot" sits inside the rotor at a random radius/angle and
  // ROTATES together with the rotor as you make progress. Aim a pointer at
  // it (mouse, or arrow keys) and hold "turn" (Space, pointer-down on the
  // lock, or the button — the button exists because a touch tap on the lock
  // only aims, it never auto-holds); staying close accelerates rotation and
  // bleeds off stress, drifting away builds stress instead. Reach the target
  // rotation while still holding it and the lock opens on its own — there's
  // no separate "open" click, matching the source. Ported from the old
  // prototype scene (prototypes/lockpicking-mechanics-v63.html, "Portable
  // game module: kingdom-come") into a fully native mode: the tracking math
  // carries over faithfully, wired through the shared economy
  // (damagePick/gameplayInputBlocked) instead of the prototype's own
  // LockRuntime shim and hard, unconditional pick break.

  function kcdRandomPointer(){
    const a=Math.random()*Math.PI*2, r=.11+Math.random()*.14;
    kcdPointerX=.5+Math.cos(a)*r;
    kcdPointerY=.5+Math.sin(a)*r;
  }

  function startKingdomComeRound(){
    solved=false;
    $lock.classList.remove('win');
    $mechanism.classList.remove('ready','opening','opened');
    picks=pickCapacity;
    moves=0;
    brokenPicks=0;
    runReward=100;
    kcdSweetR=.18+Math.random()*.18;
    kcdSweetA=Math.random()*Math.PI*2;
    kcdRot=0;
    kcdStress=0;
    kcdTurning=false;
    kcdTolerance=diffStep(.11,.082,.06,'kingdomcome');
    kcdTargetRot=diffStep(180,220,260,'kingdomcome');
    kcdRandomPointer();
    generatedDistance=Math.round(kcdTargetRot/40);
    if($kcdTurnBtn) $kcdTurnBtn.classList.remove('active');
    if($kcdLock) $kcdLock.classList.remove('shaking','solved');
    updateEconomyUI();
    renderKingdomCome();
  }

  function kcdSweetPos(){
    const a=kcdSweetA+kcdRot*Math.PI/180;
    return { x:.5+Math.cos(a)*kcdSweetR, y:.5+Math.sin(a)*kcdSweetR };
  }

  function kcdDist(){
    const s=kcdSweetPos();
    return Math.hypot(kcdPointerX-s.x,kcdPointerY-s.y);
  }

  function kcdCloseness(){
    return Math.max(0,Math.min(1,1-kcdDist()/(kcdTolerance*3.4)));
  }

  function kcdSetTurning(v){
    if(solved) return;
    kcdTurning=!!v;
    if($kcdTurnBtn) $kcdTurnBtn.classList.toggle('active',kcdTurning);
  }

  function kcdPointerMove(x,y){
    if(mode!=='kingdomcome' || solved) return;
    const r=$kcdLock.getBoundingClientRect();
    let px=(x-r.left)/r.width, py=(y-r.top)/r.height;
    const dx=px-.5, dy=py-.5, m=Math.hypot(dx,dy);
    if(m>.43){ px=.5+dx/m*.43; py=.5+dy/m*.43; }
    kcdPointerX=px;
    kcdPointerY=py;
    renderKingdomCome();
  }

  function kcdKeyMove(dir){
    if(mode!=='kingdomcome' || solved) return;
    const d=.03;
    let dx=0,dy=0;
    if(dir==='left')dx=-d; else if(dir==='right')dx=d; else if(dir==='up')dy=-d; else if(dir==='down')dy=d;
    let px=kcdPointerX+dx, py=kcdPointerY+dy;
    const x=px-.5, y=py-.5, m=Math.hypot(x,y);
    if(m>.43){ px=.5+x/m*.43; py=.5+y/m*.43; }
    kcdPointerX=px;
    kcdPointerY=py;
    SFX.move();
    renderKingdomCome();
  }

  function kcdPointerDown(e){
    if(mode!=='kingdomcome' || solved) return;
    e.preventDefault();
    kcdPointerMove(e.clientX,e.clientY);
    if(e.pointerType!=='touch') kcdSetTurning(true);
    try{ $kcdLock.setPointerCapture(e.pointerId); }catch(_){}
  }

  function kcdBreakPick(){
    kcdSetTurning(false);
    SFX.wrongLock();
    damagePick({
      resetProgress:()=>{ kcdRot=0; kcdStress=0; kcdRandomPointer(); },
      renderState:renderKingdomCome,
      surviveText:'Отмычка соскользнула'
    });
    renderKingdomCome();
  }

  function kcdTick(dt){
    if(mode!=='kingdomcome' || solved || !kcdTurning) return;
    const d=kcdDist();
    const q=Math.max(0,Math.min(1,1-d/(kcdTolerance*2.9)));
    kcdRot+=dt*(46+104*q);
    if(d<=kcdTolerance) kcdStress=Math.max(0,kcdStress-dt*1.15);
    else kcdStress=Math.min(1.1,kcdStress+dt*(.15+Math.min(2.2,(d-kcdTolerance)/(kcdTolerance*2.8))*.46));
    if(kcdStress>=1){
      kcdBreakPick();
      return;
    }
    if(kcdRot>=kcdTargetRot){
      kcdRot=kcdTargetRot;
      kcdTurning=false;
      if($kcdTurnBtn) $kcdTurnBtn.classList.remove('active');
      solved=true;
      $lock.classList.add('win');
      SFX.open();
      renderKingdomCome();
      setTimeout(()=>celebrate(),420);
      return;
    }
    renderKingdomCome();
  }

  function renderKingdomCome(){
    if(!$kcdLock) return;
    const close=kcdCloseness();
    const rect=$kcdLock.getBoundingClientRect();
    const ax=.13, ay=.83, dx=kcdPointerX-ax, dy=kcdPointerY-ay;
    const len=Math.max(38,Math.hypot(dx*rect.width,dy*rect.height));
    const ang=Math.atan2(dy,dx)*180/Math.PI;
    $kcdLock.style.setProperty('--rot',kcdRot+'deg');
    $kcdLock.style.setProperty('--pick-x',(kcdPointerX*100)+'%');
    $kcdLock.style.setProperty('--pick-y',(kcdPointerY*100)+'%');
    $kcdLock.style.setProperty('--pick-angle',ang+'deg');
    $kcdLock.style.setProperty('--pick-length',len+'px');
    $kcdLock.style.setProperty('--feedback',close);
    $kcdLock.classList.toggle('shaking',kcdStress>.3 && !solved);
    $kcdLock.classList.toggle('solved',solved);
    const progressPct=Math.min(100,kcdRot/kcdTargetRot*100);
    const stressPct=Math.min(100,kcdStress*100);
    if($kcdProgressBar) $kcdProgressBar.style.width=progressPct+'%';
    if($kcdStressBar){
      $kcdStressBar.style.width=stressPct+'%';
      $kcdStressBar.style.background = stressPct>70?'#b9655c':stressPct>38?'#b08a58':'#899d6d';
    }
    if($kcdProgressText) $kcdProgressText.textContent=Math.round(progressPct)+'%';
    if($kcdStressText) $kcdStressText.textContent=Math.round(stressPct)+'%';
    if($kcdHelp){
      if(solved) $kcdHelp.textContent='Замок открыт';
      else if(kcdTurning) $kcdHelp.textContent = close>.65 ? 'Держи точку — цилиндр продолжает вращаться' : 'Отмычка уходит — вернись в рабочую точку';
      else $kcdHelp.textContent = close>.8?'Рабочая точка найдена — зажми вращение и веди отмычку':close>.5?'Очень близко — двигайся точнее':close>.2?'Есть сопротивление — ищи рядом':'Ищи рабочую точку — двигай отмычку внутри замка';
    }
  }

  function tryOpenKingdomCome(){
    if(solved) return;
    toast('Удерживай отмычку в рабочей точке, пока замок не откроется сам');
  }

  if($kcdLock){
    $kcdLock.addEventListener('pointermove',e=>kcdPointerMove(e.clientX,e.clientY));
    $kcdLock.addEventListener('pointerdown',kcdPointerDown);
    ['pointerup','pointercancel','lostpointercapture'].forEach(ev=>$kcdLock.addEventListener(ev,()=>kcdSetTurning(false)));
  }
  if($kcdTurnBtn){
    $kcdTurnBtn.addEventListener('pointerdown',e=>{ e.preventDefault(); kcdSetTurning(true); });
    ['pointerup','pointerleave','pointercancel'].forEach(ev=>$kcdTurnBtn.addEventListener(ev,()=>kcdSetTurning(false)));
  }

  PuzzleModes.register({
    id:'kingdomcome', start:startKingdomComeRound, render:renderKingdomCome,
    tick:({dt})=>kcdTick(Math.min(.04,dt/1000)),
    objective:()=>GameCatalog.get('kingdomcome')?.objective,
    restartMessage:'Новый замок Kingdom Come',
    input:{
      horizontal:dir=>kcdKeyMove(dir<0?'left':'right'),
      vertical:dir=>kcdKeyMove(dir<0?'up':'down')
    },
    actions:{primaryStart:()=>kcdSetTurning(true),primaryEnd:()=>kcdSetTurning(false)},
    attemptOpen:tryOpenKingdomCome
  });
})();
