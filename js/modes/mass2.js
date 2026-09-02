(function(){
  // ===== MASS2 (Mass Effect 2: Парные узлы) =====
  const M2_SYMBOLS=['◈','⌁','Ψ','⊙','✦','⌬','☿','♀'], M2_HOLD_MS=900;
  let m2Nodes=[], m2Sel=-1, m2Matched=new Set(), m2Kb=0, m2Lock=false, m2UnlockTimer=0, m2TimeLeft=40, m2TimeMax=40, m2NodeEls=[];
  // Memory-match: 16 nodes (8 symbols × 2), symbols hidden until hovered
  // (mouse) or held for M2_HOLD_MS (touch). Pick two — a match stays
  // revealed, a miss briefly reveals both before hiding again. A countdown
  // adds pressure on top of the shared pick economy. Ported from the old
  // prototype scene (prototypes/lockpicking-mechanics-v63.html,
  // "Portable game module: mass-effect-2") into a fully native mode, wired
  // through the shared economy (damagePick/registerMove) instead of the
  // prototype's own LockRuntime/GameHub shims and hard pick-loss counter.

  function m2ClearUnlockTimer(){
    if(m2UnlockTimer){ clearTimeout(m2UnlockTimer); m2UnlockTimer=0; }
  }

  function m2RegenerateBoard(){
    m2ClearUnlockTimer();
    m2Kb=0;
    m2Sel=-1;
    m2Matched=new Set();
    m2Lock=false;
    m2TimeMax=diffStep(48,40,32);
    m2TimeLeft=m2TimeMax;
    const pairs=[...M2_SYMBOLS,...M2_SYMBOLS];
    for(let i=pairs.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [pairs[i],pairs[j]]=[pairs[j],pairs[i]];
    }
    m2Nodes=pairs;
    generatedDistance=M2_SYMBOLS.length;
  }

  function startMass2Round(){
    solved=false;
    $lock.classList.remove('win');
    $mechanism.classList.remove('ready','opening','opened');
    picks=pickCapacity;
    moves=0;
    brokenPicks=0;
    runReward=100;
    m2NodeEls=[];
    m2RegenerateBoard();
    updateEconomyUI();
    renderMass2();
  }

  function renderMass2(){
    if(!$m2Board) return;
    if(m2NodeEls.length!==m2Nodes.length){
      const frag=document.createDocumentFragment();
      m2NodeEls=[];
      m2Nodes.forEach((s,i)=>{
        const b=document.createElement('button');
        b.type='button';
        b.className='m2Node';
        b.textContent=s;
        b.addEventListener('mouseenter',()=>{ if(!m2Matched.has(i) && m2TimeLeft>0) b.classList.add('reveal'); });
        b.addEventListener('mouseleave',()=>{ if(i!==m2Sel && !m2Matched.has(i)) b.classList.remove('reveal'); });
        let touchStart=0, touchActive=false, suppressClick=false;
        b.addEventListener('pointerdown',e=>{
          if(e.pointerType!=='touch' || m2TimeLeft<=0) return;
          e.preventDefault();
          touchStart=performance.now();
          touchActive=true;
          suppressClick=true;
          b.classList.add('reveal');
          try{ b.setPointerCapture(e.pointerId); }catch(_){}
        });
        b.addEventListener('pointerup',e=>{
          if(e.pointerType!=='touch' || !touchActive) return;
          e.preventDefault();
          const held=performance.now()-touchStart;
          touchActive=false;
          if(held>=M2_HOLD_MS){ m2Kb=i; m2Click(i); }
          else if(i!==m2Sel && !m2Matched.has(i)) b.classList.remove('reveal');
          setTimeout(()=>{ suppressClick=false; },0);
        });
        b.addEventListener('pointercancel',e=>{
          if(e.pointerType==='touch'){
            touchActive=false;
            if(i!==m2Sel && !m2Matched.has(i)) b.classList.remove('reveal');
          }
        });
        b.addEventListener('click',e=>{
          if(suppressClick || e.pointerType==='touch') return;
          m2Kb=i;
          m2Click(i);
        });
        frag.appendChild(b);
        m2NodeEls.push(b);
      });
      $m2Board.replaceChildren(frag);
    }
    m2NodeEls.forEach((b,i)=>{
      const revealed=i===m2Sel || m2Matched.has(i);
      b.classList.toggle('selected',i===m2Sel);
      b.classList.toggle('reveal',revealed);
      b.classList.toggle('matched',m2Matched.has(i));
      b.classList.toggle('kbFocus',i===m2Kb);
    });
    if($m2Help) $m2Help.textContent=solved?'Схема открыта — все пары найдены':'';
    renderMass2Hud();
  }

  function renderMass2Hud(){
    setGlobalTimer(mode==='mass2' && !solved, m2TimeLeft, m2TimeMax, 'ТАЙМЕР');
  }

  function m2MoveKb(dir){
    if(solved) return;
    const cols=4, n=m2Nodes.length;
    if(!n) return;
    let r=Math.floor(m2Kb/cols), c=m2Kb%cols;
    if(dir==='left') c=Math.max(0,c-1);
    else if(dir==='right') c=Math.min(cols-1,c+1);
    else if(dir==='up') r=Math.max(0,r-1);
    else if(dir==='down') r=Math.min(Math.ceil(n/cols)-1,r+1);
    const next=Math.min(n-1,r*cols+c);
    if(next===m2Kb){ SFX.blocked(); return; }
    m2Kb=next;
    SFX.select();
    renderMass2();
  }

  function m2Click(i){
    if(solved || m2Lock || m2Matched.has(i) || m2TimeLeft<=0) return;
    registerMove();
    if(m2Sel<0){
      m2Sel=i;
      SFX.select();
      renderMass2();
      return;
    }
    if(i===m2Sel){
      m2Sel=-1;
      renderMass2();
      return;
    }
    if(m2Nodes[i]===m2Nodes[m2Sel]){
      m2Matched.add(i);
      m2Matched.add(m2Sel);
      m2Sel=-1;
      SFX.move();
      renderMass2();
      if(m2Matched.size===m2Nodes.length) tryOpenMass2();
      return;
    }
    m2Lock=true;
    SFX.wrongLock();
    damagePick({
      renderState:renderMass2,
      surviveText:'Не совпало'
    });
    m2ClearUnlockTimer();
    m2UnlockTimer=setTimeout(()=>{
      m2UnlockTimer=0;
      m2Sel=-1;
      m2Lock=false;
      renderMass2();
    },650);
  }

  function m2Tick(dt){
    if(mode!=='mass2' || solved) return;
    m2TimeLeft=Math.max(0,m2TimeLeft-dt);
    if(m2TimeLeft<=0){
      m2TimeLeft=0;
      damagePick({
        resetProgress:()=>{ m2RegenerateBoard(); },
        renderState:renderMass2,
        surviveText:'Время почти вышло — отмычка удержалась'
      });
      if(picks>0 && m2TimeLeft<=0) m2TimeLeft=m2TimeMax;
      return;
    }
    renderMass2Hud();
  }

  function tryOpenMass2(){
    if(solved || m2Matched.size<m2Nodes.length) return;
    solved=true;
    $lock.classList.add('win');
    SFX.open();
    renderMass2();
    setTimeout(()=>celebrate(),420);
  }

  PuzzleModes.register({
    id:'mass2',
    start:startMass2Round,
    render:renderMass2,
    tick:({dt})=>m2Tick(Math.min(.05,dt/1000)),
    syncHud:renderMass2Hud,
    objective:()=>GameCatalog.get('mass2')?.objective,
    restartMessage:'Новая схема парных узлов',
    input:{
      horizontal:dir=>m2MoveKb(dir<0?'left':'right'),
      vertical:dir=>m2MoveKb(dir<0?'up':'down')
    },
    actions:{primary:()=>m2Click(m2Kb)},
    attemptOpen:tryOpenMass2
  });
})();
