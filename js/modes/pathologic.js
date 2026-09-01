(function(){
// ===== PATHOLOGIC 2 (pathologic / ptg) =====
let ptgY=[.08,.08], ptgV=[0,0], ptgTarget=[.37,.51], ptgDur=1.35;
const PTG_TOOTH_H=.38, PTG_BAND_H=.32, PTG_DUR_MAX=1.35, PTG_GRAVITY=1.75, PTG_HIT_IMPULSE=1.18;
function ptgGood(i){
  const bandBottom=ptgY[i]+ptgTarget[i]*PTG_TOOTH_H, bandTop=bandBottom+PTG_BAND_H*PTG_TOOTH_H;
  return bandBottom<=.52 && bandTop>=.48;
}
function ptgCanLock(){ return ptgGood(0) && ptgGood(1); }
function startPathologicRound(){
  solved=false; $lock.classList.remove('win'); $mechanism.classList.remove('ready','opening','opened');
  picks=pickCapacity; moves=0; brokenPicks=0; runReward=1000;
  ptgY=[.06+.06*Math.random(),.06+.06*Math.random()];
  ptgV=[0,0];
  ptgTarget=[.24+Math.random()*.18,.24+Math.random()*.18];
  ptgDur=PTG_DUR_MAX;
  updateEconomyUI(); renderPathologic();
}
function ptgBreak(reason){
  if(solved) return;
  SFX.wrongLock();
  damagePick({
    resetProgress:()=>{
      ptgY=[.06+.06*Math.random(),.06+.06*Math.random()];
      ptgV=[0,0];
      ptgDur=PTG_DUR_MAX;
    },
    renderState:renderPathologic,
    surviveText:reason
  });
  renderPathologic();
}
function ptgHit(i){
  if(solved) return;
  registerMove();
  ptgV[i]+=PTG_HIT_IMPULSE;
  ptgDur=Math.max(0,ptgDur-.032);
  if(ptgDur<=0){ ptgBreak('Отмычка не выдержала ударов'); return; }
  renderPathologic();
}
function tryOpenPathologic(){
  if(solved) return;
  registerMove();
  if(ptgCanLock()){
    solved=true; ptgV=[0,0];
    $lock.classList.add('win'); SFX.open(); renderPathologic();
    setTimeout(()=>celebrate(),420);
    return;
  }
  ptgDur=Math.max(0,ptgDur-.10);
  toast('Фиксация мимо линии — потеря ресурса');
  if(ptgDur<=0){ ptgBreak('Неудачная фиксация сломала отмычку'); return; }
  renderPathologic();
}
function ptgTick(dt){
  if(mode!=='pathologic'||solved) return;
  for(let i=0;i<2;i++){
    ptgV[i]-=PTG_GRAVITY*dt;
    ptgY[i]+=ptgV[i]*dt;
    if(ptgY[i]<.02){ ptgY[i]=.02; ptgV[i]=Math.max(0,ptgV[i]*-.18); }
    if(ptgY[i]>.58){ ptgY[i]=.58; ptgV[i]*=-.24; }
  }
  renderPathologic();
}
function renderPathologic(){
  if(!$ptgColL||!$ptgColR) return;
  [$ptgColL,$ptgColR].forEach((col,i)=>{
    const tooth=col.querySelector('.ptgTooth'), zone=tooth.querySelector('.ptgTarget');
    tooth.style.setProperty('--bottom',(ptgY[i]*100)+'%');
    zone.style.setProperty('--target',(ptgTarget[i]*100)+'%');
    col.classList.toggle('good',ptgGood(i));
  });
  if($ptgDur) $ptgDur.style.width=Math.max(0,(ptgDur/PTG_DUR_MAX)*100)+'%';
  if($ptgHelp){
    $ptgHelp.textContent = ptgCanLock()
      ? 'Обе зоны совпали — нажми Space, чтобы зафиксировать'
      : `${ptgGood(0)?'Левая ✓':'Левая —'} / ${ptgGood(1)?'Правая ✓':'Правая —'} — совмести обе стороны`;
  }
}
document.getElementById('ptgHitLeft')?.addEventListener('click',()=>ptgHit(0));
document.getElementById('ptgHitRight')?.addEventListener('click',()=>ptgHit(1));
document.getElementById('ptgConfirmBtn')?.addEventListener('click',()=>GameActions.attemptOpen({modeId:'pathologic',source:'puzzle-control'}));
PuzzleModes.register({id:'pathologic',start:startPathologicRound,render:renderPathologic,tick:({dt})=>ptgTick(Math.min(.035,dt/1000)),objective:()=>GameCatalog.get('pathologic')?.objective,restartMessage:'Новый замок Pathologic 2',input:{horizontal:dir=>ptgHit(dir<0?0:1),vertical:()=>{}},actions:{primary:()=>GameActions.attemptOpen({modeId:'pathologic',source:'keyboard'})},attemptOpen:tryOpenPathologic});
})();
