(function(){
  // ===== HILLSFAR =====
  let hfTarget=[], hfOptions=[], hfSelected=-1, hfTimeLeft=45, hfTimeMax=45, hfTimerHandle=null, hfLastTick=0, hfInserting=false;
  function clearHillsfarTimer(){
    hfTimerHandle=null;
    hfLastTick=0;
  }

  function renderHillsfarHud(){
    setGlobalTimer(mode==='hillsfar', hfTimeLeft, hfTimeMax, 'ТАЙМЕР');
  }

  function startHillsfarTimer(){
    clearHillsfarTimer();
    hfTimeLeft = hfTimeMax;
    renderHillsfarHud();
    hfLastTick = performance.now();
    hfTimerHandle = true;
  }

  function failHillsfarAttempt(message){
    if(solved) return;
    registerMove();
    hfSelected=-1;
    const outcome=damagePick({
      resetProgress:()=>{},
      renderState:renderHillsfar,
      surviveText:message,
      forceBreak:true
    });
    if(!outcome.depleted){
      startHillsfarTimer();
      renderHillsfar();
    }

  }

  function hillsfarSegmentShape(type, x, baseY, step){
    if(type===0){ // low rectangular shelf
      return `L ${x+step*.16} ${baseY} L ${x+step*.16} ${baseY-10} L ${x+step*.72} ${baseY-10} L ${x+step*.72} ${baseY} L ${x+step} ${baseY}`;
    }
    if(type===1){ // single modest tooth
      return `L ${x+step*.18} ${baseY} L ${x+step*.48} ${baseY-20} L ${x+step*.76} ${baseY} L ${x+step} ${baseY}`;
    }
    if(type===2){ // rectangular step
      return `L ${x+step*.16} ${baseY} L ${x+step*.16} ${baseY-17} L ${x+step*.46} ${baseY-17} L ${x+step*.46} ${baseY-7} L ${x+step*.78} ${baseY-7} L ${x+step*.78} ${baseY} L ${x+step} ${baseY}`;
    }
    if(type===3){ // two short teeth
      return `L ${x+step*.12} ${baseY} L ${x+step*.29} ${baseY-14} L ${x+step*.45} ${baseY} L ${x+step*.58} ${baseY} L ${x+step*.72} ${baseY-18} L ${x+step*.86} ${baseY} L ${x+step} ${baseY}`;
    }
    if(type===4){ // taller rectangular tab
      return `L ${x+step*.18} ${baseY} L ${x+step*.18} ${baseY-8} L ${x+step*.38} ${baseY-8} L ${x+step*.38} ${baseY-22} L ${x+step*.67} ${baseY-22} L ${x+step*.67} ${baseY} L ${x+step} ${baseY}`;
    }
    // shallow shelf + tooth
    return `L ${x+step*.16} ${baseY} L ${x+step*.32} ${baseY-9} L ${x+step*.54} ${baseY-9} L ${x+step*.54} ${baseY-19} L ${x+step*.78} ${baseY-19} L ${x+step*.78} ${baseY} L ${x+step} ${baseY}`;
  }

function hillsfarPattern(len=6){
    const arr=[];
    for(let i=0;i<len;i++) arr.push(rand(0,5));
    if(arr.every(v=>v===arr[0])) arr[rand(0,len-1)] = (arr[0]+1)%4;
    return arr;
  }

  function hillsfarMutate(base){
    const out=[...base];
    const changes=rand(1,2);
    for(let k=0;k<changes;k++){
      const i=rand(0,out.length-1);
      out[i]=(out[i]+rand(1,5))%6;
    }
    return out;
  }

  function samePattern(a,b){
    return a.length===b.length && a.every((v,i)=>v===b[i]);
  }

  // One shared contact edge: key metal lies below it, lock metal above it.
  function hillsfarProfile(pattern,width=189,height=64){
    const left=1,right=width-1,baseY=height*.70,step=(right-left)/pattern.length;
    let edge=`M ${left} ${baseY}`;
    pattern.forEach((type,i)=>{edge+=' '+hillsfarSegmentShape(type,left+i*step,baseY,step);});
    return {edge,left,right};
  }
  function hillsfarSvg(pattern,width=189,height=64){
    const {edge,left,right}=hillsfarProfile(pattern,width,height);
    const body=`${edge} L ${right} ${height-10} L ${left} ${height-10} Z`;
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true"><path d="${body}" fill="#eadc93"/><path d="${edge}" fill="none" stroke="#fff0bc" stroke-width="1"/></svg>`;
  }
  function hillsfarLockSvg(pattern){
    const width=189,height=64,{edge,left,right}=hillsfarProfile(pattern,width,height);
    const plate=`${edge} L ${right} 4 L ${left} 4 Z`;
    return `<svg class="hfTargetProfile" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-label="Выемка замка"><path d="${plate}" fill="#aaa99d"/><path d="${edge}" fill="none" stroke="#e0d4b2" stroke-width="1"/></svg>`;
  }

  function renderHillsfar(){
    if(hfInserting || (solved && $hfLockCut.querySelector('.hfInsertedKey'))) return;
    $hfLockCut.innerHTML = hillsfarLockSvg(hfTarget);
    $hfCandidates.innerHTML = '';
    $hfCandidates.classList.toggle('has-selection', hfSelected !== -1);
    hfOptions.forEach((opt,i)=>{
      const btn=document.createElement('button');
      btn.type='button';
      btn.setAttribute('aria-label',`Ключ ${i+1}`);
      btn.className='hfCandidate' + (i===hfSelected ? ' selected' : '');
      btn.innerHTML = hillsfarSvg(opt, 189, 64);
      btn.addEventListener('click', ()=>{
        if(solved || hfInserting) return;
        hfSelected=i;
        SFX.select();
        renderHillsfar();
      });
      $hfCandidates.appendChild(btn);
    });
  }

  function startHillsfarRound(){
    clearHillsfarTimer();
    solved=false;
    hfInserting=false;
    $lock.classList.remove('win');
    $mechanism.classList.remove('ready','opening','opened');
    picks=pickCapacity;
    moves=0;
    brokenPicks=0;
    runReward=100;
    picks=pickCapacity;
    updatePickUI();
    hfTimeMax=(window.KeynlockCampaign?.training('hillsfar')?90:diffStep(70,45,30,'hillsfar'))/3;
    hfTarget=hillsfarPattern(diffStep(4,5,6,'hillsfar'));

    const optionCount=diffStep(6,8,9,'hillsfar');
    const options=[hfTarget];
    while(options.length<optionCount){
      const candidate=hillsfarMutate(hfTarget);
      if(!options.some(o=>samePattern(o,candidate))) options.push(candidate);
    }
    hfOptions=shuffle(options);
    hfSelected=-1;
    generatedDistance=1;
    updateEconomyUI();
    renderHillsfar();
    startHillsfarTimer();
  }

  function tryOpenHillsfar(){
    if(solved) return;
    if(hfInserting) return 'pending';
    if(hfSelected<0){
      SFX.wrongLock();
      toast('Сначала выбери ключ');
      return;
    }
    const matches=samePattern(hfOptions[hfSelected],hfTarget);
    hfInserting=true;
    clearHillsfarTimer();
    const candidate=$hfCandidates.children[hfSelected];
    if(candidate) candidate.classList.add('inserting');
    const key=document.createElement('span');
    key.className='hfInsertedKey';
    key.setAttribute('aria-hidden','true');
    key.innerHTML=hillsfarSvg(hfOptions[hfSelected]);
    $hfLockCut.appendChild(key);
    const duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:1000;
    if(duration) key.animate([
      {transform:'translateX(-110%)'},
      {transform:'translateX(0)'}
    ],{duration,easing:'cubic-bezier(.3,0,.2,1)',fill:'backwards'});
    scheduleRoundAction(()=>{
      if(mode!=='hillsfar' || !hfInserting || !key.isConnected) return;
      hfInserting=false;
      if(!matches){
        SFX.wrongLock();
        failHillsfarAttempt('Ключ не подходит');
        return;
      }
      solved=true;
      if(candidate) candidate.classList.add('correctFlash');
      $lock.classList.add('win');
      SFX.open();
      celebrate();
    },duration+180);
    return 'pending';
  }

  function tickHillsfar({now}){
    if(!hfTimerHandle||solved) return;
    const dt=Math.min(.05,Math.max(0,now-(hfLastTick||now))/1000);
    hfLastTick=now;
    hfTimeLeft=Math.max(0,hfTimeLeft-dt);
    renderHillsfarHud();
    if(hfTimeLeft<=0){ clearHillsfarTimer(); showGameDefeat('time'); }
  }

  PuzzleModes.register({
    id:'hillsfar', start:startHillsfarRound, render:renderHillsfar,
    tick:tickHillsfar, syncHud:renderHillsfarHud,
    objective:()=>GameCatalog.get('hillsfar')?.objective,
    restartMessage:'Новый набор ключей',
    input:{horizontal:()=>{},vertical:()=>{}},
    attemptOpen:tryOpenHillsfar
  });
})();
