import {MAX_CUT,cutTolerance} from './logic.js';

export function createKeyPanel({state,scene,inspectCurrentKey,measuredCuts,feedback,$,
  query=selector=>document.querySelectorAll(selector)}){
  let rows=[];
function buildCutRows(){
  $('cutRows').replaceChildren();
  rows=state.targets.map((target,i)=>{
    const row=document.createElement('div');row.className='cut-row';row.tabIndex=0;
    row.setAttribute('role','button');row.setAttribute('aria-label',`Выбрать зубец ${i+1}`);
    row.innerHTML=`<div class="cut-top"><span>Зубец ${i+1}</span><b></b></div><div class="cut-track"><i></i></div>`;
    $('cutRows').append(row);
    row.addEventListener('click',()=>selectCut(i));
    row.addEventListener('keydown',e=>{if(e.code==='Enter'||e.code==='Space'){e.preventDefault();selectCut(i);}});
    row.querySelector('.cut-track').style.setProperty('--target',`${target/MAX_CUT*100}%`);
    return row;
  });
  query('[data-cuts]').forEach(button=>{
    const active=Number(button.dataset.cuts)===state.difficulty;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  });
  $('blankNo').textContent=`ЗАГОТОВКА № ${String(state.serial).padStart(3,'0')} · ЛАТУНЬ`;
  $('difficultyNote').hidden=state.difficulty===4;
  $('difficultyNote').textContent=`Тренажёр сборки пока содержит 4 штифта и использует первые четыре паза ключа.`;
}
function selectCut(index){
  state.activeCut=Math.min(state.difficulty-1,Math.max(0,index));
  scene.setActiveCut(state.activeCut);
  rows.forEach((r,i)=>r.classList.toggle('active',i===state.activeCut));
}
function renderCuts(){
  const checked=inspectCurrentKey(),actual=measuredCuts();
  const imprint=state.keyMethod!=='guided';
  rows.forEach((r,i)=>{
    const progress=Math.round(actual[i]/state.targets[i]*100);
    r.querySelector('b').textContent=checked.brokenAt===i?'СЛОМ':
      imprint?'—':(progress>=95&&progress<=102?'100%':`${progress}%`);
    r.querySelector('.cut-track>i').style.width=`${actual[i]/MAX_CUT*100}%`;
    r.classList.toggle('overshot',!imprint&&checked.errors[i]>cutTolerance(state.targets[i]));
    r.classList.toggle('completed',!imprint&&checked.brokenAt<0&&actual[i]>=state.targets[i]*.95&&
      Math.abs(checked.errors[i])<=cutTolerance(state.targets[i]));
  });
  if(checked.brokenAt>=0){
    $('inspectKey').innerHTML='Новая заготовка <span>↻</span>';
    feedback('keyFeedback',checked.fractureX!==null?
      'Заготовка повреждена насквозь. Часть ключа отломилась.':
      `Зубец ${checked.brokenAt+1} пропилен насквозь. Часть ключа отломилась и упала.`, 'bad');
  }else if(state.keyInspection){
    $('inspectKey').innerHTML=state.keyInspection.ok?
      'Проверить повторно <span>✓</span>':'Проверить повторно <span>↻</span>';
    feedback('keyFeedback',state.keyInspection.message,state.keyInspection.ok?'good':'bad');
  }else if(imprint){
    $('inspectKey').innerHTML=state.keyMethod==='soap'?
      'Проверить по слепку <span>→</span>':'Проверить по схеме <span>→</span>';
    feedback('keyFeedback',state.keyMethod==='soap'?
      'Сравнивайте пазы с углублением в мыле. Когда профиль совпадёт на глаз, проверьте ключ.':
      'Сравнивайте пазы с контуром на доске. Когда профиль совпадёт на глаз, проверьте ключ.');
  }else if(checked.accurate){
    $('inspectKey').innerHTML='Проверить профиль <span>✓</span>';
    feedback('keyFeedback',`Профиль готов. Все ${state.difficulty} пазов в допуске, точность ${checked.score}%.`,'good');
  }else{
    $('inspectKey').innerHTML='Проверить профиль <span>→</span>';
    if(checked.extraOvercut)feedback('keyFeedback',
      'Лишний металл снят за пределами чертежа. Ключ уже не подойдёт к замку.','bad');
    else if(checked.overshot)feedback('keyFeedback',
      'Паз перепилен. Можно продолжить пропил до конца, но ключ уже не подойдёт к замку.','bad');
    else feedback('keyFeedback',
      `Зубец ${state.activeCut+1}: ведите напильник. После 95% профиль совпадёт с чертежом; продолжая пилить, его можно испортить.`);
  }
}
  return {buildCutRows,selectCut,renderCuts};
}
