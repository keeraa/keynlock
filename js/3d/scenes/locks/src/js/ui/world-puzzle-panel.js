import { CHAPTER_MISSIONS, MUSEUM_SYMBOLS } from '../gameplay/world-puzzles/rules.js';
import {formatToolCount} from '../gameplay/tool-supply.js';

/** Chapter UI sends commands exclusively through the main action dispatcher. */
export function attachWorldPuzzlePanel({document,$,engine,dispatch,tabs}) {
  const send=command=>dispatch(command,{source:'ui'});
  const missionList=$('worldMissionList'),choices=$('worldChoices');
  const levelButtons=[...document.querySelectorAll('[data-world-level]')];
  let selectedLevel=1,buttonsId='',choiceButtons=[];
  missionList.replaceChildren(...CHAPTER_MISSIONS.map((mission,index)=>{
    const button=document.createElement('button');
    button.type='button';button.className='world-mission-card';button.dataset.mission=mission.id;
    button.innerHTML=`<span class="world-mission-index">0${index+1}</span>
      <span class="world-mission-body"><strong>${mission.title}</strong><small>${mission.place}</small></span>
      <span class="world-mission-check" aria-hidden="true"></span>`;
    return button;
  }));
  missionList.addEventListener('click',event=>{
    const button=event.target.closest('[data-mission]');
    if(button)send({type:'world-start',id:button.dataset.mission,level:selectedLevel});
  });
  choices.addEventListener('click',event=>{
    const button=event.target.closest('[data-world-choice]');
    if(button)send({type:'world-choice',index:Number(button.dataset.worldChoice)});
  });
  for(const button of levelButtons)button.addEventListener('click',()=>{
    selectedLevel=Number(button.dataset.worldLevel);
    const snapshot=engine.getSnapshot();
    if(snapshot.active)send({type:'world-start',id:snapshot.id,level:selectedLevel});
    else render(snapshot);
  });
  $('worldConfirm').addEventListener('click',()=>send({type:'world-confirm'}));
  $('worldRestart').addEventListener('click',()=>send({type:'world-restart'}));
  $('worldQuit').addEventListener('click',()=>send({type:'world-exit'}));
  $('worldNext').addEventListener('click',()=>{
    const snapshot=engine.getSnapshot();
    const index=CHAPTER_MISSIONS.findIndex(mission=>mission.id===snapshot.id);
    const next=CHAPTER_MISSIONS[index+1];
    if(next)send({type:'world-start',id:next.id,level:selectedLevel});
  });

  function choiceLabels(snapshot) {
    const view=snapshot.view;
    if(snapshot.id==='wharf')return Array.from({length:view.count},(_,i)=>({text:String(i+1),
      done:view.opened.includes(i),active:view.selected===i,label:`Задвижка ${i+1}`}));
    if(snapshot.id==='keyprofile')return Array.from({length:view.count},(_,i)=>({
      text:`Ключ ${i+1}`,done:false,active:view.selected===i,label:`Проверить ключ ${i+1}`}));
    if(snapshot.id==='pairednodes')return Array.from({length:view.count},(_,i)=>{
      const known=view.matched.includes(i)||view.pending.includes(i)||view.selected===i;
      return {text:known?view.nodes[i]:'✣',done:view.matched.includes(i),
        active:view.selected===i,label:`Узел ${i+1}${known?`: ${view.nodes[i]}`:''}`};
    });
    return MUSEUM_SYMBOLS.map((symbol,i)=>({text:symbol,done:false,
      active:view.selected===i,label:`Профиль ${symbol}`}));
  }
  function renderChoices(snapshot) {
    const id=`${snapshot.serial}/${snapshot.id}`;
    if(id!==buttonsId) {
      buttonsId=id;choices.dataset.mode=snapshot.id;
      choiceButtons=choiceLabels(snapshot).map((_,i)=>{
        const button=document.createElement('button');
        button.type='button';button.dataset.worldChoice=String(i);button.className='world-choice';
        return button;
      });
      choices.replaceChildren(...choiceButtons);
    }
    choiceLabels(snapshot).forEach((item,i)=>{
      const button=choiceButtons[i];
      if(button.textContent!==item.text)button.textContent=item.text;
      button.classList.toggle('active',item.active);
      button.classList.toggle('done',item.done);
      button.setAttribute('aria-pressed',String(item.active));
      button.setAttribute('aria-label',item.label);
      button.disabled=snapshot.completed||snapshot.failed||item.done;
    });
  }
  function render(snapshot) {
    document.querySelectorAll('[data-mission]').forEach(button=>{
      const id=button.dataset.mission;
      button.classList.toggle('active',snapshot.active&&snapshot.id===id);
      button.querySelector('.world-mission-check').textContent=snapshot.progress.completed[`${id}-${selectedLevel}`]?'✓':'';
    });
    $('worldCoins').textContent=String(snapshot.progress.coins);
    $('worldCompleted').textContent=String(Object.keys(snapshot.progress.completed).length);
    levelButtons.forEach(button=>{
      const active=Number(button.dataset.worldLevel)===selectedLevel;
      button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
    });
    $('worldEmptyInfo').hidden=snapshot.active;
    $('worldRun').hidden=!snapshot.active;
    if(!snapshot.active){buttonsId='';return;}
    selectedLevel=snapshot.level;
    $('worldTitle').textContent=snapshot.mission.title;
    $('worldObjective').textContent=snapshot.mission.objective;
    $('worldInstruction').textContent=snapshot.mission.instruction;
    $('worldPicks').textContent=formatToolCount(snapshot.picks);
    $('worldMoves').textContent=String(snapshot.moves);
    const view=snapshot.view,hasTimer=Number.isFinite(view.timeLeft);
    $('worldTimeStat').hidden=!hasTimer;
    if(hasTimer)$('worldTimer').textContent=`${Math.ceil(view.timeLeft)} с`;
    $('worldFeedback').textContent=snapshot.feedback;
    $('worldFeedback').classList.toggle('positive',snapshot.completed);
    $('worldFeedback').classList.toggle('negative',snapshot.failed);
    const progress=snapshot.id==='wharf'?`${view.step}/${view.count} задвижек`:
      snapshot.id==='keyprofile'?`1 из ${view.count} ключей`:
      snapshot.id==='pairednodes'?`${view.matched.length/2}/${view.count/2} пар`:
      `${view.step}/${view.count} тумблеров`;
    $('worldProgress').textContent=progress;
    renderChoices(snapshot);
    $('worldConfirm').hidden=!['wharf','keyprofile'].includes(snapshot.id);
    $('worldConfirm').disabled=snapshot.completed||snapshot.failed;
    $('worldConfirm').textContent=snapshot.id==='keyprofile'?'Вставить ключ':'Открыть замок';
    $('worldReward').hidden=!snapshot.completed;
    $('worldReward').textContent=snapshot.reward
      ?`Задание выполнено · +${snapshot.reward} монет`:'Задание выполнено · награда уже получена';
    $('worldNext').hidden=!snapshot.completed||snapshot.id===CHAPTER_MISSIONS.at(-1).id;
  }
  // Capture physical keys before the old lock's keyboard handler.
  document.addEventListener('keydown',event=>{
    const snapshot=engine.getSnapshot();
    if(!snapshot.active||event.metaKey||event.ctrlKey||event.altKey)return;
    if(event.code==='Escape') {
      event.preventDefault();event.stopImmediatePropagation();send({type:'world-exit'});return;
    }
    if(['INPUT','TEXTAREA','SELECT'].includes(event.target?.tagName))return;
    const code=event.code;
    if(code==='KeyR'||code==='KeyN') {
      event.preventDefault();event.stopImmediatePropagation();
      if(!event.repeat)send({type:'world-restart'});return;
    }
    if(code==='Space'||code==='Enter') {
      // Native activation of focused buttons must remain available.
      if(event.target?.tagName==='BUTTON')return;
      event.preventDefault();event.stopImmediatePropagation();
      if(!event.repeat&&['wharf','keyprofile'].includes(snapshot.id))send({type:'world-confirm'});
      return;
    }
    if(/^Digit[1-9]$/.test(code)) {
      event.preventDefault();event.stopImmediatePropagation();
      if(!event.repeat)send({type:'world-choice',index:Number(code[5])-1});
    }
  },true);
  let lastRun=-1,wasActive=false;
  engine.subscribe(snapshot=>{
    // Choose the mission tab on start/restart, but allow players to inspect Visual
    // settings without the countdown forcing them back every second.
    if(snapshot.active&&snapshot.serial!==lastRun){
      lastRun=snapshot.serial;tabs.activate('story');
    } else if(!snapshot.active&&wasActive)tabs.activate('lock');
    wasActive=snapshot.active;
    render(snapshot);
  });
  render(engine.getSnapshot());
  return {render};
}
