(function(){
  'use strict';

  const STORAGE_KEY='keynlockRestoredPaintings';
  const TARGET_SCORE=window.KeynlockContent.restoration.targetScore;
  const PAINTINGS=window.KeynlockContent.paintings;
  const DAMAGE=Object.freeze({hue:[-44,-38,-31,-25,24,29,36,43],sat:[.62,.70,.78,1.22,1.30,1.38],light:[.74,.82,.88,1.12,1.20,1.28]});
  const TEXTURES=Object.freeze({
    dirt:['mask_dirt_light_dust.png','mask_dirt_heavy_dust.png','mask_dirt_soot.png','mask_dirt_streaks.png','mask_old_varnish.png'].map(name=>`assets/restoration/masks/${name}`),
    loss:['mask_loss_small_chip.png','mask_loss_large_area.png','mask_loss_abrasion.png','mask_loss_scratch.png'].map(name=>`assets/restoration/masks/${name}`),
    uv:['uv_old_restoration.png','uv_modern_paint.png','uv_false_signature.png','uv_replaced_fragment.png','uv_chemical_stain.png'].map(name=>`assets/restoration/uv/${name}`)
  });
  const textureCache=new Map();
  const root=document.querySelector('#restorationRoot');
  if(!root)return;

  const elements={
    orderButton:root.querySelector('#restorationOrderButton'),orderName:root.querySelector('#restorationOrderName'),orderArtist:root.querySelector('#restorationOrderArtist'),orderGrid:root.querySelector('#restorationOrderGrid'),
    original:root.querySelector('#restorationOriginal'),damaged:root.querySelector('#restorationDamaged'),
    hue:root.querySelector('#restorationHue'),sat:root.querySelector('#restorationSat'),light:root.querySelector('#restorationLight'),
    hueValue:root.querySelector('#restorationHueValue'),satValue:root.querySelector('#restorationSatValue'),lightValue:root.querySelector('#restorationLightValue'),
    loupe:document.querySelector('#restorationLoupeButton'),newDamage:root.querySelector('#restorationNewDamage'),check:root.querySelector('#restorationCheck'),
    score:root.querySelector('#restorationScore'),hint:root.querySelector('#restorationHint'),reward:root.querySelector('#restorationReward'),lightMatch:root.querySelector('#restorationLightMatch'),cleanliness:root.querySelector('#restorationCleanliness'),
    damagedArea:root.querySelector('[data-restoration-art="damaged"]'),dirt:root.querySelector('#restorationDirtSurface'),repair:root.querySelector('#restorationRepairSurface'),overpaint:root.querySelector('#restorationOverpaintSurface'),uv:root.querySelector('#restorationUvSurface'),scan:root.querySelector('#restorationScanSurface'),activeTool:root.querySelector('#restorationActiveTool'),toolEffect:root.querySelector('#restorationToolEffect'),drawer:document.querySelector('#restorationInventoryDrawer'),drawerToggle:document.querySelector('#restorationInventoryToggle'),tools:[...document.querySelectorAll('#restorationInventoryDrawer [data-restoration-tool]')]
  };
  let completed={};
  completed=STORE.getJSON(STORAGE_KEY,{})||{};
  function ownedPaintingIds(){
    try{
      const ids=STORE.getJSON('keynlockOwnedPaintings',[]);
      return new Set(Array.isArray(ids)?ids:[]);
    }catch(_){return new Set();}
  }
  const state={painting:0,hue:0,sat:100,light:100,damage:{hue:34,sat:.72,light:1.18},tool:'loupe',loupe:true,working:false,toolActing:false,lastPoint:null,lastMetricAt:0,damageReady:false,initialDirt:1,initialContamination:1,layerRefresh:0,layerImages:{dirt:'',repair:'',overpaint:'',scan:''},checked:false,started:false,focus:{x:50,y:50,pinned:false}};
  function restorationItemAt(x,y){
    let nearest=null;
    elements.tools.filter(item=>!item.disabled).forEach(item=>{
      const rect=item.getBoundingClientRect(),isUv=item.dataset.restorationTool==='uv';
      const top=rect.top-(isUv?Math.max(55,rect.height*.8):0),side=isUv?Math.max(12,rect.width*.35):0;
      if(x<rect.left-side||x>rect.right+side||y<top||y>rect.bottom)return;
      const distance=(x-(rect.left+rect.right)/2)**2+(y-(top+rect.bottom)/2)**2;
      if(!nearest||distance<nearest.distance)nearest={item,distance};
    });
    return nearest?.item||null;
  }
  const drawerController=window.KeynlockEquipmentDrawers?.create({root:'#restorationInventoryDrawer',toggle:'#restorationInventoryToggle',bodyClass:'restoration-inventory-open',openLabel:'Открыть инвентарь реставратора',closeLabel:'Закрыть инвентарь реставратора',approachVar:'--equipment-approach',approachLift:42,approachDepth:90,itemSelector:'.equipmentInventoryItem:not(:disabled)',routeVisualItems:true,hitTest:restorationItemAt,ignoreApproach:event=>Boolean(event.target.closest?.('.restorationArtwork,.restorationSliders'))});
  const TOOL_IMAGES={
    brush:{idle:'assets/restoration/tools/brush.png',active:'assets/restoration/tools/brush-active.png'},
    paint:{idle:'assets/restoration/tools/retouch-brush.png',active:'assets/restoration/tools/retouch-brush-active.png'},
    uv:{idle:'assets/restoration/tools/uv-lamp.png',active:'assets/restoration/tools/uv-lamp-active.png'},
    reagent:{idle:'assets/restoration/tools/dropper.png',active:'assets/restoration/tools/dropper-active.png'}
  };
  const pick=array=>array[Math.floor(Math.random()*array.length)];
  const current=()=>PAINTINGS[state.painting];
  const JAPANESE_IDS=new Set(window.KeynlockContent.restoration.japaneseIds);
  const categoryOf=painting=>painting.category||(JAPANESE_IDS.has(painting.id)?'japan':(['mona-lisa','birth-venus'].includes(painting.id)?'renaissance':(['girl-pearl','las-meninas'].includes(painting.id)?'baroque':(['sunflowers','starry-night','impression-sunrise'].includes(painting.id)?'impressionism':'modern'))));
  const PAINTING_DISTRICTS=window.KeynlockContent.restoration.categoryDistricts;
  const districtOf=painting=>{
    const categoryDistrict=PAINTING_DISTRICTS[categoryOf(painting)]||'arts';
    if(categoryDistrict==='port') return 'port';
    const bucket=[...painting.id].reduce((sum,character)=>sum+character.charCodeAt(0),0)%11;
    if(bucket===0) return 'palace';
    if(bucket===1) return 'old';
    return categoryDistrict;
  };
  PAINTINGS.forEach(painting=>{painting.district=districtOf(painting);});
  function yearStart(year){
    const numeric=year.match(/\d{3,4}/);
    if(numeric)return Number(numeric[0]);
    const roman=year.match(/[IVXLCDM]+/);
    if(!roman)return Number.MAX_SAFE_INTEGER;
    const values={I:1,V:5,X:10,L:50,C:100,D:500,M:1000};let total=0,previous=0;
    [...roman[0]].reverse().forEach(character=>{const value=values[character];if(value<previous)total-=value;else{total+=value;previous=value;}});
    return Math.max(0,(total-1)*100);
  }
  const ORDER_CATEGORIES=window.KeynlockContent.restoration.orderCategories;
  let orderCategory='all';

  function filterValue(){
    return `hue-rotate(${state.damage.hue+state.hue}deg) saturate(${(state.damage.sat*state.sat/100).toFixed(4)}) brightness(${(state.damage.light*state.light/100).toFixed(4)})`;
  }
  function score(){
    const hueScore=Math.max(0,1-Math.abs(state.damage.hue+state.hue)/60);
    const satScore=Math.max(0,1-Math.abs(state.damage.sat*state.sat/100-1)/.6);
    const lightScore=Math.max(0,1-Math.abs(state.damage.light*state.light/100-1)/.5);
    return Math.max(0,Math.min(100,Math.round((hueScore*.38+satScore*.31+lightScore*.31)*100)));
  }
  function alphaTotal(canvas){
    const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let total=0;
    for(let i=3;i<data.length;i+=16)total+=data[i];
    return total;
  }
  function contamination(){return alphaTotal(elements.dirt)+alphaTotal(elements.uv)+alphaTotal(elements.overpaint);}
  function cleanliness(){return Math.max(0,Math.min(100,Math.round((1-contamination()/Math.max(1,state.initialContamination))*100)));}
  function dirtCleanliness(){return Math.max(0,Math.min(100,Math.round((1-alphaTotal(elements.dirt)/Math.max(1,state.initialDirt))*100)));}
  function dirtReady(){return state.damageReady&&dirtCleanliness()>=99;}
  function uvSearchComplete(){const hidden=alphaTotal(elements.uv);return hidden<25||alphaTotal(elements.scan)>=hidden*.96;}
  function renderMetrics(){
    elements.lightMatch.textContent=`${score()}%`;elements.cleanliness.textContent=`${cleanliness()}%`;
    root.classList.toggle('show-check-result',state.checked);
    const ready=dirtReady();
    elements.tools.forEach(button=>{if(['paint','uv','reagent'].includes(button.dataset.restorationTool))button.disabled=!ready;});
  }
  function resetControls(){
    state.hue=0;state.sat=100;state.light=100;state.checked=false;
    elements.hue.value='0';elements.sat.value='100';elements.light.value='100';
  }
  function newDamage(){
    state.damage={hue:pick(DAMAGE.hue),sat:pick(DAMAGE.sat),light:pick(DAMAGE.light)};
    state.focus.pinned=false;state.lastPoint=null;state.damageReady=false;
    hideLenses();
    resetControls();
    renderLive();
    requestAnimationFrame(initDamageSurfaces);
  }
  function renderOrders(){
    const selected=current();
    const owned=ownedPaintingIds();
    elements.orderName.textContent=`${selected.title} (${selected.year})`;
    elements.orderArtist.textContent=selected.artist;
    const categories=`<nav class="restorationOrderCategories" aria-label="Категории картин">${ORDER_CATEGORIES.map(([id,label])=>`<button type="button" data-order-category="${id}" class="${id===orderCategory?'active':''}">${label}</button>`).join('')}</nav>`;
    const filtered=PAINTINGS.map((painting,index)=>({painting,index})).filter(({painting})=>orderCategory==='all'||categoryOf(painting)===orderCategory).sort((a,b)=>orderCategory==='all'?a.index-b.index:yearStart(a.painting.year)-yearStart(b.painting.year)||a.painting.title.localeCompare(b.painting.title,'ru'));
    const orderColumns=window.innerWidth<=680?3:(window.innerWidth<=900?4:5);
    const skeletonCount=orderCategory==='all'?0:Math.max(0,orderColumns*3-filtered.length);
    const skeletons=Array.from({length:skeletonCount},()=>'<div class="restorationOrderCard restorationOrderSkeleton" aria-hidden="true"><i></i><span></span><small></small></div>').join('');
    elements.orderGrid.innerHTML=categories+filtered.map(({painting,index})=>`
      <button class="restorationOrderCard${index===state.painting?' active':''}" type="button" data-painting="${index}" data-district="${painting.district}" style="--district-color:${DISTRICTS[painting.district].hex}" aria-label="${painting.title}, ${painting.artist}; ${DISTRICTS[painting.district].name}">
        <img src="${painting.image}" alt="">
        ${owned.has(painting.id)?`<i class="restorationOrderStatus restorationOrderFound" title="Найдена в миссии" aria-label="Найдена в миссии">${tablerIcon('eye',14)}</i>`:''}
        ${completed[painting.id]?`<i class="restorationOrderStatus restorationOrderCompleted" title="Отреставрирована" aria-label="Отреставрирована">${tablerIcon('check',14)}</i>`:''}
        <span>${painting.title} (${painting.year})</span>
        <small>${painting.artist}</small>
      </button>`).join('')+skeletons;
  }
  function closeOrders(){
    elements.orderGrid.hidden=true;
    elements.orderButton.setAttribute('aria-expanded','false');
  }
  function showOriginalActionDenied(){
    const originalArea=elements.original.closest('[data-restoration-art="original"]');
    originalArea.classList.remove('action-denied');
    void originalArea.offsetWidth;
    originalArea.classList.add('action-denied');
    clearTimeout(showOriginalActionDenied.timer);
    showOriginalActionDenied.timer=setTimeout(()=>originalArea.classList.remove('action-denied'),360);
  }
  function renderPainting(){
    const painting=current();
    const applyRatio=()=>{
      if(!elements.original.naturalWidth||!elements.original.naturalHeight)return;
      const ratio=Math.max(.55,Math.min(2.8,elements.original.naturalWidth/elements.original.naturalHeight));
      root.dataset.orientation=ratio<.86?'portrait':ratio>1.18?'landscape':'square';
      root.style.setProperty('--painting-ratio',String(ratio));
      sizePaintings();
      requestAnimationFrame(initDamageSurfaces);
      if(state.focus.pinned)placePinnedLenses();
    };
    elements.original.addEventListener('load',applyRatio,{once:true});
    elements.original.src=painting.image;
    elements.damaged.src=painting.image;
    elements.original.alt=`${painting.artist}, «${painting.title}», ${painting.year}`;
    elements.damaged.alt=`Повреждённая версия: ${painting.artist}, «${painting.title}»`;
    if(elements.original.complete)applyRatio();
    renderLive();
  }
  function sizePaintings(){
    const ratio=Number.parseFloat(getComputedStyle(root).getPropertyValue('--painting-ratio'))||1.35;
    const workspace=root.querySelector('.restorationWorkspace');
    const controls=root.querySelector('.restorationControls');
    const gap=7;
    const columnWidth=Math.max(180,(root.clientWidth-gap)/2-16);
    const availableHeight=Math.max(180,root.clientHeight-(controls?.offsetHeight||112)-gap-38);
    const heightBudget=root.dataset.orientation==='portrait'?availableHeight*.9:availableHeight;
    const width=Math.floor(Math.min(columnWidth,heightBudget*ratio));
    workspace.style.setProperty('--painting-width',`${width}px`);
    root.style.setProperty('--composition-width',`${Math.min(root.clientWidth,width*2+35)}px`);
  }
  function prepareCanvas(canvas){
    const width=Math.max(1,Math.round(elements.damagedArea.clientWidth));
    const height=Math.max(1,Math.round(elements.damagedArea.clientHeight));
    canvas.width=width;canvas.height=height;
    return canvas.getContext('2d');
  }
  function refreshLayerImages(){
    if(state.layerRefresh)return;
    state.layerRefresh=requestAnimationFrame(()=>{
      state.layerRefresh=0;
      state.layerImages={dirt:elements.dirt.toDataURL(),repair:elements.repair.toDataURL(),overpaint:elements.overpaint.toDataURL(),scan:elements.scan.toDataURL()};
      if(state.focus.pinned)placePinnedLenses();
    });
  }
  function loadTexture(src){
    if(!textureCache.has(src))textureCache.set(src,new Promise(resolve=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>resolve(null);image.src=src;}));
    return textureCache.get(src);
  }
  async function stampTextures(ctx,sources,count,w,h,minScale,maxScale){
    const images=(await Promise.all(sources.map(loadTexture))).filter(Boolean);
    for(let i=0;i<count&&images.length;i++){
      const image=pick(images),scale=minScale+Math.random()*(maxScale-minScale);
      const drawW=w*scale,drawH=drawW*image.naturalHeight/image.naturalWidth;
      const x=Math.random()*w,y=Math.random()*h;
      ctx.save();ctx.translate(x,y);ctx.rotate((Math.random()-.5)*1.4);ctx.globalAlpha=.72+Math.random()*.25;ctx.drawImage(image,-drawW/2,-drawH/2,drawW,drawH);ctx.restore();
    }
  }
  async function initDamageSurfaces(){
    if(!elements.damagedArea.clientWidth)return;
    const dirt=prepareCanvas(elements.dirt),repair=prepareCanvas(elements.repair),overpaint=prepareCanvas(elements.overpaint),uv=prepareCanvas(elements.uv),scan=prepareCanvas(elements.scan);
    const w=elements.dirt.width,h=elements.dirt.height;
    await Promise.all([stampTextures(dirt,TEXTURES.dirt,8,w,h,.09,.2),stampTextures(repair,TEXTURES.loss,4,w,h,.055,.13),stampTextures(uv,TEXTURES.uv,5,w,h,.05,.1)]);
    overpaint.clearRect(0,0,w,h);scan.clearRect(0,0,w,h);
    state.initialDirt=Math.max(1,alphaTotal(elements.dirt));state.initialContamination=Math.max(1,contamination());state.damageReady=true;refreshLayerImages();renderMetrics();
  }
  function canvasPoint(event){
    const rect=elements.damagedArea.getBoundingClientRect();
    return {x:(event.clientX-rect.left)/rect.width*elements.dirt.width,y:(event.clientY-rect.top)/rect.height*elements.dirt.height};
  }
  function softEraseAt(canvas,point,radius){
    const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(point.x,point.y,0,point.x,point.y,radius);
    gradient.addColorStop(0,'rgba(0,0,0,.9)');gradient.addColorStop(.62,'rgba(0,0,0,.58)');gradient.addColorStop(1,'rgba(0,0,0,0)');
    ctx.save();ctx.globalCompositeOperation='destination-out';ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(point.x,point.y,radius,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  function softStroke(canvas,from,to,radius){
    const distance=Math.hypot(to.x-from.x,to.y-from.y),steps=Math.max(1,Math.ceil(distance/(radius*.22)));
    for(let i=0;i<=steps;i++)softEraseAt(canvas,{x:from.x+(to.x-from.x)*i/steps,y:from.y+(to.y-from.y)*i/steps},radius);
  }
  function useActiveTool(event){
    if(event.currentTarget!==elements.damagedArea)return;
    const point=canvasPoint(event),from=state.lastPoint||point;
    state.checked=false;
    if(state.tool==='brush'){
      softStroke(elements.dirt,from,point,28);softStroke(elements.overpaint,from,point,28);
      elements.hint.textContent=dirtCleanliness()<99?'Продолжай очищать видимую грязь по всему полотну.':(alphaTotal(elements.overpaint)>25?'Видимая грязь удалена. Теперь счисти участки, проявленные реагентом.':'Очистка завершена. Можно перейти к УФ-диагностике или восстановлению утрат.');
    }
    if(state.tool==='paint')softStroke(elements.repair,from,point,20);
    state.lastPoint=point;
    if(performance.now()-state.lastMetricAt>120){state.lastMetricAt=performance.now();renderMetrics();}
  }
  function selectTool(tool){
    if(state.tool===tool){
      state.tool='';state.loupe=false;state.working=false;state.toolActing=false;state.lastPoint=null;state.focus.pinned=false;root.dataset.activeTool='';
      root.classList.remove('original-tool-blocked');
      elements.tools.forEach(button=>button.classList.remove('active'));
      elements.damagedArea.classList.remove('tool-brush','tool-paint','tool-uv','tool-reagent','working');
      hideLenses();updateToolVisual();elements.hint.textContent='Инструмент убран. Выбери следующий этап работы.';return;
    }
    if(['paint','uv','reagent'].includes(tool)&&!dirtReady()){elements.hint.textContent='Сначала полностью очисти картину щёткой.';return;}
    state.tool=tool;state.loupe=tool==='loupe';state.working=false;state.toolActing=false;state.lastPoint=null;root.dataset.activeTool=tool;
    if(state.loupe)root.classList.remove('original-tool-blocked');
    elements.tools.forEach(button=>button.classList.toggle('active',button.dataset.restorationTool===tool));
    elements.damagedArea.classList.remove('tool-brush','tool-paint','tool-uv','tool-reagent','working');
    elements.damagedArea.classList.add(`tool-${tool}`);
    if(!state.loupe){state.focus.pinned=false;hideLenses();}
    syncLenses();
    const hasScan=alphaTotal(elements.scan)>25;
    const hints={loupe:'Изучи детали и закрепи лупу кликом.',brush:dirtCleanliness()<99?'Сначала очисти полотно от видимой грязи.':'Удаляй щёткой только уже проявленные реагентом вмешательства.',paint:'Проводи кончиком кисти по тёмным утраченным участкам.',uv:uvSearchComplete()?'Все скрытые следы уже обнаружены. Теперь используй реагент.':'Медленно освети всё полотно, чтобы обнаружить скрытые вмешательства.',reagent:hasScan?'Наноси реагент только на участки, уже обнаруженные УФ-светом.':'Сначала исследуй полотно УФ-фонарём — проявленных участков пока нет.'};
    elements.hint.textContent=hints[tool];
  }
  function setDrawerOpen(force){
    drawerController?.setOpen(force);
  }
  function updateToolVisual(){
    const images=TOOL_IMAGES[state.tool];
    if(!images){elements.activeTool.classList.remove('visible','acting');elements.toolEffect.classList.remove('visible');return;}
    const active=state.toolActing||state.tool==='uv';
    elements.activeTool.src=active?images.active:images.idle;elements.activeTool.classList.toggle('acting',active);
    if(state.tool==='uv'){elements.toolEffect.src='assets/restoration/effects/effect_uv_spot.png';elements.toolEffect.classList.add('visible');}
    else if(state.tool==='brush'&&state.toolActing){elements.toolEffect.src='assets/restoration/effects/effect_brush_dust.png';elements.toolEffect.classList.add('visible');}
    else elements.toolEffect.classList.remove('visible');
  }
  function setToolActing(active){state.toolActing=active;updateToolVisual();}
  function moveActiveTool(event){
    if(!TOOL_IMAGES[state.tool]){elements.activeTool.classList.remove('visible');elements.toolEffect.classList.remove('visible');return;}
    const rect=elements.damagedArea.getBoundingClientRect();
    const left=`${event.clientX-rect.left}px`,top=`${event.clientY-rect.top}px`;
    elements.activeTool.style.left=left;elements.activeTool.style.top=top;elements.toolEffect.style.left=left;elements.toolEffect.style.top=top;elements.activeTool.classList.add('visible');updateToolVisual();
  }
  function scanUltraviolet(event){
    if(state.tool!=='uv'||event.currentTarget!==elements.damagedArea)return;
    const {x,y}=canvasPoint(event),radius=64,target=elements.scan.getContext('2d');
    elements.damagedArea.style.setProperty('--scan-x',`${x/elements.scan.width*100}%`);elements.damagedArea.style.setProperty('--scan-y',`${y/elements.scan.height*100}%`);
    target.save();target.beginPath();target.arc(x,y,radius,0,Math.PI*2);target.clip();target.drawImage(elements.uv,0,0);target.restore();
    if(performance.now()-state.lastMetricAt>180){state.lastMetricAt=performance.now();elements.hint.textContent=uvSearchComplete()?'Все скрытые следы обнаружены. Выбери реагент и прояви подсвеченные участки.':'Продолжай вести УФ-фонарём по неисследованным участкам полотна.';}
  }
  function applyDiagnosticReagent(event){
    if(state.tool!=='reagent'||event.currentTarget!==elements.damagedArea)return;
    const {x,y}=canvasPoint(event),pixel=elements.scan.getContext('2d').getImageData(Math.round(x),Math.round(y),1,1).data;
    if(pixel[3]<=25){elements.hint.textContent=alphaTotal(elements.scan)>25?'На этом участке нет УФ-следа. Выбери видимое подсвеченное пятно.':'Сначала найди скрытые пятна УФ-фонарём — реагент пока наносить не на что.';return;}
    state.checked=false;setToolActing(true);setTimeout(()=>{if(state.tool==='reagent')setToolActing(false);},260);
    const radius=46,source=elements.uv.getContext('2d'),scan=elements.scan.getContext('2d'),target=elements.overpaint.getContext('2d');
    target.save();target.beginPath();target.arc(x,y,radius,0,Math.PI*2);target.clip();target.drawImage(elements.uv,0,0);target.restore();
    source.save();source.globalCompositeOperation='destination-out';source.beginPath();source.arc(x,y,radius,0,Math.PI*2);source.fill();source.restore();
    scan.save();scan.globalCompositeOperation='destination-out';scan.beginPath();scan.arc(x,y,radius,0,Math.PI*2);scan.fill();scan.restore();
    const reaction=document.createElement('img');
    reaction.className='restorationReaction';reaction.alt='';reaction.src=`assets/restoration/reactions/reaction_${pick(['red','green','violet'])}.png`;
    reaction.style.left=`${x/elements.uv.width*100}%`;reaction.style.top=`${y/elements.uv.height*100}%`;
    elements.damagedArea.append(reaction);setTimeout(()=>reaction.remove(),1400);
    refreshLayerImages();renderMetrics();
    elements.hint.textContent=alphaTotal(elements.scan)>25?'Пятно проявлено. Отметь оставшиеся подсвеченные участки.':'Все найденные пятна проявлены. Теперь выбери щётку и очисти их.';
  }
  function renderLive(){
    elements.damaged.style.filter=filterValue();
    [elements.hue,elements.sat,elements.light].forEach(input=>input.style.setProperty('--range-progress',`${(Number(input.value)-Number(input.min))/(Number(input.max)-Number(input.min))*100}%`));
    elements.hueValue.textContent=String(state.hue);
    elements.satValue.textContent=`${state.sat}%`;
    elements.lightValue.textContent=`${state.light}%`;
    renderMetrics();
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
    const clean=cleanliness();
    state.checked=true;
    renderMetrics();
    const success=value>=TARGET_SCORE&&clean>=100;
    elements.score.textContent=`${value}%`;
    elements.score.classList.toggle('good',success);
    if(!success){
      elements.hint.textContent=value<TARGET_SCORE&&clean<100?'Нужно точнее подобрать цвет и полностью очистить картину.':(value<TARGET_SCORE?'Цвет всё ещё отличается от оригинала.':`Очистка не завершена: ${clean}%. Удали все видимые и проявленные загрязнения.`);
      elements.reward.hidden=true;return;
    }
    const painting=current();
    if(completed[painting.id]){
      elements.hint.textContent='Картина уже была восстановлена. Это тренировочная попытка.';
      elements.reward.hidden=true;
      return;
    }
    completed[painting.id]={score:value,completedAt:new Date().toISOString()};
    STORE.setJSON(STORAGE_KEY,completed);
    const result=window.KeynlockResources?.awardRestoration?.({coins:50,componentCount:2,preferredColors:painting.colors})||{coins:50,components:{}};
    elements.hint.textContent='Картина восстановлена и возвращена заказчику.';
    elements.reward.innerHTML=rewardMarkup(result);
    elements.reward.hidden=false;
    renderOrders();
  }
  function syncLenses(){
    root.querySelectorAll('.restorationLens').forEach(lens=>lens.classList.toggle('enabled',state.loupe));
    elements.loupe.classList.toggle('active',state.loupe);
    if(state.loupe&&state.focus.pinned)placePinnedLenses();
  }
  function setFocusFromEvent(event){
    const area=event.currentTarget;
    const rect=area.getBoundingClientRect();
    const x=Math.max(0,Math.min(rect.width,event.clientX-rect.left));
    const y=Math.max(0,Math.min(rect.height,event.clientY-rect.top));
    state.focus.x=x/rect.width*100;
    state.focus.y=y/rect.height*100;
  }
  function moveLenses(event){
    if(!state.loupe||state.focus.pinned)return;
    setFocusFromEvent(event);
    placeLenses(false);
  }
  function placeLenses(pinned){
    root.querySelectorAll('.restorationArtwork').forEach(target=>{
      const lens=target.querySelector('.restorationLens');
      const lensImage=lens.querySelector('i');
      const img=target.querySelector('img');
      const x=target.clientWidth*state.focus.x/100;
      const y=target.clientHeight*state.focus.y/100;
      lens.style.left=`${state.focus.x}%`;
      lens.style.top=`${state.focus.y}%`;
      const overlays=img===elements.damaged?[...(['uv','reagent'].includes(state.tool)?[state.layerImages.scan]:[]),state.layerImages.overpaint,state.layerImages.repair,state.layerImages.dirt].filter(Boolean):[];
      const size=`${target.clientWidth*2.7}px ${target.clientHeight*2.7}px`;
      const position=`${64-x*2.7}px ${64-y*2.7}px`;
      lensImage.style.setProperty('--lens-base',`url("${img.src}")`);
      lensImage.style.setProperty('--lens-base-filter',img===elements.damaged?filterValue():'none');
      lensImage.style.setProperty('--lens-overlays',overlays.length?overlays.map(src=>`url("${src}")`).join(','):'none');
      lensImage.style.setProperty('--lens-size',overlays.length?overlays.map(()=>size).join(','):size);
      lensImage.style.setProperty('--lens-position',overlays.length?overlays.map(()=>position).join(','):position);
      lens.classList.add('visible');
      lens.classList.toggle('pinned',pinned);
    });
  }
  function placePinnedLenses(){
    placeLenses(true);
  }
  function togglePinnedLens(event){
    if(!state.loupe)return;
    if(state.focus.pinned){state.focus.pinned=false;hideLenses();return;}
    setFocusFromEvent(event);
    state.focus.pinned=true;
    placePinnedLenses();
  }
  function hideLenses(){if(state.focus.pinned)return;root.querySelectorAll('.restorationLens').forEach(lens=>lens.classList.remove('visible','pinned'));}
  function start(){
    setDrawerOpen(false);
    state.started=true;
    const previous=state.painting;
    state.painting=PAINTINGS.length>1?(previous+1+Math.floor(Math.random()*(PAINTINGS.length-1)))%PAINTINGS.length:0;
    closeOrders();renderOrders();newDamage();renderPainting();
    requestAnimationFrame(sizePaintings);
  }

  [['hue','hue'],['sat','sat'],['light','light']].forEach(([element,key])=>elements[element].addEventListener('input',event=>{state[key]=Number(event.target.value);state.checked=false;renderLive();}));
  elements.orderButton.addEventListener('click',()=>{const open=elements.orderGrid.hidden;elements.orderGrid.hidden=!open;elements.orderButton.setAttribute('aria-expanded',String(open));});
  elements.orderGrid.addEventListener('click',event=>{const category=event.target.closest('[data-order-category]');if(category){orderCategory=category.dataset.orderCategory;renderOrders();return;}const card=event.target.closest('[data-painting]');if(!card)return;state.painting=Number(card.dataset.painting)||0;closeOrders();newDamage();renderPainting();renderOrders();});
  elements.newDamage.addEventListener('click',newDamage);
  elements.check.addEventListener('click',checkRestoration);
  elements.tools.forEach(button=>button.addEventListener('click',()=>selectTool(button.dataset.restorationTool)));
  root.querySelectorAll('.restorationArtwork').forEach(area=>{area.addEventListener('pointerenter',event=>{root.classList.toggle('original-tool-blocked',area.dataset.restorationArt==='original'&&Boolean(state.tool)&&state.tool!=='loupe');moveLenses(event);moveActiveTool(event);});area.addEventListener('pointermove',event=>{moveLenses(event);scanUltraviolet(event);if(state.working)useActiveTool(event);});area.addEventListener('pointerleave',()=>{root.classList.remove('original-tool-blocked');hideLenses();state.working=false;state.toolActing=false;state.lastPoint=null;elements.damagedArea.classList.remove('working');});area.addEventListener('click',event=>{if(area.dataset.restorationArt==='original'&&state.tool&&state.tool!=='loupe'){showOriginalActionDenied();return;}togglePinnedLens(event);applyDiagnosticReagent(event);});});
  elements.damagedArea.addEventListener('pointerdown',event=>{if(!['brush','paint'].includes(state.tool))return;state.working=true;state.lastPoint=null;setToolActing(true);elements.damagedArea.classList.add('working');elements.damagedArea.setPointerCapture?.(event.pointerId);useActiveTool(event);});
  const finishStroke=()=>{state.working=false;state.lastPoint=null;setToolActing(false);elements.damagedArea.classList.remove('working');refreshLayerImages();renderMetrics();};
  elements.damagedArea.addEventListener('pointerup',finishStroke);elements.damagedArea.addEventListener('pointercancel',finishStroke);
  document.addEventListener('pointermove',event=>{if(root.closest('.lairPanel')?.classList.contains('active'))moveActiveTool(event);},{passive:true});
  document.addEventListener('pointerdown',event=>{if(elements.orderGrid.hidden||event.target.closest('#restorationOrderGrid,#restorationOrderButton'))return;closeOrders();});
  window.addEventListener('resize',()=>{sizePaintings();if(!elements.orderGrid.hidden)renderOrders();});

  window.KeynlockRestoration=Object.freeze({start,paintings:PAINTINGS});
})();
