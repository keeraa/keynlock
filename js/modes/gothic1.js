(function(){
  // ===== GOTHIC 1 =====
  let g1Sequence=[], g1Input=[], g1Length=4;
  const G1_SYMBOL_PATHS={
    bar:'M0 -7V7',
    kink:'M-7 -6H-1Q6 -6 6 1V7',
    wave:'M0 -8C-5 -5 5 -2 0 1S5 7 0 9',
    hook:'M-3 8V0C-3 -7 7 -7 7 0V3',
    angle:'M6 -8L-2 0L6 8'
  };

  function g1SymbolFrame(type){
    const path=G1_SYMBOL_PATHS[type]||G1_SYMBOL_PATHS.bar;
    const marks=[];
    [18,38,58,78].forEach(x=>{
      marks.push(`<path transform="translate(${x} 8)" d="${path}"/>`);
      marks.push(`<path transform="translate(${x} 92) rotate(180)" d="${path}"/>`);
    });
    [28,50,72].forEach(y=>{
      marks.push(`<path transform="translate(8 ${y}) rotate(-90)" d="${path}"/>`);
      marks.push(`<path transform="translate(92 ${y}) rotate(90)" d="${path}"/>`);
    });
    return `<svg class="g1SymbolFrame" viewBox="0 0 100 100" aria-hidden="true">${marks.join('')}</svg>`;
  }

  function renderG1Row(container, arr, size=4){
    container.innerHTML = '';
    const symbolType=window.getKeynlockTensionRequirement?.()?.type||'bar';
    container.dataset.symbol=symbolType;
    for(let i=0;i<size;i++){
      const slot=document.createElement('div');
      const val = arr[i];
      slot.className = 'g1Slot ' + (val==null ? 'empty' : (val < 0 ? 'left' : 'right'));
      slot.insertAdjacentHTML('beforeend',g1SymbolFrame(symbolType));
      container.appendChild(slot);
    }
  }

  function renderG1(){
    renderG1Row($g1ProgressRow, g1Input, g1Length);
    const ready = g1Input.length === g1Length && g1Input.every((v,i)=>v===g1Sequence[i]);
  }

  function startG1Round(){
    solved=false;
    $lock.classList.remove('win');
    $mechanism.classList.remove('ready','opening','opened');
    picks=pickCapacity;
    moves=0;
    brokenPicks=0;
    runReward=1000;
    g1Length=diffStep(4,6,8,'g1');
    g1Input=[];
    g1Sequence = Array.from({length:g1Length}, ()=> Math.random() < .5 ? -1 : 1);
    if(g1Sequence.every(v=>v===g1Sequence[0])) g1Sequence[rand(0,g1Length-1)] *= -1;
    generatedDistance = g1Length;
    updateEconomyUI();
    renderG1();
  }

  function g1Press(dir){
    if(shopOpen || solved) return;
    const expected = g1Sequence[g1Input.length];
    registerMove();
    if(dir === expected){
      g1Input.push(dir);
      SFX.move();
      renderG1();
      if(g1Input.length === g1Length){
        SFX.ready();
      }
    }else{
      damagePick({
        resetProgress:()=>{ g1Input=[]; },
        renderState:renderG1,
        surviveText:'Неверная команда'
      });
    }
  }

  function tryOpenG1(auto=false){
    if(shopOpen || solved) return;
    const ready = g1Input.length === g1Length && g1Input.every((v,i)=>v===g1Sequence[i]);
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
    renderG1();
    setTimeout(()=>celebrate(), 420);
  }

  PuzzleModes.register({
    id:'g1', start:startG1Round, render:renderG1,
    objective:()=>`УГАДАТЬ ПОСЛЕДОВАТЕЛЬНОСТЬ ИЗ ${g1Length} ШАГОВ`,
    restartMessage:'Новая последовательность',
    input:{horizontal:g1Press,vertical:()=>{}},
    attemptOpen:tryOpenG1
  });
})();
