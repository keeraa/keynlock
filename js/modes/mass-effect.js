  // ===== MASS EFFECT =====
  function massGradientForRing(ring){
    const step = 360 / ring.count;
    const goodColor = '#f0c878';
    const decoyColor = '#8e6a39';
    const baseColor = '#2f2418';
    const darkGap = '#15100b';
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
      const targetIndex = Math.floor(cfg.count / 2);
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
    if(shopOpen || solved) return;
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

  function clamp(v,min,max){ return Math.max(min,Math.min(max,v)); }
