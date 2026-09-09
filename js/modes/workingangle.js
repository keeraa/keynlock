(function(){
  // ===== workingangle =====
  let skTargetAngle=0, skPickAngle=0, skCylinderAngle=0, skTorqueBusy=false, skDragging=false, skSolveTolerance=6;
  function skAngleDiff(){
    return Math.abs(skPickAngle-skTargetAngle);
  }

  function renderWorkingangleTensionPattern(type){
    const marks=document.querySelector('#skTensionPatternMarks');
    const outerMarks=document.querySelector('#skTensionPatternOuterMarks');
    const outerRing=document.querySelector('.skOuterRing');
    const circleArt={
      bar:'/assets/workingangle/iron_circle_bar_06.png',
      hook:'/assets/workingangle/iron_circle_hook_03.png',
      kink:'/assets/workingangle/iron_circle_kink_01.png',
      wave:'/assets/workingangle/iron_circle_wave_04.png',
      angle:'/assets/workingangle/iron_circle_angle_05.png'
    };
    const art=currentMechanismLevel===1 ? circleArt[type] : '';
    outerRing?.classList.toggle('has-circle-art',Boolean(art));
    if(outerRing){
      if(art) outerRing.style.setProperty('--sk-circle-image',`url("${art}")`);
      else outerRing.style.removeProperty('--sk-circle-image');
    }
    if(!marks || !outerMarks || marks.dataset.type===type) return;
    const symbols={
      bar:'M0 -7V7',
      kink:'M-7 -6H-1Q6 -6 6 1V7',
      wave:'M0 -8C-5 -5 5 -2 0 1S5 7 0 9',
      hook:'M-3 8V0C-3 -7 7 -7 7 0V3',
      angle:'M6 -8L-2 0L6 8'
    };
    const path=symbols[type]||symbols.bar;
    marks.dataset.type=type||'bar';
    marks.innerHTML=Array.from({length:28},(_,i)=>{
      const angle=(360/28)*i;
      return `<g transform="rotate(${angle} 280 280) translate(280 105)"><path d="${path}"/></g>`;
    }).join('');
    outerMarks.innerHTML=Array.from({length:36},(_,i)=>{
      const angle=(360/36)*i;
      return `<g transform="rotate(${angle} 280 280) translate(280 48) scale(.82)"><path d="${path}"/></g>`;
    }).join('');
  }

  function renderWorkingangle(){
    $skBoard.style.setProperty('--pick-angle',`${skPickAngle.toFixed(1)}deg`);
    $skBoard.style.setProperty('--cylinder-angle',`${skCylinderAngle.toFixed(1)}deg`);
    const diff=skAngleDiff();
    const ready=diff<=skSolveTolerance && !solved;
    $skMode.classList.toggle('ready',ready);
    const requiredTension=window.getKeynlockTensionRequirement?.();
    renderWorkingangleTensionPattern(requiredTension?.type);

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

  function startWorkingangleRound(){
    solved=false;
    $lock.classList.remove('win');
    $mechanism.classList.remove('ready','opening','opened');
    document.querySelector('.skCenterLock')?.classList.remove('opening','opened');
    picks=pickCapacity;
    moves=0;
    brokenPicks=0;
    runReward=100;
    skSolveTolerance=diffStep(10,6,4,'workingangle');
    const angleRange=diffStep(42,60,72,'workingangle');
    skTargetAngle=rand(-angleRange,angleRange);
    skPickAngle=0;
    if(Math.abs(skTargetAngle)<14) skPickAngle = skTargetAngle>0 ? -28 : 28;
    skCylinderAngle=0;
    skTorqueBusy=false;
    generatedDistance=Math.max(3,Math.round(Math.abs(skTargetAngle-skPickAngle)/8)+1);
    updateEconomyUI();
    updatePickUI();
    renderWorkingangle();
  }

  function setWorkingangleAngle(angle){
    if(solved || skTorqueBusy) return;
    const desired=clamp(angle,-80,80);
    const distance=Math.abs(desired-skTargetAngle);
    const response=distance<=skSolveTolerance*2 ? .64 : distance<=skSolveTolerance*5 ? .36 : .18;
    skPickAngle=clamp(skPickAngle+(desired-skPickAngle)*response,-80,80);
    SFX.select();
    renderWorkingangle();
  }

  function moveWorkingangle(dir){
    if(solved || skTorqueBusy) return;
    const distance=skAngleDiff();
    const step=distance<=skSolveTolerance*2 ? 3 : distance<=skSolveTolerance*5 ? 2 : 1;
    skPickAngle=clamp(skPickAngle+dir*step,-80,80);
    SFX.select();
    renderWorkingangle();
  }

  function workingangleBreakPick(){
    return damagePick({
      resetProgress:()=>{ skPickAngle=0; },
      renderState:renderWorkingangle,
      surviveText:'Слишком сильное сопротивление'
    }).broke;
  }

  function tryTorqueWorkingangle(){
    if(solved || skTorqueBusy) return;
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
      renderWorkingangle();
      setTimeout(()=>{
        centerLock?.classList.remove('opening');
        centerLock?.classList.add('opened');
        renderWorkingangle();
        celebrate();
        skTorqueBusy=false;
      },980);
      return;
    }

    const normalized=clamp(1-diff/48,0,1);
    skCylinderAngle=10+62*normalized;
    SFX.move();
    renderWorkingangle();

    $skMode.classList.remove('torque-fail');
    void $skMode.offsetWidth;
    $skMode.classList.add('torque-fail');

    workingangleBreakPick();

    setTimeout(()=>{
      if(!solved){
        skCylinderAngle=0;
        renderWorkingangle();
      }
      skTorqueBusy=false;
    },680);
  }

  function workingangleAngleFromPointer(e){
    const r=$skBoard.getBoundingClientRect();
    const cx=r.left+r.width/2;
    const cy=r.top+r.height/2;
    const dx=e.clientX-cx;
    const dy=e.clientY-cy;
    const angle=Math.atan2(dx,-dy)*180/Math.PI;
    return clamp(angle,-80,80);
  }

  function workingangleWrongTool(){
    skPickAngle=0;
    skCylinderAngle=0;
    skTorqueBusy=false;
    const centerLock=document.querySelector('.skCenterLock');
    centerLock?.classList.remove('shake-fail');
    void centerLock?.offsetWidth;
    centerLock?.classList.add('shake-fail');
    setTimeout(()=>centerLock?.classList.remove('shake-fail'),380);
    renderWorkingangle();
  }

  $skBoard.addEventListener('pointerdown',e=>{
    if(mode!=='workingangle'||e.target.closest('.skTorqueButton')) return;
    skDragging=true;
    $skBoard.setPointerCapture?.(e.pointerId);
    setWorkingangleAngle(workingangleAngleFromPointer(e));
  });
  $skBoard.addEventListener('pointermove',e=>{
    if(mode!=='workingangle'||!skDragging) return;
    setWorkingangleAngle(workingangleAngleFromPointer(e));
  });
  $skBoard.addEventListener('pointerup',e=>{
    if(mode!=='workingangle') return;
    skDragging=false;
    $skBoard.releasePointerCapture?.(e.pointerId);
  });
  $skBoard.addEventListener('pointercancel',()=>{skDragging=false;});

  PuzzleModes.register({
    id:'workingangle', start:startWorkingangleRound, render:renderWorkingangle,
    objective:()=>GameCatalog.get('workingangle')?.objective,
    restartMessage:'Новая попытка: «Рабочий угол»',
    input:{
      horizontal:moveWorkingangle,
      vertical:delta=>{ if(delta<0) GameActions.attemptOpen({modeId:'workingangle',source:'keyboard'}); }
    },
    actions:{wrongTool:workingangleWrongTool},
    attemptOpen:tryTorqueWorkingangle
  });
})();
