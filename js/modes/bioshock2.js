(function(){
// ===== BIOSHOCK 2 (bioshock2 / bio) =====
let bioZonesArr=[], bioZoneEls=[], bioX=0, bioDir=1, bioSpeed=58, bioStage=0, bioRunning=true;
const BIO_STAGES=5;
const BIO_STAGE_CFG=[
  {redCount:2,redW:6.5, greenCount:2,greenW:14.0},
  {redCount:3,redW:7.5, greenCount:2,greenW:11.5},
  {redCount:4,redW:8.5, greenCount:2,greenW:9.0},
  {redCount:5,redW:9.5, greenCount:2,greenW:7.0},
  {redCount:6,redW:10.0,greenCount:2,greenW:3.64}
];
function bioZones(stage){
  const c=BIO_STAGE_CFG[Math.max(0,Math.min(BIO_STAGES-1,stage))];
  let blocks=[];
  for(let i=0;i<c.redCount;i++) blocks.push({t:'red',w:c.redW});
  for(let i=0;i<c.greenCount;i++) blocks.push({t:'green',w:c.greenW});
  blocks=shuffle([...blocks]);
  for(let tries=0;tries<12;tries++){
    let bad=false;
    for(let i=1;i<blocks.length;i++) if(blocks[i-1].t==='green'&&blocks[i].t==='green') bad=true;
    if(!bad) break;
    blocks=shuffle([...blocks]);
  }
  const colored=blocks.reduce((a,b)=>a+b.w,0), gapCount=blocks.length+1, white=Math.max(8,100-colored);
  const weights=Array.from({length:gapCount},()=>.55+Math.random()*1.25), sum=weights.reduce((a,b)=>a+b,0), gaps=weights.map(w=>white*w/sum);
  let x=0, z=[];
  for(let i=0;i<blocks.length;i++){
    if(gaps[i]>.01){ z.push({a:x,b:x+gaps[i],t:'white'}); x+=gaps[i]; }
    const b=blocks[i]; z.push({a:x,b:x+b.w,t:b.t}); x+=b.w;
  }
  if(x<100) z.push({a:x,b:100,t:'white'});
  z[0].a=0; z[z.length-1].b=100;
  for(let i=1;i<z.length;i++) z[i].a=z[i-1].b;
  for(let i=1;i<z.length-1;i++) if(z[i].t==='white'&&z[i-1].t==='red'&&z[i+1].t==='red') z[i].t='red';
  const merged=[];
  z.forEach(seg=>{
    if(!merged.length) merged.push({...seg});
    else{ const last=merged[merged.length-1]; if(last.t===seg.t) last.b=seg.b; else merged.push({...seg}); }
  });
  merged[0].a=0; merged[merged.length-1].b=100;
  for(let i=1;i<merged.length;i++) merged[i].a=merged[i-1].b;
  return merged;
}
function bioRandomStart(){ bioDir=Math.random()<.5?1:-1; bioX=bioDir>0?0:100; }
function bioTypeAt(x){
  return bioZonesArr.find((z,i)=>x>=z.a&&(x<z.b||i===bioZonesArr.length-1&&x<=z.b))?.t||'white';
}
function startBioshock2Round(){
  solved=false; $lock.classList.remove('win'); $mechanism.classList.remove('ready','opening','opened');
  picks=pickCapacity; moves=0; brokenPicks=0; runReward=1000;
  bioStage=0; bioRunning=true; bioSpeed=54+Math.random()*12;
  bioZonesArr=bioZones(0); bioRandomStart();
  bioZoneEls=[];
  updateEconomyUI(); renderBio();
}
function bioAfterMiss(){
  bioZonesArr=bioZones(bioStage); bioRandomStart();
  bioSpeed=54+bioStage*4+Math.random()*10;
  bioZoneEls=[];
  bioRunning=!solved && picks>0;
  renderBio();
}
function bioStop(){
  if(!bioRunning||solved) return;
  registerMove();
  const t=bioTypeAt(bioX);
  if(t==='green'){
    const completed=bioStage+1;
    bioStage++;
    if(bioStage>=BIO_STAGES){
      bioRunning=false; solved=true;
      $lock.classList.add('win'); SFX.open(); renderBio();
      setTimeout(()=>celebrate(),420);
      return;
    }
    bioZonesArr=bioZones(bioStage); bioRandomStart();
    bioSpeed=56+bioStage*4+Math.random()*8;
    bioZoneEls=[];
    renderBio();
    toast(`Этап ${completed} пройден — новая раскладка`);
    return;
  }
  bioRunning=false;
  SFX.wrongLock();
  if(t==='red'){
    damagePick({ resetProgress:()=>{ bioStage=0; }, renderState:bioAfterMiss, surviveText:'Красная зона' });
  }else{
    damagePick({ resetProgress:()=>{}, renderState:bioAfterMiss, surviveText:'Белая зона' });
  }
}
function tryOpenBioshock2(){
  if(solved) return;
  toast('Останови стрелку на зелёной зоне все 5 этапов — дрон взломается сам');
}
function bioTick(dt){
  if(mode!=='bioshock2'||solved||!bioRunning) return;
  bioX+=bioDir*bioSpeed*dt;
  if(bioX>=100){ bioX=100; bioDir=-1; }
  else if(bioX<=0){ bioX=0; bioDir=1; }
  renderBio();
}
function renderBio(){
  if(!$bioTrack) return;
  if(bioZoneEls.length!==bioZonesArr.length){
    $bioTrack.querySelectorAll('.bioZone').forEach(n=>n.remove());
    bioZoneEls=bioZonesArr.map(z=>{
      const el=document.createElement('div');
      el.className='bioZone '+z.t;
      $bioTrack.insertBefore(el,$bioNeedle);
      return el;
    });
  }
  bioZoneEls.forEach((el,i)=>{ el.style.width=(bioZonesArr[i].b-bioZonesArr[i].a)+'%'; });
  if($bioNeedle) $bioNeedle.style.left=bioX+'%';
  const completed=Math.min(BIO_STAGES,bioStage), shownStage=Math.min(BIO_STAGES,Math.max(1,bioStage+1));
  if($bioStageText) $bioStageText.textContent = bioStage>=BIO_STAGES ? `${BIO_STAGES} / ${BIO_STAGES} этапов` : `Этап ${shownStage} / ${BIO_STAGES}`;
  if($bioPassesText) $bioPassesText.textContent = `Успехов ${completed} / ${BIO_STAGES}`;
  if($bioBot) $bioBot.classList.toggle('hacked', bioStage>=BIO_STAGES);
  if($bioHelp){
    $bioHelp.textContent = bioStage>=BIO_STAGES
      ? 'Взлом завершён'
      : `Останови иглу на зелёной зоне · этап ${shownStage} / ${BIO_STAGES}, успехов ${completed} / ${BIO_STAGES}`;
  }
}
document.getElementById('bioStopBtn')?.addEventListener('click',bioStop);
PuzzleModes.register({id:'bioshock2',start:startBioshock2Round,render:renderBio,tick:({dt})=>bioTick(Math.min(.04,dt/1000)),objective:()=>GameCatalog.get('bioshock2')?.objective,restartMessage:'Новый взлом BioShock 2',input:{horizontal:()=>{},vertical:()=>{}},actions:{primary:bioStop},attemptOpen:tryOpenBioshock2});
})();
