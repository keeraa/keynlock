  // ===== MUSEUM (Hillsfar — музей: подбор формы отмычки) =====
  // Six tumblers, each hiding a target pick-shape symbol. The player clicks
  // the matching symbol out of a 21-symbol grid; some tumblers are half
  // occluded (harder to read) and some are "jammed" (need the right symbol
  // clicked twice in a row). A countdown adds pressure on top of the shared
  // pick economy. Ported from the old prototype scene
  // (prototypes/lockpicking-mechanics-v63.html, "// Hillsfar") into a fully
  // native mode, wired through the shared economy (damagePick/registerMove)
  // instead of the prototype's own LockRuntime/GameHub shims.

  function hmRegeneratePins(){
    hmKb=0;
    hmStep=0;
    hmTimeMax=diffStep(34,28,22);
    hmTimeLeft=hmTimeMax;
    const seq=Array.from({length:6},()=>Math.floor(Math.random()*HM_SYMBOLS.length));
    const cover=Array(6).fill(null);
    const indices=[0,1,2,3,4,5];
    for(let i=indices.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [indices[i],indices[j]]=[indices[j],indices[i]];
    }
    const coverCount=2+Math.floor(Math.random()*2);
    indices.slice(0,coverCount).forEach(i=>{
      seq[i]=Math.floor(Math.random()*7);
      cover[i]=Math.random()<.5?'left':'right';
    });
    hmSeq=seq;
    hmCover=cover;
    const jamChance=diffStep(.15,.25,.35);
    hmJam=Array.from({length:6},()=>Math.random()<jamChance?2:1);
    generatedDistance=6;
  }

  function startMuseumRound(){
    solved=false;
    $lock.classList.remove('win');
    $mechanism.classList.remove('ready','opening','opened');
    picks=pickCapacity;
    moves=0;
    brokenPicks=0;
    runReward=1000;
    hmRegeneratePins();
    updateEconomyUI();
    renderMuseum();
  }

  function renderMuseum(){
    if(!$hmLock || !$hmPicks) return;
    if(hmTumbEls.length!==hmSeq.length){
      const frag=document.createDocumentFragment();
      hmTumbEls=[];
      for(let i=0;i<hmSeq.length;i++){
        const d=document.createElement('div');
        d.className='hmTumb';
        frag.appendChild(d);
        hmTumbEls.push(d);
      }
      $hmLock.replaceChildren(frag);
    }
    hmTumbEls.forEach((d,i)=>{
      const side=hmCover[i];
      d.className='hmTumb'+(i===hmStep?' current':'')+(i<hmStep?' done':'')+(i>=hmStep&&side?' covered-'+side:'');
      if(i<hmStep){
        d.textContent='✓';
      }else{
        const symbol=HM_SYMBOLS[hmSeq[i]];
        const occ=side?`<span class="hmOcclusion ${side}"></span>`:'';
        d.innerHTML=`<span class="hmSymbolWrap"><span class="hmTargetSymbol">${symbol}</span></span>${occ}`;
      }
    });
    if(hmPickEls.length!==HM_SYMBOLS.length){
      const frag=document.createDocumentFragment();
      hmPickEls=[];
      HM_SYMBOLS.forEach((s,i)=>{
        const b=document.createElement('button');
        b.type='button';
        b.className='hmPick';
        const glyph=s.replace(/&/g,'&amp;').replace(/"/g,'&quot;');
        b.innerHTML=`<span class="hmPickSymbol" data-glyph="${glyph}">${s}</span>`;
        b.addEventListener('click',()=>{ hmKb=i; hmPick(i); });
        frag.appendChild(b);
        hmPickEls.push(b);
      });
      $hmPicks.replaceChildren(frag);
    }
    hmPickEls.forEach((b,i)=>b.classList.toggle('kbFocus',i===hmKb));
    if($hmTimerBar) $hmTimerBar.style.width=Math.max(0,hmTimeLeft/hmTimeMax*100)+'%';
    if($hmHelp){
      if(solved) $hmHelp.textContent='Замок открыт — все профили подобраны';
      else $hmHelp.textContent=`Тумблер ${Math.min(6,hmStep+1)} / 6 · ${hmJam[hmStep]>1?'заклинивший профиль':'подбери форму'}`;
    }
  }

  function hmMoveKb(dir){
    if(solved) return;
    const cols=7, n=HM_SYMBOLS.length, row=Math.floor(hmKb/cols), col=hmKb%cols;
    let next=hmKb;
    if(dir==='left') next=row*cols+Math.max(0,col-1);
    else if(dir==='right'){ const rowEnd=Math.min(n-1,row*cols+cols-1); next=Math.min(rowEnd,hmKb+1); }
    else if(dir==='up'){ if(row>0) next=Math.min(col,n-1); }
    else if(dir==='down'){ const rows=Math.ceil(n/cols); if(row<rows-1) next=Math.min(n-1,(row+1)*cols+col); }
    if(next===hmKb){ SFX.blocked(); return; }
    hmKb=next;
    SFX.select();
    renderMuseum();
  }

  function hmPick(i){
    if(solved) return;
    hmKb=i;
    registerMove();
    if(i===hmSeq[hmStep]){
      hmJam[hmStep]--;
      SFX.move();
      if(hmJam[hmStep]>0){
        toast('Профиль заклинило — повтори');
        renderMuseum();
        return;
      }
      hmStep++;
      if(hmStep>=hmSeq.length){
        renderMuseum();
        tryOpenMuseum();
        return;
      }
      renderMuseum();
      return;
    }
    hmTimeLeft=Math.max(0,hmTimeLeft-2.2);
    SFX.wrongLock();
    damagePick({
      renderState:renderMuseum,
      surviveText:'Форма не подходит'
    });
  }

  function hmTick(dt){
    if(mode!=='museum' || solved) return;
    hmTimeLeft=Math.max(0,hmTimeLeft-dt);
    if(hmTimeLeft<=0){
      hmTimeLeft=0;
      damagePick({
        resetProgress:()=>{ hmRegeneratePins(); },
        renderState:renderMuseum,
        surviveText:'Время почти вышло — отмычка удержалась'
      });
      if(picks>0 && hmTimeLeft<=0) hmTimeLeft=hmTimeMax;
      return;
    }
    renderMuseum();
  }

  function tryOpenMuseum(){
    if(shopOpen || solved || hmStep<hmSeq.length) return;
    solved=true;
    $lock.classList.add('win');
    SFX.open();
    renderMuseum();
    setTimeout(()=>celebrate(),420);
  }
