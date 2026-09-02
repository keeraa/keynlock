(function(){
  // ===== KEY DEDUCTION =====
  let kdVals=[2,2,2,2,2], kdTarget=[2,2,2,2,2], kdSelected=0, kdTests=0, kdFailures=0, kdLogs=[], kdReady=false, kdToothCount=5;
  function renderDeduction(){
    if(!$kdKey) return;
    const pinSkin=currentGamePinSkin();
    const frag=document.createDocumentFragment();
    kdVals.forEach((v,i)=>{
      const t=document.createElement('div');
      t.className='kdTooth'+(i===kdSelected&&!kdReady?' active':'');
      t.innerHTML=`<div class="kdNum">${v}</div><div class="kdBar" style="--h:${v}"><img class="kdPinImg" src="${pinSkin}" alt=""></div><div class="kdControls"><button class="kdMini" data-d="-1" type="button">−</button><button class="kdMini" data-d="1" type="button">+</button></div>`;
      t.querySelectorAll('.kdMini').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();changeDeduction(i,Number(b.dataset.d));}));
      t.addEventListener('click',()=>{if(!kdReady){kdSelected=i;SFX.select();renderDeduction();}});
      frag.appendChild(t);
    });
    $kdKey.replaceChildren(frag);
    $kdPanel.classList.toggle('ready',kdReady&&!solved);
    $kdHistory.textContent=kdLogs.slice(-3).join(' · ');
    if(solved) $kdFeedback.textContent='Замок открыт';
    else if(kdReady) $kdFeedback.textContent=`Профиль совпал за ${kdTests} проверок — нажми на замок`;
  }
  function startDeductionRound(){
    solved=false;picks=pickCapacity;moves=0;brokenPicks=0;runReward=100;
    chooseGamePinSkin();
    kdToothCount=diffStep(4,5,6,'deduction');
    const maxTooth=diffStep(3,4,4,'deduction');
    kdVals=Array.from({length:kdToothCount},()=>2);kdTarget=Array.from({length:kdToothCount},()=>rand(0,maxTooth));kdSelected=0;kdTests=0;kdFailures=0;kdLogs=[];kdReady=false;
    generatedDistance=kdToothCount;updateEconomyUI();
    $kdFeedback.textContent='A / D — выбрать зубец · W / S — изменить высоту. Проверка сообщает только о первом неправильном зубце.';
    renderDeduction();
  }
  function moveDeductionSelection(dir){
    if(solved||kdReady) return;
    const next=clamp(kdSelected+dir,0,kdVals.length-1);
    if(next===kdSelected){SFX.blocked();return;}
    kdSelected=next;SFX.select();renderDeduction();
  }
  function changeDeduction(i,delta){
    if(solved||kdReady) return;
    kdSelected=i;
    const next=clamp(kdVals[i]+delta,0,4);
    if(next===kdVals[i]){SFX.blocked();return;}
    kdVals[i]=next;SFX.select();renderDeduction();
  }
  function checkDeduction(){
    if(solved||kdReady) return;
    kdTests++;registerMove();
    let wrong=-1;
    for(let i=0;i<kdVals.length;i++) if(kdVals[i]!==kdTarget[i]){wrong=i;break;}
    if(wrong<0){kdReady=true;SFX.ready();$kdFeedback.textContent=`Точный профиль найден за ${kdTests} проверок — нажми на замок`;kdLogs.push('Профиль совпал');renderDeduction();return;}
    const low=kdVals[wrong]<kdTarget[wrong];
    $kdFeedback.textContent=`Зубец ${wrong+1} ${low?'слишком низкий':'слишком высокий'}. Остальные пока не проверяются.`;
    kdLogs.push(`${wrong+1}: ${low?'↑':'↓'}`);kdFailures++;
    SFX.wrongLock();
    if(kdFailures%3===0){
      damagePick({
        resetProgress:()=>{kdVals=Array.from({length:kdToothCount},()=>2);kdSelected=0;},
        renderState:renderDeduction,
        surviveText:'Три неудачные пробные вставки'
      });
    } else renderDeduction();
  }
  function tryOpenDeduction(){
    if(solved) return;
    if(!kdReady){SFX.wrongLock();toast('Сначала восстанови профиль ключа');return;}
    solved=true;SFX.open();renderDeduction();setTimeout(()=>celebrate(),420);
  }

  $kdCheck?.addEventListener('click',checkDeduction);

  PuzzleModes.register({
    id:'deduction',
    start:startDeductionRound,
    render:renderDeduction,
    objective:()=>GameCatalog.get('deduction')?.objective,
    restartMessage:'Новый слепок ключа',
    input:{
      horizontal:moveDeductionSelection,
      vertical:delta=>changeDeduction(kdSelected,delta<0?1:-1)
    },
    actions:{primary:checkDeduction},
    attemptOpen:tryOpenDeduction
  });
})();
