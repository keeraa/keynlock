  function updateModeUI(){
    if($mapTab) $mapTab.classList.toggle('active',mapOpen);

    syncModePanels(mode);
    const isImported=IMPORTED_MODES.has(mode);
    $scene.classList.toggle('hideBase',isImported);
    document.body.classList.toggle('importedMode',isImported);
    document.body.classList.toggle('mode-hillsfar', mode==='hillsfar');
    document.body.classList.toggle('mode-mass', mode==='mass');
    document.body.classList.toggle('mode-skyrim', mode==='skyrim');
    document.body.classList.toggle('game-has-lock', !!GameCatalog.feature(mode,'lock.present'));
    document.body.classList.toggle('game-manual-open', !!GameCatalog.feature(mode,'lock.manualOpen'));
    document.body.classList.toggle('game-noise-sensor', !!GameCatalog.feature(mode,'world.noiseSensor'));
    document.body.dataset.gameMode=mode;
    if(mode!=='hillsfar') clearHillsfarTimer();
    if(mode==='hillsfar') setGlobalTimer(true, hfTimeLeft || hfTimeMax, hfTimeMax || 1, 'ТАЙМЕР');
    else setGlobalTimer(false);
if(mode==='classic'){
      $objectiveLine.innerHTML = `ЦЕЛЬ: <b>ПОДНЯТЬ ВСЕ ШТИФТЫ</b> · ${generatedDistance} ходов минимум`;
    }else if(mode==='target'){
      $objectiveLine.innerHTML = `ЦЕЛЬ: <b>СОВМЕСТИТЬ ШТЫРИ С СИНИМИ МЕТКАМИ</b> · ${generatedDistance} ходов минимум`;
    }else if(mode==='line'){
      $objectiveLine.innerHTML = `ЦЕЛЬ: <b>ВЫСТРОИТЬ ВСЕ ШТИФТЫ ПО ЛИНИИ ${goalLine}</b> · ${generatedDistance} ходов минимум`;
    }else if(mode==='sequence'){
      $objectiveLine.innerHTML = `КОД: <b>${targets.join(', ')}</b> · ${generatedDistance} ходов минимум`;
    }else if(mode==='special'){
      $objectiveLine.innerHTML = `ОСОБЫЙ ЗАМОК: <b>${specialTypeName()}</b> · ${generatedDistance} ходов минимум`;
    }else if(mode==='hillsfar'){
      $objectiveLine.innerHTML = 'ЦЕЛЬ: <b>ПОДОБРАТЬ ПРАВИЛЬНЫЙ КЛЮЧ</b>';
    }else if(mode==='mass'){
      $objectiveLine.innerHTML = 'ЦЕЛЬ: <b>ВЫСТРОИТЬ ВСЕ КОЛЬЦА И ОТКРЫТЬ ЗАМОК</b>';
    }else if(mode==='g1'){
      $objectiveLine.innerHTML = `ЦЕЛЬ: <b>УГАДАТЬ ПОСЛЕДОВАТЕЛЬНОСТЬ ИЗ ${g1Length} ШАГОВ</b>`;
    }else if(mode==='r2'){
      $objectiveLine.innerHTML = 'ЦЕЛЬ: <b>ПОДНЯТЬ ШТИФТЫ В ПРАВИЛЬНОМ ПОРЯДКЕ</b>';
    }else if(mode==='skyrim'){
      $objectiveLine.innerHTML = 'ЦЕЛЬ: <b>НАЙТИ ПРАВИЛЬНЫЙ УГОЛ ОТМЫЧКИ</b>';
    }else if(mode==='anach'){
      $objectiveLine.innerHTML = 'ЦЕЛЬ: <b>МЕНЯЙ 3 КАНАЛА ТАК, ЧТОБЫ ЧИСЛО ВЫРОСЛО ДО 100.0</b>';
    }else if(mode==='tension'){
      $objectiveLine.innerHTML = `ЦЕЛЬ: <b>УДЕРЖИВАТЬ НАТЯЖЕНИЕ В РАБОЧЕЙ ЗОНЕ И ПОСТАВИТЬ ${tnPinCount} ШТИФТОВ</b>`;
    }else if(mode==='resonance'){
      $objectiveLine.innerHTML = `ЦЕЛЬ: <b>ЗАФИКСИРОВАТЬ ${rsPinCount} ШТИФТОВ ТОЧНО НА ЗОЛОТОЙ ЛИНИИ</b>`;
    }else if(mode==='deduction'){
      $objectiveLine.innerHTML = 'ЦЕЛЬ: <b>ВОССТАНОВИТЬ ПРОФИЛЬ КЛЮЧА ПО ОБРАТНОЙ СВЯЗИ</b>';
    }else if(mode==='composite'){
      $objectiveLine.innerHTML = 'ЦЕЛЬ: <b>СОБРАТЬ ОТМЫЧКУ ИЗ 4 ЧАСТЕЙ ПОД ПРОФИЛЬ ШТИФТОВ</b>';
    }else if(mode==='heatcold'){
      $objectiveLine.innerHTML = 'ЦЕЛЬ: <b>ПОДОБРАТЬ 4-ЗНАЧНЫЙ КОД ПО ПОДСКАЗКАМ ТЕПЛО / ХОЛОДНО</b>';
    }else if(mode==='drum'){
      $objectiveLine.innerHTML = 'ЦЕЛЬ: <b>ВЫСТАВИТЬ 4 БАРАБАНА ПО СИЛЕ ЩЕЛЧКА</b>';
    }else if(mode==='scope'){
      $objectiveLine.innerHTML = 'ЦЕЛЬ: <b>СОВМЕСТИТЬ ТЕКУЩИЙ СИГНАЛ С ЭТАЛОНОМ</b>';
    }else if(mode==='oblivion'){
      $objectiveLine.innerHTML = 'ЦЕЛЬ: <b>ПОДНЯТЬ И ЗАФИКСИРОВАТЬ ВСЕ ШТИФТЫ</b>';
    }
  }

  window.addEventListener('keynlock-game-catalog-change',event=>{
    if(!event.detail?.id || event.detail.id===mode)updateModeUI();
  });

  function getVisibleLockArts(){
    return [...document.querySelectorAll('.mechanismZone, .sharedModeLockArt')].filter(el=>{
      const st=getComputedStyle(el);
      const r=el.getBoundingClientRect();
      return st.display!=='none' && st.visibility!=='hidden' && r.width>0 && r.height>0;
    });
  }

  function setGameInactive(flag){
    document.body.classList.toggle('game-inactive', !!flag);
    if(!flag){
      document.body.classList.remove('solved-notice-visible');
    }
  }

  let activeRoundId=0;
  function scheduleRoundAction(action,delay){
    const roundId=activeRoundId;
    return setTimeout(()=>{
      if(roundId!==activeRoundId) return;
      action();
    },delay);
  }
  function beginRoundState(){
    activeRoundId++;
    gameDefeat.reset();
    setGameInactive(false);
    setToastActionLabel('Новый замок');
    document.querySelectorAll('.mechanismZone, .sharedModeLockArt').forEach(el=>{
      el.classList.remove('opening','opened');
    });
    window.onKeynlockRoundStarted?.(activeRoundId);
  }

  function restartCurrentRound(){
    if(shopOpen) closeShop();
    if(lairOpen) closeLair();
    if(mapOpen) closeMap();
    newLock(false);
    SFX.newRound?.();
  }

  function celebrate(){
    if(!solved||gameDefeat.isActive()) return;
    const completedRoundId=activeRoundId;
    awardRun();
    setGameInactive(true);
    document.body.classList.remove('solved-notice-visible');
    setTimeout(()=>{
      if(completedRoundId!==activeRoundId) return;
      if(solved && document.body.classList.contains('game-inactive')){
        document.body.classList.add('solved-notice-visible');
      }
    },1100);
    // После успешного прохождения не показываем общий toast/кнопку «Новый замок».
    $toast.classList.remove('show','actionable');
    $toastText.textContent='';

    // Во всех режимах доигрываем анимацию открытия и оставляем замок раскрытым.
    getVisibleLockArts().forEach(el=>{
      el.classList.remove('shake-fail','ready');
      if(el.classList.contains('opened')) return;
      if(!el.classList.contains('opening')){
        el.classList.add('opening');
        setTimeout(()=>{
          if(completedRoundId!==activeRoundId) return;
          el.classList.remove('opening');
          el.classList.add('opened');
        },1000);
      }
    });
  }

  function nudgeTools(){
    const tools=[...document.querySelectorAll('.mechanismZone, .sharedModeLockArt')];
    tools.forEach(el=>el.classList.remove('nudge'));
    // force a single reflow after clearing the class so animations restart
    void document.body.offsetWidth;
    tools.forEach(el=>{
      const r=el.getBoundingClientRect();
      if(r.width>0 && r.height>0) el.classList.add('nudge');
    });
  }

  function goalMet(){
    if(mode==='classic' || mode==='special') return state.every(v=>v===GOAL);
    if(mode==='target' || mode==='sequence') return state.every((v,i)=>v===targets[i]);
    return state.every(v=>v===goalLine);
  }
