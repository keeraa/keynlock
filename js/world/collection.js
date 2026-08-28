// ===== PICK COLLECTION SCREEN =====
// Prototype: /Users/migachev/Desktop/123/stings/prototype.html proved the
// layering trick (shaft on top under z-index, handle on bottom over it —
// the overlap hides the seam on most pairs without hand-tuning) and the
// grab-to-rotate + scale-to-fit preview. This ports both into the lair as
// its own panel, opened the same generic way as every other one
// (js/core/init.js's `.lairHotspot[data-lair-open]` -> openLairModule ->
// js/world/lair.js's setLairTab toggling `.lairPanel[data-lair-panel]`).
//
// Scope, on purpose: this screen only *browses* handles inside one
// collection at a time (each handle carries its own paired shaft) — not a
// free shaft+handle mixer. The data shape below doesn't hard-code collection =
// one fixed pair, though, so a future "build your own set" screen can
// reuse PICK_COLLECTIONS without a rewrite. Economy (buying/unlocking) is
// not built here either — `unlocked` is just a flag other code can flip
// later; this screen only renders it (grayscale when false).
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
  const PICK_COLLECTIONS = [
    { id:'japan', name:'Japan', handles: buildHandles('japan', 'japan', 'japan_big_art',
      [true, true, true, true, true, true, true, false]) },
    { id:'decodance', name:'Decodance Black', handles: buildHandles('decodance', 'decodance', 'decodance_black',
      [true, true, true, true, false, true, true, true]) },
    { id:'japan-classic-white', name:'Japan Classic White', handles: buildHandles('japan-classic-white', 'japan-classic-white', 'japan_classic_white',
      [true, true, true, true, true, true, true, true]) },
    { id:'japan-classic-black', name:'Japan Classic Black', handles: buildHandles('japan-classic-black', 'japan-classic-black', 'japan_classic_black',
      [true, true, true, true, true, true, true, true]) }
  ];

  // Unlock overrides live in storage separately from the hard-coded
  // defaults above, so a future economy pass can flip individual ids
  // without touching this file.
  const UNLOCKED_KEY = 'keynlockUnlockedHandles';
  let unlockedOverrides = {};
  try{ unlockedOverrides = JSON.parse(STORE.getItem(UNLOCKED_KEY) || '{}') || {}; }catch(_){ unlockedOverrides = {}; }
  function isUnlocked(handle){
    return Object.prototype.hasOwnProperty.call(unlockedOverrides, handle.id) ? !!unlockedOverrides[handle.id] : !!handle.unlocked;
  }

  const $root = document.querySelector('#collectionRoot');
  if(!$root) return;

  const $collectionList = $root.querySelector('#collectionList');
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

  function collectionById(id){ return PICK_COLLECTIONS.find(c => c.id === id) || PICK_COLLECTIONS[0]; }

  // ===== Equipping the browsed handle into actual gameplay =====
  // The lock minigame, inventory case, and every imported-mode skin all
  // already read one shared CSS var (--pick-skin-image, set by
  // js/core/ui.js's applyPickSkin() for the older single-image pick-skin
  // shop) as a single flat background-image — see css/overrides-01-tools-shared.css,
  // css/overrides-05-inventory.css, css/modes-02-mass-effect.css. Rather
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
  async function applyEquippedSkin(handle){
    try{
      const [shaftImg, handleImg] = await Promise.all([loadImage(handle.shaft), loadImage(handle.image)]);
      const canvas = document.createElement('canvas');
      canvas.width = STAGE_W;
      canvas.height = STAGE_H;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(shaftImg, (STAGE_W - shaftImg.width) / 2, 0);
      ctx.drawImage(handleImg, (STAGE_W - handleImg.width) / 2, STAGE_H - handleImg.height);
      document.documentElement.style.setProperty('--pick-skin-image', `url("${canvas.toDataURL('image/png')}")`);
    }catch(_){ /* an asset failed to load — leave whatever skin was already applied */ }
  }
  function equipHandle(handle){
    state.handle = handle;
    try{ STORE.setItem(EQUIPPED_KEY, JSON.stringify({ collectionId: state.collectionId, handleId: handle.id })); }catch(_){}
    applyEquippedSkin(handle);
  }
  function restoreEquipped(){
    let saved = null;
    try{ saved = JSON.parse(STORE.getItem(EQUIPPED_KEY) || 'null'); }catch(_){ saved = null; }
    if(!saved) return;
    const col = PICK_COLLECTIONS.find(c => c.id === saved.collectionId);
    const handle = col?.handles.find(h => h.id === saved.handleId);
    if(handle && isUnlocked(handle)){
      state.collectionId = col.id;
      state.handle = handle;
      applyEquippedSkin(handle);
    }
  }

  function renderCollectionList(){
    $collectionList.innerHTML = '';
    PICK_COLLECTIONS.forEach(col => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'collectionRow' + (col.id === state.collectionId ? ' active' : '');
      row.innerHTML = `
        <span class="collectionRowThumbs">${col.handles.map(h => `<img src="${h.image}" alt="">`).join('')}</span>
        <span class="collectionRowLabel">${col.name}</span>
      `;
      row.addEventListener('click', () => {
        if(col.id === state.collectionId) return;
        state.collectionId = col.id;
        const firstUnlocked = col.handles.find(isUnlocked) || col.handles[0];
        equipHandle(firstUnlocked);
        renderCollectionList();
        renderHandleStrip();
        renderStage();
        burstSmoke();
      });
      $collectionList.appendChild(row);
    });
  }

  function renderHandleStrip(){
    $handleStrip.innerHTML = '';
    const col = collectionById(state.collectionId);
    col.handles.forEach(handle => {
      const unlocked = isUnlocked(handle);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'collectionHandleCard' + (handle.id === state.handle.id ? ' active' : '') + (unlocked ? '' : ' locked');
      card.innerHTML = `<img src="${handle.image}" alt="" loading="lazy">`;
      if(unlocked){
        card.addEventListener('click', () => {
          equipHandle(handle);
          renderHandleStrip();
          renderStage();
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
    function dist(a, b){ return Math.hypot(a.x - b.x, a.y - b.y); }
    function stopRotate(){ rotating = false; $stage.classList.remove('dragging'); }

    $stage.addEventListener('pointerdown', e => {
      $stage.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if(pointers.size === 1){
        rotating = true;
        $stage.classList.add('dragging');
        // The initial press can land far from the current angle — ease
        // into it once so it doesn't visually snap, then drop the
        // transition so live tracking stays 1:1 with the pointer.
        $stageInner.classList.add('easing');
        state.rotate = Math.max(-180, Math.min(180, Math.round(angleFromCenter(e.clientX, e.clientY))));
        renderStage();
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
        $stageInner.classList.remove('easing');
        state.rotate = Math.max(-180, Math.min(180, Math.round(angleFromCenter(e.clientX, e.clientY))));
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
  renderStage();
})();
