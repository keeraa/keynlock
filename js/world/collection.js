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
// collection at a time (shaft stays fixed to DEFAULT_SHAFT) — not a free
// shaft+handle mixer. The data shape below doesn't hard-code collection =
// one fixed pair, though, so a future "build your own set" screen can
// reuse PICK_COLLECTIONS without a rewrite. Economy (buying/unlocking) is
// not built here either — `unlocked` is just a flag other code can flip
// later; this screen only renders it (grayscale when false).
(function(){
  const PICK_COLLECTIONS = [
    { id:'japan', name:'Japan', handles:[
      { id:'japan-01', image:'assets/picks/handles/japan/japan_big_art_01.png', unlocked:true },
      { id:'japan-02', image:'assets/picks/handles/japan/japan_big_art_02.png', unlocked:true },
      { id:'japan-03', image:'assets/picks/handles/japan/japan_big_art_03.png', unlocked:true },
      { id:'japan-04', image:'assets/picks/handles/japan/japan_big_art_04.png', unlocked:true },
      { id:'japan-05', image:'assets/picks/handles/japan/japan_big_art_05.png', unlocked:true },
      { id:'japan-06', image:'assets/picks/handles/japan/japan_big_art_06.png', unlocked:true },
      { id:'japan-07', image:'assets/picks/handles/japan/japan_big_art_07.png', unlocked:true },
      { id:'japan-08', image:'assets/picks/handles/japan/japan_big_art_08.png', unlocked:false }
    ]},
    { id:'decodance', name:'Decodance Black', handles:[
      { id:'decodance-01', image:'assets/picks/handles/decodance/decodance_black_01.png', unlocked:true },
      { id:'decodance-02', image:'assets/picks/handles/decodance/decodance_black_02.png', unlocked:true },
      { id:'decodance-03', image:'assets/picks/handles/decodance/decodance_black_03.png', unlocked:true },
      { id:'decodance-04', image:'assets/picks/handles/decodance/decodance_black_04.png', unlocked:true },
      { id:'decodance-05', image:'assets/picks/handles/decodance/decodance_black_05.png', unlocked:false },
      { id:'decodance-06', image:'assets/picks/handles/decodance/decodance_black_06.png', unlocked:true },
      { id:'decodance-07', image:'assets/picks/handles/decodance/decodance_black_07.png', unlocked:true },
      { id:'decodance-08', image:'assets/picks/handles/decodance/decodance_black_08.png', unlocked:true }
    ]}
  ];
  const DEFAULT_SHAFT = 'assets/picks/shafts/sting_01.png';

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
  const $zoom = $root.querySelector('#collectionZoom');
  const $zoomOut = $root.querySelector('#collectionZoomOut');

  // The stage's own coordinate system matches the prototype's: every shaft
  // and handle PNG is native-pixel-sized inside a much taller box, shaft
  // pinned to the top (z-index below), handle pinned to the bottom
  // (z-index above) so the natural overlap hides the seam. 100% zoom here
  // means exactly that — native pixel size, not "fill the box".
  const STAGE_W = 300, STAGE_H = 912;

  let state = {
    collectionId: PICK_COLLECTIONS[0].id,
    handle: PICK_COLLECTIONS[0].handles[0],
    shaft: DEFAULT_SHAFT,
    // 100% = the source PNGs' own pixel size (matches the prototype's
    // default, unscaled view) — the stage box clips anything past its own
    // edges rather than shrinking content to fit, same as a normal image
    // zoom control. Starts low enough to show the whole 300x912 stage
    // inside the box by default.
    zoom: 35,
    rotate: 0
  };

  function collectionById(id){ return PICK_COLLECTIONS.find(c => c.id === id) || PICK_COLLECTIONS[0]; }

  function renderCollectionList(){
    $collectionList.innerHTML = '';
    PICK_COLLECTIONS.forEach(col => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'collectionRow' + (col.id === state.collectionId ? ' active' : '');
      row.innerHTML = `
        <span class="collectionRowThumb"><img src="${col.handles[0].image}" alt=""></span>
        <span class="collectionRowName">${col.name}</span>
      `;
      row.addEventListener('click', () => {
        state.collectionId = col.id;
        const firstUnlocked = col.handles.find(isUnlocked) || col.handles[0];
        state.handle = firstUnlocked;
        renderCollectionList();
        renderHandleStrip();
        renderStage();
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
          state.handle = handle;
          renderHandleStrip();
          renderStage();
        });
      }else{
        card.disabled = true;
        card.setAttribute('aria-label', 'Ещё не открыто');
      }
      $handleStrip.appendChild(card);
    });
  }

  function renderStage(){
    $imgShaft.src = state.shaft;
    $imgHandle.src = state.handle.image;
    $imgShaft.style.transform = 'translateX(-50%)';
    $imgHandle.style.transform = 'translateX(-50%)';
    const scale = state.zoom / 100;
    $stageInner.style.transform = `scale(${scale}) rotate(${state.rotate}deg)`;
    $zoom.value = state.zoom;
    $zoomOut.textContent = `${state.zoom}%`;
  }

  $zoom.addEventListener('input', e => {
    state.zoom = Number(e.target.value);
    renderStage();
  });

  // Grab-to-rotate, same technique as the prototype: angle from the
  // stage's own center to the pointer, updated on drag.
  (function(){
    let dragging = false;
    function angleFromCenter(clientX, clientY){
      const rect = $stage.getBoundingClientRect();
      const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
      const dx = clientX - cx, dy = clientY - cy;
      return Math.atan2(dx, -dy) * 180 / Math.PI;
    }
    $stage.addEventListener('pointerdown', e => {
      dragging = true;
      $stage.classList.add('dragging');
      $stage.setPointerCapture(e.pointerId);
      state.rotate = Math.max(-180, Math.min(180, Math.round(angleFromCenter(e.clientX, e.clientY))));
      renderStage();
    });
    $stage.addEventListener('pointermove', e => {
      if(!dragging) return;
      state.rotate = Math.max(-180, Math.min(180, Math.round(angleFromCenter(e.clientX, e.clientY))));
      renderStage();
    });
    function stop(){ dragging = false; $stage.classList.remove('dragging'); }
    $stage.addEventListener('pointerup', stop);
    $stage.addEventListener('pointercancel', stop);
  })();

  window.addEventListener('resize', renderStage);

  renderCollectionList();
  renderHandleStrip();
  renderStage();
})();
