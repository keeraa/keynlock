(function(){
  // Drum clicks
  let drumSecret=[0,0,0,0], drumState=[0,0,0,0], drumSoundOn=true, drumAudioCtx=null;
  function drumCircDist(a,b){
    const distance=Math.abs(a-b);
    return Math.min(distance,10-distance);
  }

  function drumStrength(distance){
    return [100,82,60,36,18,8][distance]||8;
  }

  function drumLabel(distance){
    return [
      'точный резонанс',
      'очень сильный щелчок',
      'сильный щелчок',
      'средний отклик',
      'слабый отклик',
      'почти тишина'
    ][distance]||'почти тишина';
  }

  function drumPlayClick(distance){
    if(!drumSoundOn)return;
    try{
      const AudioContextClass=window.AudioContext||window.webkitAudioContext;
      if(!AudioContextClass)return;
      drumAudioCtx ||= new AudioContextClass();
      const now=drumAudioCtx.currentTime;
      const hit=(time,frequency,gainValue,duration=.035)=>{
        const oscillator=drumAudioCtx.createOscillator();
        const gain=drumAudioCtx.createGain();
        oscillator.type='square';
        oscillator.frequency.value=frequency;
        gain.gain.setValueAtTime(gainValue,time);
        gain.gain.exponentialRampToValueAtTime(.001,time+duration);
        oscillator.connect(gain);
        gain.connect(drumAudioCtx.destination);
        oscillator.start(time);
        oscillator.stop(time+duration);
      };
      const strength=drumStrength(distance)/100;
      hit(now,140+420*strength,.018+.045*strength);
      if(distance===0)hit(now+.055,520,.052,.045);
    }catch{}
  }

  function renderDrum(){
    if(!$drumWheels)return;
    $drumWheels.innerHTML=drumState.map((value,index)=>{
      const distance=drumCircDist(value,drumSecret[index]);
      return `
        <div class="digitalWheel" id="drumWheel${index}">
          <button data-drum-i="${index}" data-dir="1" type="button">▲</button>
          <div class="digitalWheelValue">${value}</div>
          <button data-drum-i="${index}" data-dir="-1" type="button">▼</button>
          <div class="drumMeter"><i style="width:${drumStrength(distance)}%"></i></div>
          <div class="drumLabel">${drumLabel(distance)}</div>
        </div>
      `;
    }).join('');
  }

  function startDrumRound(){
    resetDigitalRunState();
    ({secret:drumSecret,state:drumState}=randomCodeAndState());
    setDigitalResult($drumResult);
    renderDrum();
    updateEconomyUI();
  }

  function changeDrum(index,direction){
    if(solved)return;
    drumState[index]=(drumState[index]+direction+10)%10;
    registerMove();
    const distance=drumCircDist(drumState[index],drumSecret[index]);
    drumPlayClick(distance);
    renderDrum();
    const wheel=document.querySelector(`#drumWheel${index}`);
    wheel?.classList.add('hit');
    setTimeout(()=>wheel?.classList.remove('hit'),120);
    setDigitalResult($drumResult);
  }

  function checkDrum(){
    if(solved)return;
    const exact=drumState.filter((value,index)=>value===drumSecret[index]).length;
    if(exact===4){
      setDigitalResult($drumResult,'Все четыре барабана в резонансе. Замок открыт.',true);
      finishDigitalPuzzle(renderDrum);
      return;
    }
    setDigitalResult($drumResult,`Точно выставлено барабанов: ${exact}/4`);
    SFX.wrongLock();
  }

  $drumWheels?.addEventListener('click',e=>{const b=e.target.closest('[data-drum-i]');if(b)changeDrum(Number(b.dataset.drumI),Number(b.dataset.dir));});
  $drumCheck?.addEventListener('click',()=>GameActions.attemptOpen({modeId:'drum',source:'puzzle-control'}));
  $drumNew?.addEventListener('click',()=>newLock());
  $drumSound?.addEventListener('click',()=>{drumSoundOn=!drumSoundOn;$drumSound.textContent='Звук: '+(drumSoundOn?'вкл':'выкл');});

  PuzzleModes.register({
    id:'drum',start:startDrumRound,render:renderDrum,
    objective:()=>GameCatalog.get('drum')?.objective,restartMessage:'Новый барабанный замок',
    input:{horizontal:()=>{},vertical:()=>{}},
    actions:{swipe:(dir,target)=>{const wheel=target?.closest?.('.digitalWheel[id^="drumWheel"]');if(wheel)changeDrum(Number(wheel.id.replace('drumWheel','')),dir==='up'||dir==='right'?1:-1);}},
    attemptOpen:checkDrum
  });
})();
