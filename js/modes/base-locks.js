  // ===== BASE / SPECIAL LOCKS =====
  function buildSpecialLinks(type){
    links=Array.from({length:n},()=>Array(n).fill(0));

    if(type==='chain'){
      for(let i=0;i<n;i++){
        links[i][i]=1;
        if(i>0) links[i][i-1]=1;
        if(i<n-1) links[i][i+1]=1;
      }
      return;
    }

    if(type==='mirror'){
      for(let i=0;i<n;i++){
        links[i][i]=1;
        const m=n-1-i;
        if(m!==i) links[i][m]=-1;
      }
      return;
    }

    // "wave": selected pin + next pin same direction + previous pin opposite.
    for(let i=0;i<n;i++){
      links[i][i]=1;
      links[i][(i+1)%n]=1;
      links[i][(i-1+n)%n]=-1;
    }
  }

  function specialTypeName(){
    return specialType==='chain' ? 'Цепной' : (specialType==='mirror' ? 'Зеркальный' : 'Волновой');
  }

  function makeLinks(){
    links=Array.from({length:n},()=>Array(n).fill(0));
    for(let i=0;i<n;i++){
      links[i][i]=1;
      let count = n<=3 ? rand(0,1) : rand(1,Math.min(2,n-1));
      let candidates=shuffle([...Array(n).keys()].filter(j=>j!==i));
      for(let k=0;k<count;k++) links[i][candidates[k]]=Math.random()<.68?1:-1;
    }
  }

  function deltaFor(i,dir){return links[i].map(v=>v*dir)}
  function legal(st,i,dir){
    const d=deltaFor(i,dir);
    return st.every((v,j)=>v+d[j]>=MIN && v+d[j]<=MAX);
  }
  function applyRaw(st,i,dir){
    const d=deltaFor(i,dir); return st.map((v,j)=>v+d[j]);
  }
