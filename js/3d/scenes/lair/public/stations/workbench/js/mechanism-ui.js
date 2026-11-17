import {BOARD,PARTS,PALETTE,CORE_PALETTE,ADVANCED_PALETTE,PIN_CODES,makePart,demoMechanism,validateParts,portsFor,
  buildContacts,inspectLayout,stepMechanism,createMechanismRuntime,analyzePicking,
  canPick,checkTensionFit,MECHANISM_PRESETS,mechanismPreset,identifyMechanismPreset} from './mechanism-engine.js';
import {createMechanism3D} from './mechanism-3d.js';
import {STANDARD_TENSION_TOOLS,tensionToolIcon} from './mechanism-lockpicks.js';

const STORAGE_KEY='keynlock-mechanism-board-v1';
const BACKUP_KEY='keynlock-mechanism-custom-backup-v1';
const $=id=>document.getElementById(id);
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const icons={pinbank:'▥',gear:'⚙',lever:'⌁',pin:'↥',spring:'≈',ratchet:'◌',cam:'◉',latch:'⊐',
  splitter:'⑂',interlock:'⊗',shield:'▣'};
const effects={pinbank:'Правильный ключ выставляет пять штифтов на линию среза.',
  gear:'Меняет направление вращения. Сама по себе не повышает защиту.',
  lever:'Передаёт усилие через неподвижную опору на другое плечо.',
  pin:'Дополнительный упор. Должен двигаться в направляющей.',
  spring:'Возвращает подвижную деталь в исходное положение.',
  ratchet:'Храповик и собачка удерживают ход. Можно требовать несколько поворотов ключа.',
  cam:'Превращает поворот оси в толчок для защёлки.',
  latch:'Уходит с пути засова, когда её толкает кулачок.',
  splitter:'Одна тяга приводит в движение сразу два плеча.',
  interlock:'Отпускает засов лишь тогда, когда оба входа сдвинулись.',
  shield:'Перекрывает крючку путь к секрету, но не мешает правильному ключу.'};
