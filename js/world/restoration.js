(function(){
  'use strict';

  const STORAGE_KEY='keynlockRestoredPaintings';
  const TARGET_SCORE=88;
  const PAINTINGS=Object.freeze([
    {id:'sunflowers',title:'Подсолнухи',artist:'Винсент ван Гог',year:'1888',image:'assets/restoration/sunflowers.jpg',colors:['yellow','orange','green']},
    {id:'starry-night',title:'Звёздная ночь',artist:'Винсент ван Гог',year:'1889',image:'assets/restoration/starry-night.jpg',colors:['blue','yellow','violet']},
    {id:'great-wave',title:'Большая волна в Канагаве',artist:'Кацусика Хокусай',year:'ок. 1831',image:'assets/restoration/great-wave.jpg',colors:['blue','cyan']},
    {id:'mona-lisa',title:'Мона Лиза',artist:'Леонардо да Винчи',year:'1503–1519',image:'assets/restoration/mona-lisa.jpg',colors:['green','yellow','orange']},
    {id:'girl-pearl',title:'Девушка с жемчужной серёжкой',artist:'Ян Вермеер',year:'ок. 1665',image:'assets/restoration/girl-pearl.jpg',colors:['blue','yellow']},
    {id:'birth-venus',title:'Рождение Венеры',artist:'Сандро Боттичелли',year:'1480-е',image:'assets/restoration/birth-venus.jpg',colors:['cyan','orange','green']},
    {id:'the-kiss',title:'Поцелуй',artist:'Густав Климт',year:'1907–1908',image:'assets/restoration/the-kiss.jpg',colors:['yellow','orange']},
    {id:'the-scream',title:'Крик',artist:'Эдвард Мунк',year:'1893',image:'assets/restoration/the-scream.jpg',colors:['orange','blue','violet']},
    {id:'las-meninas',title:'Менины',artist:'Диего Веласкес',year:'1656',image:'assets/restoration/las-meninas.jpg',colors:['yellow','violet']},
    {id:'impression-sunrise',title:'Впечатление. Восход солнца',artist:'Клод Моне',year:'1872',image:'assets/restoration/impression-sunrise.jpg',colors:['orange','cyan','blue']},
    {id:'red-fuji',title:'Красная Фудзи',artist:'Кацусика Хокусай',year:'ок. 1830–1832',image:'assets/restoration/red-fuji.jpg',colors:['red','blue','green']},
    {id:'kajikazawa',title:'Кадзикадзава в провинции Каи',artist:'Кацусика Хокусай',year:'ок. 1830–1832',image:'assets/restoration/kajikazawa.jpg',colors:['blue','cyan','yellow']},
    {id:'sea-satta',title:'Море в Сатта, провинция Суруга',artist:'Утагава Хиросигэ',year:'1858',image:'assets/restoration/sea-satta.jpg',colors:['blue','cyan','green']},
    {id:'sudden-shower',title:'Внезапный ливень над мостом Син-Охаси',artist:'Утагава Хиросигэ',year:'1857',image:'assets/restoration/sudden-shower.jpg',colors:['blue','cyan','violet']},
    {id:'plum-garden',title:'Сливовый сад в Камэйдо',artist:'Утагава Хиросигэ',year:'1857',image:'assets/restoration/plum-garden.jpg',colors:['red','green','cyan']},
    {id:'ejiri',title:'Эдзири в провинции Суруга',artist:'Кацусика Хокусай',year:'ок. 1830–1832',image:'assets/restoration/ejiri.jpg',colors:['green','yellow','blue']},
    {id:'enoshima',title:'Эносима в провинции Сагами',artist:'Кацусика Хокусай',year:'ок. 1830–1832',image:'assets/restoration/enoshima.jpg',colors:['blue','cyan','green']},
    {id:'umezawa',title:'Умэдзава в провинции Сагами',artist:'Кацусика Хокусай',year:'ок. 1830–1832',image:'assets/restoration/umezawa.jpg',colors:['green','yellow','blue']},
    {id:'inume',title:'Перевал Инумэ в провинции Каи',artist:'Кацусика Хокусай',year:'ок. 1830–1832',image:'assets/restoration/inume.jpg',colors:['blue','green','yellow']},
    {id:'mishima',title:'Перевал Мисима в провинции Каи',artist:'Кацусика Хокусай',year:'ок. 1830–1832',image:'assets/restoration/mishima.jpg',colors:['blue','cyan','green']},
    {id:'shono',title:'Сёно. Внезапный дождь',artist:'Утагава Хиросигэ',year:'1833–1834',image:'assets/restoration/shono.jpg',colors:['blue','green','violet']},
    {id:'yokkaichi',title:'Ёккаити',artist:'Утагава Хиросигэ',year:'1833–1834',image:'assets/restoration/yokkaichi.jpg',colors:['blue','green','yellow']},
    {id:'kameyama',title:'Камэяма',artist:'Утагава Хиросигэ',year:'1833–1834',image:'assets/restoration/kameyama.jpg',colors:['cyan','blue','violet']},
    {id:'nihonbashi',title:'Нихонбаси. Утро',artist:'Утагава Хиросигэ',year:'1833–1834',image:'assets/restoration/nihonbashi.jpg',colors:['blue','yellow','red']},
    {id:'kanbara',title:'Камбара. Ночной снег',artist:'Утагава Хиросигэ',year:'1833–1834',image:'assets/restoration/kanbara.jpg',colors:['blue','cyan','violet']}
  ]);
  const DAMAGE=Object.freeze({hue:[-44,-38,-31,-25,24,29,36,43],sat:[.62,.70,.78,1.22,1.30,1.38],light:[.74,.82,.88,1.12,1.20,1.28]});
  const root=document.querySelector('#restorationRoot');
  if(!root)return;

  const elements={
    select:root.querySelector('#restorationPaintingSelect'),progress:root.querySelector('#restorationProgress'),
    original:root.querySelector('#restorationOriginal'),damaged:root.querySelector('#restorationDamaged'),
    hue:root.querySelector('#restorationHue'),sat:root.querySelector('#restorationSat'),light:root.querySelector('#restorationLight'),
    hueValue:root.querySelector('#restorationHueValue'),satValue:root.querySelector('#restorationSatValue'),lightValue:root.querySelector('#restorationLightValue'),
    loupe:root.querySelector('#restorationLoupeButton'),newDamage:root.querySelector('#restorationNewDamage'),check:root.querySelector('#restorationCheck'),
    score:root.querySelector('#restorationScore'),hint:root.querySelector('#restorationHint'),reward:root.querySelector('#restorationReward')
  };
  let completed={};
  try{completed=JSON.parse(STORE.getItem(STORAGE_KEY)||'{}')||{};}catch(_){completed={};}
  const state={painting:0,hue:0,sat:100,light:100,damage:{hue:34,sat:.72,light:1.18},loupe:true,checked:false,started:false,focus:{x:50,y:50,pinned:false}};
  const pick=array=>array[Math.floor(Math.random()*array.length)];
  const current=()=>PAINTINGS[state.painting];

  function filterValue(){
    return `hue-rotate(${state.damage.hue+state.hue}deg) saturate(${(state.damage.sat*state.sat/100).toFixed(4)}) brightness(${(state.damage.light*state.light/100).toFixed(4)})`;
  }
  function score(){
    const hueScore=Math.max(0,1-Math.abs(state.damage.hue+state.hue)/60);
    const satScore=Math.max(0,1-Math.abs(state.damage.sat*state.sat/100-1)/.6);
    const lightScore=Math.max(0,1-Math.abs(state.damage.light*state.light/100-1)/.5);
    return Math.max(0,Math.min(100,Math.round((hueScore*.38+satScore*.31+lightScore*.31)*100)));
  }
  function resetControls(){
    state.hue=0;state.sat=100;state.light=100;state.checked=false;
    elements.hue.value='0';elements.sat.value='100';elements.light.value='100';
  }
  function newDamage(){
    state.damage={hue:pick(DAMAGE.hue),sat:pick(DAMAGE.sat),light:pick(DAMAGE.light)};
    state.focus.pinned=false;
    hideLenses();
    resetControls();
    renderLive();
  }
  function renderSelect(){
    elements.select.innerHTML=PAINTINGS.map((painting,index)=>`<option value="${index}">${completed[painting.id]?'✓ ':''}${painting.title} — ${painting.artist}</option>`).join('');
    elements.select.value=String(state.painting);
    const done=PAINTINGS.filter(painting=>completed[painting.id]).length;
    elements.progress.textContent=`Восстановлено ${done}/${PAINTINGS.length}`;
  }
  function renderPainting(){
    const painting=current();
    elements.original.src=painting.image;
    elements.damaged.src=painting.image;
    elements.original.alt=`${painting.artist}, «${painting.title}», ${painting.year}`;
    elements.damaged.alt=`Повреждённая версия: ${painting.artist}, «${painting.title}»`;
    renderLive();
  }
  function renderLive(){
    elements.damaged.style.filter=filterValue();
    elements.hueValue.textContent=String(state.hue);
    elements.satValue.textContent=`${state.sat}%`;
    elements.lightValue.textContent=`${state.light}%`;
    if(!state.checked){
      elements.score.textContent='—';
      elements.score.classList.remove('good');
      elements.hint.textContent=`Добейся совпадения не ниже ${TARGET_SCORE}%.`;
      elements.reward.hidden=true;
    }
    syncLenses();
  }
  function rewardMarkup(result){
    const rows=Object.entries(result.components).map(([id,count])=>{
      const component=window.KeynlockResources.components.find(item=>item.id===id);
      return `<span><i style="--reward-color:${component?.color||'#888'}"></i>+${count} ${component?.name||id}</span>`;
    }).join('');
    return `<b>Награда</b><span>+${result.coins} монет</span>${rows}`;
  }
  function checkRestoration(){
    const value=score();
    state.checked=true;
    const success=value>=TARGET_SCORE;
    elements.score.textContent=`${value}%`;
    elements.score.classList.toggle('good',success);
    if(!success){elements.hint.textContent='Цвет всё ещё отличается от оригинала.';elements.reward.hidden=true;return;}
    const painting=current();
    if(completed[painting.id]){
      elements.hint.textContent='Картина уже была восстановлена. Это тренировочная попытка.';
      elements.reward.hidden=true;
      return;
    }
    completed[painting.id]={score:value,completedAt:new Date().toISOString()};
    STORE.setItem(STORAGE_KEY,JSON.stringify(completed));
    const result=window.KeynlockResources?.awardRestoration?.({coins:50,componentCount:2,preferredColors:painting.colors})||{coins:50,components:{}};
    elements.hint.textContent='Картина восстановлена и возвращена заказчику.';
    elements.reward.innerHTML=rewardMarkup(result);
    elements.reward.hidden=false;
    renderSelect();
  }
  function syncLenses(){
    root.querySelectorAll('.restorationLens').forEach(lens=>lens.classList.toggle('enabled',state.loupe));
    elements.loupe.classList.toggle('active',state.loupe);
    if(state.loupe&&state.focus.pinned)placePinnedLenses();
  }
  function moveLenses(event){
    if(!state.loupe||state.focus.pinned)return;
    const area=event.currentTarget;
    const rect=area.getBoundingClientRect();
    const x=Math.max(0,Math.min(rect.width,event.clientX-rect.left));
    const y=Math.max(0,Math.min(rect.height,event.clientY-rect.top));
    state.focus.x=x/rect.width*100;
    state.focus.y=y/rect.height*100;
    root.querySelectorAll('.restorationArtwork').forEach(target=>{
      const lens=target.querySelector('.restorationLens');
      const img=target.querySelector('img');
      lens.style.left=`${x/rect.width*100}%`;
      lens.style.top=`${y/rect.height*100}%`;
      lens.style.backgroundImage=`url("${img.src}")`;
      lens.style.backgroundSize=`${target.clientWidth*2.7}px ${target.clientHeight*2.7}px`;
      lens.style.backgroundPosition=`${64-x*2.7}px ${64-y*2.7}px`;
      lens.style.filter=img===elements.damaged?filterValue():'none';
      lens.classList.add('visible');
      lens.classList.toggle('pinned',state.focus.pinned);
    });
  }
  function placePinnedLenses(){
    root.querySelectorAll('.restorationArtwork').forEach(target=>{
      const lens=target.querySelector('.restorationLens');
      const img=target.querySelector('img');
      const x=target.clientWidth*state.focus.x/100;
      const y=target.clientHeight*state.focus.y/100;
      lens.style.left=`${state.focus.x}%`;lens.style.top=`${state.focus.y}%`;
      lens.style.backgroundImage=`url("${img.src}")`;
      lens.style.backgroundSize=`${target.clientWidth*2.7}px ${target.clientHeight*2.7}px`;
      lens.style.backgroundPosition=`${64-x*2.7}px ${64-y*2.7}px`;
      lens.style.filter=img===elements.damaged?filterValue():'none';
      lens.classList.add('visible','pinned');
    });
  }
  function togglePinnedLens(event){
    if(!state.loupe)return;
    if(state.focus.pinned){state.focus.pinned=false;hideLenses();return;}
    moveLenses(event);
    state.focus.pinned=true;
    placePinnedLenses();
  }
  function hideLenses(){if(state.focus.pinned)return;root.querySelectorAll('.restorationLens').forEach(lens=>lens.classList.remove('visible','pinned'));}
  function start(){
    if(!state.started){
      state.started=true;
      const next=PAINTINGS.findIndex(painting=>!completed[painting.id]);
      state.painting=next<0?0:next;
      renderSelect();newDamage();renderPainting();
    }else{renderSelect();renderLive();}
  }

  [['hue','hue'],['sat','sat'],['light','light']].forEach(([element,key])=>elements[element].addEventListener('input',event=>{state[key]=Number(event.target.value);state.checked=false;renderLive();}));
  elements.select.addEventListener('change',event=>{state.painting=Number(event.target.value)||0;newDamage();renderPainting();});
  elements.newDamage.addEventListener('click',newDamage);
  elements.check.addEventListener('click',checkRestoration);
  elements.loupe.addEventListener('click',()=>{state.loupe=!state.loupe;if(!state.loupe)state.focus.pinned=false;hideLenses();syncLenses();});
  root.querySelectorAll('.restorationArtwork').forEach(area=>{area.addEventListener('pointermove',moveLenses);area.addEventListener('pointerleave',hideLenses);area.addEventListener('click',togglePinnedLens);});

  window.KeynlockRestoration=Object.freeze({start,paintings:PAINTINGS});
})();
