(function(){
  // ===== MASS EFFECT =====
  let meRings=[], meSelected=0, meInitialPositions=[];
  function massGradientForRing(ring){
    const step = 360 / ring.count;
    const goodColor = '#e4bd70';
    const decoyColor = '#796340';
    const baseColor = '#363633';
    const darkGap = '#171714';
    const gap = Math.max(2.2, step * .11);
    const parts = [];

    // Все кольца используют одну и ту же дискретную угловую сетку.
    // Сектор i центрирован ровно на i * step градусов.
    for(let i=0;i<ring.count;i++){
      const start = i * step;
      const segStart = start + gap;
      const segEnd = start + step - gap;
      let color = baseColor;
      if(i === ring.goodIndex) color = goodColor;
      else if(ring.decoys.includes(i)) color = decoyColor;
      parts.push(`${darkGap} ${start.toFixed(2)}deg ${segStart.toFixed(2)}deg`);
      parts.push(`${color} ${segStart.toFixed(2)}deg ${segEnd.toFixed(2)}deg`);
      parts.push(`${darkGap} ${segEnd.toFixed(2)}deg ${(start+step).toFixed(2)}deg`);
    }

    // -step/2 делает центр нулевого сектора направленным ровно вверх.
    return `conic-gradient(from ${(-step/2).toFixed(2)}deg, ${parts.join(',')})`;
  }

  function massRingSolved(ring){
    return ring.pos === ring.solution;
  }

  function renderMassEffect(){
    $massRings.innerHTML = '';
    meRings.forEach((ring, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'massRing' + (i===meSelected ? ' selected' : '') + (massRingSolved(ring) ? ' ready' : '');
      btn.style.width = `${ring.size}px`;
      btn.style.height = `${ring.size}px`;
      btn.style.setProperty('--mass-thickness', `${ring.thickness}px`);
      btn.style.setProperty('--mass-marker-width', `${Math.max(14, Math.round(ring.thickness * .34))}px`);
      btn.style.setProperty('--mass-marker-height', `${Math.max(10, Math.round(ring.thickness * .24))}px`);
      btn.style.setProperty('--mass-marker-bottom', `${Math.max(8, Math.round(ring.thickness * .18))}px`);
      btn.style.setProperty('--mass-ring-color', ['#d8bd83','#b7a77f','#9f9277'][i] || '#d8bd83');
      const ringNames = ['Внешнее кольцо','Среднее кольцо','Внутреннее кольцо'];
      btn.setAttribute('aria-label', ringNames[i] || `Кольцо ${i+1}`);

      const disc = document.createElement('div');
      disc.className = 'massRingDisc';
      disc.style.background = massGradientForRing(ring);
      disc.style.transform = `rotate(${(ring.pos * 360 / ring.count).toFixed(2)}deg)`;
      disc.style.webkitMask = disc.style.mask = `radial-gradient(circle, transparent calc(50% - ${ring.thickness}px), #000 calc(50% - ${ring.thickness}px + 1px), #000 calc(50% - 1px), transparent 50%)`;
      btn.appendChild(disc);

      btn.addEventListener('click', () => {
        if(solved) return;
        meSelected = i;
        SFX.select();
        renderMassEffect();
      });

      $massRings.appendChild(btn);
    });

    const ready = meRings.length && meRings.every(massRingSolved);
    let beamDepth=0;
    while(beamDepth<meRings.length && massRingSolved(meRings[beamDepth])) beamDepth++;
    document.querySelector('.massBoard')?.setAttribute('data-beam-depth',String(beamDepth));
    const active=meRings[meSelected];
    const status=document.querySelector('#massStatus');
    const progress=document.querySelector('#massProgress');
    const ringNames=['ВНЕШНЕЕ','СРЕДНЕЕ','ВНУТРЕННЕЕ'];
    if(status) status.textContent=solved?'ЗАМОК ОТКРЫТ':ready?'ВСЕ КОЛЬЦА ВЫСТАВЛЕНЫ':`${ringNames[meSelected]} КОЛЬЦО · ${massRingSolved(active)?'ВЫСТАВЛЕНО':'ПОДВЕДИ ЗОЛОТОЙ СЕКТОР К МЕТКЕ'}`;
    if(progress) progress.innerHTML=meRings.map((item,i)=>`<i class="${massRingSolved(item)?'ready ':''}${i===meSelected?'selected':''}"></i>`).join('');
    $massCenter.classList.toggle('ready', ready && !solved);
    $massCenterText.textContent = solved ? 'ОТКРЫТО' : (ready ? 'ОТКРЫТЬ' : 'ПОВОРОТ');
  }

  function startMassRound(){
    solved = false;
    $lock.classList.remove('win');
    $mechanism.classList.remove('ready','opening','opened');
    document.querySelector('.massCenterLock')?.classList.remove('opening','opened');
    picks = pickCapacity;
    moves = 0;
    brokenPicks = 0;
    runReward = 1000;
    const sectorCount = diffStep(10,12,14,'mass');
    const decoyCount = diffStep(2,3,4,'mass');
    const configs = [
      {count:sectorCount, size:310, thickness:28},
      {count:sectorCount, size:250, thickness:26},
      {count:sectorCount, size:190, thickness:24}
    ];
    meRings = configs.map(cfg => {
      const goodIndex = rand(0, cfg.count-1);
      // The scanner and pointer are at 12 o'clock, so the highlighted sector
      // is solved only when its centre reaches index zero (the top).
      const targetIndex = 0;
      const solution = (targetIndex - goodIndex + cfg.count) % cfg.count;
      const decoys = [];
      while(decoys.length < decoyCount){
        const d = rand(0, cfg.count-1);
        if(d !== goodIndex && !decoys.includes(d)) decoys.push(d);
      }
      let pos = rand(0, cfg.count-1);
      if(pos === solution) pos = (pos + 1) % cfg.count;
      return {...cfg, goodIndex, decoys, solution, pos};
    });
    meSelected = 0;
    meInitialPositions = meRings.map(r=>r.pos);
    generatedDistance = meRings.reduce((sum, r) => {
      const diff = Math.abs(r.pos - r.solution);
      return sum + Math.min(diff, r.count - diff);
    }, 0);
    updateEconomyUI();
    renderMassEffect();
  }

  function tryOpenMass(){
    if(solved) return;
    if(!meRings.every(massRingSolved)){
      SFX.wrongLock();
      damagePick({
        resetProgress:()=>meRings.forEach((r,i)=>{ r.pos=meInitialPositions[i] ?? r.pos; }),
        renderState:renderMassEffect,
        surviveText:'Кольца ещё не выстроены'
      });
      return;
    }
    solved = true;
    $lock.classList.add('win');
    document.querySelector('.massCenterLock')?.classList.add('opening');
    SFX.open();
    renderMassEffect();
    setTimeout(() => celebrate(), 420);
  }

  function moveMass(dir){
    if(solved) return;
    const ring = meRings[meSelected];
    if(!ring) return;
    ring.pos = (ring.pos + dir + ring.count) % ring.count;
    registerMove();
    SFX.move();
    const wasReady = $massCenter.classList.contains('ready');
    renderMassEffect();
    const isReady = meRings.every(massRingSolved);
    if(isReady && !wasReady) SFX.ready();
  }

  function selectMass(delta){
    if(solved) return;
    // W / ArrowUp passes delta=-1: outer (0) -> middle (1) -> inner (2).
    // S / ArrowDown goes in the opposite direction.
    const step = delta < 0 ? 1 : -1;
    meSelected = (meSelected + step + meRings.length) % meRings.length;
    SFX.select();
    renderMassEffect();
  }

  PuzzleModes.register({
    id:'mass', start:startMassRound, render:renderMassEffect,
    objective:()=>GameCatalog.get('mass')?.objective,
    restartMessage:'Новый круговой замок',
    input:{horizontal:moveMass,vertical:selectMass},
    attemptOpen:tryOpenMass
  });
})();

  function clamp(v,min,max){ return Math.max(min,Math.min(max,v)); }