let plateEls=[], pinTopPlateEls=[];
  function plateMouseSteeringActive(){
    return mode==='classic'||mode==='target'||mode==='line'||mode==='sequence'||mode==='special';
  }

  function rebuildPlates(){
    plateEls=[];
    pinTopPlateEls=[];
    const spacing = n===3 ? 118 : n===4 ? 88 : n===5 ? 88 : 84;
    const pinSkin=currentPinSkin();
    const plateSkin=currentPlateSkin();
    const pinImage=cssUrl(pinSkin);
    const plateImage=cssUrl(plateSkin);
    const frag=document.createDocumentFragment();
    const pinTopFrag=document.createDocumentFragment();
    const pinTopRoot=document.querySelector('#pinTopPlates');
    state.forEach((pos,i)=>{
      const p=document.createElement('div');
      p.className='plate';
      if(mode==='target') p.classList.add('mode-target');
      p.dataset.index=i;
      p.setAttribute('role','button');
      p.setAttribute('tabindex','0');
      p.setAttribute('aria-label',plateMouseSteeringActive()
        ? `Пластина ${i+1}: левая половина двигает штифт влево, правая — вправо`
        : `Выбрать пластину ${i+1}`);

      const x=0, y=i*spacing;
      p.style.setProperty('--dx',`${x}px`);
      p.style.setProperty('--dy',`${y}px`);
      p.style.setProperty('--parx', `${(0.55 + i*0.08).toFixed(2)}`);
      p.style.setProperty('--pary', `${(0.28 + i*0.05).toFixed(2)}`);
      p.style.zIndex=20+i;

      const plateH=97;
      const holeY=currentPlateHoleY()*plateH;

      const pin=document.createElement('div');
      pin.className='pin';
      pin.style.backgroundImage=pinImage;
      pin.style.setProperty('--pin-image',pinImage);
      pin.style.bottom=`${(plateH-holeY-17).toFixed(2)}px`;

      const pinTopPlate=document.createElement('div');
      pinTopPlate.className='pinTopPlate';
      pinTopPlate.dataset.index=i;
      pinTopPlate.style.setProperty('--dx',`${x}px`);
      pinTopPlate.style.setProperty('--dy',`${y}px`);
      pinTopPlate.style.setProperty('--parx', `${(0.55 + i*0.08).toFixed(2)}`);
      pinTopPlate.style.setProperty('--pary', `${(0.28 + i*0.05).toFixed(2)}`);
      const pinTop=document.createElement('div');
      pinTop.className='pinTopPin';
      pinTop.style.backgroundImage=pinImage;
      pinTop.style.setProperty('--pin-image',pinImage);
      pinTop.style.bottom=`${(plateH-holeY-17).toFixed(2)}px`;
      pinTopPlate.appendChild(pinTop);

      const face=document.createElement('div');
      face.className='plateFace';
      face.style.backgroundImage=plateImage;

      const target=document.createElement('div');
      target.className='target';

      const idx=document.createElement('div');
      idx.className='index';
      idx.textContent=String(i+1).padStart(2,'0');

      p.append(pin,face,target,idx);
      p._pin=pin;
      p._pinTop=pinTop;
      p._pinTopPlate=pinTopPlate;
      p._target=target;
      p._pinState=null;
      p.addEventListener('pointerdown',e=>e.preventDefault());
      p.addEventListener('mousedown',e=>e.preventDefault());
      p.addEventListener('click',event=>{
        if(solved) return;
        if(plateMouseSteeringActive()){
          const rect=p.getBoundingClientRect();
          const dir=event.clientX<rect.left+rect.width/2?-1:1;
          if(selected!==i)SFX.select();
          selected=i;
          move(dir);
          return;
        }
        selected=i;
        SFX.select();
        render();
      });
      p.addEventListener('keydown',e=>{
        if(e.key==='Enter'||e.key===' '){
          e.preventDefault();
          if(!solved){selected=i;SFX.select();render();}
        }
      });
      frag.appendChild(p);
      pinTopFrag.appendChild(pinTopPlate);
      plateEls.push(p);
      pinTopPlateEls.push(pinTopPlate);
    });
    $plates.replaceChildren(frag);
    if(pinTopRoot) pinTopRoot.replaceChildren(pinTopFrag);
  }

  function pinXForState(pos){
    const i=Math.max(0,Math.min(6,pos-1));
    return PLATE_HOLE_X[i]*520;
  }

  function targetLineFor(i){
    if(mode==='classic' || mode==='special') return GOAL;
    if(mode==='target' || mode==='sequence') return targets[i] || GOAL;
    return goalLine;
  }

  function pinScaleFor(i, pos){
    if(mode==='sequence') return goalMet() ? 0.70 : 0.56;
    const target = targetLineFor(i);
    return pos === target ? 0.70 : 0.56;
  }

  function pinTransform(x, scale=1){
    const xShift=(520*0.01);
    const yShift=(scale>=0.70 ? -5 : 0);
    return `translate3d(${(x-23-xShift).toFixed(2)}px,${yShift.toFixed(2)}px,0) scaleX(1) scaleY(${scale})`;
  }

  function animatePinTo(p, nextState){
    const pins=[p._pin,p._pinTop].filter(Boolean);
    if(!pins.length) return;
    const row=+p.dataset.index;
    const prevState=p._pinState;
    const nextX=pinXForState(nextState);
    const nextScale=pinScaleFor(row,nextState);

    if(prevState==null || prevState===nextState){
      const nextTransform=pinTransform(nextX,nextScale);
      pins.forEach(pin=>{ pin.style.transform=nextTransform; });
      p._pinState=nextState;
      return;
    }

    const prevX=pinXForState(prevState);
    const prevScale=pinScaleFor(row,prevState);
    pins.forEach(pin=>{
      pin.getAnimations().forEach(a=>a.cancel());
      const anim=pin.animate([
        {transform:pinTransform(prevX,prevScale),offset:0},
        {transform:pinTransform(prevX,.28),offset:.28},
        {transform:pinTransform(nextX,.28),offset:.64},
        {transform:pinTransform(nextX,nextScale),offset:1}
      ],{duration:616,easing:'cubic-bezier(.2,.82,.2,1)',fill:'forwards'});
      pin.style.transform=pinTransform(nextX,nextScale);
      anim.onfinish=()=>anim.cancel();
    });
    p._pinState=nextState;
  }

  function updatePlateVisual(i){
    const p=plateEls[i];
    if(!p) return;
    const isSelected = i===selected;
    const codeSolved = mode==='sequence' && goalMet();
    const isSolved = (mode==='classic' || mode==='special') ? state[i]===GOAL : (mode==='target' ? state[i]===targets[i] : (mode==='line' ? state[i]===goalLine : codeSolved));
    p.classList.toggle('selected',isSelected);
    p.classList.toggle('solved',isSolved);
    p.classList.toggle('mode-target', mode==='target');
    if(p._pinTopPlate){
      p._pinTopPlate.classList.toggle('selected',isSelected);
      p._pinTopPlate.classList.toggle('solved',isSolved);
    }
    p.style.zIndex = 20 + i;
    if(p._target){
      const tx = pinXForState((targets[i]||1)) - 8;
      p._target.style.transform = `translate3d(${tx.toFixed(2)}px,0,0)`;
      p._target.style.opacity = mode==='target' ? '1' : '0';
    }
    animatePinTo(p,state[i]);
  }

  function newLock(notify=true){
    beginRoundState();
    $toast.classList.remove('show','actionable');
    chooseRoundPinSkin();
    chooseRoundPlateSkin();
    chooseRoundMechanismSkin();
    $lock.classList.remove('win');
    $mechanism.classList.remove('ready','opening','opened');
    const baseDifficulty = getModeDifficulty(mode);
    n=((mode==='classic' || mode==='target' || mode==='line' || mode==='sequence' || mode==='special') && baseDifficulty===1) ? 4 : 5;
    selected=0; solved=false; picks=pickCapacity; moves=0; brokenPicks=0; runReward=1000;

    if(mode==='classic'){
      goalLine=GOAL;
      targets=[];
      makeLinks();
      state=generateLinkedPuzzle(GOAL,diffStep(6,8,11),diffStep(9,12,15));
      initial=[...state];
      rebuildPlates();
      render();
    }else if(mode==='target'){
      goalLine=GOAL;
      links=[];
      makeSmartTargetModeStart(diffStep(6,8,12),diffStep(10,14,18));
      initial=[...state];
      rebuildPlates();
      render();
    }else if(mode==='line'){
      targets=[];
      goalLine=shuffle([2,3,5,6])[0];
      makeLinks();
      state=generateLinkedPuzzle(goalLine,diffStep(6,8,11),diffStep(9,12,15));
      initial=[...state];
      rebuildPlates();
      render();
    }else if(mode==='sequence'){
      goalLine=GOAL;
      links=[];
      makeSmartTargetModeStart(diffStep(6,8,12),diffStep(10,14,18));
      initial=[...state];
      rebuildPlates();
      render();
    }else if(mode==='special'){
      targets=[];
      goalLine=GOAL;
      const specialDifficulty=getModeDifficulty('special');
      specialType=shuffle(specialDifficulty===1 ? ['chain'] : (specialDifficulty===2 ? ['chain','mirror'] : ['chain','mirror','wave']))[0];
      buildSpecialLinks(specialType);
      state=generateLinkedPuzzle(GOAL,diffStep(5,7,10,'special'),diffStep(8,11,14,'special'));
      initial=[...state];
      rebuildPlates();
      render();
    }else if(PuzzleModes.call(mode,'start')){
      // Registered puzzle owns its complete round lifecycle.
    }else if(mode==='heatcold'){
      startHeatColdRound();
    }else if(mode==='drum'){
      startDrumRound();
    }else if(mode==='scope'){
      startScopeRound();
    }else if(mode==='wharf'){
      startWharfRound();
    }else if(mode==='thiefds'){
      startThiefDsRound();
    }else if(mode==='kingdomcome'){
      startKingdomComeRound();
    }else if(mode==='thief12'){
      startThief12Round();
    }else if(mode==='fallout'){
      startFalloutRound();
    }else if(mode==='anachlab'){
      startAnachLabRound();
    }else if(mode==='masshack'){
      startMassHackRound();
    }else if(mode==='pathologic'){
      startPathologicRound();
    }else if(mode==='bioshock2'){
      startBioshock2Round();
    }else if(mode==='alphaprotocol'){
      startAlphaProtocolRound();
    }

    updateModeUI();
    updateEconomyUI();

    const msg = PuzzleModes.has(mode) ? PuzzleModes.restartMessage(mode) :
      mode==='classic' ? 'Новый замок' :
      mode==='target' ? 'Новая цель' :
      mode==='line' ? `Новая линия: ${goalLine}` :
      mode==='sequence' ? `Новый код: ${targets.join(', ')}` :
      mode==='special' ? `Особый замок: ${specialTypeName()}` :
      mode==='heatcold' ? 'Новый цифровой код' :
      mode==='drum' ? 'Новый барабанный замок' :
      mode==='wharf' ? 'Новый набор задвижек' :
      mode==='thiefds' ? 'Новый замок' :
      mode==='kingdomcome' ? 'Новый замок' :
      mode==='thief12' ? 'Новый замок' :
      mode==='fallout' ? 'Новый замок' :
      mode==='anachlab' ? 'Новый код' :
      mode==='masshack' ? 'Новый обход' :
      mode==='pathologic' ? 'Новый замок' :
      mode==='bioshock2' ? 'Новый взлом' :
      mode==='alphaprotocol' ? 'Новый замок' :
      'Новый сигнал осциллографа';
    if(notify){
      toast(msg);
      SFX.newRound();
    }
  }

  function reset(){
    beginRoundState();
    if(PuzzleModes.call(mode,'start')){ toast(PuzzleModes.restartMessage(mode)); return; }
    if(mode==='heatcold'){ startHeatColdRound(); toast('Цифровой код обновлён'); return; }
    if(mode==='drum'){ startDrumRound(); toast('Барабанный замок обновлён'); return; }
    if(mode==='scope'){ startScopeRound(); toast('Сигнал обновлён'); return; }
    if(mode==='wharf'){ startWharfRound(); toast('Задвижки обновлены'); return; }
    if(mode==='thiefds'){ startThiefDsRound(); toast('Замок обновлён'); return; }
    if(mode==='kingdomcome'){ startKingdomComeRound(); toast('Замок обновлён'); return; }
    if(mode==='thief12'){ startThief12Round(); toast('Замок обновлён'); return; }
    if(mode==='fallout'){ startFalloutRound(); toast('Замок обновлён'); return; }
    if(mode==='anachlab'){ startAnachLabRound(); toast('Код обновлён'); return; }
    if(mode==='masshack'){ startMassHackRound(); toast('Обход обновлён'); return; }
    if(mode==='pathologic'){ startPathologicRound(); toast('Замок обновлён'); return; }
    if(mode==='bioshock2'){ startBioshock2Round(); toast('Взлом обновлён'); return; }
    if(mode==='alphaprotocol'){ startAlphaProtocolRound(); toast('Замок обновлён'); return; }
    state=[...initial]; solved=false; $lock.classList.remove('win');
    $mechanism.classList.remove('ready','opening','opened');
    render(); toast('Механизм сброшен');
  }

  function failMove(){
    nudgeTools();
    document.body.classList.remove('flash');
    void document.body.offsetWidth;
    document.body.classList.add('flash');

    const info=PICK_TYPES[pickType];
    const breaks=Math.random()<info.breakChance;
    if(!breaks){
      SFX.survive();
      toast(`Ошибка · ${info.name.toLowerCase()} выдержала`);
      render();
      return;
    }

    const previousVisiblePicks=Math.max(0, Math.min(pickCapacity, picks));
    picks=Math.max(0,picks-1);
    if(previousVisiblePicks>0) triggerInventoryBreakAnimation(previousVisiblePicks);
    brokenPicks++;
    SFX.break();
    const keepsPosition=Math.random()<info.saveChance;
    if(!keepsPosition) state=[...initial];

    if(picks<=0){
      render();
      showPickDepletedLoss();
      return;
    }

    toast(keepsPosition?'Отмычка сломалась · позиция сохранена':'Отмычка сломалась · замок сброшен');
    render();
    $mechanism.classList.toggle('ready',goalMet());
  }

  function move(dir){
    if(PuzzleModes.input(mode,'horizontal',dir)) return;
    if(mode==='wharf') return wfMove(dir);
    if(mode==='thiefds') return tdsMove(dir);
    if(mode==='kingdomcome') return kcdKeyMove(dir<0?'left':'right');
    if(mode==='thief12') return;
    if(mode==='fallout') return;
    if(mode==='anachlab') return alabSelectSlot(dir);
    if(mode==='masshack') return hackMove(dir);
    if(mode==='pathologic') return;
    if(mode==='bioshock2') return;
    if(mode==='alphaprotocol'){ apSelectPin(apSel+dir); return; }
    if(mode==='heatcold'||mode==='drum'||mode==='scope') return;
    if(solved) return;
    nudgeTools();
    if(mode==='classic' || mode==='line' || mode==='special'){
      if(!legal(state,selected,dir)){SFX.blocked();failMove();return}
      state=applyRaw(state,selected,dir);
      registerMove();
    }else{
      const next = state[selected] + dir;
      if(next<MIN || next>MAX){SFX.blocked();failMove();return}
      state[selected] = next;
      registerMove();
    }
    SFX.plateMove();
    const wasReady=$mechanism.classList.contains('ready');
    render();
    const isReady=goalMet();
    $mechanism.classList.toggle('ready',isReady);
    if(isReady&&!wasReady) SFX.ready();
  }

  function shakeUniversalLock(){
    if(!$mechanism || solved) return;
    $mechanism.classList.remove('shake-fail');
    void $mechanism.offsetWidth;
    $mechanism.classList.add('shake-fail');
    setTimeout(()=> $mechanism.classList.remove('shake-fail'), 380);
  }

  function handleUniversalLockClick(){
    if(shopOpen || solved) return;
    const solvedBefore = solved;
    GameActions.attemptOpen({modeId:mode,source:'universal-lock'});
    if(!solved && !solvedBefore) shakeUniversalLock();
  }

  function tryOpenLock(){
    return GameActions.attemptOpen({modeId:mode,source:'legacy'});
  }

  function tryOpenBaseLock(){
    if(solved || shopOpen) return;

    if(!goalMet()){
      $mechanism.classList.remove('ready');
      nudgeTools();
      SFX.wrongLock();
      toast('Замок ещё не выставлен');
      return;
    }

    solved=true;
    SFX.open();
    $mechanism.classList.remove('ready');
    $mechanism.classList.add('opening');
    $lock.classList.add('win');
    render();

    const openingRoundId=activeRoundId;
    setTimeout(()=>{
      if(openingRoundId!==activeRoundId || !solved) return;
      $mechanism.classList.remove('opening');
      $mechanism.classList.add('opened');
      celebrate();
    },1000);
  }

  /* Mode files keep ownership of their puzzle-specific validation, but every
     UI surface enters through GameActions.attemptOpen. Lambdas intentionally
     resolve the function variables at call time: the inventory/tension layer
     may wrap those functions later without leaving stale registrations. */
  GameActions.registerOpeners({
    classic:()=>tryOpenBaseLock(),
    target:()=>tryOpenBaseLock(),
    line:()=>tryOpenBaseLock(),
    sequence:()=>tryOpenBaseLock(),
    special:()=>tryOpenBaseLock(),
    tension:()=>PuzzleModes.call('tension','attemptOpen'),
    resonance:()=>PuzzleModes.call('resonance','attemptOpen'),
    deduction:()=>PuzzleModes.call('deduction','attemptOpen'),
    composite:()=>PuzzleModes.call('composite','attemptOpen'),
    heatcold:()=>scanHeatCold(),
    drum:()=>checkDrum(),
    scope:()=>checkScope(),
    anach:()=>PuzzleModes.call('anach','attemptOpen'),
    skyrim:()=>PuzzleModes.call('skyrim','attemptOpen'),
    r2:()=>PuzzleModes.call('r2','attemptOpen'),
    g1:()=>PuzzleModes.call('g1','attemptOpen'),
    hillsfar:()=>PuzzleModes.call('hillsfar','attemptOpen'),
    mass:()=>PuzzleModes.call('mass','attemptOpen'),
    oblivion:()=>PuzzleModes.call('oblivion','attemptOpen'),
    watchmen:()=>PuzzleModes.call('watchmen','attemptOpen'),
    museum:()=>PuzzleModes.call('museum','attemptOpen'),
    mass2:()=>PuzzleModes.call('mass2','attemptOpen'),
    pipeline:()=>PuzzleModes.call('pipeline','attemptOpen'),
    wharf:()=>tryOpenWharf(),
    thiefds:()=>tryOpenThiefDs(),
    kingdomcome:()=>tryOpenKingdomCome(),
    thief12:()=>tryOpenThief12(),
    fallout:()=>tryOpenFallout(),
    anachlab:()=>tryOpenAnachLab(),
    masshack:()=>tryOpenMassHack(),
    pathologic:()=>tryOpenPathologic(),
    bioshock2:()=>tryOpenBioshock2(),
    alphaprotocol:()=>tryOpenAlphaProtocol()
  });

  function select(delta){
    if(PuzzleModes.input(mode,'vertical',delta)) return;
    if(mode==='wharf'){
      if(delta<0) return wfTry();
      return;
    }
    if(mode==='thiefds'){
      tdsSelectRing(tdsSelectedRing+(delta<0?-1:1));
      return;
    }
    if(mode==='kingdomcome'){
      kcdKeyMove(delta<0?'up':'down');
      return;
    }
    if(mode==='thief12') return;
    if(mode==='fallout') return;
    if(mode==='anachlab'){ alabAdjustDigit(delta<0?1:-1); return; }
    if(mode==='masshack'){ if(delta<0) hackIn(); else hackOut(); return; }
    if(mode==='pathologic') return;
    if(mode==='bioshock2') return;
    if(mode==='alphaprotocol'){ apMovePin(delta<0?-1:1); return; }
    if(mode==='heatcold'||mode==='drum'||mode==='scope') return;
    if(solved)return;
    selected=(selected+delta+n)%n;
    SFX.select();
    render();
  }

  function render(){
    if(plateEls.length!==n) rebuildPlates();
    for(let i=0;i<n;i++) updatePlateVisual(i);

    updatePickUI();
    if(PuzzleModes.has(mode)){ $mechanism.classList.remove('ready'); }
    else if(mode==='wharf'){ $mechanism.classList.remove('ready'); }
    else if(mode==='thiefds'){ $mechanism.classList.remove('ready'); }
    else if(mode==='kingdomcome'){ $mechanism.classList.remove('ready'); }
    else if(mode==='thief12'){ $mechanism.classList.remove('ready'); }
    else if(mode==='fallout'){ $mechanism.classList.remove('ready'); }
    else if(mode==='anachlab'){ $mechanism.classList.remove('ready'); }
    else if(mode==='masshack'){ $mechanism.classList.remove('ready'); }
    else if(mode==='pathologic'){ $mechanism.classList.remove('ready'); }
    else if(mode==='bioshock2'){ $mechanism.classList.remove('ready'); }
    else if(mode==='alphaprotocol'){ $mechanism.classList.remove('ready'); }
    else if(mode==='g1'){ $mechanism.classList.remove('ready'); }
    else if(mode==='mass'){ $mechanism.classList.remove('ready'); }
    else if(mode!=='hillsfar') $mechanism.classList.toggle('ready',!solved && goalMet());
    else $mechanism.classList.remove('ready');
    $status.innerHTML = '';
  }

  // Все динамические эффекты идут через requestAnimationFrame:
  // на дисплее 120 Гц браузер отрисовывает их до 120 кадров/с.
  let lastFrame=performance.now();
  const ACTIVE_FRAME_MS=24;
  function scheduleAnimationLoop(delay=ACTIVE_FRAME_MS){
    setTimeout(()=>requestAnimationFrame(animationLoop),delay);
  }
  let animationLoopParked=false;
  function animationLoop(now){
    const dt=Math.min(50,now-lastFrame);
    lastFrame=now;
    if(isWorldPaused()){ animationLoopParked=true; return; }
    animationLoopParked=false;
    const lerp = 1 - Math.pow(0.001, dt/1000);
    pointerX += (pointerTargetX - pointerX) * lerp;
    pointerY += (pointerTargetY - pointerY) * lerp;
    bgParallaxX += (bgParallaxTargetX - bgParallaxX) * lerp;
    bgParallaxY += (bgParallaxTargetY - bgParallaxY) * lerp;
    document.body.style.setProperty('--bg-parallax-x', `${bgParallaxX.toFixed(2)}px`);
    document.body.style.setProperty('--bg-parallax-y', `${bgParallaxY.toFixed(2)}px`);
    toolMotionController.setTarget(toolMotionController.targetFromLinear(state,selected,{min:MIN,max:MAX}));

    $lock.style.setProperty('--px', `${pointerX.toFixed(2)}px`);
    $lock.style.setProperty('--py', `${pointerY.toFixed(2)}px`);
    if(plateEls.length){
      for(const p of plateEls){
        const px=`${pointerX.toFixed(2)}px`;
        const py=`${pointerY.toFixed(2)}px`;
        p.style.setProperty('--px',px);
        p.style.setProperty('--py',py);
        if(p._pinTopPlate){
          p._pinTopPlate.style.setProperty('--px',px);
          p._pinTopPlate.style.setProperty('--py',py);
        }
      }
    }
    if(!solved) PuzzleModes.call(mode,'tick',{now,dt});
    if(mode==='thiefds' && !solved){
      tdsTick(Math.min(.05,dt/1000));
    }
    if(mode==='kingdomcome' && !solved){
      kcdTick(Math.min(.04,dt/1000));
    }
    if(mode==='thief12' && !solved){
      th12Tick(Math.min(.05,dt/1000));
    }
    if(mode==='fallout' && !solved){
      sfTick(Math.min(.04,dt/1000));
    }
    if(mode==='anachlab' && !solved){
      alabTick(Math.min(.05,dt/1000));
    }
    if(mode==='masshack' && !solved){
      hackTick(Math.min(.05,dt/1000));
    }
    if(mode==='pathologic' && !solved){
      ptgTick(Math.min(.035,dt/1000));
    }
    if(mode==='bioshock2' && !solved){
      bioTick(Math.min(.04,dt/1000));
    }
    if(mode==='alphaprotocol' && !solved){
      apTick(Math.min(.05,dt/1000));
    }
    scheduleAnimationLoop(solved ? 160 : ACTIVE_FRAME_MS);
  }
  window.addEventListener('keynlock-world-pausechange',event=>{
    if(!event.detail?.paused && animationLoopParked){
      animationLoopParked=false;
      lastFrame=performance.now();
      requestAnimationFrame(animationLoop);
    }
  });
