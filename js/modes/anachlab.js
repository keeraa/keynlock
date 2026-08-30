(function(){
  // ===== ANACHRONOX — ЛАБОРАТОРИЯ (anachlab) =====
  let alabSecret=[0,0,0], alabVals=[0,0,0], alabMeters=[0,0,0], alabSlot=0, alabChecked=[new Set(),new Set(),new Set()], alabFailed=false, alabTimeLeft=30, alabTimeMax=30, alabLastHint='';
  // A 3-digit hidden code. Select a dial, dial in a candidate digit, and
  // test it: the meter shows how close that digit is (circular distance,
  // so 9 is one step from 0). Testing the same digit on the same dial
  // twice breaks a pick; nothing else during dialing/testing does. Once
  // every dial has been tested at least once and the code matches, the
  // lock opens — attempting to open before that (wrong code, or before
  // every dial's been tried) also breaks a pick. Ported from the old
  // prototype scene (prototypes/lockpicking-mechanics-v63.html, the
  // "// Anachronox" module) into a fully native mode: the distance/checked
  // logic carries over faithfully, wired through the shared economy
  // (damagePick) instead of the prototype's own LockRuntime shim and hard,
  // unconditional pick break.
  //
  // Naming note: there is a SEPARATE, unrelated native mode also called
  // "Anachronox" (mode id 'anach', js/modes/anachronox.js — a channel-tuning
  // game, not this one) that already owns every "an"-prefixed identifier.
  // Everything here uses an "alab" prefix instead so the two never collide
  // in the shared module scope.

  const alabSlotEls=[];

  function alabCorrect(){ return alabVals.every((v,i)=>v===alabSecret[i]); }
  function alabAllChecked(){ return alabChecked.length===3 && alabChecked.every(set=>set.size>0); }

  function startAnachLabRound(){
    solved=false;
    $lock.classList.remove('win');
    $mechanism.classList.remove('ready','opening','opened');
    picks=pickCapacity;
    moves=0;
    brokenPicks=0;
    runReward=1000;
    alabSecret=[0,1,2].map(()=>Math.floor(Math.random()*10));
    alabVals=[0,0,0];
    alabMeters=[0,0,0];
    alabSlot=0;
    alabChecked=[new Set(),new Set(),new Set()];
    alabFailed=false;
    alabTimeMax=diffStep(36,30,24,'anachlab');
    alabTimeLeft=alabTimeMax;
    alabLastHint='';
    generatedDistance=(alabSecret.reduce((s,v)=>s+Math.min(v,10-v),0)+4)*2;
    updateEconomyUI();
    renderAnachLab();
  }

  function alabBreakPick(reason){
    if(solved || alabFailed) return;
    SFX.wrongLock();
    damagePick({ renderState:renderAnachLab, surviveText:reason||'Отмычка сломалась' });
    renderAnachLab();
  }

  function alabSelectSlot(dir){
    if(solved || alabFailed) return;
    alabSlot=(alabSlot+dir+3)%3;
    SFX.select();
    renderAnachLab();
  }

  function alabAdjustDigit(d){
    if(solved || alabFailed) return;
    registerMove();
    alabVals[alabSlot]=(alabVals[alabSlot]+d+10)%10;
    SFX.move();
    renderAnachLab();
  }

  function alabTest(){
    if(solved || alabFailed) return;
    registerMove();
    const checked=alabChecked[alabSlot];
    const value=alabVals[alabSlot];
    if(checked.has(value)){
      alabBreakPick('Это число для этого тумблера уже проверялось');
      return;
    }
    checked.add(value);
    const diff=Math.abs(value-alabSecret[alabSlot]), c=Math.min(diff,10-diff);
    alabMeters[alabSlot]=Math.max(0,100-c*20);
    alabLastHint = c===0?'Точное значение!':c===1?'Очень близко — на один шаг':c<=2?'Близко':'Далеко';
    if(c===0 && alabCorrect()) alabLastHint='Код собран — теперь нажми на замок';
    SFX.move();
    renderAnachLab();
  }

  function tryOpenAnachLab(){
    if(shopOpen || solved || alabFailed) return;
    registerMove();
    if(alabCorrect() && alabAllChecked()){
      solved=true;
      $lock.classList.add('win');
      SFX.open();
      renderAnachLab();
      setTimeout(()=>celebrate(),420);
      return;
    }
    alabBreakPick(alabAllChecked() ? 'Код ещё неверный' : 'Сначала проверь все три цифры');
  }

  function alabTick(dt){
    if(mode!=='anachlab' || solved || alabFailed) return;
    alabTimeLeft=Math.max(0,alabTimeLeft-dt);
    if(alabTimeLeft<=0){
      alabTimeLeft=0;
      alabFailed=true;
    }
    renderAnachLab();
  }

  function renderAnachLab(){
    if(!$alabSlots) return;
    setGlobalTimer(mode==='anachlab' && !alabFailed, alabTimeLeft, alabTimeMax, 'ТАЙМЕР');
    if(alabSlotEls.length!==3){
      const frag=document.createDocumentFragment();
      alabSlotEls.length=0;
      for(let i=0;i<3;i++){
        const el=document.createElement('div');
        el.className='alabSlot';
        const up=document.createElement('button');
        up.className='alabStep alabPlus';
        up.type='button';
        up.textContent='+';
        up.addEventListener('click',e=>{ e.stopPropagation(); alabSlot=i; alabAdjustDigit(1); });
        const digit=document.createElement('button');
        digit.className='alabDigitBtn';
        digit.type='button';
        digit.addEventListener('click',()=>{ alabSlot=i; renderAnachLab(); });
        const down=document.createElement('button');
        down.className='alabStep alabMinus';
        down.type='button';
        down.textContent='−';
        down.addEventListener('click',e=>{ e.stopPropagation(); alabSlot=i; alabAdjustDigit(-1); });
        const meter=document.createElement('div');
        meter.className='alabMeter';
        const meterFill=document.createElement('span');
        meter.appendChild(meterFill);
        el.append(up,digit,down,meter);
        frag.appendChild(el);
        alabSlotEls.push({el,digit,meterFill});
      }
      $alabSlots.replaceChildren(frag);
    }
    alabSlotEls.forEach((s,i)=>{
      s.el.classList.toggle('active',i===alabSlot);
      s.digit.textContent=String(alabVals[i]);
      s.meterFill.style.width=alabMeters[i]+'%';
    });
    if($alabHelp){
      if(alabFailed) $alabHelp.textContent='Время вышло — начни новый код';
      else if(solved) $alabHelp.textContent='Замок открыт';
      else $alabHelp.textContent=alabLastHint||'Выбери тумблер, выставь цифру и проверь расстояние';
    }
  }

  addEventListener('keydown',e=>{
    if(!gameplayInputBlocked()&&mode==='anachlab'&&e.code==='Enter'){
      e.preventDefault();
      GameActions.attemptOpen({modeId:'anachlab',source:'keyboard'});
    }
  });

  PuzzleModes.register({
    id:'anachlab', start:startAnachLabRound, render:renderAnachLab,
    tick:({dt})=>alabTick(Math.min(.05,dt/1000)),
    syncHud:renderAnachLab,
    objective:()=>GameCatalog.get('anachlab')?.objective,
    restartMessage:'Новый лабораторный код',
    input:{horizontal:alabSelectSlot,vertical:delta=>alabAdjustDigit(delta<0?1:-1)},
    actions:{primary:alabTest},
    attemptOpen:tryOpenAnachLab
  });
})();
