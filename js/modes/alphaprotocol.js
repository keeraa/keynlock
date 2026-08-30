// ===== ALPHA PROTOCOL (alphaprotocol / ap) =====
const AP_SYMBOLS=[
  '<svg viewBox="0 0 48 48"><path d="M24 5V43"/></svg>',
  '<svg viewBox="0 0 48 48"><path d="M8 8H27Q38 8 38 20V43"/></svg>',
  '<svg viewBox="0 0 48 48"><path d="M25 5C14 11 35 17 24 24C14 31 35 37 24 43"/></svg>',
  '<svg viewBox="0 0 48 48"><path d="M14 43V23Q14 7 28 7Q41 7 41 22V25"/></svg>',
  '<svg viewBox="0 0 48 48"><path d="M39 6L14 24L39 43"/></svg>'
];
const AP_STEP=.5, AP_MIN_Y=-2, AP_MAX_Y=50, AP_TOL=2;
function apClampY(v){ return Math.max(AP_MIN_Y,Math.min(AP_MAX_Y,Math.round(v/AP_STEP)*AP_STEP)); }
function apTargetFor(groove){ return apClampY(50-groove*.52); }
function apMakePin(){
  const groove=14+Math.floor(Math.random()*73), target=apTargetFor(groove);
  const candidates=[-16,-12,-9,-6,6,9,12,16].map(v=>apClampY(target+v)).filter(v=>v!==target);
  const y=candidates.length?candidates[Math.floor(Math.random()*candidates.length)]:apClampY(target+6);
  return {y,groove,target,set:false};
}
function apReady(i){ const p=apPins[i]; return Math.abs(p.y-p.target)<=AP_TOL; }
function apBeamProgress(){
  for(let i=0;i<5;i++) if(!apReady(i)) return i/5*100;
  return 100;
}
function apSymbolTop(p){ return p.groove>50?18:82; }
function startAlphaProtocolRound(){
  solved=false; $lock.classList.remove('win'); $mechanism.classList.remove('ready','opening','opened');
  picks=pickCapacity; moves=0; brokenPicks=0; runReward=1000;
  apPins=Array.from({length:5},apMakePin);
  apSel=0; apOrder=shuffle([0,1,2,3,4]); apOrderStep=0;
  apTimeMax=diffStep(30,26,22,'alphaprotocol'); apTimeLeft=apTimeMax;
  updateEconomyUI(); renderAlphaProtocol();
}
function apSelectPin(i){
  if(solved) return;
  apSel=((i%5)+5)%5;
  SFX.select();
  renderAlphaProtocol();
}
function apMovePin(dir){
  if(solved||apTimeLeft<=0) return;
  const p=apPins[apSel];
  if(p.set){ toast('Этот пин уже зафиксирован — перейди к другому'); return; }
  registerMove();
  p.y=apClampY(p.y+dir*AP_STEP);
  renderAlphaProtocol();
}
function apSet(){
  if(solved||apTimeLeft<=0) return;
  const p=apPins[apSel];
  if(p.set){ toast('Этот пин уже зафиксирован'); return; }
  registerMove();
  const expected=apOrder[apOrderStep];
  if(apSel!==expected){
    apTimeLeft=Math.max(0,apTimeLeft-1);
    SFX.wrongLock();
    damagePick({ resetProgress:()=>{}, renderState:renderAlphaProtocol, surviveText:'Неверный символ' });
    return;
  }
  if(apReady(apSel)){
    p.set=true; apOrderStep++;
    if(apOrderStep>=apOrder.length){
      toast('Механизм выставлен — нажми на замок');
    }else{
      toast('Верно. Найди следующий символ сам.');
    }
    renderAlphaProtocol();
    return;
  }
  apTimeLeft=Math.max(0,apTimeLeft-1.25);
  SFX.wrongLock();
  damagePick({ resetProgress:()=>{}, renderState:renderAlphaProtocol, surviveText:'Щель не совпала' });
}
function tryOpenAlphaProtocol(){
  if(shopOpen||solved) return;
  if(apOrderStep<apOrder.length){
    SFX.wrongLock();
    toast('Сначала выставь все 5 пинов по порядку символов');
    return;
  }
  solved=true;
  $lock.classList.add('win'); SFX.open(); renderAlphaProtocol();
  setTimeout(()=>celebrate(),420);
}
function apTick(dt){
  if(mode!=='alphaprotocol'||solved||apTimeLeft<=0) return;
  apTimeLeft=Math.max(0,apTimeLeft-dt);
  renderAlphaProtocol();
}
function renderAlphaProtocol(){
  if(!$apLock) return;
  setGlobalTimer(mode==='alphaprotocol' && apTimeLeft>0, apTimeLeft, apTimeMax, 'ТАЙМЕР');
  apPins.forEach((p,i)=>{
    const pinEl=document.getElementById('apPin'+i), shaft=document.getElementById('apShaft'+i);
    if(!pinEl||!shaft) return;
    pinEl.classList.toggle('active', i===apSel);
    pinEl.classList.toggle('set', p.set);
    pinEl.classList.toggle('ready', !p.set && apReady(i));
    shaft.style.setProperty('--y', p.y+'%');
    shaft.style.setProperty('--symbol-top', apSymbolTop(p)+'%');
    const groove=shaft.querySelector('.apGroove');
    if(groove) groove.style.setProperty('--groove', p.groove+'%');
    const symbol=shaft.querySelector('.apSymbol');
    if(symbol && !symbol.innerHTML) symbol.innerHTML=AP_SYMBOLS[i];
  });
  if($apBeamFill) $apBeamFill.style.width=apBeamProgress()+'%';
  if(apSeqEls.length!==apOrder.length){
    if($apSequence) $apSequence.innerHTML='';
    apSeqEls=apOrder.map(pinIndex=>{
      const el=document.createElement('div');
      el.className='apSeqItem';
      el.innerHTML=AP_SYMBOLS[pinIndex];
      $apSequence?.appendChild(el);
      return el;
    });
  }
  apSeqEls.forEach((el,step)=>{
    el.classList.toggle('done', step<apOrderStep);
    el.classList.toggle('current', step===apOrderStep && apOrderStep<apOrder.length);
  });
  if($apHelp){
    $apHelp.textContent = apOrderStep>=apOrder.length
      ? 'Механизм выставлен — нажми на замок или Enter'
      : apTimeLeft<=0
        ? 'Время вышло — начни заново (R)'
        : `Выставлено ${apOrderStep} / 5 — соверши щель паза с золотой линией и зафиксируй Space`;
  }
}
