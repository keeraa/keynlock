(function(){
  // ===== WATCHMEN (Подпружиненные тумблеры) =====
  let wmPins=[], wmSelected=0, wmPinEls=[], wmTimeLeft=16, wmTimeMax=16;
  const WM_SCALE=2.05, WM_LOCK_TOL=3.8, WM_MIN=0, WM_MAX=96, WM_ROUGH_MISS=18;
  // Five spring-loaded pins, each with a hidden target height. Raising or
  // lowering the selected pin also nudges its neighbors (coupled springs;
  // some pins are randomly "inverted" and move opposite to the input), and
  // a countdown adds pressure on top of the shared pick economy. Ported
  // from the old prototype scene (prototypes/lockpicking-mechanics-v63.html,
  // "Portable game module: watchmen") into a fully native mode: same
  // coupled-spring physics and miss tiers, wired through the shared economy
  // (damagePick/registerMove/diffStep) instead of the prototype's own
  // LockRuntime/GameHub shims and its own hard pick-loss counter.

  function wmCanLock(i){
    const p=wmPins[i];
    return !!p && !p.locked && Math.abs(p.h-p.target)<=WM_LOCK_TOL;
  }

  // The pin's own height, its resting offset off the slot floor, and the
  // rise-per-unit scale (--wm-scale, also read by .wmTarget's CSS formula
  // so the target line always lines up with the pin) are all derived from
  // wmLock's actual rendered height rather than fixed pixels — wmLock has
  // no min-height (css/modes-08-watchmen.css), so this keeps the physics
  // correct whether the shared puzzle area gives it 150px or 400px+.
  function wmApplyGeometry(){
    if(!$wmLock) return WM_SCALE;
    const cs=getComputedStyle($wmLock);
    const h=$wmLock.clientHeight-(parseFloat(cs.paddingTop)||0)-(parseFloat(cs.paddingBottom)||0);
    if(!h || h<0) return WM_SCALE;
    const pinBottom=Math.max(8,Math.min(22,h*.07));
    const pinH=Math.max(36,Math.min(112,h*.36));
    const topClearance=Math.max(8,h*.09);
    const availableRise=Math.max(24,h-pinBottom-pinH-topClearance);
    const scale=availableRise/WM_MAX;
    $wmLock.style.setProperty('--wm-pin-bottom',pinBottom.toFixed(1)+'px');
    $wmLock.style.setProperty('--wm-pin-h',pinH.toFixed(1)+'px');
    $wmLock.style.setProperty('--wm-scale',scale.toFixed(3));
    return scale;
  }

  // Regenerates just the puzzle state (pins + timer) without touching the
  // shared economy fields (picks/moves/brokenPicks/runReward) — used both
  // for a fresh round and as damagePick's resetProgress on a timeout, where
  // the pick loss itself is already handled by damagePick.
  function wmRegeneratePins(){
    wmSelected=0;
    wmTimeMax=diffStep(20,16,12);
    wmTimeLeft=wmTimeMax;
    const invertCount=Math.random()<.5?1:2;
    const order=[0,1,2,3,4];
    for(let i=order.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [order[i],order[j]]=[order[j],order[i]];
    }
    const inverted=new Set(order.slice(0,invertCount));
    wmPins=Array.from({length:5},(_,i)=>({
      h:10+Math.random()*20, target:58+Math.random()*30, locked:false,
      weight:.7+Math.random()*.7, inverted:inverted.has(i)
    }));
    generatedDistance=5;
  }

  function startWatchmenRound(){
    chooseGamePinSkin();
    solved=false;
    $lock.classList.remove('win');
    $mechanism.classList.remove('ready','opening','opened');
    picks=pickCapacity;
    moves=0;
    brokenPicks=0;
    runReward=1000;
    wmRegeneratePins();
    updateEconomyUI();
    renderWatchmen();
  }

  function renderWatchmen(){
    if(!$wmLock) return;
    if(wmPinEls.length!==wmPins.length){
      const frag=document.createDocumentFragment();
      wmPinEls=[];
      wmPins.forEach((p,i)=>{
        const s=document.createElement('div');
        s.className='wmSlot';
        s.dataset.i=i;
        s.innerHTML=`<div class="wmSpring"></div><div class="wmTarget"></div><img class="wmPin" src="${currentGamePinSkin()}" alt="">`;
        s.style.setProperty('--wm-target',p.target.toFixed(1));
        s.addEventListener('click',()=>{
          if(solved) return;
          wmSelected=i;
          SFX.select();
          renderWatchmen();
        });
        frag.appendChild(s);
        wmPinEls.push(s);
      });
      $wmLock.replaceChildren(frag);
    }
    const scale=wmApplyGeometry();
    wmPins.forEach((p,i)=>{
      const s=wmPinEls[i];
      const pin=s.querySelector('.wmPin');
      if(pin && pin.getAttribute('src')!==currentGamePinSkin()) pin.src=currentGamePinSkin();
      if(!s) return;
      s.style.setProperty('--wm-target',p.target.toFixed(1));
      s.classList.toggle('selected',i===wmSelected);
      s.classList.toggle('locked',p.locked);
      s.classList.toggle('lockable',!solved && wmCanLock(i));
      pin.style.setProperty('--wm-rise',(p.h*scale).toFixed(1));
    });
    if($wmTimerBar) $wmTimerBar.style.width=Math.max(0,wmTimeLeft/wmTimeMax*100)+'%';
    const n=wmPins.filter(p=>p.locked).length;
    if($wmHelp){
      if(solved) $wmHelp.textContent='Замок открыт — все тумблеры выставлены';
      else if(wmPins[wmSelected]?.locked) $wmHelp.textContent='Этот тумблер уже зафиксирован';
      else if(wmCanLock(wmSelected)) $wmHelp.textContent='Совпадение — фиксируй сейчас (Space)';
      else $wmHelp.textContent=`${n} / 5 · выставь высоту и зафиксируй`;
    }
    if($wmOpenBtn) $wmOpenBtn.disabled = solved || n!==wmPins.length;
  }

  function wmMove(dir){
    if(solved) return;
    const next=Math.max(0,Math.min(wmPins.length-1,wmSelected+dir));
    if(next===wmSelected){ SFX.blocked(); return; }
    wmSelected=next;
    SFX.move();
    renderWatchmen();
  }

  function wmAdjust(dir){
    if(solved) return;
    const p=wmPins[wmSelected];
    if(!p || p.locked) return;
    const actual=p.inverted?-dir:dir;
    const delta=5*p.weight*actual;
    const next=p.h+delta;
    if((actual>0 && p.h>=WM_MAX-1) || (actual<0 && p.h<=WM_MIN+1)){
      SFX.wrongLock();
      damagePick({
        renderState:renderWatchmen,
        surviveText:'Штифт упёрся в стену'
      });
      return;
    }
    p.h=Math.max(WM_MIN,Math.min(WM_MAX,next));
    wmPins.forEach((q,i)=>{
      if(i===wmSelected || q.locked) return;
      const dist=Math.abs(i-wmSelected);
      if(dist===1) q.h=Math.max(WM_MIN,Math.min(WM_MAX,q.h+actual*(Math.random()>.45?3.5:-2)));
      else if(dist===2) q.h=Math.max(WM_MIN,Math.min(WM_MAX,q.h-actual));
    });
    registerMove();
    SFX.move();
    renderWatchmen();
  }

  function wmRaise(){ wmAdjust(1); }
  function wmLower(){ wmAdjust(-1); }

  function wmTryLock(){
    if(solved) return;
    const p=wmPins[wmSelected];
    if(!p || p.locked) return;
    const miss=Math.abs(p.h-p.target);
    if(wmCanLock(wmSelected)){
      p.locked=true;
      SFX.move();
      renderWatchmen();
      if(wmPins.every(q=>q.locked)){
        SFX.ready();
        renderWatchmen();
      }
      return;
    }
    const rough=miss>=WM_ROUGH_MISS;
    SFX.wrongLock();
    damagePick({
      resetProgress:()=>{
        p.h=Math.max(WM_MIN,p.h-(rough?18:12));
        wmPins.forEach(q=>{ if(!q.locked) q.h=Math.max(WM_MIN,q.h-(rough?4:3)); });
      },
      renderState:renderWatchmen,
      surviveText:'Промах — штифт сорвался'
    });
  }

  function wmTick(dt){
    if(mode!=='watchmen' || solved) return;
    if(wmPins.length && wmPins.every(p=>p.locked)) return;
    wmTimeLeft=Math.max(0,wmTimeLeft-dt);
    if(wmTimeLeft<=0){
      wmTimeLeft=0;
      damagePick({
        resetProgress:()=>{ wmRegeneratePins(); },
        renderState:renderWatchmen,
        surviveText:'Время почти вышло — отмычка удержалась'
      });
      if(picks>0 && wmTimeLeft<=0) wmTimeLeft=wmTimeMax;
      return;
    }
    renderWatchmen();
  }

  function tryOpenWatchmen(){
    if(solved) return;
    if(!wmPins.length || !wmPins.every(p=>p.locked)){
      SFX.wrongLock();
      toast('Сначала зафиксируй все тумблеры');
      return;
    }
    solved=true;
    $lock.classList.add('win');
    SFX.open();
    renderWatchmen();
    setTimeout(()=>celebrate(),420);
  }

  PuzzleModes.register({
    id:'watchmen',
    start:startWatchmenRound,
    render:renderWatchmen,
    tick:({dt})=>wmTick(Math.min(.04,dt/1000)),
    resize:()=>{ wmApplyGeometry(); renderWatchmen(); },
    objective:()=>GameCatalog.get('watchmen')?.objective,
    restartMessage:'Новые подпружиненные тумблеры',
    input:{
      horizontal:wmMove,
      vertical:delta=>delta<0?wmRaise():wmLower()
    },
    actions:{primary:wmTryLock},
    attemptOpen:tryOpenWatchmen
  });
})();
