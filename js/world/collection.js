// Handle collections, mission discovery, and the player’s case loadout.
(function(){
  // Every handle gets its own numbered shaft (sting_01..08, matched to the
  // handle's position within its collection) rather than all sharing one
  // fixed shaft — building that list inline per collection would repeat the
  // same eight paths four times over, so it's generated once here instead.
  function shaftFor(index){ return `assets/picks/shafts/sting_0${index + 1}.png`; }
  function buildHandles(idPrefix, folder, filePrefix, unlockedFlags){
    return unlockedFlags.map((unlocked, i) => {
      const n = String(i + 1).padStart(2, '0');
      return { id: `${idPrefix}-${n}`, image: `assets/picks/handles/${folder}/${filePrefix}_${n}.png`, shaft: shaftFor(i), unlocked };
    });
  }
  // Shown in the third column of the Коллекция screen — what each set is
  // going for and why its handles look the way they do. Collection-level
  // only (not per-handle): six short write-ups, not forty-eight.
  const PICK_COLLECTIONS = [
    { id:'japan-wood', name:'Japan Wood', description:
      `<p>Голое дерево, без единого мазка краски — резьба сама несёт узор: волна, ракушка, дракон, ирис.
      Каждая рукоять — отдельный японский мотив, вырезанный прямо по волокну, а не нанесённый поверх него.</p>
      <p>Это набор для тех, кто ценит инструмент, а не украшение: материал остаётся видимым материалом,
      мастерство — в глубине резьбы, а не в лаке и позолоте.</p>`,
      handles: buildHandles('japan-wood', 'japan-wood', 'japan_wood',
      [true, true, true, true, true, true, true, true]) },
    { id:'japan', name:'Japan', description:
      `<p>Классические образы укиё-э, перенесённые на рукоять: журавль, карп, бамбук, гора Фудзи, ветка сакуры,
      дракон, гейша с веером, хризантема. Каждый — устойчивый символ японской культуры: удача и долголетие,
      упорство и стойкость к течению, стойкость характера, священная вершина, скоротечность красоты, сила и защита,
      изящество и статус, благородство.</p>
      <p>Собранные вместе, они складываются в маленькую антологию образов, которыми принято описывать саму Японию —
      носить такую рукоять означает нести с собой один из этих символов.</p>`,
      handles: buildHandles('japan', 'japan', 'japan_big_art',
      [true, true, true, true, true, true, true, false]) },
    { id:'decodance', name:'Decodance Black', description:
      `<p>Чёрный лак и золотая линия — эстетика ар-деко 1920–30-х, наложенная на те же японские мотивы (журавль,
      сосна, сакура, веер), но прочерченная геометрией, а не кистью укиё-э. Тёмный фон превращает узор в блеск
      витрины ночного города, а не в страницу гравюры.</p>
      <p>Это Япония, увиденная сквозь стекло дорогого отеля межвоенной эпохи: те же символы, но заново
      огранённые под роскошь и полумрак.</p>`,
      handles: buildHandles('decodance', 'decodance', 'decodance_black',
      [true, true, true, true, false, true, true, true]) },
    { id:'decodance-white', name:'Decodance White', description:
      `<p>Тот же ар-деко словарь, что и в чёрной версии коллекции, но на светлом, слоновой кости лаке — острая
      геометрия смягчается, золото и металл читаются тоньше, драгоценнее. Там, где чёрная версия — блеск ночного
      клуба, белая — утренний свет и фарфор.</p>
      <p>Пара к Decodance Black: один и тот же стиль, показанный с двух разных сторон суток.</p>`,
      handles: buildHandles('decodance-white', 'decodance-white', 'decodance_white',
      [true, true, true, true, true, true, true, true]) },
    { id:'japan-classic-white', name:'Japan Classic White', description:
      `<p>Светлое лаковое покрытие в духе традиционной японской посуды — сдержанные, почти монохромные узоры,
      без ярких акцентов основного набора «Japan». Здесь важна не картинка, а сама поверхность: гладкий белый лак,
      как на старом фарфоре или в чайном доме.</p>
      <p>Минимализм вместо иллюстрации — рукоять, которая не рассказывает историю, а просто хорошо сделана.</p>`,
      handles: buildHandles('japan-classic-white', 'japan-classic-white', 'japan_classic_white',
      [true, true, true, true, true, true, true, true]) },
    { id:'japan-classic-black', name:'Japan Classic Black', description:
      `<p>Чёрный близнец «Japan Classic White» — тот же сдержанный, почти монохромный лак, но в цвете
      традиционной чёрной лаковой утвари. Строгость вместо орнамента: рукоять как предмет обихода мастера,
      а не витрина с символами.</p>
      <p>Две классические версии рядом дают выбор между светлым и тёмным лаком одного и того же спокойного стиля.</p>`,
      handles: buildHandles('japan-classic-black', 'japan-classic-black', 'japan_classic_black',
      [true, true, true, true, true, true, true, true]) }
  ];

  // Unlock overrides live in storage separately from the hard-coded
  // defaults above, so a future economy pass can flip individual ids
  // without touching this file.
  const UNLOCKED_KEY = 'keynlockUnlockedHandles';
  let unlockedOverrides = {};
  unlockedOverrides=STORE.getJSON(UNLOCKED_KEY,{})||{};
  function isUnlocked(handle){
    return Object.prototype.hasOwnProperty.call(unlockedOverrides, handle.id) ? !!unlockedOverrides[handle.id] : handle.id.startsWith('japan-wood-');
  }

  function collectionReady(col){return col.handles.every(isUnlocked);}
  const LOADOUT_KEY='keynlockHandleLoadouts';
  const loadouts=STORE.getJSON(LOADOUT_KEY,{})||{};
  const assignedSlots=STORE.getJSON('keynlockHandleAssignedSlots',Object.fromEntries(Object.keys(loadouts).map(id=>[id,Array.from({length:8},(_,i)=>i)])))||{};
  let selectedSlot=0,skinRequest=0;
  function handlesFor(col){
    const saved=Array.isArray(loadouts[col.id])?loadouts[col.id]:[];
    const ids=[...new Set(saved.filter(id=>col.handles.some(h=>h.id===id)))];
    return [...ids,...col.handles.map(h=>h.id).filter(id=>!ids.includes(id))].map(id=>col.handles.find(h=>h.id===id));
  }
  const $root = document.querySelector('#collectionRoot');
  if(!$root) return;

  const $collectionList = $root.querySelector('#collectionList');
  const $infoTitle = $root.querySelector('#collectionInfoTitle');
  const $infoText = $root.querySelector('#collectionInfoText');
  const $handleStrip = $root.querySelector('#collectionHandleStrip');
  const $stage = $root.querySelector('#collectionStage');
  const $stageInner = $root.querySelector('#collectionStageInner');
  const $imgShaft = $root.querySelector('#collectionImgShaft');
  const $imgHandle = $root.querySelector('#collectionImgHandle');
  const $smoke = $root.querySelector('#collectionStageSmoke');

  // Re-triggers the CSS burst animation (a class can't replay its own
  // animation just by staying applied — remove it, force a reflow, then
  // add it back) whenever the collection changes.
  function burstSmoke(){
    if(!$smoke) return;
    $smoke.classList.remove('burst');
    void $smoke.offsetWidth;
    $smoke.classList.add('burst');
    $smoke.addEventListener('animationend', () => $smoke.classList.remove('burst'), { once: true });
  }

  // The stage's own coordinate system matches the prototype's: every shaft
  // and handle PNG is native-pixel-sized inside a much taller box, shaft
  // pinned to the top (z-index below), handle pinned to the bottom
  // (z-index above) so the natural overlap hides the seam. 100% zoom here
  // means exactly that — native pixel size, not "fill the box".
  const STAGE_W = 300, STAGE_H = 912;

  let state = {
    collectionId: PICK_COLLECTIONS[0].id,
    handle: PICK_COLLECTIONS[0].handles[0],
    // 100% = the source PNGs' own pixel size (matches the prototype's
    // default, unscaled view) — the stage box clips anything past its own
    // edges rather than shrinking content to fit, same as a normal image
    // zoom control. 39% is both the default AND the floor — any lower
    // reads as illegibly small, so zooming out further isn't offered.
    zoom: 39,
    rotate: 0
  };

  let equippedHandle=state.handle;

  function collectionById(id){ return PICK_COLLECTIONS.find(c => c.id === id) || PICK_COLLECTIONS[0]; }

  // ===== Equipping the browsed handle into actual gameplay =====
  // The lock minigame, inventory case, and every imported-mode skin all
  // already read one shared CSS var (--pick-skin-image, set by
  // js/core/ui.js's applyPickSkin() for the older single-image pick-skin
  // inventory) as a single flat background-image — see css/tools-shared.css,
  // css/inventory.css. Rather
  // than teach five different already-tuned rendering contexts to layer
  // two separate shaft/handle backgrounds each with their own sizing math,
  // this composites the pair once onto an offscreen canvas (same layering
  // as the live preview stage: shaft top-aligned, handle bottom-aligned,
  // handle painted last so it sits over the shaft) and hands that single
  // flattened image to the exact same var — every one of those five spots
  // picks it up for free, no changes needed there.
  const EQUIPPED_KEY = 'keynlockEquippedPick';
  function loadImage(src){
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }
  // Finds the smallest box that actually holds non-transparent pixels.
  // The shaft/handle pair is drawn centered in a 300px-wide canvas, but
  // the art itself (a thin pick) is nowhere near that wide — every
  // gameplay context that reads this composite sizes it with
  // background:contain against boxes shaped for a thin tall pick (e.g.
  // the lock minigame's 72x360 box), so the wide transparent margins
  // were shrinking the whole rendered pick down to fit, and leaving it
  // vertically centered/short of the box's top edge instead of reaching
  // it (where the keyhole/pivot expects the tip to be).
  function opaqueBoundingBox(ctx, w, h){
    const data = ctx.getImageData(0, 0, w, h).data;
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for(let y = 0; y < h; y++){
      for(let x = 0; x < w; x++){
        if(data[(y * w + x) * 4 + 3] > 8){
          if(x < minX) minX = x;
          if(x > maxX) maxX = x;
          if(y < minY) minY = y;
          if(y > maxY) maxY = y;
        }
      }
    }
    return maxX >= minX ? { minX, minY, maxX, maxY } : { minX: 0, minY: 0, maxX: w - 1, maxY: h - 1 };
  }
  // handle.id -> composited, cropped data URL. Compositing needs two
  // image loads plus a pixel scan, so results are cached rather than
  // redone every time a rail or the equipped skin needs the same handle.
  const compositeCache = new Map();
  async function compositeHandle(handle){
    if(compositeCache.has(handle.id)) return compositeCache.get(handle.id);
    const promise = (async () => {
      const [shaftImg, handleImg] = await Promise.all([loadImage(handle.shaft), loadImage(handle.image)]);
      const canvas = document.createElement('canvas');
      canvas.width = STAGE_W;
      canvas.height = STAGE_H;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(shaftImg, (STAGE_W - shaftImg.width) / 2, 0);
      ctx.drawImage(handleImg, (STAGE_W - handleImg.width) / 2, STAGE_H - handleImg.height);
      const box = opaqueBoundingBox(ctx, STAGE_W, STAGE_H);
      const cropW = box.maxX - box.minX + 1, cropH = box.maxY - box.minY + 1;
      const cropped = document.createElement('canvas');
      cropped.width = cropW;
      cropped.height = cropH;
      cropped.getContext('2d').drawImage(canvas, box.minX, box.minY, cropW, cropH, 0, 0, cropW, cropH);
      return cropped.toDataURL('image/png');
    })();
    compositeCache.set(handle.id, promise);
    // Replace the pending promise with its resolved string once ready —
    // cachedImage()/getInventoryRail() need a synchronous string to hand
    // to an <img src>, and a Map entry that's still a Promise reads as
    // "not ready yet" there forever otherwise.
    const url = await promise;
    compositeCache.set(handle.id, url);
    return url;
  }
  async function applyEquippedSkin(handle){
    try{
      const request=++skinRequest;
      const url = await compositeHandle(handle);
      if(request!==skinRequest)return;
      document.documentElement.style.setProperty('--pick-skin-image', `url("${url}")`);
    }catch(_){ /* an asset failed to load — leave whatever skin was already applied */ }
  }
  function equipHandle(handle){
    if(!collectionReady(collectionById(state.collectionId))||!isUnlocked(handle))return;
    state.handle = handle;
    equippedHandle=handle;
    try{STORE.setJSON(EQUIPPED_KEY,{collectionId:state.collectionId,handleId:handle.id});}catch(_){}
    applyEquippedSkin(handle);
    refreshInventoryRail();
  }
  function restoreEquipped(){
    let saved = null;
    saved=STORE.getJSON(EQUIPPED_KEY);
    if(saved){
      const col = PICK_COLLECTIONS.find(c => c.id === saved.collectionId);
      const handle = col?.handles.find(h => h.id === saved.handleId);
      if(handle && isUnlocked(handle)&&collectionReady(col)){
        state.collectionId = col.id;
        state.handle = handle;
      }
    }
    if(!handlesFor(collectionById(state.collectionId)).slice(0,pickProgress.capacity).some(h=>h.id===state.handle.id))state.handle=handlesFor(collectionById(state.collectionId))[0];
    // The collection is the only live source of pick artwork. Apply its
    // default too, instead of letting the retired PICK_SKINS flash first.
    equippedHandle=state.handle;
    applyEquippedSkin(equippedHandle);
  }

  // ===== Feeding the inventory case's own pick rail =====
  // js/world/inventory.js (loaded earlier, but classic scripts share one
  // lexical environment so its functions are still callable from here)
  // used to show 5 fixed preset skins from PICK_SKINS as pickable
  // options. It now asks this file for the current collection's handles
  // instead, through the small API exposed below — the rail shows the
  // equipped handle's own collection (first 5, matching the rail's slot
  // count) so it stays consistent with whatever the player last chose in
  // the Коллекция screen, defaulting to the first collection otherwise.
  function railCollection(){
    return collectionById(state.collectionId);
  }
  function getInventoryRail(count){
    return handlesFor(railCollection()).slice(0,Math.min(count,pickProgress.capacity));
  }
  function refreshInventoryRail(){
    // Composites for the rail's handles may not be cached yet — kick
    // them off, then re-render once ready so the rail doesn't sit on
    // stale/missing thumbnails while they load.
    const handles = getInventoryRail(Math.max(5,pickProgress.capacity));
    Promise.all(handles.map(compositeHandle)).then(() => {
      if(typeof renderInventoryTools === 'function') renderInventoryTools();
    }).catch(() => {});
  }
  function cachedImage(handleId){
    const cached = compositeCache.get(handleId);
    // Only a resolved string is usable synchronously as an <img src>; a
    // still-pending promise means the composite isn't ready yet — the
    // caller falls back to something else until refreshInventoryRail's
    // re-render lands.
    return typeof cached === 'string' ? cached : null;
  }
  function pendingHandleRewards(){
    const collection=PICK_COLLECTIONS.find(col=>!collectionReady(col));
    return collection?collection.handles.filter(handle=>!isUnlocked(handle)).map(handle=>({collection,handle})):[];
  }
  function handleRewardPreview(missionId,tier=1){
    const candidates=pendingHandleRewards();
    if(!candidates.length)return {complete:true,chance:0,tip:'Все рукоятки собраны.'};
    const saved=STORE.getJSON('keynlockHandleDropProgress',{});
    const claimed=saved.claimed||STORE.getJSON('keynlockHandleRewardedMissions',{});
    const misses=Math.max(0,Number(saved.misses)||0);
    const baseChance=window.KeynlockContent.economy.lockLoot[tier].handleChance;
    const guaranteed=window.KeynlockRewardPolicy.handleDrop({id:missionId,misses,claimed,chance:baseChance,roll:1});
    const left=Math.max(1,window.KeynlockContent.economy.handlePity-misses);
    const {collection,handle}=candidates[0];
    const guarantee=guaranteed.milestone?'За это сюжетное задание рукоятка гарантирована при следующей победе.':left===1?'Следующая победа гарантированно принесёт рукоятку.':`Если рукоятка не выпадет раньше, она гарантированно выпадет через ${window.KeynlockCampaignRoute.quantity(left,['победу','победы','побед'])}, включая победу в этой миссии.`;
    return {complete:false,chance:guaranteed.drop?100:Math.round(baseChance*100),left,
      image:handle.image,name:`${collection.name} · ${handle.id.split('-').at(-1)}`,collection:collection.name,count:candidates.length,
      tip:`${guarantee} Учитываются победы во всех миссиях, включая повторные. После выпадения счётчик сбрасывается; максимум — ${window.KeynlockContent.economy.handlePity} побед между рукоятками. На изображении один из возможных вариантов: ${collection.name}. Выпадает случайная ненайденная рукоятка из этой коллекции, без повторов. Район на выбор не влияет.`};
  }
  window.KeynlockCollection = {
    getInventoryRail(count){
      // Keep every available slot visible while the shaft+handle composite
      // is still being prepared. The raw handle is a temporary visual
      // fallback; refreshInventoryRail() replaces it with the composite.
      return getInventoryRail(count).map(h => ({ id: h.id, image: cachedImage(h.id) || h.image }));
    },
    getEquippedHandleId(){ return equippedHandle.id; },
    equipHandleById(handleId){
      const handle = railCollection().handles.find(h => h.id === handleId);
      if(handle && getInventoryRail(pickProgress.capacity).some(h=>h.id===handle.id)) equipHandle(handle);
    },
    awardMissionHandle(missionId,tier=1){
      if(!missionId||!PICK_COLLECTIONS.some(col=>!collectionReady(col)))return null;
      const saved=STORE.getJSON('keynlockHandleDropProgress',{});
      const claimed=saved.claimed||STORE.getJSON('keynlockHandleRewardedMissions',{});
      const misses=Math.max(0,Number(saved.misses)||0);
      const decision=window.KeynlockRewardPolicy.handleDrop({id:missionId,misses,claimed,chance:window.KeynlockContent.economy.lockLoot[tier].handleChance,roll:Math.random()});
      const reward=decision.drop?this.unlockRandomHandle():null;
      if(reward&&decision.milestone)claimed[missionId]=true;
      STORE.setJSON('keynlockHandleDropProgress',{claimed,misses:reward?0:misses+1});
      return reward;
    },
    handleRewardPreview,
    handleRewardHint(missionId,tier=1){
      const preview=handleRewardPreview(missionId,tier);
      if(preview.complete)return 'Все рукоятки собраны';
      if(preview.chance===100)return 'Гарантированная рукоятка';
      return `Шанс рукоятки ${preview.chance}% · гарантия не позже чем через ${window.KeynlockCampaignRoute.quantity(preview.left,['победу','победы','побед'])}`;
    },
    unlockRandomHandle(){
      const locked=pendingHandleRewards();
      if(!locked.length)return null;
      const reward=locked[Math.floor(Math.random()*locked.length)];
      unlockedOverrides[reward.handle.id]=true;
      STORE.setJSON(UNLOCKED_KEY,unlockedOverrides);
      renderCollectionList();
      if(reward.collection.id===state.collectionId)renderHandleStrip();
      refreshInventoryRail();
      return {id:reward.handle.id,image:reward.handle.image,name:`${reward.collection.name} · ${reward.handle.id.split('-').at(-1)}`};
    }
  };

  function renderCollectionList(){
    $collectionList.innerHTML = '';
    PICK_COLLECTIONS.forEach(col => {
      const row = document.createElement('button');
      row.type = 'button';
      row.disabled=!collectionReady(col);
      row.className = 'collectionRow' + (col.id === state.collectionId ? ' active' : '');
      row.innerHTML = `
        <span class="collectionRowThumbs">${col.handles.map(h => `<img src="${h.image}" alt="" class="${isUnlocked(h)?'':'undiscovered'}">`).join('')}</span>
        <span class="collectionRowLabel">${col.name} · ${col.handles.filter(isUnlocked).length}/8</span>
      `;
      row.addEventListener('click', () => {
        if(!collectionReady(col)||col.id === state.collectionId) return;
        selectedSlot=0;
        state.collectionId = col.id;
        const firstUnlocked = handlesFor(col)[0];
        equipHandle(firstUnlocked);
        renderCollectionList();
        renderHandleStrip();
        renderCollectionInfo();
        renderStage();
        burstSmoke();
      });
      $collectionList.appendChild(row);
    });
  }

  const slots=document.createElement('div');slots.className='collectionLoadout';
  $infoTitle.after(slots);
  function renderSlots(){
    selectedSlot=Math.min(selectedSlot,pickProgress.capacity-1);
    const chosen=getInventoryRail(pickProgress.capacity);
    const assigned=assignedSlots[state.collectionId]||[];
    slots.innerHTML='<p>Перетащи рукоятку на силуэт в футляре. Нажатие на рукоятку открывает превью. Для назначения без перетаскивания выбери рукоятку, затем нажми на место.</p><div class="collectionCaseSlots">'+chosen.map((h,i)=>`<button class="collectionCaseSlot" type="button" data-slot="${i}" aria-label="Место ${i+1}: рукоятка ${h.id.split('-').at(-1)}" aria-pressed="${i===selectedSlot}"><img class="collectionSlotSilhouette" src="${h.image}" alt="">${assigned.includes(i)?`<img class="collectionSlotHandle" src="${h.image}" alt="">`:''}<span>${i+1}</span></button>`).join('')+'</div>';

  }
  function assignHandle(handle,slot){
    const col=collectionById(state.collectionId);
    if(!collectionReady(col)||!isUnlocked(handle)||!Number.isInteger(slot)||slot<0||slot>=pickProgress.capacity)return;
    const chosen=handlesFor(col),old=chosen.findIndex(h=>h.id===handle.id);
    if(old<0)return;
    selectedSlot=slot;
    const assigned=new Set(assignedSlots[col.id]||[]);
    if(assigned.has(slot)&&old<pickProgress.capacity)assigned.add(old);
    assigned.add(slot);assignedSlots[col.id]=[...assigned];
    STORE.setJSON('keynlockHandleAssignedSlots',assignedSlots);
    [chosen[slot],chosen[old]]=[chosen[old],chosen[slot]];
    loadouts[col.id]=chosen.map(h=>h.id);STORE.setJSON(LOADOUT_KEY,loadouts);
    equipHandle(handle);renderSlots();renderHandleStrip();renderStage();
  }
  let drag=null,suppressClick=false;
  $handleStrip.addEventListener('dragstart',event=>event.preventDefault());
  $handleStrip.addEventListener('pointerdown',event=>{
    const card=event.target.closest('[data-handle-id]');
    if(!card||card.disabled||event.button!==0)return;
    drag={id:card.dataset.handleId,pointer:event.pointerId,x:event.clientX,y:event.clientY,ghost:null};
  });
  window.addEventListener('pointermove',event=>{
    if(!drag||drag.pointer!==event.pointerId)return;
    if(!drag.ghost&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<6)return;
    event.preventDefault();
    if(!drag.ghost){
      $handleStrip.setPointerCapture(event.pointerId);
      const handle=collectionById(state.collectionId).handles.find(h=>h.id===drag.id);
      drag.ghost=document.createElement('img');drag.ghost.src=handle.image;drag.ghost.className='collectionDragGhost';drag.ghost.alt='';document.body.append(drag.ghost);
      slots.classList.add('acceptingHandle');
    }
    drag.ghost.style.left=`${event.clientX}px`;drag.ghost.style.top=`${event.clientY}px`;
    const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-slot]');
    slots.querySelectorAll('[data-slot]').forEach(slot=>slot.classList.toggle('dropTarget',slot===target));
  });
  function finishDrag(event){
    if(!drag||drag.pointer!==event.pointerId)return;
    const current=drag;drag=null;
    if(current.ghost){
      const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-slot]');
      current.ghost.remove();slots.classList.remove('acceptingHandle');
      slots.querySelectorAll('.dropTarget').forEach(slot=>slot.classList.remove('dropTarget'));
      suppressClick=true;setTimeout(()=>{suppressClick=false;},0);
      if(event.type==='pointerup'&&target&&slots.contains(target))assignHandle(collectionById(state.collectionId).handles.find(h=>h.id===current.id),Number(target.dataset.slot));
    }
    if($handleStrip.hasPointerCapture(event.pointerId))$handleStrip.releasePointerCapture(event.pointerId);
  }
  window.addEventListener('pointerup',finishDrag);
  window.addEventListener('pointercancel',finishDrag);
  $handleStrip.addEventListener('lostpointercapture',finishDrag);
  slots.addEventListener('click',event=>{const b=event.target.closest('[data-slot]');if(b&&!suppressClick){assignHandle(state.handle,Number(b.dataset.slot));}});
  window.addEventListener('keynlock-resources-change',()=>{renderSlots();refreshInventoryRail();});
  function renderCollectionInfo(){
    renderSlots();
    const col = collectionById(state.collectionId);
    if($infoTitle) $infoTitle.textContent = col.name;
    if($infoText) $infoText.innerHTML = col.description || '';
  }

  function renderHandleStrip(){
    $handleStrip.innerHTML = '';
    const col = collectionById(state.collectionId);
    col.handles.forEach(handle => {
      const unlocked = isUnlocked(handle);
      const card = document.createElement('button');
      card.type = 'button';
      card.dataset.handleId=handle.id;
      card.setAttribute('aria-label',`Рукоятка ${handle.id.split('-').at(-1)}`);
      card.className = 'collectionHandleCard' + (handle.id === state.handle.id ? ' active' : '') + (unlocked ? '' : ' locked');
      card.innerHTML = `<img src="${handle.image}" alt="" loading="lazy">`;
      if(unlocked){
        card.addEventListener('click', () => {
          if(suppressClick)return;
          state.handle=handle;
          renderHandleStrip();renderStage();
        });
      }else{
        card.disabled = true;
        card.setAttribute('aria-label', 'Ещё не открыто');
        // The grain overlay (css/collection.css) is masked to this exact
        // handle's own art so it only covers the pick's actual silhouette,
        // not the whole square button box around it. A url() inside a
        // custom property resolves against the stylesheet that reads it
        // (css/collection.css), not this script or the page — so the path
        // needs a leading slash, or "assets/..." resolves to "css/assets/...".
        card.style.setProperty('--handle-mask', `url("/${handle.image}")`);
      }
      $handleStrip.appendChild(card);
    });
  }

  function renderStage(){
    $imgShaft.src = state.handle.shaft;
    $imgHandle.src = state.handle.image;
    $imgShaft.style.transform = 'translateX(-50%)';
    $imgHandle.style.transform = 'translateX(-50%)';
    const scale = state.zoom / 100;
    $stageInner.style.transform = `scale(${scale}) rotate(${state.rotate}deg)`;
  }

  function clampZoom(z){ return Math.max(39, Math.min(100, z)); }

  // One-finger drag rotates (angle from the stage's own center to the
  // pointer); two fingers pinch to zoom, same gesture as a normal photo
  // viewer. Desktop covers the same ground with a trackpad pinch or plain
  // wheel, both delivered as `wheel` events.
  (function(){
    const pointers = new Map();
    let rotating = false;
    let pinchStartDist = 0;
    let pinchStartZoom = state.zoom;

    // Rotation always pivots on the stage's own center. An earlier
    // attempt pivoted on whichever end (shaft/handle) the grab landed
    // closer to, using the CSS transform-origin actually set — that was
    // mathematically correct (the origin point does stay fixed on
    // screen), but rotation angle near a close pivot is extremely
    // sensitive: a tiny pointer move produces a huge angle swing, so the
    // far end whipped across the screen. Not a bug to fix, a property of
    // near-pivot rotation — reverted per explicit call after seeing it
    // live.
    function angleFromCenter(clientX, clientY){
      const rect = $stage.getBoundingClientRect();
      const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
      const dx = clientX - cx, dy = clientY - cy;
      return Math.atan2(dx, -dy) * 180 / Math.PI;
    }
    // Wraps a raw angle difference into (-180, 180] — atan2 only ever
    // returns -180..180, so a drag that crosses that seam (e.g. pointer
    // angle going from 179° to -179°, an actual 2° move) would otherwise
    // read as a 358° jump.
    function normalizeAngleDelta(delta){
      return ((delta + 180) % 360 + 360) % 360 - 180;
    }
    function dist(a, b){ return Math.hypot(a.x - b.x, a.y - b.y); }
    function stopRotate(){ rotating = false; $stage.classList.remove('dragging'); }

    // Relative dragging, not absolute angle-snapping: grabbing the object
    // used to immediately set its rotation to match the click point's own
    // angle from center, so a click on the lower half (where the handle
    // sits at rest, near 180° from center) snapped the whole tool to face
    // that way before any actual drag motion happened. Now the press only
    // records a starting reference; only pointer MOVEMENT after that
    // changes the rotation, by the same amount the pointer's own angle
    // changed — so touching down anywhere never itself moves the tool.
    let dragStartPointerAngle = 0;
    let dragStartRotate = 0;

    $stage.addEventListener('pointerdown', e => {
      $stage.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if(pointers.size === 1){
        rotating = true;
        $stage.classList.add('dragging');
        dragStartPointerAngle = angleFromCenter(e.clientX, e.clientY);
        dragStartRotate = state.rotate;
      }else if(pointers.size === 2){
        stopRotate();
        const [a, b] = [...pointers.values()];
        pinchStartDist = dist(a, b);
        pinchStartZoom = state.zoom;
      }
    });
    $stage.addEventListener('pointermove', e => {
      if(!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if(pointers.size >= 2){
        const [a, b] = [...pointers.values()];
        const d = dist(a, b);
        if(pinchStartDist > 0){
          state.zoom = clampZoom(Math.round(pinchStartZoom * (d / pinchStartDist)));
          renderStage();
        }
      }else if(rotating){
        const delta = normalizeAngleDelta(angleFromCenter(e.clientX, e.clientY) - dragStartPointerAngle);
        state.rotate = Math.round(dragStartRotate + delta);
        renderStage();
      }
    });
    function releasePointer(e){
      pointers.delete(e.pointerId);
      if(pointers.size < 2) pinchStartDist = 0;
      if(pointers.size === 0) stopRotate();
    }
    $stage.addEventListener('pointerup', releasePointer);
    $stage.addEventListener('pointercancel', releasePointer);

    // Trackpad pinch arrives as `wheel` with ctrlKey set; a plain wheel
    // scroll zooms too, for a mouse.
    $stage.addEventListener('wheel', e => {
      e.preventDefault();
      state.zoom = clampZoom(Math.round(state.zoom - e.deltaY * 0.15));
      renderStage();
    }, { passive: false });

    // A very slow ambient spin while nobody's actually turning the tool —
    // stops the instant a finger/pointer touches the stage (pointers.size
    // check) and only does work while this panel is the one on screen.
    const $panel = $root.closest('.lairPanel');
    (function idleSpin(){
      if(pointers.size === 0 && $panel?.classList.contains('active')){
        state.rotate = (state.rotate + 0.025) % 360;
        renderStage();
      }
      requestAnimationFrame(idleSpin);
    })();
  })();

  window.addEventListener('resize', renderStage);

  restoreEquipped();
  renderCollectionList();
  renderHandleStrip();
  renderCollectionInfo();
  renderStage();
  refreshInventoryRail();
})();
