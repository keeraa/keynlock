  // ===== THIEF 1/2 =====
  // Five hidden pick profiles, one correct per stage. Press-and-hold a
  // profile (mouse/touch on its button, or number keys 1-5) to test it: the
  // wrong one gives a "near" or "miss" cue depending on whether it's the
  // planted decoy for this stage, the right one "catches" and must be held
  // continuously until it completes. Retrying ANY profile already tried at
  // this stage — including the correct one if released too early — breaks
  // a pick; nothing else does. Ported from the old prototype scene
  // (prototypes/lockpicking-mechanics-v63.html, "Portable game module:
  // thief-1-2") into a fully native mode: the elimination logic carries
  // over faithfully (setInterval-based hold progress replaced with a
  // dt-driven tick, matching this session's other continuous-hold ports),
  // wired through the shared economy (damagePick) instead of the
  // prototype's own LockRuntime shim and hard, unconditional pick break.

  const TH12_TYPES=['p1','p2','p3','p4','p5'];

  const th12ProfileEls=[...document.querySelectorAll('.th12Profile')];

  function th12MakeNear(correct){
    const pool=TH12_TYPES.filter(t=>t!==correct);
    return pool[Math.floor(Math.random()*pool.length)];
  }

  function startThief12Round(){
    solved=false;
    $lock.classList.remove('win');
    $mechanism.classList.remove('ready','opening','opened');
    picks=pickCapacity;
    moves=0;
    brokenPicks=0;
    runReward=1000;
    th12Seq=Array.from({length:5},()=>TH12_TYPES[Math.floor(Math.random()*TH12_TYPES.length)]);
    th12Near=th12Seq.map(th12MakeNear);
    th12Step=0;
    th12Hold=null;
    th12HoldProgress=0;
    th12Tried=new Set();
    th12Failed=false;
    th12TimeMax=diffStep(28,22,17,'thief12');
    th12TimeLeft=th12TimeMax;
    th12HoldDuration=diffStep(.45,.63,.85,'thief12');
    th12LastHint='';
    th12KeyType=null;
    if($th12Door) $th12Door.classList.remove('working');
    th12ProfileEls.forEach(b=>b.classList.remove('active'));
    generatedDistance=5;
    updateEconomyUI();
    renderThief12();
  }

  function th12BreakPick(){
    th12Hold=null;
    th12HoldProgress=0;
    if($th12Door) $th12Door.classList.remove('working');
    th12ProfileEls.forEach(b=>b.classList.remove('active'));
    SFX.wrongLock();
    damagePick({
      renderState:renderThief12,
      surviveText:'Повтор профиля сломал отмычку'
    });
    renderThief12();
  }

  function th12Use(type,on){
    if(mode!=='thief12' || solved) return;
    if(!on){
      if(th12Hold===type){ th12Hold=null; th12HoldProgress=0; }
      renderThief12();
      return;
    }
    if(th12Step>=5 || th12Failed) return;
    if(th12Tried.has(type)){
      th12BreakPick();
      return;
    }
    th12Tried.add(type);
    registerMove();
    const correct=th12Seq[th12Step], near=th12Near[th12Step];
    if(type!==correct){
      if(type===near){
        SFX.move();
        th12LastHint='Механизм слегка цепляется, но профиль не тот';
      }else{
        SFX.blocked();
        th12LastHint='Сухой щелчок — профиль точно не цепляет';
      }
      renderThief12();
      return;
    }
    th12Hold=type;
    th12HoldProgress=0;
    SFX.select();
    th12LastHint='Чёткое зацепление — удерживай';
    renderThief12();
  }

  function th12Tick(dt){
    if(mode!=='thief12' || solved || th12Failed) return;
    if(th12Step<5){
      th12TimeLeft=Math.max(0,th12TimeLeft-dt);
      if(th12TimeLeft<=0){
        th12TimeLeft=0;
        th12Failed=true;
        th12Hold=null;
        th12HoldProgress=0;
        if($th12Door) $th12Door.classList.remove('working');
        th12ProfileEls.forEach(b=>b.classList.remove('active'));
        renderThief12();
        return;
      }
    }
    if(th12Hold){
      th12HoldProgress+=dt/th12HoldDuration;
      if(th12HoldProgress>=1){
        th12HoldProgress=0;
        th12Hold=null;
        th12Tried=new Set();
        th12Step++;
        SFX.move();
        if(th12Step>=5){
          solved=true;
          $lock.classList.add('win');
          SFX.open();
          renderThief12();
          setTimeout(()=>celebrate(),420);
          return;
        }
        th12LastHint='Стадия открыта — слушай следующую';
      }
    }
    renderThief12();
  }

  function renderThief12(){
    if(!$th12Door) return;
    if($th12Stages){
      [...$th12Stages.children].forEach((s,i)=>s.classList.toggle('done',i<th12Step));
    }
    $th12Door.classList.toggle('working',!!th12Hold);
    th12ProfileEls.forEach(b=>b.classList.toggle('active',th12Hold===b.dataset.type));
    if($th12Help){
      if(th12Failed) $th12Help.textContent='Время вышло — начни новый замок';
      else if(th12Step>=5) $th12Help.textContent='Замок открыт';
      else $th12Help.textContent=th12LastHint||'Слушай механизм и найди профиль на слух';
    }
  }

  function tryOpenThief12(){
    if(shopOpen || solved) return;
    toast('Удерживай подходящий профиль до конца — дверь откроется сама');
  }

  th12ProfileEls.forEach(b=>{
    b.addEventListener('pointerdown',e=>{ e.preventDefault(); th12Use(b.dataset.type,true); });
    ['pointerup','pointerleave','pointercancel'].forEach(ev=>b.addEventListener(ev,()=>th12Use(b.dataset.type,false)));
  });
