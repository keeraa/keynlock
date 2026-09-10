(function(){
  // ===== RESONANCE =====
  let rsIndex=0, rsSpeeds=[], rsBaseSpeeds=[], rsSpeedTargets=[], rsSpeedChangeAt=[], rsOffsets=[], rsPhases=[], rsLaneEls=[], rsOrbEls=[], rsReady=false, rsPinCount=5, rsLaneHeight=400;
  function rsPos(i){ return 50+43*Math.sin((rsOffsets[i]||0)+(rsPhases[i]||0)); }
  function positionResonanceOrb(i){
    const position=i<rsIndex?50:rsPos(i);
    rsOrbEls[i].style.transform=`translate3d(-50%,${position*rsLaneHeight/100}px,0) translateY(-50%)`;
  }
  function resizeResonance(){
    // Measure only when layout changes; animation frames only update transforms.
    rsLaneHeight=$rsLanes?.clientHeight||400;
    rsOrbEls.forEach((_,i)=>positionResonanceOrb(i));
  }
  function renderResonance(){
    if(!$rsLanes) return;
    document.body.style.setProperty('--resonance-shell-size',`${366+(rsPinCount-4)*81}px`);
    if(rsLaneEls.length!==rsPinCount){
      rsLaneEls=[];rsOrbEls=[];
      const frag=document.createDocumentFragment();
      for(let i=0;i<rsPinCount;i++){
        const lane=document.createElement('div');
        lane.className='rsLane';
        const orb=document.createElement('div');orb.className='rsOrb';
        lane.appendChild(orb);
        lane.addEventListener('pointerdown',()=>{if(i===rsIndex&&!rsReady)hitResonance();});
        frag.appendChild(lane);rsLaneEls.push(lane);rsOrbEls.push(orb);
      }
      $rsLanes.replaceChildren(frag);
    }
    rsLaneEls.forEach((lane,i)=>{
      lane.classList.toggle('active',i===rsIndex&&!rsReady);
      lane.classList.toggle('set',i<rsIndex);
    });
    resizeResonance();
  }
  function startResonanceRound(){
    solved=false; picks=pickCapacity; moves=0; brokenPicks=0; runReward=100;
    rsPinCount=diffStep(4,5,6,'resonance');
    rsIndex=0; rsReady=false;
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
    generatedDistance=rsPinCount; updateEconomyUI(); renderResonance();
  }
  function hitResonance(){
    if(solved||rsReady) return;
    toolMotionController.impulse();
    moves++;
    const p=rsPos(rsIndex);
    if(Math.abs(p-50)<=diffStep(10,7,5,'resonance')){
      rsIndex++; SFX.move();
      if(rsIndex>=rsPinCount){rsReady=true;SFX.ready();}
      renderResonance(); return;
    }
    missResonance();
  }
  function missResonance(){
    SFX.wrongLock();
    runReward=Math.max(0,runReward-20);
    animateRewardDrop();
    updateEconomyUI();
    damagePick({
      forceBreak:true,
      resetProgress:()=>{rsIndex=0;rsReady=false;},
      renderState:renderResonance,
      surviveText:'Мимо резонанса · −20 монет за замок'
    });
  }
  function tryOpenResonance(){
    if(solved) return;
    if(!rsReady){missResonance();return;}
    solved=true;SFX.open();renderResonance();
    $mechanism.classList.add('opening');
    scheduleRoundAction(()=>celebrate(),1000);
  }

  function tickResonance({now,dt}){
    if(solved||rsReady||!rsLaneEls.length) return;
    const rsLevel=getModeDifficulty('resonance');
    rsLaneEls.forEach((lane,i)=>{
      const orb=rsOrbEls[i];
      if(!orb||i<rsIndex) return;
      if(rsLevel>=2){
        if(now>=(rsSpeedChangeAt[i]||0)){
          const base=rsBaseSpeeds[i]||rsSpeeds[i]||1;
          const vary=rsLevel===2?.18:.24;
          rsSpeedTargets[i]=Math.max(.28,base*(1+rand(Math.round(-vary*100),Math.round(vary*100))/100));
          rsSpeedChangeAt[i]=now+rand(rsLevel===2?1100:900,rsLevel===2?2300:1800);
        }
        rsSpeeds[i]+=(rsSpeedTargets[i]-rsSpeeds[i])*(1-Math.exp(-dt/900));
      }
      rsOffsets[i]=(rsOffsets[i]||0)+dt*.001*(rsSpeeds[i]||1);
      positionResonanceOrb(i);
    });
  }

  PuzzleModes.register({
    id:'resonance',
    start:startResonanceRound,
    render:renderResonance,
    tick:tickResonance,
    resize:resizeResonance,
    objective:()=>`ЗАФИКСИРОВАТЬ ${rsPinCount} ШТИФТОВ ТОЧНО НА ЗОЛОТОЙ ЛИНИИ`,
    restartMessage:'Новый резонансный замок',
    input:{
      horizontal:()=>{},
      vertical:delta=>{ if(delta<0) hitResonance(); }
    },
    actions:{primary:hitResonance},
    attemptOpen:tryOpenResonance
  });
})();
