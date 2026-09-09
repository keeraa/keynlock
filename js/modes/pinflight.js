(function(){
  // ===== pinflight (pinflight) =====
  let obPins=[], obSelected=0, obPinEls=[];
  const OB_READY_MIN=76, OB_READY_MAX=112;
  // Five independent pins. Each one springs upward on its own timer, pauses
  // briefly right at its own apex height, then falls back down if nothing
  // happens — clicking/selecting it during that pause sets it in place.
  // Ported from the old prototype scene (prototypes/lockpicking-mechanics-v63.html,
  // "Portable game module: pinflight") into a fully native mode: same rise/
  // pause/fall physics and timing windows, wired through the shared economy
  // (damagePick/registerMove/diffStep) instead of the prototype's own
  // LockRuntime/GameHub shims.

  function obApex(i){
    const s=obPinEls[i];
    const pin=s?.querySelector('.obPin');
    if(!s||!pin||!s.clientHeight) return 116;
    return Math.max(58,s.clientHeight-19-pin.offsetHeight-12);
  }

  function obStartPin(p,i){
    p.apex=obApex(i);
    p.state='up';
    p.speed=p.baseSpeed*(.98+Math.random()*.04);
    p.pause=OB_READY_MIN+Math.random()*(OB_READY_MAX-OB_READY_MIN);
  }

  function obDropOneSet(){
    const setPins=obPins.map((p,i)=>[p,i]).filter(([p])=>p.set);
    if(!setPins.length) return false;
    const [,idx]=setPins[Math.floor(Math.random()*setPins.length)];
    const drop=obPins[idx];
    drop.set=false;
    drop.state='down';
    drop.rise=Math.max(56,drop.rise||drop.apex||145);
    drop.phase=0;
    return true;
  }

  function startPinflightRound(){
    chooseGamePinSkin();
    solved=false;
    $lock.classList.remove('win');
    $mechanism.classList.remove('ready','opening','opened');
    picks=pickCapacity;
    moves=0;
    brokenPicks=0;
    runReward=100;
    obSelected=0;
    const tiers=[420,520,640,780,930].map(v=>v*.8*(.94+Math.random()*.12));
    for(let i=tiers.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [tiers[i],tiers[j]]=[tiers[j],tiers[i]];
    }
    obPins=Array.from({length:5},(_,i)=>({
      rise:0, state:'idle', phase:0, speed:0, pause:0, set:false,
      baseSpeed:tiers[i], pinH:(108+Math.random()*52)*.8, apex:116
    }));
    generatedDistance=5;
    updateEconomyUI();
    renderPinflight();
  }

  function renderPinflight(){
    if(!$obLock) return;
    if(obPinEls.length!==obPins.length){
      const frag=document.createDocumentFragment();
      obPinEls=[];
      obPins.forEach((p,i)=>{
        const s=document.createElement('div');
        s.className='obSlot';
        s.dataset.i=i;
        s.innerHTML=`<img class="obPin" src="${currentGamePinSkin()}" alt="">`;
        s.querySelector('.obPin').style.setProperty('--ob-pin-h',p.pinH.toFixed(1)+'px');
        s.addEventListener('click',()=>{
          if(solved) return;
          obSelected=i;
          SFX.select();
          renderPinflight();
          obClick(i);
        });
        frag.appendChild(s);
        obPinEls.push(s);
      });
      $obLock.replaceChildren(frag);
    }
    let selectedReady=false;
    obPins.forEach((p,i)=>{
      const s=obPinEls[i];
      if(!s) return;
      const pin=s.querySelector('.obPin');
      if(pin && pin.getAttribute('src')!==currentGamePinSkin()) pin.src=currentGamePinSkin();
      pin?.style.setProperty('--ob-pin-h',p.pinH.toFixed(1)+'px');
      const ready=!p.set && !solved && p.state==='pause' && Math.abs(p.rise-p.apex)<.5;
      s.classList.toggle('set',p.set);
      s.classList.toggle('ready',ready);
      s.classList.toggle('selected',i===obSelected);
      if(i===obSelected) selectedReady=ready;
      pin?.style.setProperty('--rise',p.rise.toFixed(1));
    });
    if(!$obMessage) return;
    const n=obPins.filter(p=>p.set).length;
    if(solved) $obMessage.textContent='Замок открыт — все штифты выставлены';
    else if(selectedReady) $obMessage.textContent='Совпадение — фиксируй сейчас';
    else $obMessage.textContent=`${n} / 5 · лови точное совпадение с верхней прорезью`;
  }

  function obMove(dir){
    if(solved) return;
    const next=Math.max(0,Math.min(obPins.length-1,obSelected+dir));
    if(next===obSelected){ SFX.blocked(); return; }
    obSelected=next;
    SFX.move();
    renderPinflight();
  }

  function obClick(i){
    if(solved) return;
    obSelected=i;
    const p=obPins[i];
    if(p.set) return;
    registerMove();
    if(p.state==='idle'){
      obStartPin(p,i);
      renderPinflight();
      return;
    }
    if(p.state==='pause' && Math.abs(p.rise-p.apex)<.5){
      // Re-read the rendered geometry at the moment of capture. Pin heights
      // change between rounds, so a stale apex would leave a visually valid
      // pin above or below the slot even though the state considered it set.
      p.apex=obApex(i);
      p.set=true;
      p.state='set';
      p.rise=p.apex;
      SFX.move();
      renderPinflight();
      if(obPins.every(q=>q.set)){
        if(obPins.length) SFX.ready();
        tryOpenPinflight();
      }
      return;
    }
    p.state='down';
    SFX.wrongLock();
    // A pick that breaks and isn't saved also knocks one already-set pin
    // loose (obDropOneSet) — the harsher consequence stays tied to the
    // shared pick-break roll instead of firing on every single miss like
    // the old prototype did.
    damagePick({
      resetProgress:()=>{ obDropOneSet(); },
      renderState:renderPinflight,
      surviveText:'Момент фиксации пропущен'
    });
  }

  function obTick(dt){
    if(mode!=='pinflight' || solved) return;
    let changed=false;
    obPins.forEach(p=>{
      if(p.set) return;
      if(p.state==='up'){
        p.rise+=p.speed*dt;
        if(p.rise>=p.apex){ p.rise=p.apex; p.state='pause'; p.phase=p.pause; }
        changed=true;
      }else if(p.state==='pause'){
        p.phase-=dt*1000;
        if(p.phase<=0) p.state='down';
        changed=true;
      }else if(p.state==='down'){
        p.rise-=p.speed*1.14*dt;
        if(p.rise<=0){ p.rise=0; p.state='idle'; }
        changed=true;
      }
    });
    if(changed) renderPinflight();
  }

  function tryOpenPinflight(){
    if(solved) return;
    if(!obPins.length || !obPins.every(p=>p.set)){
      SFX.wrongLock();
      toast('Сначала выставь все штифты');
      return;
    }
    solved=true;
    $lock.classList.add('win');
    SFX.open();
    renderPinflight();
    setTimeout(()=>celebrate(),420);
  }

  PuzzleModes.register({
    id:'pinflight',
    start:startPinflightRound,
    render:renderPinflight,
    tick:({dt})=>obTick(Math.min(.035,dt/1000)),
    objective:()=>GameCatalog.get('pinflight')?.objective,
    restartMessage:'Новая попытка: «Штифтовый замок»',
    input:{
      horizontal:obMove,
      vertical:delta=>{ if(delta<0) obClick(obSelected); }
    },
    actions:{primary:()=>obClick(obSelected)},
    attemptOpen:tryOpenPinflight
  });
})();
