(function(){
  // ===== RISEN 2 — ВЕРФЬ (wharf) =====
  let wfSequence=[], wfStep=0, wfPos=0, wfWrong=-1, wfStress=0, wfBarEls=[], wfBarCount=6;
  // A row of bolts ("задвижки") must be raised in a hidden order. The order
  // isn't a flat shuffle — wfMakeSequence walks it so each next bolt tends to
  // be spatially close to the last, like sliding a pick along physically
  // adjacent latches. Raising the right bolt advances the sequence; raising
  // the wrong one resets it to the start. Ported from the old prototype scene
  // (prototypes/lockpicking-mechanics-v63.html, "Portable game module:
  // risen-2", data-name="Risen 2") into a fully native mode.
  //
  // Everything here uses a "wf" prefix to keep the mode isolated in the
  // shared module scope.

  function wfMakeSequence(n){
    const seq=[];
    let pos=Math.floor(Math.random()*n);
    seq.push(pos);
    while(seq.length<n){
      const options=[];
      for(let i=0;i<n;i++) if(!seq.includes(i)) options.push(i);
      options.sort((a,b)=>Math.abs(a-pos)-Math.abs(b-pos));
      const pool=options.slice(0,Math.min(3,options.length));
      pos=pool[Math.floor(Math.random()*pool.length)];
      seq.push(pos);
    }
    return seq;
  }

  function startWharfRound(){
    chooseGamePinSkin();
    solved=false;
    $lock.classList.remove('win');
    $mechanism.classList.remove('ready','opening','opened');
    picks=pickCapacity;
    moves=0;
    brokenPicks=0;
    runReward=1000;
    wfBarCount=diffStep(5,6,7,'wharf');
    wfPos=0;
    wfStep=0;
    wfWrong=-1;
    wfStress=0;
    wfBarEls=[];
    wfSequence=wfMakeSequence(wfBarCount);
    generatedDistance=wfBarCount;
    updateEconomyUI();
    renderWharf();
  }

  function renderWharf(){
    if(!$wfLock) return;
    if(wfBarEls.length!==wfBarCount){
      const frag=document.createDocumentFragment();
      wfBarEls=[];
      for(let i=0;i<wfBarCount;i++){
        const b=document.createElement('div');
        b.className='wfBar';
        const spring=String(1+Math.floor(Math.random()*6)).padStart(2,'0');
        // Every pin keeps its real dimensions. Different apparent lengths
        // come from how deeply the lower part sits inside the mechanism.
        b.style.setProperty('--pin-depth',(4+Math.random()*38).toFixed(1)+'%');
        b.innerHTML=`<div class="wfPinRig">
          <img class="wfPin" src="${currentGamePinSkin()}" alt="">
          <span class="wfSpring" aria-hidden="true">
            <img class="wfSpringIdle" src="assets/springs/spring_idle_${spring}.png" alt="">
            <img class="wfSpringCompressed" src="assets/springs/spring_compressed_${spring}.png" alt="">
          </span>
        </div>`;
        b.addEventListener('click',()=>{
          if(solved) return;
          wfPos=i;
          wfTry();
        });
        frag.appendChild(b);
        wfBarEls.push(b);
      }
      $wfLock.replaceChildren(frag);
    }
    const opened=wfSequence.slice(0,wfStep);
    wfBarEls.forEach((b,i)=>{
      const pin=b.querySelector('.wfPin');
      if(pin && pin.getAttribute('src')!==currentGamePinSkin()) pin.src=currentGamePinSkin();
      b.classList.toggle('current', i===wfPos);
      b.classList.toggle('open', opened.includes(i));
      b.classList.toggle('wrong', i===wfWrong);
    });
    if($wfHelp){
      if(solved) $wfHelp.textContent='Верфь взломана — все задвижки пройдены';
      else if(wfStep>=wfBarCount) $wfHelp.textContent='Все задвижки открыты — нажми на замок';
      else $wfHelp.textContent=`${wfStep} / ${wfBarCount} · задвижек открыто`;
    }
  }

  function wfMove(dir){
    if(solved) return;
    const next=Math.max(0,Math.min(wfBarCount-1,wfPos+dir));
    if(next===wfPos){ SFX.blocked(); return; }
    wfPos=next;
    SFX.move();
    renderWharf();
  }

  function wfWrongPulse(i){
    wfWrong=i;
    renderWharf();
    setTimeout(()=>{ wfWrong=-1; renderWharf(); },170);
  }

  function wfTry(){
    if(solved || wfStep>=wfBarCount) return;
    const opened=wfSequence.slice(0,wfStep);
    if(opened.includes(wfPos)) return;
    registerMove();
    if(wfPos===wfSequence[wfStep]){
      wfStep++;
      wfStress=Math.max(0,wfStress-1);
      wfWrong=-1;
      SFX.move();
      renderWharf();
      if(wfStep===wfBarCount) SFX.ready();
      return;
    }
    wfStress++;
    wfStep=0;
    SFX.wrongLock();
    wfWrongPulse(wfPos);
    if(wfStress>=2){
      damagePick({
        resetProgress:()=>{ wfStress=0; },
        renderState:renderWharf,
        surviveText:'Задвижка сорвалась'
      });
      renderWharf();
    }
  }

  function tryOpenWharf(){
    if(solved) return;
    if(wfStep<wfBarCount){
      SFX.wrongLock();
      toast('Сначала пройди все задвижки по порядку');
      return;
    }
    solved=true;
    $lock.classList.add('win');
    SFX.open();
    renderWharf();
    setTimeout(()=>celebrate(),420);
  }

  PuzzleModes.register({
    id:'wharf', start:startWharfRound, render:renderWharf,
    objective:()=>GameCatalog.get('wharf')?.objective,
    restartMessage:'Новый набор задвижек',
    input:{horizontal:wfMove,vertical:delta=>{if(delta<0)wfTry();}},
    actions:{primary:wfTry},
    attemptOpen:tryOpenWharf
  });
})();
