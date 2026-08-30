(function(){
  // ===== ANACHRONOX =====
  let anTarget=[0,0,0], anState=[0,0,0], anInitialState=[0,0,0], anSelected=0;
  function anReadoutValue(){
    const distance=Math.abs(anState[0]-anTarget[0]) + Math.abs(anState[1]-anTarget[1]) + Math.abs(anState[2]-anTarget[2]);
    return Math.max(0, 100 - distance*2.5);
  }

  function anSolved(){
    return anState.every((v,i)=>v===anTarget[i]);
  }

  function renderAn(){
    const channels=[...document.querySelectorAll('.anChannel')];
    channels.forEach((ch,i)=>{
      ch.classList.toggle('selected',i===anSelected && !solved);
      const level=ch.querySelector('.anLevel');
      const value=ch.querySelector('.anValue');
      if(level) level.style.height = `${18 + anState[i]*18}px`;
      if(value) value.textContent = anState[i];
    });
    const score = anReadoutValue();
    $anReadout.textContent = score.toFixed(1);
    if($anSelectedHint) $anSelectedHint.textContent = `Выбран канал ${anSelected + 1} из 3 · текущее значение ${anState[anSelected]}`;
    const ready = !solved && anSolved();
    $anUnlock.classList.toggle('ready', ready);
    if(solved) $anActionLabel.textContent = 'Контур открыт';
    else if(ready) $anActionLabel.textContent = 'Сигнал 100.0 · нажми на панель';
    else $anActionLabel.textContent = 'Меняй выбранный канал W / S и добивайся роста числа сверху';
  }

  function startAnRound(){
    solved=false;
    $lock.classList.remove('win');
    $mechanism.classList.remove('ready','opening','opened');
    picks=pickCapacity;
    moves=0;
    brokenPicks=0;
    runReward=1000;
    const anMax=diffStep(6,8,9,'anach');
    const minDistance=diffStep(6,10,14,'anach');
    let dist=0;
    do{
      anTarget=[rand(0,anMax),rand(0,anMax),rand(0,anMax)];
      anState=[rand(0,anMax),rand(0,anMax),rand(0,anMax)];
      dist=Math.abs(anState[0]-anTarget[0]) + Math.abs(anState[1]-anTarget[1]) + Math.abs(anState[2]-anTarget[2]);
    }while(dist<minDistance || anSolved());
    anInitialState=[...anState];
    anSelected=0;
    generatedDistance = dist;
    updateEconomyUI();
    renderAn();
  }

  function moveAn(dir){
    if(solved) return;
    const next = Math.max(0, Math.min(2, anSelected + dir));
    if(next===anSelected){ SFX.blocked(); return; }
    anSelected = next;
    SFX.select();
    renderAn();
  }

  function adjustAn(step, forcedCol=null){
    if(solved) return;
    const col = forcedCol==null ? anSelected : Math.max(0,Math.min(2,forcedCol));
    if(forcedCol!=null && col!==anSelected){ anSelected=col; }
    const next = Math.max(0, Math.min(9, anState[col] + step));
    if(next===anState[col]){ SFX.blocked(); return; }
    anState[col]=next;
    registerMove();
    SFX.move();
    renderAn();
    if(anSolved()) SFX.ready();
  }

  function tryOpenAn(){
    if(shopOpen || solved) return;
    if(!anSolved()){
      SFX.wrongLock();
      damagePick({
        resetProgress:()=>{ anState=[...anInitialState]; },
        renderState:renderAn,
        surviveText:'Сигнал ещё не собран'
      });
      return;
    }
    solved=true;
    $lock.classList.add('win');
    SFX.open();
    renderAn();
    setTimeout(()=>celebrate(),420);
  }

  document.querySelectorAll('[data-an-col]').forEach(btn=>btn.addEventListener('click',e=>{
    e.stopPropagation();
    adjustAn(btn.dataset.anDir==='up'?1:-1,Number(btn.dataset.anCol));
  }));
  document.querySelectorAll('.anChannel').forEach(ch=>ch.addEventListener('click',e=>{
    if(e.target.closest('.anBtn')) return;
    anSelected=Number(ch.dataset.col);
    SFX.select();
    renderAn();
  }));

  PuzzleModes.register({
    id:'anach', start:startAnRound, render:renderAn,
    objective:()=>GameCatalog.get('anach')?.objective,
    restartMessage:'Новый контур Anachronox',
    input:{horizontal:moveAn,vertical:delta=>adjustAn(delta<0?1:-1)},
    attemptOpen:tryOpenAn
  });
})();