function stateKey(s){ return s.join(''); }

  function shortestDistance(start, goal, maxDepth=24){
    const targetKey=stateKey(goal);
    const startKey=stateKey(start);
    if(startKey===targetKey) return 0;

    const queue=[[start,0]];
    const seen=new Set([startKey]);
    let head=0;

    while(head<queue.length){
      const [cur,depth]=queue[head++];
      if(depth>=maxDepth) continue;

      for(let i=0;i<n;i++){
        for(const dir of [-1,1]){
          if(!legal(cur,i,dir)) continue;
          const next=applyRaw(cur,i,dir);
          const key=stateKey(next);
          if(seen.has(key)) continue;
          if(key===targetKey) return depth+1;
          seen.add(key);
          queue.push([next,depth+1]);
        }
      }
    }
    return Infinity;
  }

  function randomWalkFrom(goalState, steps){
    let s=[...goalState];
    let last=null;
    for(let k=0;k<steps;k++){
      const choices=[];
      for(let i=0;i<n;i++){
        for(const dir of [-1,1]){
          if(!legal(s,i,dir)) continue;
          if(last && last.i===i && last.dir===-dir) continue;
          choices.push({i,dir});
        }
      }
      if(!choices.length) break;
      const c=choices[rand(0,choices.length-1)];
      s=applyRaw(s,c.i,c.dir);
      last=c;
    }
    return s;
  }

  function generateLinkedPuzzle(goal, minMoves=7, maxMoves=12){
    const goalState=Array(n).fill(goal);
    let best=null;
    let bestScore=-Infinity;

    for(let attempt=0;attempt<80;attempt++){
      const steps=rand(minMoves,maxMoves+6);
      const candidate=randomWalkFrom(goalState,steps);
      if(candidate.every(v=>v===goal)) continue;

      const distance=shortestDistance(candidate,goalState,maxMoves+8);
      if(Number.isFinite(distance) && distance>=minMoves && distance<=maxMoves){
        generatedDistance=distance;
        return candidate;
      }

      if(Number.isFinite(distance)){
        const score=-Math.abs(distance-(minMoves+maxMoves)/2);
        if(score>bestScore){
          best=[...candidate];
          bestScore=score;
          generatedDistance=distance;
        }
      }
    }

    if(best) return best;
    generatedDistance=minMoves;
    return randomWalkFrom(goalState,minMoves);
  }

  function independentDistance(a,b){
    return a.reduce((sum,v,i)=>sum+Math.abs(v-b[i]),0);
  }

  function makeSmartTargetModeStart(minMoves=8,maxMoves=14){
    for(let attempt=0;attempt<100;attempt++){
      const t=Array.from({length:n},()=>rand(MIN,MAX));
      const s=Array.from({length:n},()=>rand(MIN,MAX));
      const d=independentDistance(s,t);
      if(d>=minMoves && d<=maxMoves){
        targets=t;
        state=s;
        generatedDistance=d;
        return;
      }
    }
    targets=[2,3,4,5,6];
    state=[6,5,4,3,2];
    generatedDistance=12;
  }
