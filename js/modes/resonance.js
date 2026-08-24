  // ===== RESONANCE =====
  function rsPos(i){ return 50+43*Math.sin((rsOffsets[i]||0)+(rsPhases[i]||0)); }
  function renderResonance(){
    if(!$rsLanes) return;
    rsLaneEls=[]; rsOrbEls=[];
    const frag=document.createDocumentFragment();
    $rsLanes.style.setProperty('--rs-lane-width', `${Math.max(46,Math.round(292/Math.max(1,rsPinCount)))}px`);
    for(let i=0;i<rsPinCount;i++){
      const lane=document.createElement('div');
      lane.className='rsLane'+(i===rsIndex&&!rsReady?' active':'')+(i<rsIndex?' set':'');
      const orb=document.createElement('div'); orb.className='rsOrb';
      orb.style.top=`${i<rsIndex?50:rsPos(i)}%`;
      lane.appendChild(orb);
      lane.addEventListener('pointerdown',()=>{if(i===rsIndex&&!rsReady) hitResonance();});
      frag.appendChild(lane); rsLaneEls.push(lane); rsOrbEls.push(orb);
    }
    $rsLanes.replaceChildren(frag);
  }
  function startResonanceRound(){
    solved=false; picks=pickCapacity; moves=0; brokenPicks=0; runReward=1000;
    rsPinCount=diffStep(4,5,6,'resonance');
    rsIndex=0; rsT=0; rsReady=false;
    const speedBase=diffStep(.72,.85,1.02,'resonance');
    const speedStep=diffStep(.10,.13,.16,'resonance');
    const randomAmp=diffStep(.16,.22,.28,'resonance');
    rsBaseSpeeds=Array.from({length:rsPinCount},(_,i)=>speedBase+i*speedStep+Math.random()*randomAmp);
    rsSpeeds=[...rsBaseSpeeds];
    rsSpeedTargets=[...rsBaseSpeeds];
    rsOffsets=Array.from({length:rsPinCount},()=>0);
    rsPhases=Array.from({length:rsPinCount},()=>Math.random()*Math.PI*2);
    const now=performance.now();
    rsSpeedChangeAt=Array.from({length:rsPinCount},()=>now+rand(900,1700));
    rsPauseUntil=Array.from({length:rsPinCount},()=>0);
    generatedDistance=rsPinCount; updateEconomyUI(); renderResonance();
  }
  function hitResonance(){
    if(solved||rsReady) return;
    registerMove();
    const p=rsPos(rsIndex);
    if(Math.abs(p-50)<=diffStep(10,7,5,'resonance')){
      rsIndex++; SFX.move();
      if(rsIndex>=rsPinCount){rsReady=true;SFX.ready();}
      renderResonance(); return;
    }
    SFX.wrongLock();
    damagePick({
      resetProgress:()=>{rsIndex=0;rsReady=false;},
      renderState:renderResonance,
      surviveText:'Мимо резонанса'
    });
  }
  function tryOpenResonance(){
    if(shopOpen||solved) return;
    if(!rsReady){SFX.wrongLock();toast('Сначала зафиксируй все штифты');return;}
    solved=true;SFX.open();renderResonance();setTimeout(()=>celebrate(),420);
  }

