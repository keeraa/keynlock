(function(){
  // ===== turnmemory =====
  let turnmemorySequence=[], turnmemoryInput=[], turnmemoryLength=4;
  const TURNMEMORY_SYMBOL_PATHS={
    bar:'M0 -7V7',
    kink:'M-7 -6H-1Q6 -6 6 1V7',
    wave:'M0 -8C-5 -5 5 -2 0 1S5 7 0 9',
    hook:'M-3 8V0C-3 -7 7 -7 7 0V3',
    angle:'M6 -8L-2 0L6 8'
  };

  function turnmemorySymbolFrame(type){
    const path=TURNMEMORY_SYMBOL_PATHS[type]||TURNMEMORY_SYMBOL_PATHS.bar;
    const marks=[];
    [18,38,58,78].forEach(x=>{
      marks.push(`<path transform="translate(${x} 8)" d="${path}"/>`);
      marks.push(`<path transform="translate(${x} 92) rotate(180)" d="${path}"/>`);
    });
    [28,50,72].forEach(y=>{
      marks.push(`<path transform="translate(8 ${y}) rotate(-90)" d="${path}"/>`);
      marks.push(`<path transform="translate(92 ${y}) rotate(90)" d="${path}"/>`);
    });
    return `<svg class="turnmemorySymbolFrame" viewBox="0 0 100 100" aria-hidden="true">${marks.join('')}</svg>`;
  }

  function renderTURNMEMORYRow(container, arr, size=4){
    container.innerHTML = '';
    const symbolType=window.getKeynlockTensionRequirement?.()?.type||'bar';
    container.dataset.symbol=symbolType;
    for(let i=0;i<size;i++){
      const slot=document.createElement('div');
      const val = arr[i];
      slot.className = 'turnmemorySlot ' + (val==null ? 'empty' : (val < 0 ? 'left' : 'right'));
      slot.insertAdjacentHTML('beforeend',turnmemorySymbolFrame(symbolType));
      container.appendChild(slot);
    }
  }

  function renderTURNMEMORY(){
    renderTURNMEMORYRow($turnmemoryProgressRow, turnmemoryInput, turnmemoryLength);
    const ready = turnmemoryInput.length === turnmemoryLength && turnmemoryInput.every((v,i)=>v===turnmemorySequence[i]);
  }

  function startTURNMEMORYRound(){
    solved=false;
    $lock.classList.remove('win');
    $mechanism.classList.remove('ready','opening','opened');
    picks=pickCapacity;
    moves=0;
    brokenPicks=0;
    runReward=100;
    turnmemoryLength=diffStep(4,6,8,'turnmemory');
    turnmemoryInput=[];
    turnmemorySequence = Array.from({length:turnmemoryLength}, ()=> Math.random() < .5 ? -1 : 1);
    if(turnmemorySequence.every(v=>v===turnmemorySequence[0])) turnmemorySequence[rand(0,turnmemoryLength-1)] *= -1;
    generatedDistance = turnmemoryLength;
    updateEconomyUI();
    renderTURNMEMORY();
  }

  function turnmemoryPress(dir){
    if(solved) return;
    const expected = turnmemorySequence[turnmemoryInput.length];
    registerMove();
    if(dir === expected){
      turnmemoryInput.push(dir);
      SFX.move();
      renderTURNMEMORY();
      if(turnmemoryInput.length === turnmemoryLength){
        SFX.ready();
      }
    }else{
      damagePick({
        resetProgress:()=>{ turnmemoryInput=[]; },
        renderState:renderTURNMEMORY,
        surviveText:'Неверная команда'
      });
    }
  }

  function tryOpenTURNMEMORY(auto=false){
    if(solved) return;
    const ready = turnmemoryInput.length === turnmemoryLength && turnmemoryInput.every((v,i)=>v===turnmemorySequence[i]);
    if(!ready){
      if(!auto){
        SFX.wrongLock();
        toast('Сначала собери правильную последовательность');
      }
      return;
    }
    solved = true;
    $lock.classList.add('win');
    SFX.open();
    renderTURNMEMORY();
    setTimeout(()=>celebrate(), 420);
  }

  PuzzleModes.register({
    id:'turnmemory', start:startTURNMEMORYRound, render:renderTURNMEMORY,
    objective:()=>`УГАДАТЬ ПОСЛЕДОВАТЕЛЬНОСТЬ ИЗ ${turnmemoryLength} ШАГОВ`,
    restartMessage:'Новая последовательность',
    input:{horizontal:turnmemoryPress,vertical:()=>{}},
    attemptOpen:tryOpenTURNMEMORY
  });
})();
