  // ===== RISEN 2 =====
  function getR2Layout(){
    const count = r2PinCount;
    const pinGap = count >= 8 ? 12 : 18;
    const pinsWidth = 540;
    const pinWidth = Math.floor((pinsWidth - pinGap * (count - 1)) / count);
    const pinsLeft = (780 - pinsWidth) / 2;
    const pinXs = Array.from({length:count},(_,i)=>18 + i * (pinWidth + pinGap));
    const pinCenters = pinXs.map(x => pinsLeft + x + pinWidth / 2);
    const imported = document.body.classList.contains('importedMode');
    const pickTipCenter = imported ? 308 : 276;
    return { pinWidth, pinGap, pinsWidth, pinsLeft, pinXs, pinCenters, pickTipCenter };
  }

  function startR2Round(){
    solved=false;
    $lock.classList.remove('win');
    $mechanism.classList.remove('ready','opening','opened');
    picks=pickCapacity;
    moves=0;
    brokenPicks=0;
    runReward=1000;
    r2PinCount=diffStep(4,6,8,'r2');
    r2ProgressCount=0;
    r2PickPos=rand(0,r2PinCount-1);
    r2Sequence=shuffle(Array.from({length:r2PinCount},(_,i)=>i));
    generatedDistance=r2PinCount;
    renderR2();
    updateEconomyUI();
  }

  function renderR2(){
    const layout = getR2Layout();
    const raised = new Set(r2Sequence.slice(0,r2ProgressCount));
    const pinSkin=currentPinSkin();
    const frag=document.createDocumentFragment();
    r2PinEls=[];

    for(let i=0;i<r2PinCount;i++){
      const pin=document.createElement('div');
      const isRaised = raised.has(i);
      pin.className='r2Pin' + (i===r2PickPos?' current':'') + (isRaised?' up':'');
      pin.dataset.index=i;
      pin.style.left=`${layout.pinXs[i]}px`;
      pin.style.setProperty('--pin-lift', isRaised ? '-36px' : '0px');

      const stem=document.createElement('div');
      stem.className='r2PinStem';
      const head=document.createElement('div');
      head.className='r2PinHead';
      const skin=document.createElement('img');
      skin.className='r2PinImg';
      skin.src=pinSkin;
      skin.alt='';
      pin.append(stem,head,skin);

      pin.addEventListener('click',()=>{
        if(solved) return;
        r2PickPos=i;
        SFX.select();
        renderR2();
        setTimeout(()=>attemptR2Pin(),90);
      });

      frag.appendChild(pin);
      r2PinEls.push(pin);
    }
    $r2Pins.replaceChildren(frag);

    const targetX = layout.pinCenters[r2PickPos] - layout.pickTipCenter;
    $r2Pick.style.setProperty('--r2x',`${targetX.toFixed(1)}px`);

    $r2Progress.textContent=`${r2ProgressCount} / ${r2PinCount}`;
    $r2Message.textContent = r2ProgressCount===r2PinCount
      ? 'Все штифты подняты — нажми на картинку замка'
      : 'A / D — двигать отмычку, W — поднять штифт';
  }

  function moveR2(dir){
    if(solved) return;
    const next=Math.max(0,Math.min(r2PinCount-1,r2PickPos+dir));
    if(next===r2PickPos){ SFX.blocked(); return; }
    r2PickPos=next;
    SFX.move();
    renderR2();
  }

  function attemptR2Pin(){
    if(solved) return;
    registerMove();
    const expected=r2Sequence[r2ProgressCount];
    const pin=r2PinEls[r2PickPos];

    if(r2PickPos===expected){
      r2ProgressCount++;
      SFX.move();
      renderR2();
      if(r2ProgressCount===r2PinCount) SFX.ready();
      return;
    }

    if(pin){
      pin.classList.add('wrong');
      setTimeout(()=>pin.classList.remove('wrong'),340);
    }
    const outcome=damagePick({
      resetProgress:()=>{ r2ProgressCount=0; },
      renderState:renderR2,
      surviveText:'Неверный штифт'
    });
    if(!outcome.broke || outcome.kept){
      renderR2();
    }
  }

  function tryOpenR2(){
    if(shopOpen || solved) return;
    if(r2ProgressCount!==r2PinCount){
      SFX.wrongLock();
      toast('Сначала подними все штифты в правильном порядке');
      return;
    }
    solved=true;
    $lock.classList.add('win');
    SFX.open();
    renderR2();
    setTimeout(()=>celebrate(),420);
  }

