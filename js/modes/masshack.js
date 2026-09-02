(function(){
// ===== MASS EFFECT — УЗЕЛ (masshack) =====
let hackRing=5, hackAng=90, hackBlocks=[], hackHitUntil=0, hackCollapse=false, hackCollapseStart=0, hackRingEls=[], hackBlockEls=[];
const HACK_RING_RATIOS=[.12,.20,.28,.36,.44];
function hackArenaMetrics(){
  const w=$hackArena?.clientWidth||0, h=$hackArena?.clientHeight||0, s=Math.min(w,h);
  return {w,h,s,cx:w/2,cy:h/2};
}
function hackRadiusPx(r,s){ return r<=0?0:HACK_RING_RATIOS[r-1]*s; }
function hackXY(r,a){
  const m=hackArenaMetrics(), rad=a*Math.PI/180, R=hackRadiusPx(r,m.s);
  return {x:m.cx+Math.cos(rad)*R, y:m.cy+Math.sin(rad)*R};
}
function hackAngleDiff(a,b){ const d=Math.abs(a-b)%360; return d>180?360-d:d; }
function hackHitTolerance(r){ return 9+Math.max(0,5-r)*1.6; }
function hackCollides(){
  if(hackRing<=0) return false;
  const tol=hackHitTolerance(hackRing);
  return hackBlocks.some(b=>b.ring===hackRing && hackAngleDiff(hackAng,b.a)<=tol);
}
function hackSafeOuterAngle(){
  let best=hackAng, bestGap=-1;
  const outer=hackBlocks.filter(b=>b.ring===5);
  for(let a=0;a<360;a+=6){
    const gaps=outer.length?outer.map(b=>hackAngleDiff(a,b.a)):[180];
    const gap=Math.min(...gaps);
    if(gap>bestGap){ bestGap=gap; best=a; }
  }
  return best;
}
function startMassHackRound(){
  solved=false; $lock.classList.remove('win'); $mechanism.classList.remove('ready','opening','opened');
  picks=pickCapacity; moves=0; brokenPicks=0; runReward=100;
  const ringPlan=[1,2,3,4,5,3,5], baseSpeeds=[24,28,32,36,40,30,38];
  hackRing=5; hackAng=Math.random()*360;
  hackBlocks=ringPlan.map((ring,i)=>({ ring, a:(Math.random()*360+i*43)%360, s:(baseSpeeds[i]+(Math.random()*10-5))*(Math.random()<.5?-1:1) }));
  hackHitUntil=0; hackCollapse=false; hackCollapseStart=0;
  hackRingEls=[]; hackBlockEls=[];
  updateEconomyUI(); renderMassHack();
}
function hackMove(dir){
  if(solved||hackRing===0) return;
  registerMove();
  hackAng=(hackAng+dir*12+360)%360;
  renderMassHack();
}
function hackOut(){
  if(solved||hackRing===0) return;
  registerMove();
  hackRing=Math.min(5,hackRing+1);
  renderMassHack();
}
function hackIn(){
  if(solved||hackRing===0) return;
  registerMove();
  if(hackCollides()){ hackHit(); return; }
  hackRing--;
  if(hackRing===0){ hackCollapse=true; hackCollapseStart=performance.now(); }
  renderMassHack();
}
function hackHit(){
  const now=performance.now();
  if(solved||now<hackHitUntil) return;
  hackHitUntil=now+650;
  hackCollapse=false; hackCollapseStart=0;
  SFX.wrongLock();
  damagePick({
    resetProgress:()=>{ hackRing=5; hackAng=hackSafeOuterAngle(); hackCollapse=false; hackCollapseStart=0; },
    renderState:renderMassHack,
    surviveText:'Отмычка сломалась'
  });
  renderMassHack();
}
function hackCollapseRadius(b,now,m){
  const base=hackRadiusPx(b.ring,m.s);
  if(!hackCollapse||!hackCollapseStart) return base;
  const delay=(5-b.ring)*260, duration=1800/.85;
  const t=Math.max(0,Math.min(1,(now-hackCollapseStart-delay)/duration));
  const eased=t*t*(3-2*t);
  return base*(1-eased);
}
function hackCollapseReachedCore(now){
  if(!hackCollapse||hackRing!==0) return false;
  const m=hackArenaMetrics();
  return hackBlocks.some(b=>hackCollapseRadius(b,now,m)<=12);
}
function tryOpenMassHack(){
  if(solved) return;
  if(hackRing!==0){
    SFX.wrongLock();
    toast('Сначала доберись до ядра');
    return;
  }
  solved=true;
  $lock.classList.add('win'); SFX.open(); renderMassHack();
  setTimeout(()=>celebrate(),420);
}
function hackTick(dt){
  if(mode!=='masshack'||solved) return;
  const now=performance.now();
  const speedFactor=hackRing===0?.85:1;
  hackBlocks.forEach(b=>{ b.a=(b.a+b.s*dt*speedFactor+360)%360; });
  if(now>=hackHitUntil){
    if(hackRing===0 && hackCollapseReachedCore(now)) hackHit();
    else if(hackCollides()) hackHit();
  }
  renderMassHack();
}
function renderMassHack(){
  if(!$hackArena) return;
  const m=hackArenaMetrics(), now=performance.now();
  if(hackRingEls.length!==5){
    $hackArena.querySelectorAll('.hackRing,.hackBlock').forEach(n=>n.remove());
    hackRingEls=[]; hackBlockEls=[];
    for(let r=1;r<=5;r++){
      const el=document.createElement('div');
      el.className='hackRing';
      $hackArena.insertBefore(el,$hackCore);
      hackRingEls.push(el);
    }
    hackBlocks.forEach(()=>{
      const el=document.createElement('div');
      el.className='hackBlock';
      $hackArena.appendChild(el);
      hackBlockEls.push(el);
    });
  }
  const p=hackXY(hackRing,hackAng);
  if($hackPlayer){ $hackPlayer.style.left=p.x+'px'; $hackPlayer.style.top=p.y+'px'; }
  hackRingEls.forEach((el,i)=>{
    const r=i+1, R=hackRadiusPx(r,m.s);
    el.style.width=(R*2)+'px'; el.style.height=(R*2)+'px';
  });
  hackBlocks.forEach((b,i)=>{
    const el=hackBlockEls[i]; if(!el) return;
    const R=hackCollapseRadius(b,now,m), rad=b.a*Math.PI/180;
    el.style.left=(m.cx+Math.cos(rad)*R)+'px';
    el.style.top=(m.cy+Math.sin(rad)*R)+'px';
    el.style.transform=`translate(-50%,-50%) rotate(${b.a+90}deg)`;
  });
  if($hackCore) $hackCore.classList.toggle('ready', hackRing===0 && !solved);
  if($hackHelp){
    $hackHelp.textContent = solved ? 'Ядро подтверждено'
      : hackRing===0 ? 'Ядро достигнуто — подтверди тапом, кликом или Enter'
      : `Кольцо ${hackRing} / 5 — ищи окно для перехода внутрь`;
  }
}
let hackSwipe=null;
if($hackArena){
  $hackArena.addEventListener('pointerdown',e=>{
    if(e.target===$hackCore) return;
    hackSwipe={x:e.clientX,y:e.clientY};
    try{ $hackArena.setPointerCapture(e.pointerId); }catch(_){}
  });
  $hackArena.addEventListener('pointerup',e=>{
    if(!hackSwipe||e.target===$hackCore){ hackSwipe=null; return; }
    const dx=e.clientX-hackSwipe.x, dy=e.clientY-hackSwipe.y;
    hackSwipe=null;
    if(Math.abs(dx)<18 && Math.abs(dy)<18) return;
    if(Math.abs(dx)>=Math.abs(dy)){ hackMove(dx>0?-1:1); }
    else{ if(dy<0) hackIn(); else hackOut(); }
  });
  $hackArena.addEventListener('pointercancel',()=>{ hackSwipe=null; });
}
$hackCore?.addEventListener('click',()=>GameActions.attemptOpen({modeId:'masshack',source:'puzzle-control'}));
PuzzleModes.register({id:'masshack',start:startMassHackRound,render:renderMassHack,tick:({dt})=>hackTick(Math.min(.05,dt/1000)),objective:()=>GameCatalog.get('masshack')?.objective,restartMessage:'Новый обход Mass Effect',input:{horizontal:hackMove,vertical:delta=>delta<0?hackIn():hackOut()},actions:{primary:()=>GameActions.attemptOpen({modeId:'masshack',source:'keyboard'}),secondary:()=>GameActions.attemptOpen({modeId:'masshack',source:'keyboard'})},attemptOpen:tryOpenMassHack});
})();
