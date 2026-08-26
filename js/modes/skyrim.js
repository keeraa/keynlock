  // ===== SKYRIM =====
  function skAngleDiff(){
    return Math.abs(skPickAngle-skTargetAngle);
  }

  function renderSkyrim(){
    $skBoard.style.setProperty('--pick-angle',`${skPickAngle.toFixed(1)}deg`);
    $skBoard.style.setProperty('--cylinder-angle',`${skCylinderAngle.toFixed(1)}deg`);
    const diff=skAngleDiff();
    const ready=diff<=skSolveTolerance && !solved;
    $skMode.classList.toggle('ready',ready);
    const tensionHint=document.querySelector('#skTensionHint');
    const requiredTension=window.getKeynlockTensionRequirement?.();
    if(tensionHint) tensionHint.textContent=`Нужен натяжитель: ${requiredTension?.label || '—'}`;

    if(solved){
      $skFeedbackText.textContent='Замок открыт';
    }else if(ready){
      $skFeedbackText.textContent='Почти без сопротивления — проверни замок';
    }else if(diff<=skSolveTolerance*2.5){
      $skFeedbackText.textContent='Механизм поддаётся';
    }else if(diff<=skSolveTolerance*5){
      $skFeedbackText.textContent='Есть сопротивление';
    }else{
      $skFeedbackText.textContent='Сильное сопротивление';
    }
  }

  function startSkyrimRound(){
    solved=false;
    $lock.classList.remove('win');
    $mechanism.classList.remove('ready','opening','opened');
    document.querySelector('.skCenterLock')?.classList.remove('opening','opened');
    picks=pickCapacity;
    moves=0;
    brokenPicks=0;
    runReward=1000;
    skSolveTolerance=diffStep(10,6,4,'skyrim');
    const angleRange=diffStep(42,60,72,'skyrim');
    skTargetAngle=rand(-angleRange,angleRange);
    skPickAngle=0;
    if(Math.abs(skTargetAngle)<14) skPickAngle = skTargetAngle>0 ? -28 : 28;
    skCylinderAngle=0;
    skTorqueBusy=false;
    generatedDistance=Math.max(3,Math.round(Math.abs(skTargetAngle-skPickAngle)/8)+1);
    updateEconomyUI();
    updatePickUI();
    renderSkyrim();
  }

  function setSkyrimAngle(angle){
    if(solved || skTorqueBusy) return;
    const desired=clamp(angle,-80,80);
    const distance=Math.abs(desired-skTargetAngle);
    const response=distance<=skSolveTolerance*2 ? .78 : distance<=skSolveTolerance*5 ? .54 : .34;
    skPickAngle=clamp(skPickAngle+(desired-skPickAngle)*response,-80,80);
    SFX.select();
    renderSkyrim();
  }

  function moveSkyrim(dir){
    if(solved || skTorqueBusy) return;
    const distance=skAngleDiff();
    const step=distance<=skSolveTolerance*2 ? 4 : distance<=skSolveTolerance*5 ? 3 : 2;
    skPickAngle=clamp(skPickAngle+dir*step,-80,80);
    SFX.select();
    renderSkyrim();
  }

  function skyrimBreakPick(){
    return damagePick({
      resetProgress:()=>{ skPickAngle=0; },
      renderState:renderSkyrim,
      surviveText:'Слишком сильное сопротивление'
    }).broke;
  }

  function tryTorqueSkyrim(){
    if(shopOpen || solved || skTorqueBusy) return;
    skTorqueBusy=true;
    registerMove();

    const diff=skAngleDiff();
    if(diff<=skSolveTolerance){
      solved=true;
      skCylinderAngle=0;
      $lock.classList.add('win');
      const centerLock=document.querySelector('.skCenterLock');
      centerLock?.classList.add('opening');
      SFX.open();
      renderSkyrim();
      setTimeout(()=>{
        centerLock?.classList.remove('opening');
        centerLock?.classList.add('opened');
        renderSkyrim();
        celebrate();
        skTorqueBusy=false;
      },980);
      return;
    }

    const normalized=clamp(1-diff/48,0,1);
    skCylinderAngle=10+62*normalized;
    SFX.move();
    renderSkyrim();

    $skMode.classList.remove('torque-fail');
    void $skMode.offsetWidth;
    $skMode.classList.add('torque-fail');

    skyrimBreakPick();

    setTimeout(()=>{
      if(!solved){
        skCylinderAngle=0;
        renderSkyrim();
      }
      skTorqueBusy=false;
    },680);
  }

  function skyrimAngleFromPointer(e){
    const r=$skBoard.getBoundingClientRect();
    const cx=r.left+r.width/2;
    const cy=r.top+r.height/2;
    const dx=e.clientX-cx;
    const dy=e.clientY-cy;
    const angle=Math.atan2(dx,-dy)*180/Math.PI;
    return clamp(angle,-80,80);
  }
