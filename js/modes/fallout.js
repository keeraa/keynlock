(function(){
  // ===== FALLOUT =====
  let sfSecret=0, sfAngle=-90, sfTurn=0, sfWear=0, sfTorqueDir=0, sfOpenDir=1, sfStall=0, sfFailed=false, sfSuccessTol=8, sfLastHint='';
  // A hidden secret angle and a hidden torque direction. Move the mouse
  // across the lock to aim the pick at an angle; hold A/D (or the torque
  // buttons, for touch) to try turning. The wrong direction springs back
  // and wears the pick down; the right direction only turns as far as the
  // angle allows — close to the secret, it can go all the way and open the
  // lock automatically once held there; far off, it stalls out and wears
  // the pick instead. Ported from the old prototype scene
  // (prototypes/lockpicking-mechanics-v63.html, "Portable game module:
  // fallout") into a fully native mode: the wear/stall math carries over
  // faithfully, wired through the shared economy (damagePick) instead of
  // the prototype's own LockRuntime shim and hard, unconditional pick
  // break. Drops the prototype's separate "match a tension tool to a
  // hinted symbol" gate on the final turn and its decorative symbol ring
  // entirely — that system only ever matched the unrelated
  // Classic/Alternative typed-tensioner mechanic (same call made for
  // Thief: Deadly Shadows earlier this session).

  const SF_MAX_TURN=88;

  function startFalloutRound(){
    solved=false;
    $lock.classList.remove('win');
    $mechanism.classList.remove('ready','opening','opened');
    picks=pickCapacity;
    moves=0;
    brokenPicks=0;
    runReward=1000;
    sfSecret=-150+Math.random()*120;
    sfAngle=-90;
    sfTurn=0;
    sfWear=0;
    sfTorqueDir=0;
    sfOpenDir=Math.random()<.5?-1:1;
    sfStall=0;
    sfFailed=false;
    sfSuccessTol=diffStep(12,8,5,'fallout');
    sfLastHint='';
    if($sfTorqueLeft) $sfTorqueLeft.classList.remove('active');
    if($sfTorqueRight) $sfTorqueRight.classList.remove('active');
    $sfCylinder?.classList.remove('strain');
    generatedDistance=6;
    updateEconomyUI();
    renderFallout();
  }

  function sfPointerMove(e){
    if(mode!=='fallout' || solved || sfFailed || sfTorqueDir) return;
    const r=$sfLock.getBoundingClientRect();
    const x=(e.clientX-r.left)/r.width;
    sfAngle=Math.max(-165,Math.min(-15,-165+x*150));
    renderFallout();
  }

  function sfTorque(dir){
    if(mode!=='fallout' || solved || sfFailed) return;
    sfTorqueDir=dir;
    if($sfTorqueLeft) $sfTorqueLeft.classList.toggle('active',dir<0);
    if($sfTorqueRight) $sfTorqueRight.classList.toggle('active',dir>0);
  }

  function sfRelease(dir=0){
    if(dir && sfTorqueDir!==dir) return;
    sfTorqueDir=0;
    sfStall=0;
    if($sfTorqueLeft) $sfTorqueLeft.classList.remove('active');
    if($sfTorqueRight) $sfTorqueRight.classList.remove('active');
  }

  function sfBreakPick(){
    sfRelease();
    $sfCylinder?.classList.remove('strain');
    SFX.wrongLock();
    damagePick({
      resetProgress:()=>{ sfWear=0; sfTurn=0; },
      renderState:renderFallout,
      surviveText:'Отмычка сломалась'
    });
    renderFallout();
  }

  function sfTick(dt){
    if(mode!=='fallout' || solved || sfFailed) return;
    const d=Math.abs(sfAngle-sfSecret);
    const q=Math.max(0,1-d/58);
    const maxMag = d<=sfSuccessTol ? SF_MAX_TURN : Math.min(80,8+70*q);
    if(sfTorqueDir){
      if(sfTorqueDir!==sfOpenDir){
        sfTurn+=(0-sfTurn)*Math.min(1,dt*14);
        if(Math.abs(sfTurn)<.2) sfTurn=0;
        sfStall+=dt;
        sfWear=Math.min(1,sfWear+dt);
        $sfCylinder?.classList.add('strain');
        sfLastHint='Не идёт — неверное направление, отмычка изнашивается';
        if(sfWear>=1||sfStall>=1){ sfBreakPick(); return; }
      }else{
        const target=sfOpenDir*maxMag, step=dt*105*sfOpenDir;
        if(Math.abs(sfTurn)<maxMag-.15){
          sfTurn = sfOpenDir>0 ? Math.min(target,sfTurn+Math.abs(step)) : Math.max(target,sfTurn-Math.abs(step));
          sfStall=0;
        }else if(d>sfSuccessTol){
          sfWear+=dt*(.11+d/200);
          sfStall+=dt;
        }else{
          sfStall=0;
        }
        $sfCylinder?.classList.toggle('strain', d>sfSuccessTol && Math.abs(sfTurn)>=maxMag-.5);
        if(sfStall>=1){ sfBreakPick(); return; }
        if(sfWear>=1){ sfBreakPick(); return; }
        if(Math.abs(sfTurn)>=87 && d<=sfSuccessTol){
          solved=true;
          sfTurn=sfOpenDir*SF_MAX_TURN;
          sfRelease();
          $sfCylinder?.classList.remove('strain');
          $lock.classList.add('win');
          SFX.open();
          renderFallout();
          setTimeout(()=>celebrate(),420);
          return;
        }
        sfLastHint = d<=sfSuccessTol?'Есть полный ход — держи вращение':d<32?'Есть ход — подкорректируй отмычку':'Сильное сопротивление — измени угол отмычки';
      }
    }else{
      sfStall=0;
      sfTurn+=(0-sfTurn)*Math.min(1,dt*12);
      if(Math.abs(sfTurn)<.2) sfTurn=0;
      $sfCylinder?.classList.remove('strain');
    }
    renderFallout();
  }

  function renderFallout(){
    if(!$sfLock) return;
    $sfLock.style.setProperty('--angle',sfAngle+'deg');
    $sfLock.style.setProperty('--turn',sfTurn+'deg');
    const p=Math.min(100,Math.abs(sfTurn)/SF_MAX_TURN*100), w=Math.min(100,sfWear*100);
    if($sfTurnBar) $sfTurnBar.style.width=p+'%';
    if($sfTurnText) $sfTurnText.textContent=Math.round(p)+'%';
    if($sfWearBar){
      $sfWearBar.style.width=w+'%';
      $sfWearBar.style.background = w>70?'#b9655c':'#899d6d';
    }
    if($sfWearText) $sfWearText.textContent=Math.round(w)+'%';
    if($sfHelp){
      if(sfFailed) $sfHelp.textContent='Отмычки закончились — начни новый замок';
      else if(solved) $sfHelp.textContent='Замок открыт';
      else $sfHelp.textContent=sfLastHint||'Найди угол — сначала выставь отмычку, затем пробуй A / D';
    }
  }

  function tryOpenFallout(){
    if(shopOpen || solved) return;
    toast('Найди угол и держи верное направление — замок откроется сам');
  }

  if($sfLock){
    $sfLock.addEventListener('pointermove',sfPointerMove);
    $sfLock.addEventListener('pointerdown',e=>{ e.preventDefault(); sfPointerMove(e); try{ $sfLock.setPointerCapture(e.pointerId); }catch(_){} });
  }
  addEventListener('pointermove',e=>{ if(mode==='fallout') sfPointerMove(e); },{passive:true});
  function sfBindTorqueButton(btn,dir){
    if(!btn) return;
    btn.addEventListener('pointerdown',e=>{ e.preventDefault(); sfTorque(dir); });
    ['pointerup','pointerleave','pointercancel','lostpointercapture'].forEach(ev=>btn.addEventListener(ev,()=>sfRelease(dir)));
  }
  sfBindTorqueButton($sfTorqueLeft,-1);
  sfBindTorqueButton($sfTorqueRight,1);

  addEventListener('keydown',e=>{
    if(gameplayInputBlocked()||mode!=='fallout') return;
    if(e.code==='KeyA'||e.code==='ArrowLeft'){e.preventDefault();sfTorque(-1);}
    else if(e.code==='KeyD'||e.code==='ArrowRight'){e.preventDefault();sfTorque(1);}
  });
  addEventListener('keyup',e=>{
    if(mode!=='fallout') return;
    if(e.code==='KeyA'||e.code==='ArrowLeft')sfRelease(-1);
    else if(e.code==='KeyD'||e.code==='ArrowRight')sfRelease(1);
  });

  PuzzleModes.register({
    id:'fallout', start:startFalloutRound, render:renderFallout,
    tick:({dt})=>sfTick(Math.min(.04,dt/1000)),
    objective:()=>GameCatalog.get('fallout')?.objective,
    restartMessage:'Новый замок Fallout',
    input:{horizontal:()=>{},vertical:()=>{}},
    attemptOpen:tryOpenFallout
  });
})();
