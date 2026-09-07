(() => {
  'use strict';
  const panel=document.querySelector('#silhouettesMode');
  const rows=panel.querySelector('.silhouetteRows');
  const status=panel.querySelector('[role="status"]');
  const names=['Круг','Треугольник','Ромб','Квадрат'];
  // Both the reference and candidate pieces use these exact paths and offsets.
  const paths=['M 26 0 A 26 26 0 1 0 -26 0 A 26 26 0 1 0 26 0',
    'M 0 -26 L 25 26 L -25 26 Z','M 0 -28 L 28 0 L 0 28 L -28 0 Z',
    'M -25 -25 H 25 V 25 H -25 Z'];
  let stages=[],step=0,selection=[0,0],activeSide=1,timeLeft=30;
  function svg(pair){
    return `<svg viewBox="0 0 100 110" aria-hidden="true">${pair.map((shape,side)=>shape===null?'':`<path fill="currentColor" d="${paths[shape]}" transform="translate(50 ${side===0?65:45})"/>`).join('')}</svg>`;
  }
  function shuffled(values){
    const result=[...values];
    for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
    return result;
  }
  function start(){
    const pairs=[];
    for(let left=0;left<4;left++)for(let right=0;right<4;right++)if(left!==right)pairs.push([left,right]);
    stages=shuffled(pairs).slice(0,4).map(pair=>({pair,options:[shuffled([0,1,2,3]),shuffled([0,1,2,3])]}));
    step=0;selection=[0,0];activeSide=1;timeLeft=30;
    solved=false;moves=0;brokenPicks=0;runReward=100;generatedDistance=4;
    updateEconomyUI();syncHud();render();
    status.textContent='Переключай верхнюю и нижнюю фигуры, чтобы вместе они совпали с образцом. ↑/↓ — выбрать составляющую, ←/→ — сменить фигуру, Enter — совместить.';
  }
  function syncHud(){setGlobalTimer(mode==='silhouettes'&&!solved,timeLeft,30,'ТАЙМЕР');}
  function tick({dt}){
    if(mode!=='silhouettes'||solved||gameplayInputBlocked())return;
    timeLeft=Math.max(0,timeLeft-dt/1000);syncHud();
    if(timeLeft===0)showGameDefeat('time');
  }
  function render(){
    rows.innerHTML=stages.map((stage,index)=>{
      const current=index===step&&!solved,done=index<step;
      const selector=side=>{
        const shape=done?stage.pair[side]:current?selection[side]:null;
        const label=side===1?'Верхняя':'Нижняя';
        return `<div class="silhouetteSelector${current&&activeSide===side?' isActive':''}" data-component="${side}"><div class="silhouetteSwitch"><button class="uiButton" type="button" data-side="${side}" data-direction="-1" aria-label="${label}: предыдущая фигура" ${current?'':'disabled'}>‹</button><span role="img" aria-label="${shape===null?'Закрыто':names[shape]}">${shape===null?'·':svg([shape,null]).replace('translate(50 65)','translate(50 55)')}</span><button class="uiButton" type="button" data-side="${side}" data-direction="1" aria-label="${label}: следующая фигура" ${current?'':'disabled'}>›</button></div></div>`;
      };
      return `<section class="silhouetteColumn${current?' silhouetteCurrent':''}${done?' silhouetteComplete':''}" aria-label="Печать ${index+1}">${selector(1)}<div class="silhouetteTarget">${index<=step?svg(stage.pair):'<span class="silhouetteHidden">?</span>'}${done?'<span class="silhouetteDone" aria-label="Печать открыта">✓</span>':''}</div>${selector(0)}</section>`;
    }).join('');
    const check=panel.querySelector('.silhouetteCheck');
    check.disabled=solved;
    check.textContent=solved?'Все печати открыты':'Совместить';
  }
  function cycle(side,direction){
    if(mode!=='silhouettes'||solved||gameplayInputBlocked())return;
    activeSide=side;
    const options=stages[step].options[side];
    selection[side]=options[(options.indexOf(selection[side])+direction+options.length)%options.length];
    SFX.select();render();
    rows.querySelector(`[data-side="${side}"][data-direction="${direction}"]:not(:disabled)`)?.focus({preventScroll:true});
  }
  function check(){
    if(mode!=='silhouettes'||solved||gameplayInputBlocked()||selection.includes(null))return;
    registerMove();
    const pair=stages[step].pair;
    if(selection.some((shape,side)=>shape!==pair[side])){
      SFX.wrongLock();status.textContent='Силуэты не совпали. Попробуй другую пару символов. Отмычки не расходуются.';return;
    }
    SFX.move();step++;selection=[0,0];activeSide=1;
    if(step===4){solved=true;SFX.open();}
    render();
    status.textContent=solved?'Четыре печати открыты.':`Печать ${step} открыта. Собери следующую фигуру справа.`;
    if(solved){syncHud();celebrate();}
    else rows.querySelector('.silhouetteCurrent button')?.focus({preventScroll:true});
  }
  rows.addEventListener('click',event=>{
    const button=event.target.closest('[data-direction]');
    if(button&&!button.disabled)cycle(Number(button.dataset.side),Number(button.dataset.direction));
  });
  window.addEventListener('keydown',event=>{
    if(mode!=='silhouettes'||gameplayInputBlocked()||event.altKey||event.ctrlKey||event.metaKey)return;
    const key=event.key.toLowerCase();
    if(!['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d','enter',' '].includes(key))return;
    event.preventDefault();event.stopImmediatePropagation();
    if(solved)return;
    if(['arrowup','arrowdown','w','s'].includes(key)){
      activeSide=['arrowup','w'].includes(key)?1:0;render();
      rows.querySelector(`.silhouetteCurrent [data-side="${activeSide}"]`)?.focus({preventScroll:true});
    }else if(['arrowleft','arrowright','a','d'].includes(key))cycle(activeSide,['arrowleft','a'].includes(key)?-1:1);
    else if(!event.repeat)check();
  },true);
  panel.querySelector('.silhouetteCheck').addEventListener('click',check);
  PuzzleModes.register({id:'silhouettes',start,render,syncHud,tick,actions:{primary:check},attemptOpen:check,restartMessage:'Новые силуэты'});
})();