const html=s=>String(s).replace(/[&<>"']/g,ch=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const STAGE_MS=510;

// Follow the actual contacts, including parallel branches. A disconnected
// component does not light up when the key is turned.
function transmissionStages(parts,view){
  const byId=new Map(parts.map(part=>[part.id,part]));
  const key=parts.find(part=>part.type==='key');if(!key)return [];
  const depths=new Map([[key.id,0]]),queue=[key.id];
  for(let i=0;i<queue.length;i++)for(const link of view.links){
    if(link.from!==queue[i]||depths.has(link.to))continue;
    depths.set(link.to,depths.get(link.from)+1);queue.push(link.to);
  }
  const levels=[...new Set(depths.values())].sort((a,b)=>a-b);
  const stages=levels.map(depth=>({
    ids:parts.filter(part=>depths.get(part.id)===depth).map(part=>part.id),depth
  }));
  const stopped=stages.findIndex(stage=>stage.depth>0&&stage.ids.every(id=>
    Math.abs(view.values[id]||0)<.015));
  return stopped>=0?stages.slice(0,stopped+1):stages;
}
function stepCaption(stage,parts,view){
  const matches=stage.ids.map(id=>parts.find(part=>part.id===id)).filter(Boolean);
  const part=matches[0];if(!part)return {title:'Нет контакта',detail:'Передача разорвана.'};
  const moving=matches.some(item=>(view.values[item.id]||0)>.015);
  switch(part.type){
    case 'key':return {title:'Ключ поворачивает сердцевину',detail:'Поворот ключа — источник движения всего механизма.'};
    case 'pinbank':return {title:moving?'Штифты освободили сердцевину':'Штифты удерживают сердцевину',
      detail:'Пять пар поднимаются на разную высоту; их стыки должны совпасть с линией среза.'};
    case 'cam':return {title:moving?'Кулачок начинает давить на защёлку':'Кулачку не хватает хода',
      detail:'Поворот диска превращается в поступательное усилие.'};
    case 'latch':return {title:moving?'Защёлка отходит от засова':'Защёлка продолжает держать засов',
      detail:'Пружинный стопор должен выйти из паза, иначе засов не сдвинется.'};
    case 'bolt':return {title:view.ready?'Засов освобождает правую скобу':'Засов остаётся запертым',
      detail:'Только после освобождения стопоров стальной стержень может уйти внутрь корпуса.'};
    case 'ratchet':{
      const count=view.runtime.pawls[part.id]?.steps||0;
      return {title:`Трещотка: ${count} из ${part.setting} щелчков`,
        detail:'Собачка удерживает каждый шаг после возврата ключа. Нужно набрать все щелчки.'};
    }
    case 'splitter':return {title:'Усилие расходится на две тяги',detail:'Одно движение от сердцевины передаётся верхнему и нижнему плечу.'};
    case 'lever':return {title:'Два рычага двигаются вместе',detail:'Каждое плечо поворачивается вокруг своей опоры и толкает отдельный вход стопора.'};
    case 'interlock':return {title:moving?'Оба рычага освободили стопор':'Один из входов не сработал',
      detail:'Для освобождения засова два плеча должны давить одновременно.'};
    case 'gear':return {title:'Шестерня передаёт вращение',detail:'Зацепление меняет направление вращения следующей оси.'};
    default:return {title:PARTS[part.type].name,
      detail:moving?'Передача усилия продолжается.':'Этот узел остановил передачу движения.'};
  }
}
function stagedView(full,stages,elapsed,parts){
  const positions=new Map(stages.flatMap((stage,i)=>stage.ids.map(id=>[id,i])));
  const fade=index=>{
    if(index===undefined)return 0;
    const t=clamp((elapsed-index*STAGE_MS)/STAGE_MS,0,1);
    return t*t*(3-2*t);
  };
  const values={},inputs={};
  for(const [id,value] of Object.entries(full.values))values[id]=value*fade(positions.get(id));
  for(const [id,value] of Object.entries(full.inputs))inputs[id]=value*fade(positions.get(id));
  const bolt=parts.find(part=>part.type==='bolt')?.id;
  return {...full,values,inputs,
    boltTravel:full.boltTravel*fade(positions.get(bolt))};
}

function initialParts(){
  try{
    const stored=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
    const parts=validateParts(stored?.parts);
    // Migrate the former busy 16-part demonstration, but retain custom designs.
    if(parts.length===16&&parts.some(part=>part.id==='u-6'&&part.type==='latch')&&
      parts.some(part=>part.id==='d-6'&&part.type==='latch')&&
      parts.some(part=>part.id==='d-3'&&part.type==='ratchet'))return demoMechanism();
    if(parts.some(part=>part.type==='key')&&parts.some(part=>part.type==='bolt'))return parts;
  }catch{}
  return demoMechanism();
}

export function createMechanismUI(){
  const root=$('mechanismWorkspace'),canvas=$('mechBoard');
  const palette=$('mechPalette'),inspector=$('mechPartInspector');
  let parts=initialParts(),selected=null,mode='build',wrenchIndex=null,
    showContacts=false,drag=null,active=false,serial=0,tension=false,
    runtime=createMechanismRuntime(),view=null,pulseUntil=0,pickUntil=0,pickId=null,wrenchAttemptUntil=0,
    everOpen=false,activePin=0,lastInfo=0,lastFrame=0,feedbackUntil=0,
    security=null,diagnostics=null,raf=0,model3d=null,disposed=false,playback=null;
  let customBackup=null;
  try{
    const candidate=validateParts(JSON.parse(localStorage.getItem(BACKUP_KEY))?.parts);
    if(candidate.some(part=>part.type==='key')&&candidate.some(part=>part.type==='bolt'))
      customBackup=candidate;
  }catch{}
  const listeners=[];
  const listen=(target,event,fn,options)=>{
    target.addEventListener(event,fn,options);listeners.push([target,event,fn,options]);};
  const save=()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify({version:1,parts}));}catch{}};
  function rememberCurrentCustom(){
    if(identifyMechanismPreset(parts)||parts.length<=2||
      !parts.some(part=>part.type==='key')||!parts.some(part=>part.type==='bolt'))return;
    customBackup=validateParts(parts);
    try{localStorage.setItem(BACKUP_KEY,JSON.stringify({parts:customBackup}));}catch{}
  }
  for(const part of parts){const n=Number(part.id.split('-').at(-1));if(Number.isFinite(n))serial=Math.max(serial,n+1);}
  function resize(){model3d?.resize();}

  function notify(message,tone=''){
    const node=$('mechFeedback');node.textContent=message;
    node.classList.toggle('good',tone==='good');node.classList.toggle('bad',tone==='bad');
    feedbackUntil=performance.now()+3100;
  }
  function setWrenchStatus(message,tone=''){
    const node=$('mechFitStatus');node.textContent=message;
    node.classList.toggle('good',tone==='good');node.classList.toggle('bad',tone==='bad');
  }
  function refreshTensionButton(){
    $('mechTension').classList.toggle('active',tension);
    $('mechTension').setAttribute('aria-pressed',String(tension));
    $('mechTension').disabled=wrenchIndex===null;
    $('mechTensionLabel').textContent=tension?'2 · Натяжитель вставлен ✓':'2 · Проверить посадку';
    $('mechPickStroke').disabled=!tension;
  }
  function resetMotion(){runtime=createMechanismRuntime();pulseUntil=pickUntil=0;pickId=null;
    wrenchAttemptUntil=0;wrenchIndex=null;
    playback=null;$('mechMotionReadout').hidden=true;
    tension=false;everOpen=false;
    refreshTensionButton();renderWrenchChoices();
    setWrenchStatus('Сравните изгиб инструмента с металлической направляющей у скважины.');
    renderPinControls();
    $('mechTurnKey').disabled=false;refreshTurnButton();}
  function refreshTurnButton(){
    const ratchet=parts.find(part=>part.type==='ratchet');
    const count=ratchet?runtime.pawls[ratchet.id]?.steps||0:0;
    $('mechTurnKey').textContent=ratchet?
      `▶ Повернуть ключ · ${count}/${ratchet.setting} щелчков`:
      '▶ Повернуть ключ — посмотреть движение';
  }
  function renderPresets(){
    const activePreset=identifyMechanismPreset(parts);
    for(const button of $('mechPresetList').querySelectorAll('[data-mech-preset]')){
      const isActive=button.dataset.mechPreset===activePreset;
      button.classList.toggle('active',isActive);button.setAttribute('aria-pressed',String(isActive));
    }
    const node=$('mechPresetDetail');
    $('mechRestoreCustom').hidden=!customBackup;
    if(activePreset){
      const preset=MECHANISM_PRESETS[activePreset];
      node.innerHTML=`<strong>${html(preset.effect)}</strong><p>${html(preset.value)}</p>`;
    }else node.innerHTML='<strong>Своя сборка</strong><p>Перетаскивайте детали к концам тяг. После соединения поверните ключ и посмотрите, где останавливается движение.</p>';
  }
  function changed(){resetMotion();diagnostics=inspectLayout(parts);security=analyzePicking(parts);
    save();renderInspector();renderDiagnostics();renderPresets();}
  diagnostics=inspectLayout(parts);security=analyzePicking(parts);
  rememberCurrentCustom();

  // The five original pin-lab wrench curves drive both these icons and the 3D meshes.
  const wrenchChooser=$('mechWrenchChoices');
  for(const [index,spec] of STANDARD_TENSION_TOOLS.entries()){
    const button=document.createElement('button');button.type='button';
    button.dataset.wrenchIndex=String(index);
    button.setAttribute('aria-label',spec.name);
    button.innerHTML='<span class="mech-wrench-drawing">'+tensionToolIcon(index)+'</span>'
      +'<small>'+html(spec.name)+'</small>';
    listen(button,'click',()=>{
      if(wrenchIndex!==index&&tension){
        tension=false;runtime=stepMechanism(parts,runtime,{tension:false},.2).runtime;
        everOpen=false;pickId=null;pickUntil=0;
      }
      wrenchIndex=index;wrenchAttemptUntil=0;refreshTensionButton();
      renderWrenchChoices();renderPinControls();
      setWrenchStatus('Попробуйте вставить выбранный натяжитель в фигурный паз.');
      notify('Выбрана форма «'+spec.name+'». Проверьте, пройдёт ли изгиб через направляющую.');
    });
    wrenchChooser.appendChild(button);
  }
  function renderWrenchChoices(){
    $('mechWrenchLabel').textContent=STANDARD_TENSION_TOOLS[wrenchIndex]?.name||'Форма не выбрана';
    $('mechTensionIcon').innerHTML=wrenchIndex===null?'':tensionToolIcon(wrenchIndex);
    for(const button of wrenchChooser.children){
      const active=Number(button.dataset.wrenchIndex)===wrenchIndex;
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',String(active));
    }
  }
  function renderPinControls(){
    const bank=parts.find(part=>part.type==='pinbank');
    const pins=runtime.pinBanks?.[bank?.id]?.pins||[];
    const fixed=pins.filter(pin=>pin.set).length;
    const chooser=$('mechPinChoices');chooser.replaceChildren();
    $('mechPinProgress').textContent=bank?
      fixed+' из '+PIN_CODES.length+' зафиксировано':'Нет штифтового секрета';
    const pinSection=root.querySelector('.mech-attack-pins');
    if(pinSection)pinSection.hidden=!bank;
    if(!bank)return;
    for(let i=0;i<PIN_CODES.length;i++){
      const pin=pins[i],button=document.createElement('button');
      button.type='button';button.dataset.pinIndex=String(i);button.disabled=!tension;
      button.className=(i===activePin?'active ':'')+(pin?.set?'set':'');
      button.setAttribute('aria-pressed',String(i===activePin));
      button.setAttribute('aria-label','Штифт '+(i+1)+(pin?.set?', выставлен':', поднят на '+(pin?.lift||0)));
      button.innerHTML='<span>'+(i+1)+'</span><small>'+(pin?.set?'✓':pin?.lift?'↑ '+pin.lift:'·')+'</small>';
      button.addEventListener('click',()=>{
        if(!tension)return;
        activePin=i;selected=bank.id;renderPinControls();renderInspector();
        notify(pin?.set?'Штифт '+(i+1)+' уже выставлен. Выберите другой.':
          'Выбран штифт '+(i+1)+'. Нажимайте «Поднять отмычкой».');
      });
      chooser.appendChild(button);
    }
  }
  renderWrenchChoices();
  renderPinControls();

  const presetList=$('mechPresetList');
  for(const [name,preset] of Object.entries(MECHANISM_PRESETS)){
    const button=document.createElement('button');button.type='button';
    button.dataset.mechPreset=name;button.setAttribute('aria-pressed','false');
    button.innerHTML=`${html(preset.name)}<span>${html(preset.short)}</span>`;
    listen(button,'click',()=>{rememberCurrentCustom();parts=mechanismPreset(name);selected=null;changed();
      notify(`${preset.name}: ${preset.effect}`);});
    presetList.appendChild(button);
  }
  listen($('mechRestoreCustom'),'click',()=>{if(!customBackup)return;
    parts=validateParts(customBackup);selected=null;changed();
    notify('Восстановлена предыдущая собственная схема.');});
  renderPresets();

  const tooltip=document.createElement('div');
  tooltip.className='mech-part-tooltip';tooltip.hidden=true;
  tooltip.setAttribute('role','tooltip');root.appendChild(tooltip);
  function showPartTooltip(btn,type){
    const title=document.createElement('strong'),description=document.createElement('small');
    title.textContent=PARTS[type].name;description.textContent=effects[type];
    tooltip.replaceChildren(title,description);tooltip.hidden=false;
    const anchor=btn.getBoundingClientRect(),bounds=root.getBoundingClientRect();
    const width=tooltip.offsetWidth,height=tooltip.offsetHeight;
    const rightSide=anchor.right+width+12<=bounds.right;
    const x=rightSide?anchor.right-bounds.left+9:anchor.left-bounds.left-width-9;
    const y=anchor.top-bounds.top+(anchor.height-height)/2;
    tooltip.style.left=`${clamp(x,8,bounds.width-width-8)}px`;
    tooltip.style.top=`${clamp(y,8,bounds.height-height-8)}px`;
  }
  const hidePartTooltip=()=>{tooltip.hidden=true;};
  const createPaletteHeading=title=>{
    const heading=document.createElement('div');heading.className='mech-palette-heading';
    heading.textContent=title;palette.appendChild(heading);
  };
  const addPaletteItem=(type,target=palette)=>{
    const def=PARTS[type],btn=document.createElement('button');
    btn.type='button';btn.draggable=true;btn.dataset.partType=type;
    btn.innerHTML=`<span class="mech-glyph" aria-hidden="true">${icons[type]}</span>`;
    btn.setAttribute('aria-label',`${def.name}. ${effects[type]}. Нажмите, чтобы добавить.`);
    listen(btn,'pointerenter',()=>showPartTooltip(btn,type));
    listen(btn,'pointerleave',hidePartTooltip);
    listen(btn,'focus',()=>showPartTooltip(btn,type));
    listen(btn,'blur',hidePartTooltip);
    listen(btn,'click',()=>{if(mode==='build')addPart(type);});
    listen(btn,'dragstart',event=>{hidePartTooltip();if(mode!=='build'){event.preventDefault();return;}
      event.dataTransfer.setData('text/plain',type);event.dataTransfer.effectAllowed='copy';});
    target.appendChild(btn);
  };
  createPaletteHeading('ОСНОВА ЗАМКА');
  // forEach passes (item, index, array). Pass only the type: otherwise the
  // numeric index replaces addPaletteItem's default DOM container and throws.
  CORE_PALETTE.forEach(type=>addPaletteItem(type));
  const advanced=document.createElement('details');advanced.className='mech-advanced';
  const caption=document.createElement('summary');caption.textContent='Дополнительные механизмы · 6';
  const advancedGrid=document.createElement('div');advancedGrid.className='mech-palette';
  advanced.append(caption,advancedGrid);palette.appendChild(advanced);
  for(const type of ADVANCED_PALETTE)addPaletteItem(type,advancedGrid);
  listen(palette.parentElement,'scroll',hidePartTooltip);

  function renderInspector(){
    const part=parts.find(item=>item.id===selected);
    if(mode==='attack'){
      const bank=parts.find(item=>item.type==='pinbank');
      const fixed=(runtime.pinBanks?.[bank?.id]?.pins||[]).filter(pin=>pin.set).length;
      inspector.innerHTML=`<div class="mech-part-name">Как открыть этот замок</div>
        <ol class="mech-physical-chain">
          <li><b>Форма натяжителя</b> должна пройти через направляющую у скважины.</li>
          <li><b>Подходящий натяжитель</b> чуть поворачивает сердцевину и удерживает поднятые штифты.</li>
          <li><b>Отмычка-крючок</b> по одному приподнимает штифты внутри скважины.</li>
          <li><b>Щелчок ✓</b> означает правильное положение. Когда все штифты выставлены, сердцевина может повернуться.</li>
        </ol>
        ${bank?'<div class="mech-param-row"><span>Выставлено штифтов</span><strong>'+fixed+' / '+PIN_CODES.length+'</strong></div>':
          '<p>В механизме нет штифтового секрета. Исследуйте доступные точки через скважину.</p>'}
        <p class="mech-pin-help">Выбирайте штифт под замком. Если подняли слишком высоко, извлеките натяжитель — штифты опустятся.</p>`;
      return;
    }
    if(!part){
      inspector.innerHTML=`<div class="mech-part-name">Как открыть замок</div>
        <ol class="mech-physical-chain">
          <li><b>Ключ</b> приподнимает пять штифтов на нужную высоту.</li>
          <li><b>Сердцевина</b> получает возможность повернуться.</li>
          <li><b>Кулачок или тяги</b> отводят пружинную защёлку.</li>
          <li><b>Засов</b> втягивается и отпускает правую скобу.</li>
        </ol><p>Нажмите «Повернуть ключ». Каждый этап будет подсвечен прямо на металле. Нажмите на деталь в 3D, чтобы увидеть её роль.</p>`;
      return;
    }
    const def=PARTS[part.type];
    const contacts=buildContacts(parts).filter(link=>link.from===part.id||link.to===part.id).length;
    let body=`<div class="mech-part-name">${def.name}</div>
      <div class="mech-part-kind">${part.type==='shield'?'ЗАЩИТНАЯ ПЛАСТИНА':`СОЕДИНЕНИЙ С ДРУГИМИ ДЕТАЛЯМИ: ${contacts}`}</div>
      <p class="mech-simple-explanation">${html(effects[part.type]||def.detail)}</p>
      <details class="mech-technical-note"><summary>Как устроена деталь</summary><p>${html(def.detail)}</p></details>`;
    if(mode==='build'){
      if(part.type==='key'){
        body+=`<label class="mech-keyway-label" for="mechKeywayProfile">Фигурный паз для натяжителя</label>
          <select id="mechKeywayProfile" class="mech-keyway-select" aria-label="Форма направляющей скважины">
            ${STANDARD_TENSION_TOOLS.map((tool,i)=>`<option value="${i}" ${part.wrenchProfile===i?'selected':''}>${html(tool.name)}</option>`).join('')}
          </select>
          <p class="mech-pin-help">Изгиб направляющей определяет, какой натяжитель войдёт в замок.</p>`;
      }
      if(def.param){
        const title={ratio:'Передаточное число',resistance:'Сопротивление',strength:'Сила возврата',
          steps:'Число щелчков',phase:'Начало рабочей фазы',threshold:'Порог открытия',
          radius:'Радиус защиты'}[def.param];
        body+=`<label class="mech-param-row" for="mechParameter"><span>${title}</span>
          <strong id="mechParameterValue">${Number(part.setting).toFixed(def.step===1||def.step===5?0:2)}${def.unit}</strong></label>
          <input id="mechParameter" type="range" min="${def.min}" max="${def.max}"
          step="${def.step}" value="${part.setting}" />`;
      }
      if(['lever'].includes(part.type))body+=`<label class="mech-toggle-row"><input type="checkbox" id="mechFlip" ${part.flip?'checked':''} /> Обратное плечо</label>`;
      if(['pin','cam','latch'].includes(part.type))body+=`<label class="mech-toggle-row"><input type="checkbox" id="mechPolarity" ${part.polarity===-1?'checked':''} /> Работает от обратного усилия</label>`;
      body+=`<div class="mech-properties-actions"><button id="mechRotate" type="button" ${def.fixed?'disabled':''}>Повернуть 90° ↻</button>
        <button id="mechRemove" type="button" ${def.fixed?'disabled':''}>Убрать деталь ×</button></div>`;
    }else{
      const level=view?.values[part.id]||0;
      body+=`<div class="mech-param-row"><span>Текущий ход</span><strong>${Math.round(Math.abs(level)*100)}%</strong></div>`;
      if(mode==='attack')body+=`<div class="mech-param-row"><span>Доступ крючком</span><strong>${canPick(part,parts)?'ЕСТЬ':'НЕТ'}</strong></div>`;
    }
    inspector.innerHTML=body;
    $('mechRotate')?.addEventListener('click',()=>rotateSelected(1));
    $('mechRemove')?.addEventListener('click',removeSelected);
    $('mechParameter')?.addEventListener('input',event=>{
      part.setting=Number(event.target.value);const value=$('mechParameterValue');
      value.textContent=Number(part.setting).toFixed(def.step===1||def.step===5?0:2)+def.unit;
      save();diagnostics=inspectLayout(parts);security=analyzePicking(parts);
    });
    $('mechParameter')?.addEventListener('change',changed);
    $('mechFlip')?.addEventListener('change',event=>{part.flip=event.target.checked;changed();});
    $('mechPolarity')?.addEventListener('change',event=>{part.polarity=event.target.checked?-1:1;changed();});
    $('mechKeywayProfile')?.addEventListener('change',event=>{
      part.wrenchProfile=Number(event.target.value);changed();});
  }

  function renderDiagnostics(){
    diagnostics=inspectLayout(parts);
    if(mode==='attack'){
      $('mechDiagnostics').innerHTML='<div>Корпус: <b>ЗАКРЫТ</b></div><div>Внутренние связи и число стопоров скрыты.</div>';
      $('mechSecurity').removeAttribute('data-status');
      $('mechSecurity').innerHTML='<span class="mech-security-name">Проверка на ощупь</span>Натяжитель удерживает сердцевину, а крючок по одному поднимает штифты. Внутренности остаются скрыты.';
      return;
    }
    const count=parts.filter(part=>part.type!=='key'&&part.type!=='bolt').length;
    $('mechDiagnostics').innerHTML=`<div class="mech-signal-status ${diagnostics.connected&&!diagnostics.jammed?'good':'bad'}">
      ${diagnostics.connected&&!diagnostics.jammed?'Тяги соединены от ключа до засова':'Есть разрыв в передаче движения'}</div>
      <div>Установлено: <b>${count}</b> · Рабочих стыков: <b>${diagnostics.connections.length}</b></div>
      <div>Защёлок у засова: <b>${diagnostics.boltGates}</b></div>
      ${diagnostics.issues.slice(0,3).map(issue=>`<div class="mech-issue">${html(issue)}</div>`).join('')}`;
    security=analyzePicking(parts);
    const label={pickable:'Уязвимость найдена',guarded:'Простой взлом затруднён',
      trivial:'Засов не защищён',jammed:'Механизм заклинен',invalid:'Схема не работает'}[security.status];
    const box=$('mechSecurity');box.dataset.status=security.status;
    box.innerHTML=`<span class="mech-security-name">${label}</span>${html(security.summary)}
      <p>Проверяется доступ наших натяжителей и отмычки-крючка. Результат зависит от расположения и движения деталей.</p>`;
  }

  function coordinates(event){
    const point=model3d?.eventToBoard(event)||{x:BOARD.width/2,y:BOARD.height/2};
    return {x:clamp(point.x,0,BOARD.width),y:clamp(point.y,0,BOARD.height)};
  }
  function hitTest(event){
    const id=model3d?.hitPart(event,mode);
    return parts.find(part=>part.id===id)||null;
  }
  function snap(part){
    if(PARTS[part.type].fixed||part.type==='shield')return;
    let best=null;
    const own=portsFor(part),others=parts.filter(item=>item.id!==part.id);
    for(const other of others){
      const ports=portsFor(other);
      for(const [local,remote] of [[own.inputs,ports.outputs],[own.outputs,ports.inputs]]){
        for(const a of local)for(const b of remote){
          const dot=a.nx*b.nx+a.ny*b.ny;
          const distance=Math.hypot(a.x-b.x,a.y-b.y);
          if(dot<-.7&&distance<38&&(!best||distance<best.distance))
            best={distance,dx:b.x-a.x,dy:b.y-a.y};
        }
      }
    }
    if(best){part.x=clamp(part.x+best.dx,30,890);part.y=clamp(part.y+best.dy,30,580);}
  }
  function nextFreePosition(type){
    const def=PARTS[type];
    const selectedPart=parts.find(part=>part.id===selected);
    if(selectedPart&&def.span){
      const linked=new Set(buildContacts(parts).map(link=>`${link.from}:${link.fromPort}`));
      for(const output of portsFor(selectedPart).outputs){
        if(linked.has(`${selectedPart.id}:${output.name}`))continue;
        const x=output.x+def.span*output.nx,y=output.y+def.span*output.ny;
        if(x>55&&x<865&&y>65&&y<545)return {x,y};
      }
    }
    const attempts=[[240,125],[340,125],[440,125],[550,125],[650,125],[750,125],
      [220,500],[330,500],[445,500],[570,500],[690,500]];
    const vacant=attempts.find(([x,y])=>parts.every(part=>Math.hypot(part.x-x,part.y-y)>64));
    return vacant?{x:vacant[0],y:vacant[1]}:{x:460,y:305};
  }
  function addPart(type,position){
    if(mode!=='build'||!PARTS[type]||PARTS[type].fixed||parts.length>=60)return;
    const at=position||nextFreePosition(type);
    const part=makePart(type,`part-${++serial}`,Math.round(at.x),Math.round(at.y));
    parts.push(part);selected=part.id;if(!position)snap(part);
    changed();notify(`${PARTS[type].name} добавлена. Совместите точки контакта с соседними деталями.`);
  }
  function rotateSelected(step){
    if(mode!=='build')return;const part=parts.find(item=>item.id===selected);
    if(!part||PARTS[part.type].fixed)return;
    part.rot=(part.rot+step+4)%4;changed();
  }
  function removeSelected(){
    if(mode!=='build')return;
    const part=parts.find(item=>item.id===selected);
    if(!part||PARTS[part.type].fixed)return;
    parts=parts.filter(item=>item.id!==selected);selected=null;changed();
  }

  function liftWithHook(part){
    if(!part){notify('Выберите точку для отмычки у скважины.','bad');return;}
    if(!tension){notify('Сначала вставьте натяжитель: он удерживает штифты после щелчка.','bad');return;}
    if(!canPick(part,parts)){
      notify('Крючок сюда не проходит: мешает защитная пластина.','bad');return;
    }
    selected=part.id;
    const now=performance.now(),picked=activePin;
    // Release between strokes; this is the very same contact solver used by the key.
    runtime=stepMechanism(parts,runtime,{tension:true,wrenchIndex},.28).runtime;
    const before=Object.values(runtime.pawls).reduce((sum,v)=>sum+v.steps,0);
    const targetId=part.type==='pinbank'?part.id+':'+picked:part.id;
    const force=part.type==='pinbank'?1:part.polarity||1;
    pickId=targetId;pickUntil=now+330;
    const result=stepMechanism(parts,runtime,{picks:{[targetId]:force},tension:true,wrenchIndex},.5);
    runtime=result.runtime;view=result;
    const after=Object.values(runtime.pawls).reduce((sum,v)=>sum+v.steps,0);
    if(result.open){everOpen=true;notify('Щелчок! Засов втянут, скоба освободилась.','good');}
    else if(part.type==='pinbank'){
      const pin=runtime.pinBanks[part.id]?.pins[picked];
      if(pin?.set){
        const next=PIN_CODES.findIndex((_,i)=>!runtime.pinBanks[part.id].pins[i].set);
        activePin=next<0?picked:next;
        notify('Щелчок! Штифт '+(picked+1)+' зафиксирован. '+(next<0?
          'Все штифты выставлены.':'Следующий — '+(next+1)+'.'),'good');
      }else if(pin?.lift>PIN_CODES[picked])
        notify('Штифт '+(picked+1)+' поднят слишком высоко. Извлеките натяжитель и попробуйте снова.','bad');
      else notify('Штифт '+(picked+1)+' поднят на один шаг. Поднимайте до щелчка.');
    }else if(after>before)
      notify('Щелчок: механическая собачка удержала новый шаг.','good');
    else if(Math.abs(result.values[part.id])<.05)
      notify('Крючок не сдвинул деталь. Путь заблокирован.','bad');
    else notify('Крючок сдвинул внутреннюю деталь.');
    renderPinControls();renderInspector();
  }

  listen(canvas,'pointerdown',event=>{
    if(event.button!==0||event.shiftKey)return;
    const {x,y}=coordinates(event),part=hitTest(event);
    if(part)event.stopImmediatePropagation();
    if(mode==='build'){
      selected=part?.id||null;renderInspector();
      if(part?.type==='key')turnKey();
      if(part&&!PARTS[part.type].fixed){
        drag={id:part.id,dx:x-part.x,dy:y-part.y};canvas.setPointerCapture(event.pointerId);
      }
    }else if(mode==='attack'&&part){
      liftWithHook(part);
    }else if(part){selected=part.id;renderInspector();}
    event.preventDefault();
  },{capture:true});
  listen(canvas,'pointermove',event=>{
    if(!drag)return;
    const part=parts.find(item=>item.id===drag.id);if(!part)return;
    const {x,y}=coordinates(event);
    part.x=clamp(Math.round(x-drag.dx),55,BOARD.width-55);
    part.y=clamp(Math.round(y-drag.dy),75,BOARD.height-75);
    event.preventDefault();
  });
  function releaseDrag(){
    if(!drag)return;const part=parts.find(item=>item.id===drag.id);
    if(part){snap(part);changed();}drag=null;
  }
  listen(canvas,'pointerup',releaseDrag);
  listen(canvas,'pointercancel',releaseDrag);
  listen(canvas,'dblclick',event=>{if(mode!=='build')return;
    const hit=hitTest(event);
    if(hit){selected=hit.id;rotateSelected(1);}event.preventDefault();});
  listen(canvas,'dragover',event=>{if(mode!=='build')return;event.preventDefault();event.dataTransfer.dropEffect='copy';});
  listen(canvas,'drop',event=>{if(mode!=='build')return;event.preventDefault();
    const type=event.dataTransfer.getData('text/plain');
    if(PALETTE.includes(type))addPart(type,coordinates(event));});
  listen(window,'keydown',event=>{
    if(!active||mode!=='build'||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
    if(['KeyQ','KeyE','Delete','Backspace'].includes(event.code))event.preventDefault();
    if(event.code==='KeyE')rotateSelected(1);
    else if(event.code==='KeyQ')rotateSelected(-1);
    else if(event.code==='Delete'||event.code==='Backspace')removeSelected();
  });

  document.querySelectorAll('[data-mech-mode]').forEach(button=>listen(button,'click',()=>setMechanismMode(button.dataset.mechMode)));
  listen($('mechTension'),'click',()=>{
    if(wrenchIndex===null){notify('Сначала выберите форму натяжителя.','bad');return;}
    if(!tension){
      const fit=checkTensionFit(parts,wrenchIndex);
      if(!fit.fits){
        wrenchAttemptUntil=performance.now()+900;
        setWrenchStatus('Не входит: изгиб упирается в направляющую. Выберите другую форму.','bad');
        notify('Натяжитель упёрся в край паза. Сердцевина остаётся заблокированной.','bad');
        return;
      }
    }
    tension=!tension;wrenchAttemptUntil=0;refreshTensionButton();
    const result=stepMechanism(parts,runtime,{tension,wrenchIndex},.5);
    runtime=result.runtime;view=result;
    renderPinControls();renderInspector();
    setWrenchStatus(tension?'Подошёл ✓ Кончик вошёл, изгиб прошёл направляющую.':'Натяжитель извлечён. Можно выбрать другую форму.',
      tension?'good':'');
    notify(tension?'Натяжитель подошёл! Выберите штифт и поднимайте его крючком.':
      'Натяжитель извлечён. Штифты опустились, можно попробовать снова.');});
  listen($('mechPickStroke'),'click',()=>{
    const bank=parts.find(part=>part.type==='pinbank');
    const selectedPart=parts.find(part=>part.id===selected);
    liftWithHook(selectedPart||bank||parts.find(part=>canPick(part,parts)));
  });
  function turnKey(){
    const now=performance.now();if(now<pulseUntil||playback)return;
    // The physical solver decides the outcome once. Playback reveals that
    // actual outcome through successive connected assemblies, not a cutscene.
    runtime=stepMechanism(parts,runtime,{key:0,tension:false},.3).runtime;
    const result=stepMechanism(parts,runtime,{key:1,tension:true},.5);
    runtime=result.runtime;view=result;
    const stages=transmissionStages(parts,result);
    playback={start:now,stages,result,shown:-1,
      duration:Math.max(1,stages.length)*STAGE_MS+150};
    pulseUntil=now+playback.duration;
    $('mechTurnKey').disabled=true;
    $('mechMotionReadout').hidden=false;
    notify('Проследим путь усилия от ключа до засова.');
  }
  listen($('mechTurnKey'),'click',turnKey);
  listen($('mechResetTest'),'click',()=>{resetMotion();notify('Механизм вернулся в исходное положение.');});
  listen($('mechResetAttack'),'click',()=>{
    resetMotion();renderInspector();notify('Инструменты извлечены. Можно начать вскрытие заново.');});
  listen($('mechShowContacts'),'click',()=>{showContacts=!showContacts;
    $('mechShowContacts').textContent=`Контакты: ${showContacts?'вкл.':'выкл.'}`;
    $('mechShowContacts').setAttribute('aria-pressed',String(showContacts));});
  listen($('mechResetCamera'),'click',()=>model3d?.resetCamera());
  listen($('mechToggleCover'),'click',()=>{
    if(mode==='attack')return;
    const next=!model3d?.getCutaway();model3d?.setCutaway(next);
    $('mechToggleCover').textContent=next?'Закрыть крышку':'Открыть разрез';
    $('mechToggleCover').setAttribute('aria-pressed',String(!next));
  });
  listen($('mechClear'),'click',()=>{
    parts=parts.filter(part=>PARTS[part.type].fixed);selected=null;changed();
    notify('Плита очищена. Ключевой ротор и засов остались на местах.');});
  listen($('mechExport'),'click',()=>{
    const blob=new Blob([JSON.stringify({format:'keynlock-mechanism-v1',parts},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='keynlock-mechanism.json';a.click();URL.revokeObjectURL(url);
    notify('Схема механизма сохранена в JSON.');
  });
  listen($('mechImport'),'click',()=>$('mechImportFile').click());
  listen($('mechImportFile'),'change',async event=>{
    const file=event.target.files?.[0];if(!file)return;
    try{
      if(file.size>160000)throw new Error('Слишком большой файл');
      const json=JSON.parse(await file.text()),incoming=validateParts(json.parts);
      if(incoming.filter(item=>item.type==='key').length!==1||
        incoming.filter(item=>item.type==='bolt').length!==1)
        throw new Error('В схеме требуется один ключевой ротор и один засов');
      parts=incoming;selected=null;changed();notify('Схема импортирована.');
    }catch(error){notify(`Ошибка импорта: ${error.message}`,'bad');}
    event.target.value='';
  });

  function setMechanismMode(next){
    if(!['build','attack'].includes(next))return;
    mode=next;activePin=0;resetMotion();
    selected=mode==='attack'?parts.find(part=>part.type==='pinbank')?.id||null:null;
    renderPinControls();
    root.classList.toggle('mech-attack-active',mode==='attack');
    if(mode!=='attack'&&model3d&&!model3d.getCutaway()){
      model3d.setCutaway(true);
      $('mechToggleCover').textContent='Закрыть крышку';
      $('mechToggleCover').setAttribute('aria-pressed','false');
    }
    document.querySelectorAll('[data-mech-mode]').forEach(button=>{
      const isCurrent=button.dataset.mechMode===mode;
      button.classList.toggle('active',isCurrent);button.setAttribute('aria-pressed',String(isCurrent));});
    $('mechBuildControls').hidden=mode!=='build';
    $('mechAttackControls').hidden=mode!=='attack';
    $('mechToggleCover').hidden=mode==='attack';
    $('mech3dViewLabel').textContent=mode==='attack'?'ЗАКРЫТЫЙ ЗАМОК · НАБОР ОТМЫЧЕК':
      '3D-РАЗРЕЗ · ВНУТРЕННИЙ МЕХАНИЗМ';
    canvas.style.cursor=mode==='build'?'grab':mode==='attack'?'crosshair':'default';
    renderInspector();renderDiagnostics();
    const messages={build:'Собирайте механизм и сразу поворачивайте ключ: штифты → кулачок → защёлка → засов → скоба.',
      attack:'1. Подберите форму натяжителя. 2. Проверьте посадку. 3. Выберите штифт. 4. Поднимайте крючком.'};
    notify(messages[mode]);
  }

  // The real mesh hierarchy and all interaction targets are rendered in Three.js.
  function frame(now){
    raf=requestAnimationFrame(frame);if(!active)return;
    const dt=clamp((now-(lastFrame||now))/1000,.008,.05);lastFrame=now;
    const key=mode==='build'&&now<pulseUntil?1:0;
    view=stepMechanism(parts,runtime,{key,
      tension:mode==='build'?!!key:mode==='attack'&&tension,
      ...(mode==='attack'&&wrenchIndex!==null?{wrenchIndex}:{})},dt);
    runtime=view.runtime;
    let visualView=view,motionActive=[],shackleReleased=everOpen;
    if(playback&&mode==='build'){
      const elapsed=Math.max(0,now-playback.start),duration=playback.duration;
      const step=Math.min(playback.stages.length-1,Math.floor(elapsed/STAGE_MS));
      if(elapsed<duration&&step>=0){
        const current=playback.stages[step];
        visualView=stagedView(playback.result,playback.stages,elapsed,parts);
        motionActive=current.ids;
        if(step!==playback.shown){
          const caption=stepCaption(current,parts,playback.result);
          $('mechMotionIndex').textContent=`ШАГ ${step+1} / ${playback.stages.length}`;
          $('mechMotionTitle').textContent=caption.title;
          $('mechMotionDetail').textContent=caption.detail;
          playback.shown=step;
        }
        // The bow must not leave its sockets before the bolt itself moves.
        const bolt=parts.find(part=>part.type==='bolt');
        shackleReleased=everOpen||Boolean(playback.result.open&&
          (visualView.boltTravel||0)>.85&&bolt);
      }else{
        const finished=playback;playback=null;
        $('mechMotionReadout').hidden=true;
        $('mechTurnKey').disabled=false;
        refreshTurnButton();
        if(finished.result.open){everOpen=true;shackleReleased=true;
          notify('Засов втянут. Правая скоба освободилась.','good');}
        else{
          const ratchet=parts.find(part=>part.type==='ratchet');
          const steps=ratchet?runtime.pawls[ratchet.id]?.steps||0:0;
          if(ratchet&&steps<ratchet.setting)
            notify(`Трещотка удержала ${steps}/${ratchet.setting} щелчков. Поверните ключ ещё раз.`);
          else notify(diagnostics.issues[0]||'Передача остановилась. Выберите неподвижную деталь и проверьте её соединение.','bad');
        }
      }
    }
    if(view.open&&!everOpen&&!playback){everOpen=true;shackleReleased=true;
      notify(mode==='attack'?'Крючок освободил засов, правая скоба вышла из гнезда.':
        'Засов освободил правую скобу.','good');}
    model3d?.render({parts,view:visualView,mode,selected,showContacts,pickId,pickUntil,
      tension,wrenchIndex,wrenchAttemptUntil,activePin,dragging:drag?.id,motionActive,unlocked:shackleReleased},now);
    if(now-lastInfo>350){
      lastInfo=now;
      if(selected&&mode!=='build')renderInspector();
      const pawls=parts.filter(part=>part.type==='ratchet');
      const snaps=pawls.map(part=>runtime.pawls[part.id]?.steps||0);
      const count=snaps.reduce((a,b)=>a+b,0);
      if(mode==='build'&&now>=feedbackUntil&&!everOpen&&!playback)
        $('mechFeedback').textContent=pawls.length?
          `Трещотка: ${count} щелчков. Проверьте освобождение защёлки и засова.`:
          'Поверните ключ. Наблюдайте движение штифтов, кулачка, защёлки и засова.';
      if(mode==='attack'&&now>=feedbackUntil&&!everOpen){
        const bank=parts.find(part=>part.type==='pinbank');
        const set=runtime.pinBanks?.[bank?.id]?.pins?.filter(pin=>pin.set).length||0;
        $('mechFeedback').textContent=tension?
          `Выставлено ${set} из ${PIN_CODES.length} штифтов. Выберите номер и нажимайте «Поднять отмычкой».`:
          'Подберите форму натяжителя и проверьте, проходит ли он через направляющую скважины.';
      }
    }
  }
  try{
    model3d=createMechanism3D(canvas);
    const refreshThumbnails=()=>{
      if(disposed)return;
      const thumbnails=model3d.captureThumbnails(PALETTE);
      for(const [type,src] of Object.entries(thumbnails)){
        const glyph=palette.querySelector(`[data-part-type="${type}"] .mech-glyph`);
        if(!glyph)continue;
        const image=document.createElement('img');image.alt=`3D: ${PARTS[type].name}`;
        image.src=src;glyph.replaceChildren(image);
      }
    };
    refreshThumbnails();
    model3d.whenTexturesReady().then(refreshThumbnails)
      .catch(error=>console.warn('3D catalog thumbnails:',error));
  }catch(error){
    console.error('3D mechanism scene:',error);
    $('mech3dUnavailable').hidden=false;
    $('mech3dUnavailable').textContent='Для трёхмерной песочницы требуется WebGL. Не удалось открыть 3D-корпус замка.';
    $('mechFeedback').textContent='В этом браузере не удалось создать WebGL-сцену.';
  }
  renderInspector();renderDiagnostics();raf=requestAnimationFrame(frame);

  return {
    open(){active=true;root.hidden=false;lastFrame=0;model3d?.open();
      renderDiagnostics();renderInspector();},
    close(){active=false;root.hidden=true;drag=null;hidePartTooltip();model3d?.close();resetMotion();},
    dispose(){disposed=true;cancelAnimationFrame(raf);model3d?.dispose();
      for(const [target,event,fn,options] of listeners)target.removeEventListener(event,fn,options);
      tooltip.remove();}
  };
}
