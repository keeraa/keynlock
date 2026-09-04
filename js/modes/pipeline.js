(function(){
  // ===== PIPELINE (Трубопровод) =====
  const PL_ROWS=6, PL_PREP_MS=17000,
    PL_START={r:2,c:0,in:'W'},
    PL_DIR_OPP={N:'S',S:'N',E:'W',W:'E'}, PL_DIR_VEC={N:[-1,0],S:[1,0],E:[0,1],W:[0,-1]}, PL_DIR_ORDER=['N','E','S','W'];
  let PL_COLS=6, PL_EXIT={r:3,c:5,out:'E'},
    plTiles=[], plRevealed=new Set(), plVisited=new Set(), plCursor=0, plState='prep',
    plStartAt=0, plPrepMax=PL_PREP_MS, plLastStep=0, plPos=null, plInDir='W',
    plTileEls=[], plLastLevelSig='';
  // A difficulty-scaled grid of hidden pipe tiles. Reveal a tile to see its shape, click it
  // again to rotate 90° clockwise. Once the prep countdown runs out, a flow
  // auto-traces from a fixed start port to a fixed exit port. A complete,
  // revealed route accelerates automatically. Hitting an unrevealed tile, a
  // hazard tile, a dead end, a disconnect, a loop, or the grid edge fails
  // the attempt and consumes all remaining picks. Ported from the old
  // prototype scene (prototypes/lockpicking-mechanics-v63.html, "Portable
  // game module: bioshock-1") into a fully native mode: the path-generation
  // and flow-trace algorithms are carried over faithfully, wired through
  // the shared economy (damagePick/registerMove) instead of the
  // prototype's own LockRuntime/GameHub shims and hard pick-loss counter.

  function plReqType(prev,cur,next){
    const dirs=[];
    const add=(a,b)=>{
      const dr=b[0]-a[0], dc=b[1]-a[1];
      if(dr===-1) dirs.push('N');
      else if(dr===1) dirs.push('S');
      else if(dc===1) dirs.push('E');
      else if(dc===-1) dirs.push('W');
    };
    if(prev) add(cur,prev); else dirs.push('W');
    if(next) add(cur,next); else dirs.push('E');
    return dirs.sort((a,b)=>'NESW'.indexOf(a)-'NESW'.indexOf(b)).join('');
  }

  function plMakeBandPath(kind){
    const upper=kind==='upper', rows=upper?[0,1,2]:[3,4,5];
    const path=[[PL_START.r,PL_START.c],[upper?1:3,0]];
    let row=upper?1:3;
    for(let c=1;c<PL_COLS;c++){
      const target=c===PL_COLS-1 ? (upper?2:4)
        : (!upper && c===PL_COLS-2 ? [4,5][Math.floor(Math.random()*2)] : rows[Math.floor(Math.random()*rows.length)]);
      path.push([row,c]);
      while(row!==target){ row+=target>row?1:-1; path.push([row,c]); }
    }
    path.push([PL_EXIT.r,PL_EXIT.c]);
    return path;
  }

  function plPathSig(paths){ return paths.map(p=>p.map(x=>x.join(',')).join(';')).join('|'); }

  let plPaths=[], plRequiredPaths=[];
  function plGeneratePaths(){
    let paths, sig='';
    for(let attempt=0;attempt<40;attempt++){
      paths=[plMakeBandPath('upper'),plMakeBandPath('lower')];
      sig=plPathSig(paths);
      if(sig!==plLastLevelSig) break;
    }
    plLastLevelSig=sig;
    plPaths=paths;
    plRequiredPaths=plPaths.map(path=>path.map((p,i)=>plReqType(i?path[i-1]:null,p,i<path.length-1?path[i+1]:null)));
  }

  function plRandomPipeType(){ return ['EW','NS','EN','ES','NW','SW'][Math.floor(Math.random()*6)]; }

  function plIndex(r,c){ return r*PL_COLS+c; }

  function plCoherentDecoy(i,hazards){
    const r=Math.floor(i/PL_COLS), c=i%PL_COLS, dirs=[];
    [['N',-1,0],['E',0,1],['S',1,0],['W',0,-1]].forEach(([d,dr,dc])=>{
      const nr=r+dr, nc=c+dc;
      if(nr<0||nr>=PL_ROWS||nc<0||nc>=PL_COLS) return;
      const ni=plIndex(nr,nc);
      if(!hazards.has(ni)) dirs.push(d);
    });
    if(dirs.length<2) return plRotateType(plRandomPipeType(),Math.floor(Math.random()*4));
    const pairs=[];
    for(let a=0;a<dirs.length;a++) for(let b=a+1;b<dirs.length;b++) pairs.push(plCanonical(dirs[a]+dirs[b]));
    return pairs[Math.floor(Math.random()*pairs.length)];
  }

  function plCanonical(type){
    if(type==='X') return type;
    return type.split('').sort((a,b)=>PL_DIR_ORDER.indexOf(a)-PL_DIR_ORDER.indexOf(b)).join('');
  }

  function plRotateType(type,steps=1){
    if(type==='X') return type;
    const map={N:'E',E:'S',S:'W',W:'N'};
    let out=type;
    const n=((steps%4)+4)%4;
    for(let k=0;k<n;k++) out=out.split('').map(d=>map[d]).join('');
    return plCanonical(out);
  }

  function plRotationTo(type,target){
    for(let n=0;n<4;n++) if(plRotateType(type,n)===target) return n;
    return -1;
  }

  function plPipeFamily(type){
    if(type==='X') return 'X';
    const t=plCanonical(type);
    return t==='EW'||t==='NS' ? 'straight' : 'corner';
  }

  function plMinRotations(type,target){
    let best=9;
    for(let n=0;n<4;n++) if(plRotateType(type,n)===target) best=Math.min(best,Math.min(n,4-n));
    return best===9 ? 0 : best;
  }

  function plIdealMoves(tiles){
    let best=Infinity;
    plPaths.forEach((path,pIndex)=>{
      let moves=0;
      path.forEach((cell,j)=>{
        const idx=plIndex(cell[0],cell[1]);
        if(idx!==plIndex(PL_START.r,PL_START.c) && idx!==plIndex(PL_EXIT.r,PL_EXIT.c)) moves++;
        moves+=plMinRotations(tiles[idx].type,plRequiredPaths[pIndex][j]);
      });
      best=Math.min(best,moves);
    });
    return Number.isFinite(best) ? best : 18;
  }

  function plDirs(type){ return type==='X' ? [] : type.split(''); }

  function plTraceTiles(tiles){
    let r=PL_START.r, c=PL_START.c, inDir=PL_START.in;
    const visited=new Set(), route=[];
    for(let guard=0;guard<PL_ROWS*PL_COLS+2;guard++){
      if(r<0||r>=PL_ROWS||c<0||c>=PL_COLS) return {ok:false,route};
      const idx=plIndex(r,c), tile=tiles[idx];
      if(!tile||tile.type==='X') return {ok:false,route};
      if(visited.has(idx)) return {ok:false,route};
      visited.add(idx); route.push(idx);
      const dirs=plDirs(tile.type);
      if(dirs.length!==2||!dirs.includes(inDir)) return {ok:false,route};
      const out=dirs.find(d=>d!==inDir);
      if(!out) return {ok:false,route};
      if(r===PL_EXIT.r && c===PL_EXIT.c && out===PL_EXIT.out) return {ok:true,route};
      const [dr,dc]=PL_DIR_VEC[out], nr=r+dr, nc=c+dc;
      if(nr<0||nr>=PL_ROWS||nc<0||nc>=PL_COLS) return {ok:false,route};
      const next=tiles[plIndex(nr,nc)];
      if(!next||next.type==='X') return {ok:false,route};
      if(!plDirs(next.type).includes(PL_DIR_OPP[out])) return {ok:false,route};
      r=nr; c=nc; inDir=PL_DIR_OPP[out];
    }
    return {ok:false,route};
  }

  function plBuildBoard(){
    plGeneratePaths();
    const unionOptions=new Map();
    plPaths.forEach((path,pIndex)=>{
      const reqs=plRequiredPaths[pIndex];
      path.forEach((cell,i)=>{
        const idx=plIndex(cell[0],cell[1]);
        if(!unionOptions.has(idx)) unionOptions.set(idx,[]);
        unionOptions.get(idx).push(reqs[i]);
      });
    });
    const safe=[...Array(PL_ROWS*PL_COLS).keys()].filter(i=>!unionOptions.has(i));
    const hazardCount=diffStep(4,6,8);
    const shuffledSafe=[...safe];
    for(let i=shuffledSafe.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [shuffledSafe[i],shuffledSafe[j]]=[shuffledSafe[j],shuffledSafe[i]]; }
    const hazards=new Set(shuffledSafe.slice(0,hazardCount));
    const tiles=[];
    for(let i=0;i<PL_ROWS*PL_COLS;i++){
      let type;
      if(unionOptions.has(i)){
        const opts=unionOptions.get(i);
        const families=[...new Set(opts.map(plPipeFamily))];
        const family=families.includes('corner') && !families.includes('straight') ? 'corner' : 'straight';
        const base=family==='corner' ? ['EN','ES','NW','SW'][Math.floor(Math.random()*4)] : ['EW','NS'][Math.floor(Math.random()*2)];
        type=plRotateType(base,Math.floor(Math.random()*4));
      }else if(hazards.has(i)){
        type='X';
      }else{
        type=plCoherentDecoy(i,hazards);
      }
      tiles.push({type,i});
    }
    const canSolveAll=plPaths.every((path,pIndex)=>{
      const solved=tiles.map(t=>({...t}));
      let orientable=true;
      path.forEach((cell,j)=>{
        const idx=plIndex(cell[0],cell[1]), target=plRequiredPaths[pIndex][j], turns=plRotationTo(solved[idx].type,target);
        if(turns<0) orientable=false; else solved[idx].type=plRotateType(solved[idx].type,turns);
      });
      const trace=orientable ? plTraceTiles(solved) : {ok:false};
      return trace.ok && trace.route.length===path.length;
    });
    if(canSolveAll) return tiles;
    return [...Array(PL_ROWS*PL_COLS)].map((_,i)=>{
      if(unionOptions.has(i)){
        const opts=unionOptions.get(i), families=[...new Set(opts.map(plPipeFamily))];
        const family=families.includes('corner') && !families.includes('straight') ? 'corner' : 'straight';
        return {type:family==='corner'?'EN':'EW',i};
      }
      return {type:plRandomPipeType(),i};
    });
  }

  function plWaterLocked(i){
    if(plVisited.has(i)) return true;
    return !!(plState==='flow' && plPos && plIndex(plPos.r,plPos.c)===i);
  }

  function plRestartAttempt(retryMs){
    plState='prep';
    plStartAt=performance.now()+retryMs;
    plPrepMax=retryMs;
    plLastStep=0;
    plPos=null;
    plInDir='W';
    plVisited=new Set();
  }

  function startPipelineRound(){
    solved=false;
    $lock.classList.remove('win');
    $mechanism.classList.remove('ready','opening','opened');
    picks=pickCapacity;
    moves=0;
    brokenPicks=0;
    runReward=100;
    PL_COLS=diffStep(6,8,10,'pipeline');
    PL_EXIT={r:3,c:PL_COLS-1,out:'E'};
    if($plGrid){
      $plGrid.style.setProperty('--pl-cols',String(PL_COLS));
      $plGrid.style.setProperty('--pl-aspect',`${PL_COLS} / ${PL_ROWS}`);
    }
    plTileEls=[];
    const tiles=plBuildBoard();
    plTiles=tiles;
    plRevealed=new Set();
    plCursor=plIndex(PL_START.r,PL_START.c);
    plPrepMax=diffStep(22000,PL_PREP_MS,13000);
    generatedDistance=plIdealMoves(tiles);
    plRestartAttempt(plPrepMax);
    updateEconomyUI();
    renderPipeline();
  }

  function plPipeHtml(type){
    if(type==='X') return '';
    return `<div class="plPipe">${type.split('').map(d=>`<span class="plSeg ${d}"></span>`).join('')}<span class="plHub"></span></div>`;
  }

  function plAlignPorts(){
    if(!$plGridWrap || !$plStartPort || !$plExitPort || !$plGrid) return;
    const tiles=$plGrid.children;
    const startTile=tiles[plIndex(PL_START.r,PL_START.c)], exitTile=tiles[plIndex(PL_EXIT.r,PL_EXIT.c)];
    if(!startTile||!exitTile) return;
    const wr=$plGridWrap.getBoundingClientRect();
    const gr=$plGrid.getBoundingClientRect();
    // plGridWrap is a wide centering flex box (needed so plGrid can size
    // itself off height via aspect-ratio); plGrid is often narrower than
    // the wrap and centered within it, so the ports must be pinned to
    // plGrid's actual edges, not the wrap's — plain CSS left:0/right:0
    // would sit at the wrap's edges and float away from the grid. They
    // sit just outside the grid (flush against its edge, not overlapping
    // into the first/last tile) like a pipe stub plugged into the socket.
    $plStartPort.style.left=`${gr.left-wr.left-$plStartPort.offsetWidth}px`;
    $plExitPort.style.right=`${wr.right-gr.right-$plExitPort.offsetWidth}px`;
    [[$plStartPort,startTile],[$plExitPort,exitTile]].forEach(([port,tile])=>{
      const tr=tile.getBoundingClientRect();
      port.style.top=`${tr.top-wr.top+(tr.height-port.offsetHeight)/2}px`;
    });
  }

  function renderPipeline(){
    if(!$plGrid) return;
    if($plStartPort) $plStartPort.classList.toggle('filled',plState==='flow'||plState==='won');
    if($plExitPort) $plExitPort.classList.toggle('filled',plState==='won');
    if(plTileEls.length!==plTiles.length){
      const frag=document.createDocumentFragment();
      plTileEls=[];
      plTiles.forEach((t,i)=>{
        const b=document.createElement('button');
        b.type='button';
        b.className='plTile';
        b.addEventListener('click',()=>plClick(i));
        frag.appendChild(b);
        plTileEls.push(b);
      });
      $plGrid.replaceChildren(frag);
    }
    plTiles.forEach((t,i)=>{
      const el=plTileEls[i];
      if(!el) return;
      const revealed=plRevealed.has(i);
      const waterLocked=plWaterLocked(i);
      el.className='plTile'
        +(!revealed?' hidden':t.type==='X'?' hazard':'')
        +(i===plCursor && !waterLocked?' kbFocus':'')
        +(plVisited.has(i)?' done':'')
        +(plPos && plIndex(plPos.r,plPos.c)===i && plState==='flow' ? ' flow' : '')
        +(waterLocked?' waterLocked':'');
      el.innerHTML=revealed?plPipeHtml(t.type):'';
    });
    if($plHelp) $plHelp.textContent='';
    renderPipelineHud();
    plAlignPorts();
  }

  function renderPipelineHud(){
    setGlobalTimer(mode==='pipeline' && !solved && plState==='prep', Math.max(0,plStartAt-performance.now())/1000, plPrepMax/1000, 'ТАЙМЕР');
  }

  function plMoveCursor(dr,dc){
    if(solved) return;
    const r=Math.floor(plCursor/PL_COLS), c=plCursor%PL_COLS;
    const nr=Math.max(0,Math.min(PL_ROWS-1,r+dr)), nc=Math.max(0,Math.min(PL_COLS-1,c+dc));
    const next=plIndex(nr,nc);
    if(next===plCursor){ SFX.blocked(); return; }
    if(plWaterLocked(next)){ SFX.blocked(); return; }
    plCursor=next;
    SFX.select();
    renderPipeline();
  }

  function plRotate(i){
    if(solved || plState==='won' || !plRevealed.has(i) || plTiles[i].type==='X' || plWaterLocked(i)) return;
    registerMove();
    plTiles[i].type=plRotateType(plTiles[i].type,1);
    SFX.move();
    renderPipeline();
  }

  function plClick(i){
    if(solved || plState==='won') return;
    if(plWaterLocked(i)){ SFX.blocked(); return; }
    plCursor=i;
    if(!plRevealed.has(i)){
      registerMove();
      plRevealed.add(i);
      if(plState==='flow') plLastStep=performance.now();
      SFX.select();
      renderPipeline();
      return;
    }
    if(plTiles[i].type==='X') return;
    plRotate(i);
  }

  function plKeyboardAction(){
    plClick(plCursor);
  }

  function plFail(msg){
    if(solved || plState==='failed') return;
    plState='failed';
    plPos=null;
    SFX.wrongLock();
    const remaining=Math.max(0,Math.min(pickCapacity,picks));
    picks=0;
    window.KeynlockResources?.consumePicks?.(remaining);
    brokenPicks+=remaining;
    for(let slot=remaining;slot>0;slot--) triggerInventoryBreakAnimation(slot);
    SFX.break();
    updatePickUI();
    renderPipeline();
    showGameDefeat('picks',{text:`${msg}. Все отмычки потеряны. Вернись в логово и подготовь новый комплект.`});
  }

  function plStep(now){
    if(plState==='prep'){
      const startIdx=plIndex(PL_START.r,PL_START.c);
      if(!plRevealed.has(startIdx)){
        plFail('Входная клетка не подготовлена');
        return;
      }
      plState='flow';
      plPos={r:PL_START.r,c:PL_START.c};
      plInDir=PL_START.in;
      plLastStep=now;
      renderPipeline();
      return;
    }
    if(plState!=='flow' || !plPos) return;
    const idx=plIndex(plPos.r,plPos.c);
    if(!plRevealed.has(idx)){
      plFail('Поток упёрся в нераскрытую плитку');
      return;
    }
    const tile=plTiles[idx], dirs=plDirs(tile.type);
    if(tile.type==='X'){ plFail('Поток попал в аварийную плитку'); return; }
    if(dirs.length!==2 || !dirs.includes(plInDir)){ plFail('Труба не соединена с предыдущей'); return; }
    const out=dirs.find(d=>d!==plInDir);
    if(!out){ plFail('Поток упёрся в тупик'); return; }
    plVisited.add(idx);
    if(plPos.r===PL_EXIT.r && plPos.c===PL_EXIT.c && out===PL_EXIT.out){ tryOpenPipeline(); return; }
    const [dr,dc]=PL_DIR_VEC[out], nr=plPos.r+dr, nc=plPos.c+dc;
    if(nr<0||nr>=PL_ROWS||nc<0||nc>=PL_COLS){ plFail('Поток вышел за пределы схемы'); return; }
    const ni=plIndex(nr,nc);
    if(plVisited.has(ni)){ plFail('Поток замкнулся в петлю'); return; }
    const next=plTiles[ni];
    if(!next){ plFail('Следующая плитка отсутствует'); return; }
    if(!plRevealed.has(ni)){ plFail('Поток упёрся в нераскрытую плитку'); return; }
    if(next.type==='X'){ plFail('Поток попал в аварийную плитку'); return; }
    if(!plDirs(next.type).includes(PL_DIR_OPP[out])){ plFail('Следующая труба подключена неверно'); return; }
    plPos={r:nr,c:nc};
    plInDir=PL_DIR_OPP[out];
    plLastStep=now;
    renderPipeline();
  }

  function plHasReadyRoute(){
    const trace=plTraceTiles(plTiles);
    return trace.ok && trace.route.every(i=>plRevealed.has(i));
  }

  function plTick(now){
    if(mode!=='pipeline' || solved) return;
    if(plState==='prep'){
      renderPipelineHud();
      if(now>=plStartAt) plStep(now);
      return;
    }
    if(plState==='flow'){
      const introDelay=plVisited.size<1?1200:plVisited.size<2?1050:plVisited.size<3?900:820;
      const delay=plHasReadyRoute()?240:introDelay;
      if(now-plLastStep>=delay) plStep(now);
    }
  }

  function tryOpenPipeline(){
    if(solved) return;
    plState='won';
    plPos=null;
    solved=true;
    $lock.classList.add('win');
    SFX.open();
    renderPipeline();
    setTimeout(()=>celebrate(),420);
  }

  PuzzleModes.register({
    id:'pipeline',
    start:startPipelineRound,
    render:renderPipeline,
    tick:({now})=>plTick(now),
    resize:plAlignPorts,
    syncHud:renderPipelineHud,
    objective:()=>GameCatalog.get('pipeline')?.objective,
    restartMessage:'Новая схема трубопровода',
    input:{
      horizontal:dir=>plMoveCursor(0,dir),
      vertical:dir=>plMoveCursor(dir,0)
    },
    actions:{primary:plKeyboardAction},
    attemptOpen:tryOpenPipeline
  });
})();
