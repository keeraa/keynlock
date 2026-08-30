(function(){
  // Heat / cold
  let hcSecret=[0,0,0,0], hcAttempts=[], hcDigits=[0,0,0,0], hcActiveIndex=0;
  function hcGrade(distance){
    if(distance===0)return ['точно',100];
    if(distance===1)return ['очень горячо',88];
    if(distance===2)return ['горячо',70];
    if(distance<=4)return ['тепло',48];
    if(distance<=6)return ['прохладно',28];
    return ['холодно',10];
  }

  function syncHeatColdInput(){
    if($hcInput)$hcInput.value=hcDigits.join('');
  }

  function renderHeatColdControls(){
    if(!$hcDialRow)return;
    $hcDialRow.innerHTML=hcDigits.map((digit,index)=>`
      <div class="hcDigitCol${index===hcActiveIndex?' active':''}" data-hc-col="${index}" tabindex="0" aria-label="Разряд ${index+1}: ${digit}">
        <button class="hcStepBtn" type="button" data-hc-step="1" data-hc-index="${index}" aria-label="Увеличить цифру ${index+1}">▲</button>
        <div class="hcDigitValue">${digit}</div>
        <button class="hcStepBtn" type="button" data-hc-step="-1" data-hc-index="${index}" aria-label="Уменьшить цифру ${index+1}">▼</button>
      </div>
    `).join('');
  }

  function adjustHeatColdDigit(index,delta){
    if(solved) return;
    hcActiveIndex=((index%4)+4)%4;
    hcDigits[hcActiveIndex]=(hcDigits[hcActiveIndex]+delta+10)%10;
    syncHeatColdInput();
    renderHeatColdControls();
    focusHeatColdDigit(hcActiveIndex);
    setDigitalResult($hcResult);
  }

  function setHeatColdActive(index){
    hcActiveIndex=((index%4)+4)%4;
    renderHeatColdControls();
    focusHeatColdDigit(hcActiveIndex);
  }

  function focusHeatColdDigit(index){
    if(!$hcDialRow) return;
    const col=$hcDialRow.querySelector(`[data-hc-col="${index}"]`);
    if(col && document.activeElement!==col) col.focus({preventScroll:true});
  }

  function handleHeatColdKey(e){
    if(mode!=='heatcold' || solved || gameplayInputBlocked()) return;
    const key=e.key;
    if(key==='ArrowLeft'){e.preventDefault();setHeatColdActive(hcActiveIndex-1);return;}
    if(key==='ArrowRight'){e.preventDefault();setHeatColdActive(hcActiveIndex+1);return;}
    if(key==='ArrowUp'){e.preventDefault();adjustHeatColdDigit(hcActiveIndex,1);return;}
    if(key==='ArrowDown'){e.preventDefault();adjustHeatColdDigit(hcActiveIndex,-1);return;}
    if(key==='Home'){e.preventDefault();setHeatColdActive(0);return;}
    if(key==='End'){e.preventDefault();setHeatColdActive(3);return;}
    if(/^[0-9]$/.test(key)){e.preventDefault();hcDigits[hcActiveIndex]=Number(key);syncHeatColdInput();renderHeatColdControls();focusHeatColdDigit(hcActiveIndex);setDigitalResult($hcResult);return;}
    if(key==='Enter' || key===' '){e.preventDefault();GameActions.attemptOpen({modeId:'heatcold',source:'keyboard'});return;}
  }

  function renderHeatColdEmpty(){
    renderHeatColdControls();
    if(!$hcSlots)return;
    $hcSlots.innerHTML=[0,1,2,3].map(index=>`
      <div class="hcSlot">
        <div class="hcNum">?</div>
        <div class="hcWord">—</div>
        <div class="hcThermo"><i style="width:0%"></i></div>
      </div>
    `).join('');
  }

  function startHeatColdRound(){
    resetDigitalRunState();
    hcSecret=randomFourDigitCode();
    hcAttempts=[];
    hcDigits=[0,0,0,0];
    hcActiveIndex=0;
    syncHeatColdInput();
    setDigitalResult($hcResult);
    if($hcRows)$hcRows.innerHTML='';
    renderHeatColdEmpty();
    focusHeatColdDigit(hcActiveIndex);
    updateEconomyUI();
  }

  function scanHeatCold(){
    if(solved)return;
    const code=hcDigits.join('');

    registerMove();
    let exact=0;
    const states=hcDigits.map((value,index)=>{
      const distance=Math.abs(value-hcSecret[index]);
      if(distance===0)exact++;
      const [word,pct]=hcGrade(distance);
      return {value,distance,word,pct};
    });

    if($hcSlots){
      $hcSlots.innerHTML=states.map(state=>`
        <div class="hcSlot">
          <div class="hcNum">${state.value}</div>
          <div class="hcWord">${state.word}</div>
          <div class="hcThermo"><i style="width:${state.pct}%"></i></div>
        </div>
      `).join('');
    }

    hcAttempts.unshift({code,states});
    hcAttempts=hcAttempts.slice(0,5);
    if($hcRows){
      $hcRows.innerHTML=hcAttempts.map(attempt=>`
        <div class="hcRow">
          <b>${attempt.code}</b>
          <span>${attempt.states.map(state=>state.word).join(' · ')}</span>
        </div>
      `).join('');
    }

    if(exact===4){
      setDigitalResult($hcResult,'Код подобран. Замок открыт.',true);
      finishDigitalPuzzle();
    }else{
      setDigitalResult($hcResult);
    }
  }

  $hcInput?.addEventListener('keydown',e=>{if(!gameplayInputBlocked()&&e.key==='Enter'){e.preventDefault();GameActions.attemptOpen({modeId:'heatcold',source:'keyboard'});}});
  $hcInput?.addEventListener('input',()=>{$hcInput.value=$hcInput.value.replace(/\D/g,'').slice(0,4);});
  document.addEventListener('keydown',handleHeatColdKey);
  $hcDialRow?.addEventListener('click',e=>{
    const btn=e.target.closest('[data-hc-step]');
    if(btn){adjustHeatColdDigit(Number(btn.dataset.hcIndex),Number(btn.dataset.hcStep));return;}
    const col=e.target.closest('[data-hc-col]');
    if(col)setHeatColdActive(Number(col.dataset.hcCol));
  });
  $hcDialRow?.addEventListener('focusin',e=>{
    const col=e.target.closest('[data-hc-col]');
    if(col&&Number(col.dataset.hcCol)!==hcActiveIndex){hcActiveIndex=Number(col.dataset.hcCol);renderHeatColdControls();focusHeatColdDigit(hcActiveIndex);}
  });

  PuzzleModes.register({
    id:'heatcold',start:startHeatColdRound,render:renderHeatColdEmpty,
    objective:()=>GameCatalog.get('heatcold')?.objective,restartMessage:'Новый цифровой код',
    input:{horizontal:()=>{},vertical:()=>{}},
    actions:{swipe:(dir,target)=>{
      const col=target?.closest?.('[data-hc-col]');
      if(col)setHeatColdActive(Number(col.dataset.hcCol));
      if(dir==='left')setHeatColdActive(hcActiveIndex-1);
      else if(dir==='right')setHeatColdActive(hcActiveIndex+1);
      else if(dir==='up')adjustHeatColdDigit(hcActiveIndex,1);
      else adjustHeatColdDigit(hcActiveIndex,-1);
    }},
    attemptOpen:scanHeatCold
  });
})();
