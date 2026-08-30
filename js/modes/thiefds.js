(function(){
  // ===== THIEF: DEADLY SHADOWS =====
  let tdsRingSymbols=[], tdsOrder=[], tdsStep=0, tdsSelectedRing=0, tdsAngle=0, tdsTargets=[], tdsHot=false, tdsDone=new Set(), tdsFailed=false, tdsTimeLeft=22, tdsTimeMax=22, tdsDownInfo=null, tdsRingEls=[], tdsSeqEls=[];
  // Three concentric rings, each hiding one of 5 abstract symbols and a
  // random target angle. A hidden (never-trivial) order says which ring to
  // set first; rotate the pick to a ring's hidden "sweet spot" angle and
  // commit while it's selected to advance. Wrong ring, or the right ring off
  // its sweet spot, both miss. Ported from the old prototype scene
  // (prototypes/lockpicking-mechanics-v63.html, "Portable game module:
  // thief-deadly-shadows") into a fully native mode: the angle/sweet-spot
  // math and pointer gestures carry over faithfully, wired through the
  // shared economy (damagePick/registerMove) instead of the prototype's own
  // LockRuntime shims and guaranteed-break tension-tool gate (dropped
  // entirely — that gate only ever matched the unrelated Classic/Alternative
  // typed-tensioner system).

  const TDS_SYMBOLS=[
    '<svg viewBox="0 0 48 48"><path d="M24 5V43"/></svg>',
    '<svg viewBox="0 0 48 48"><path d="M8 8H27Q38 8 38 20V43"/></svg>',
    '<svg viewBox="0 0 48 48"><path d="M25 5C14 11 35 17 24 24C14 31 35 37 24 43"/></svg>',
    '<svg viewBox="0 0 48 48"><path d="M14 43V23Q14 7 28 7Q41 7 41 22V25"/></svg>',
    '<svg viewBox="0 0 48 48"><path d="M39 6L14 24L39 43"/></svg>'
  ];

  function tdsAngleDiff(a,b){ return Math.abs(((a-b+540)%360)-180); }

  function tdsMakeOrder(){
    let order=shuffle([0,1,2]);
    while(order.join(',')==='0,1,2') order=shuffle([0,1,2]);
    return order;
  }

  function startThiefDsRound(){
    solved=false;
    $lock.classList.remove('win');
    $mechanism.classList.remove('ready','opening','opened');
    picks=pickCapacity;
    moves=0;
    brokenPicks=0;
    runReward=1000;
    tdsRingSymbols=shuffle([0,1,2,3,4]).slice(0,3);
    tdsOrder=tdsMakeOrder();
    tdsSelectedRing=2;
    tdsAngle=0;
    tdsTargets=[0,1,2].map(()=>Math.random()*360);
    tdsHot=false;
    tdsDone=new Set();
    tdsFailed=false;
    tdsStep=0;
    tdsTimeMax=diffStep(26,22,18,'thiefds');
    tdsTimeLeft=tdsTimeMax;
    tdsDownInfo=null;
    tdsRingEls=[];
    tdsSeqEls=[];
    generatedDistance=3;
    updateEconomyUI();
    renderThiefDs();
  }

  function tdsUpdateHot(){
    const tolerance=diffStep(18,14,10,'thiefds');
    tdsHot = !tdsFailed && !tdsDone.has(tdsSelectedRing) && tdsAngleDiff(tdsAngle,tdsTargets[tdsSelectedRing])<=tolerance;
  }

  function tdsSelectRing(i){
    if(tdsFailed || tdsStep>=3) return;
    const next=Math.max(0,Math.min(2,i));
    if(next===tdsSelectedRing){ SFX.blocked(); return; }
    tdsSelectedRing=next;
    tdsUpdateHot();
    SFX.select();
    renderThiefDs();
  }

  function tdsMove(dir){
    if(tdsFailed || tdsStep>=3) return;
    tdsAngle=(tdsAngle+dir*6+360)%360;
    tdsUpdateHot();
    SFX.move();
    renderThiefDs();
  }

  function tdsPointerAngle(e){
    if(mode!=='thiefds' || tdsFailed || tdsStep>=3) return;
    const r=$tdsLock.getBoundingClientRect();
    const x=e.clientX-(r.left+r.width/2), y=e.clientY-(r.top+r.height/2);
    tdsAngle=Math.atan2(y,x)*180/Math.PI;
    tdsUpdateHot();
    renderThiefDs();
  }

  function tdsPointerRing(e){
    const r=$tdsLock.getBoundingClientRect();
    const x=e.clientX-(r.left+r.width/2), y=e.clientY-(r.top+r.height/2);
    const dist=Math.hypot(x,y)/Math.min(r.width,r.height);
    const radii=[.39,.29,.19];
    let best=-1, bestD=Infinity;
    radii.forEach((v,i)=>{ const d=Math.abs(dist-v); if(d<bestD){ bestD=d; best=i; } });
    return bestD<=.035 ? best : -1;
  }

  function tdsPointerDown(e){
    if(mode!=='thiefds' || tdsFailed || tdsStep>=3) return;
    e.preventDefault();
    const beforeHot=tdsHot, ring=tdsPointerRing(e);
    // Desktop aiming never changes ring. On touch, a deliberate tap directly
    // on another ring selects it instead of aiming from wherever it lands.
    if(e.pointerType==='touch' && !beforeHot && ring>=0 && ring!==tdsSelectedRing){
      tdsSelectRing(ring);
      tdsDownInfo={x:e.clientX,y:e.clientY,ring:tdsSelectedRing,selectOnly:true};
      return;
    }
    tdsPointerAngle(e);
    tdsDownInfo={x:e.clientX,y:e.clientY,ring:tdsSelectedRing,selectOnly:false};
    try{ $tdsLock.setPointerCapture(e.pointerId); }catch(_){}
  }

  function tdsPointerUp(e){
    if(!tdsDownInfo) return;
    const info=tdsDownInfo;
    tdsDownInfo=null;
    if(info.selectOnly) return;
    const dx=e.clientX-info.x, dy=e.clientY-info.y, dist=Math.hypot(dx,dy);
    const sameRing=tdsSelectedRing===info.ring;
    if(dist<=14 && sameRing) tdsCommit();
  }

  function tdsCommit(){
    if(tdsFailed || tdsStep>=3) return;
    registerMove();
    const expected=tdsOrder[tdsStep];
    if(tdsSelectedRing!==expected){
      SFX.wrongLock();
      damagePick({ renderState:renderThiefDs, surviveText:'Выбрано не то кольцо' });
      return;
    }
    if(!tdsHot){
      SFX.wrongLock();
      damagePick({ renderState:renderThiefDs, surviveText:'Промах мимо сладкой точки' });
      return;
    }
    tdsDone.add(tdsSelectedRing);
    tdsStep++;
    tdsHot=false;
    SFX.move();
    renderThiefDs();
    if(tdsStep>=3) SFX.ready();
  }

  function tdsTick(dt){
    if(mode!=='thiefds' || solved || tdsFailed || tdsStep>=3) return;
    tdsTimeLeft=Math.max(0,tdsTimeLeft-dt);
    if(tdsTimeLeft<=0){
      tdsTimeLeft=0;
      tdsFailed=true;
      tdsHot=false;
    }
    renderThiefDs();
  }

  function renderTdsSequence(){
    if(!$tdsSequence) return;
    const key=tdsOrder.map(i=>tdsRingSymbols[i]).join(',');
    if($tdsSequence.dataset.key!==key || tdsSeqEls.length!==tdsOrder.length){
      $tdsSequence.dataset.key=key;
      const frag=document.createDocumentFragment();
      tdsSeqEls=[];
      tdsOrder.forEach(ringIndex=>{
        const d=document.createElement('div');
        d.className='tdsSeqItem';
        d.innerHTML=TDS_SYMBOLS[tdsRingSymbols[ringIndex]];
        tdsSeqEls.push(d);
        frag.appendChild(d);
      });
      $tdsSequence.replaceChildren(frag);
    }
    tdsSeqEls.forEach((d,step)=>{
      d.classList.toggle('done', step<tdsStep);
      d.classList.toggle('current', step===tdsStep && !tdsFailed);
    });
  }

  function renderThiefDs(){
    if(!$tdsLock) return;
    setGlobalTimer(mode==='thiefds' && !tdsFailed, tdsTimeLeft, tdsTimeMax, 'ТАЙМЕР');
    if(tdsRingEls.length!==3){
      tdsRingEls=[];
      for(let i=0;i<3;i++){
        const r=document.createElement('div');
        r.className='tdsRing r'+(i+1);
        tdsRingEls.push(r);
        $tdsLock.insertBefore(r,$tdsProbe);
      }
    }
    tdsRingEls.forEach((r,i)=>{
      r.classList.toggle('selected', !tdsFailed && i===tdsSelectedRing);
      r.classList.toggle('set', tdsDone.has(i));
      const symbol=String(tdsRingSymbols[i]);
      if(r.dataset.symbol!==symbol){
        r.dataset.symbol=symbol;
        r.innerHTML=`<span class="tdsRingSymbol">${TDS_SYMBOLS[tdsRingSymbols[i]]}</span>`;
      }
    });
    if($tdsProbe) $tdsProbe.style.transform=`rotate(${tdsAngle}deg)`;
    $tdsLock.classList.toggle('hot', tdsHot && !tdsFailed);
    renderTdsSequence();
    if($tdsHelp){
      if(tdsFailed) $tdsHelp.textContent='Попытка провалена — начни новый замок';
      else if(tdsStep>=3) $tdsHelp.textContent='Все кольца выставлены — нажми на замок';
      else if(tdsHot) $tdsHelp.textContent='Сладкая точка найдена — Space, чтобы зафиксировать';
      else $tdsHelp.textContent=`${tdsStep} / 3 · ищи точку на выбранном кольце`;
    }
  }

  function renderThiefDsHud(){
    setGlobalTimer(mode==='thiefds'&&!tdsFailed,tdsTimeLeft,tdsTimeMax,'ТАЙМЕР');
  }

  function tryOpenThiefDs(){
    if(shopOpen || solved) return;
    if(tdsFailed || tdsStep<3){
      SFX.wrongLock();
      toast('Сначала выставь все три кольца');
      return;
    }
    solved=true;
    $lock.classList.add('win');
    SFX.open();
    renderThiefDs();
    setTimeout(()=>celebrate(),420);
  }

  if($tdsLock){
    $tdsLock.addEventListener('pointermove',e=>{ if(e.pointerType!=='touch') tdsPointerAngle(e); });
    $tdsLock.addEventListener('pointerdown',tdsPointerDown);
    $tdsLock.addEventListener('pointerup',tdsPointerUp);
    $tdsLock.addEventListener('pointercancel',()=>{ tdsDownInfo=null; });
  }

  PuzzleModes.register({
    id:'thiefds', start:startThiefDsRound, render:renderThiefDs,
    tick:({dt})=>tdsTick(Math.min(.05,dt/1000)),
    syncHud:renderThiefDsHud,
    objective:()=>GameCatalog.get('thiefds')?.objective,
    restartMessage:'Новый замок Thief: Deadly Shadows',
    input:{
      horizontal:tdsMove,
      vertical:delta=>tdsSelectRing(tdsSelectedRing+(delta<0?-1:1))
    },
    actions:{primary:tdsCommit},
    attemptOpen:tryOpenThiefDs
  });
})();
