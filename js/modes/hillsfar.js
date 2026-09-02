(function(){
  // ===== HILLSFAR =====
  let hfTarget=[], hfOptions=[], hfSelected=-1, hfTimeLeft=45, hfTimeMax=45, hfTimerHandle=null, hfLastTick=0;
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
      surviveText:message
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

  function hillsfarLockShape(type, x, baseY, step){
    if(type===0){
      return `L ${x+step*.16} ${baseY} L ${x+step*.16} ${baseY+10} L ${x+step*.72} ${baseY+10} L ${x+step*.72} ${baseY} L ${x+step} ${baseY}`;
    }
    if(type===1){
      return `L ${x+step*.18} ${baseY} L ${x+step*.48} ${baseY+20} L ${x+step*.76} ${baseY} L ${x+step} ${baseY}`;
    }
    if(type===2){
      return `L ${x+step*.16} ${baseY} L ${x+step*.16} ${baseY+17} L ${x+step*.46} ${baseY+17} L ${x+step*.46} ${baseY+7} L ${x+step*.78} ${baseY+7} L ${x+step*.78} ${baseY} L ${x+step} ${baseY}`;
    }
    if(type===3){
      return `L ${x+step*.12} ${baseY} L ${x+step*.29} ${baseY+14} L ${x+step*.45} ${baseY} L ${x+step*.58} ${baseY} L ${x+step*.72} ${baseY+18} L ${x+step*.86} ${baseY} L ${x+step} ${baseY}`;
    }
    if(type===4){
      return `L ${x+step*.18} ${baseY} L ${x+step*.18} ${baseY+8} L ${x+step*.38} ${baseY+8} L ${x+step*.38} ${baseY+22} L ${x+step*.67} ${baseY+22} L ${x+step*.67} ${baseY} L ${x+step} ${baseY}`;
    }
    return `L ${x+step*.16} ${baseY} L ${x+step*.32} ${baseY+9} L ${x+step*.54} ${baseY+9} L ${x+step*.54} ${baseY+19} L ${x+step*.78} ${baseY+19} L ${x+step*.78} ${baseY} L ${x+step} ${baseY}`;
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

  function hillsfarSvg(pattern, width=189, height=64){
    const baseY = height * 0.70;
    const shankH = Math.max(12, Math.round(height * 0.14));
    const left = 1;
    const right = 1;
    const usable = width - left - right;
    const step = usable / pattern.length;
    let d = `M ${left} ${baseY}`;
    for(let i=0;i<pattern.length;i++){
      d += ' ' + hillsfarSegmentShape(pattern[i], left + i*step, baseY, step);
    }
    d += ` L ${width - right} ${baseY} L ${width - right} ${height - 10} L ${left} ${height - 10} Z`;

    const metal = '#eadc93';
    const shadow = '#8d7841';
    const body = `<path d="${d}" fill="${metal}"/>`;
    const spine = `<rect x="${left}" y="${height - 10 - shankH}" width="${width - left - right}" height="${shankH}" rx="2" fill="${metal}"/>`;
    const tip = `<rect x="${width - 10}" y="${height - 30}" width="9" height="20" fill="${metal}"/>`;
    const grooves = [0.28,0.56].map(k=>{
      const y = baseY + k * (height - baseY - 16);
      return `<path d="M ${left + 3} ${y} L ${width - right - 3} ${y}" stroke="${shadow}" stroke-opacity="0.28" stroke-width="1.5"/>`;
    }).join('');
    const bevel = `<path d="${d}" fill="none" stroke="rgba(255,247,206,.35)" stroke-width="1.6" stroke-linejoin="round"/>`;
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true">${body}${spine}${tip}${grooves}${bevel}</svg>`;
  }

  function hillsfarLockSvg(pattern, width=760, height=64){
    const baseY = 22;
    const step = width / pattern.length;
    let d = `M 0 ${baseY}`;
    for(let i=0;i<pattern.length;i++){
      d += ' ' + hillsfarLockShape(pattern[i], i*step, baseY, step);
    }
    d += ` L ${width} ${baseY} L ${width} ${height} L 0 ${height} Z`;
    const bg = `<rect x="0" y="0" width="${width}" height="${height}" fill="url(#hfBg)"/>`;
    const cut = `<path d="${d}" fill="#e8d88e"/>`;
    const defs = `<defs><linearGradient id="hfBg" x1="0" x2="1"><stop offset="0" stop-color="#8f8f8f"/><stop offset="0.55" stop-color="#9b9b9b"/><stop offset="1" stop-color="#8f8f8f"/></linearGradient></defs>`;
    const bevels = `<path d="M 0 ${baseY} H ${width}" stroke="rgba(255,255,255,.12)" stroke-width="1.5"/>`;
    return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" preserveAspectRatio="none">${defs}${bg}${cut}${bevels}</svg>`;
  }

  function renderHillsfar(){
    $hfLockCut.innerHTML = hillsfarLockSvg(hfTarget);
    $hfCandidates.innerHTML = '';
    $hfCandidates.classList.toggle('has-selection', hfSelected !== -1);
    hfOptions.forEach((opt,i)=>{
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='hfCandidate' + (i===hfSelected ? ' selected' : '');
      btn.innerHTML = hillsfarSvg(opt, 189, 64);
      btn.addEventListener('click', ()=>{
        if(solved) return;
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
    $lock.classList.remove('win');
    $mechanism.classList.remove('ready','opening','opened');
    picks=pickCapacity;
    moves=0;
    brokenPicks=0;
    runReward=100;
    picks=pickCapacity;
    updatePickUI();
    hfTimeMax=diffStep(70,45,30,'hillsfar');
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
    if(hfSelected<0){
      SFX.wrongLock();
      toast('Сначала выбери ключ');
      return;
    }
    if(samePattern(hfOptions[hfSelected], hfTarget)){
      solved=true;
      clearHillsfarTimer();
      $lock.classList.add('win');
      const candidate=$hfCandidates.children[hfSelected];
      if(candidate) candidate.classList.add('correctFlash');
      SFX.open();
      setTimeout(()=>celebrate(),420);
      return;
    }

    SFX.wrongLock();
    failHillsfarAttempt('Ключ не подходит');
  }

  function tickHillsfar({now}){
    if(!hfTimerHandle||solved) return;
    const dt=Math.max(0,now-(hfLastTick||now))/1000;
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
