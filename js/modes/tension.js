  // ===== TENSION CONTROL =====
  function tnInBand(){ return Math.abs(tnTension-tnTarget)<=tnWidth/2; }
  function renderTension(){
    if(!$tnNeedle) return;
    $tnNeedle.style.left=`${tnTension}%`;
    $tnBand.style.left=`${tnTarget-tnWidth/2}%`;
    $tnBand.style.width=`${tnWidth}%`;
    const pinSkin=currentPinSkin();
    const frag=document.createDocumentFragment();
    for(let i=0;i<tnPinCount;i++){
      const p=document.createElement('div');
      p.className='tnPin'+(i===tnIndex&&!tnReady?' active':'')+(i<tnIndex?' set':'');
      p.innerHTML=`<div class="tnPinStem"></div><div class="tnPinHead"></div><img class="tnPinImg" src="${pinSkin}" alt="">`;
      frag.appendChild(p);
    }
    $tnPins.replaceChildren(frag);
    if(solved) $tnMessage.textContent='Замок открыт';
    else if(tnReady) $tnMessage.textContent='Все штифты выставлены — нажми на замок';
    else $tnMessage.textContent=tnInBand()?'Натяжение в рабочей зоне · W / ↑ / Space — поставить штифт':'A / D — удерживай натяжение в зелёной зоне';
  }
  function startTensionRound(){
    solved=false; picks=pickCapacity; moves=0; brokenPicks=0; runReward=1000;
    tnPinCount=diffStep(4,5,6,'tension');
    tnTension=rand(28,60); tnTarget=rand(25,75); tnWidth=rand(diffStep(22,14,10,'tension'),diffStep(32,22,16,'tension')); tnIndex=0; tnReady=false;
    tnDrift=(Math.random()>.5?1:-1)*(diffStep(.03,.05,.075,'tension')+Math.random()*diffStep(.02,.025,.03,'tension'));
    generatedDistance=tnPinCount; updateEconomyUI(); renderTension();
  }
  function moveTension(dir){
    if(solved||tnReady) return;
    tnTension=clamp(tnTension+dir*3,0,100);
    SFX.select(); renderTension();
  }
  function setTensionPin(){
    if(solved||tnReady) return;
    registerMove();
    if(tnInBand()){
      tnIndex++; SFX.move();
      if(tnIndex>=tnPinCount){ tnReady=true; SFX.ready(); }
      else { tnTarget=rand(18,82); tnWidth=rand(diffStep(18,12,9,'tension'),diffStep(28,20,15,'tension')); tnTension=clamp(tnTension+rand(-4,4),0,100); }
      renderTension(); return;
    }
    SFX.wrongLock();
    damagePick({
      resetProgress:()=>{tnIndex=0;tnReady=false;},
      renderState:renderTension,
      surviveText:'Неверное натяжение'
    });
    tnTension=clamp(tnTension-rand(7,15),0,100);
    renderTension();
  }
  function tryOpenTension(){
    if(shopOpen||solved) return;
    if(!tnReady){ SFX.wrongLock(); toast('Сначала выставь все штифты'); return; }
    solved=true; SFX.open(); renderTension(); setTimeout(()=>celebrate(),420);
  }

