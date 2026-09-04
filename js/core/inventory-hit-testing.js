/* Inventory visual hit testing */
(function(){
  const PAD=14;
  function root(){ return document.querySelector('#inventoryDrawer'); }
  // The hovered/selected tool lifts its artwork by --tool-lift. Hit testing has to
  // undo that lift, or the lifted tool slides out from under the pointer and the
  // hover flickers on and off as it bounces back.
  function restingBox(btn,img){
    const b=img.getBoundingClientRect();
    const lift=parseFloat(getComputedStyle(btn).getPropertyValue('--tool-lift'))||0;
    return {left:b.left, right:b.right, top:b.top+lift, bottom:b.bottom+lift};
  }
  function candidates(x,y){
    const r=root();
    if(!r) return [];
    return [...r.querySelectorAll('.inventoryTool:not(.hidden-slot):not(.breaking-out):not(:disabled)')]
      .map(btn=>{
        const img=btn.querySelector('img');
        if(!img) return null;
        // Horizontally the tool owns its grid column and no more. A tensioner is
        // drawn rotated, so its axis-aligned box runs three cells wide and used
        // to start reacting from over by the avatar's head. Vertically the art
        // box still rules, so tall handles stay reachable above their pocket.
        const cell=btn.getBoundingClientRect();
        if(x<cell.left-PAD || x>cell.right+PAD) return null;
        const b=restingBox(btn,img);
        if(y<b.top-PAD || y>b.bottom+PAD) return null;
        const cx=(cell.left+cell.right)/2, cy=(b.top+b.bottom)/2;
        const dx=x-cx, dy=y-cy;
        return {btn,dist:dx*dx+dy*dy};
      })
      .filter(Boolean)
      .sort((a,b)=>a.dist-b.dist);
  }
  // The outside-click guard needs the same answer this module uses: tension art
  // is 176px wide and reaches well past the case, so a press on a perfectly
  // visible tool can land outside the drawer box and read as "outside".
  window.inventoryToolAtPoint=(x,y)=>candidates(x,y)[0]?.btn || null;

  let hovered=null;
  function setHovered(btn){
    if(hovered===btn) return;
    hovered?.classList.remove('visual-hover');
    hovered=btn||null;
    hovered?.classList.add('visual-hover');
  }
  function clearVisualHover(){ setHovered(null); }
  document.addEventListener('pointermove',e=>{
    if(!root()) return;
    setHovered(candidates(e.clientX,e.clientY)[0]?.btn || null);
  },{passive:true});
  document.addEventListener('pointerleave',clearVisualHover,{passive:true});

  // Closed, the grab strip covers the whole peek so any press opens the case —
  // but a press on a tool that is plainly sticking out of a pocket belongs to
  // that tool. Claim by grid column rather than by image box: tension art is
  // three cells wide, so its box alone would swallow most of the right half.
  function toolInPeek(x,y){
    const r=root();
    if(!r) return null;
    const strip=r.getBoundingClientRect();
    if(y<strip.top || y>window.innerHeight) return null;
    let best=null;
    for(const btn of r.querySelectorAll('.inventoryTool:not(.hidden-slot):not(.breaking-out):not(:disabled)')){
      const img=btn.querySelector('img');
      if(!img) continue;
      const cell=btn.getBoundingClientRect();
      if(x<cell.left-PAD || x>cell.right+PAD) continue;
      // Test the art where it is actually drawn, not where it rests: hovering
      // lifts it by --tool-lift, and the tension rail only clears the bottom of
      // the screen by ~18px, so that offset alone would miss the whole tool.
      const art=img.getBoundingClientRect();
      if(art.bottom<strip.top || art.top>window.innerHeight) continue;
      // Any tool showing above the lip owns its whole column of the peek — the
      // tensioners poke out a third as far as the picks do, and a sliver at the
      // very edge of the screen is not something anyone can reliably click.
      const d=Math.abs(x-(cell.left+cell.right)/2);
      if(!best || d<best.d) best={btn,d};
    }
    return best?.btn || null;
  }

  // Keep enlarged tool images clickable outside their narrow grid cells.
  let peekPressAt=0;
  document.addEventListener('pointerdown',e=>{
    peekPressAt=0;
    const r=root();
    if(!r || !r.contains(e.target)) return;
    if(e.target.closest('.inventoryTool')) return;
    if(e.target.closest('.inventoryToggle')){
      if(r.classList.contains('open')) return;
      const tool=toolInPeek(e.clientX,e.clientY);
      if(!tool) return;
      e.preventDefault();
      e.stopPropagation();
      peekPressAt=e.timeStamp||performance.now();
      tool.click();
      return;
    }
    const hit=candidates(e.clientX,e.clientY)[0];
    if(hit){
      e.preventDefault();
      e.stopPropagation();
      hit.btn.click();
    }
  },true);
  // pointerdown cannot cancel the click the toggle button still emits after it.
  // Only the toggle's own click clears the flag: routing to a tool fires that
  // tool's click first, and that one must not consume it.
  document.addEventListener('click',e=>{
    if(!peekPressAt) return;
    if(!e.target.closest?.('.inventoryToggle')) return;
    peekPressAt=0;
    e.preventDefault();
    e.stopImmediatePropagation();
  },true);
})();

/* Mobile gestures + unlock motion coordinator */
(function(){
  const mobileQuery=window.matchMedia('(max-width:760px), (max-height:560px) and (orientation:landscape)');
  const SWIPE_THRESHOLD=24;
  let gesture=null;

  function direction(dx,dy){
    return Math.abs(dx)>Math.abs(dy)
      ? (dx>0?'right':'left')
      : (dy>0?'down':'up');
  }

  function useDigitalSwipe(dir,target){
    return PuzzleModes.action(mode,'swipe',dir,target);
  }

  function applySwipe(dir,target){
    if(solved || mapOpen || lairOpen) return;
    if(useDigitalSwipe(dir,target)) return;

    const plate=target?.closest?.('.plate');
    if(plate){
      selected=Number(plate.dataset.index)||0;
      render();
    }

    const key=dir==='left'?'a':dir==='right'?'d':dir==='up'?'w':'s';
    input(key);
  }

  function bindMobileSwipes(){
    const scene=document.querySelector('.scene');
    if(!scene) return;

    scene.addEventListener('pointerdown',e=>{
      if(!mobileQuery.matches || e.pointerType!=='touch') return;
      if(e.target.closest('.topRightHud,.inventoryDrawer,.worldMapScreen,.lairOverlay,.skBoard,.tnGauge')) return;
      gesture={id:e.pointerId,x:e.clientX,y:e.clientY,target:e.target};
    },{passive:true});

    scene.addEventListener('pointerup',e=>{
      if(!gesture || e.pointerId!==gesture.id) return;
      const dx=e.clientX-gesture.x;
      const dy=e.clientY-gesture.y;
      const start=gesture;
      gesture=null;
      if(Math.max(Math.abs(dx),Math.abs(dy))<SWIPE_THRESHOLD) return;
      applySwipe(direction(dx,dy),start.target);
    },{passive:true});

    scene.addEventListener('pointercancel',()=>{gesture=null;},{passive:true});
  }

  // Make celebrate idempotent so the fast animation can finish the base lock
  // before legacy delayed callbacks fire.
  const originalCelebrate=celebrate;
  celebrate=function(){
    if(document.body.classList.contains('game-inactive')) return;
    return originalCelebrate();
  };

  document.addEventListener('animationend',e=>{
    if(e.animationName!=='keynlockShackleOpenFast') return;
    const lockArt=e.target?.closest?.('.mechanismZone,.sharedModeLockArt,.skCenterLock') || e.target;
    if(!lockArt?.classList?.contains('opening')) return;

    lockArt.classList.remove('opening');
    lockArt.classList.add('opened');

    if(solved && !document.body.classList.contains('game-inactive')) celebrate();
    if(solved){
      setTimeout(()=>{
        if(solved && document.body.classList.contains('game-inactive')){
          document.body.classList.add('solved-notice-visible');
        }
      },120);
    }
  });

  bindMobileSwipes();
})();

/* v257 — typed tensioners across all lock modes; typed plates only on level 1.
   v259 — five iron tiers per type, with per-skin hole geometry. */
(function(){
  // v259 — iron plates in five tiers; end shape still encodes the tension type.
  const typedPlateNames=[
    'iron_bar_01.webp',
    'iron_bar_02.png',
    'iron_bar_03.png',
    'iron_bar_04.png',
    'iron_bar_05.png',
    'iron_hook_01.webp',
    'iron_hook_02.png',
    'iron_hook_03.png',
    'iron_hook_04.png',
    'iron_hook_05.png',
    'iron_kink_01.webp',
    'iron_kink_02.png',
    'iron_kink_03.png',
    'iron_kink_04.png',
    'iron_kink_05.png',
    'iron_wave_01.webp',
    'iron_wave_02.png',
    'iron_wave_03.png',
    'iron_wave_04.png',
    'iron_wave_05.png',
    'iron_angle_01.webp',
    'iron_angle_02.png',
    'iron_angle_03.png',
    'iron_angle_04.png',
    'iron_angle_05.png'
  ];
  const typedPlateSkins=[
    'assets/plates/iron_bar_01.webp',
    'assets/plates/iron_bar_02.png',
    'assets/plates/iron_bar_03.png',
    'assets/plates/iron_bar_04.png',
    'assets/plates/iron_bar_05.png',
    'assets/plates/iron_hook_01.webp',
    'assets/plates/iron_hook_02.png',
    'assets/plates/iron_hook_03.png',
    'assets/plates/iron_hook_04.png',
    'assets/plates/iron_hook_05.png',
    'assets/plates/iron_kink_01.webp',
    'assets/plates/iron_kink_02.png',
    'assets/plates/iron_kink_03.png',
    'assets/plates/iron_kink_04.png',
    'assets/plates/iron_kink_05.png',
    'assets/plates/iron_wave_01.webp',
    'assets/plates/iron_wave_02.png',
    'assets/plates/iron_wave_03.png',
    'assets/plates/iron_wave_04.png',
    'assets/plates/iron_wave_05.png',
    'assets/plates/iron_angle_01.webp',
    'assets/plates/iron_angle_02.png',
    'assets/plates/iron_angle_03.png',
    'assets/plates/iron_angle_04.png',
    'assets/plates/iron_angle_05.png'
  ];
  // Hole geometry measured from each source image: `ar` is its aspect ratio,
  // `x` the seven hole centres as a fraction of image width, `y` the row centre
  // as a fraction of image height. Tiers differ in hole spacing, so a single
  // shared table would leave pins sitting outside the holes.
  const typedPlateGeom=[
    {ar:6.76159,y:0.52899,x:[0.13519,0.25672,0.37926,0.50130,0.62344,0.74603,0.86692]},
    {ar:6.86957,y:0.48577,x:[0.14374,0.26162,0.37981,0.49766,0.61581,0.73368,0.85070]},
    {ar:5.95139,y:0.50235,x:[0.18448,0.29172,0.39960,0.50732,0.61556,0.72388,0.83190]},
    {ar:4.72781,y:0.50282,x:[0.15150,0.26811,0.38417,0.49984,0.61595,0.73218,0.84817]},
    {ar:6.00000,y:0.47966,x:[0.14996,0.26376,0.37732,0.49537,0.61516,0.73347,0.85286]},
    {ar:7.24113,y:0.50137,x:[0.13511,0.25665,0.37914,0.50136,0.62344,0.74602,0.86678]},
    {ar:7.11712,y:0.48521,x:[0.14462,0.26300,0.38095,0.49901,0.61689,0.73459,0.85152]},
    {ar:5.74510,y:0.51263,x:[0.18896,0.29348,0.39834,0.50359,0.60920,0.71474,0.82020]},
    {ar:5.22727,y:0.50192,x:[0.15287,0.26851,0.38369,0.49844,0.61371,0.72896,0.84382]},
    {ar:6.19697,y:0.48967,x:[0.17116,0.28179,0.39395,0.50395,0.61528,0.72654,0.83579]},
    {ar:5.90173,y:0.50152,x:[0.13514,0.25683,0.37920,0.50137,0.62337,0.74609,0.86703]},
    {ar:7.00000,y:0.48585,x:[0.14461,0.26293,0.38079,0.49858,0.61637,0.73382,0.85070]},
    {ar:5.77922,y:0.51465,x:[0.19765,0.30073,0.40467,0.50832,0.61248,0.71679,0.82092]},
    {ar:5.06918,y:0.49047,x:[0.15461,0.26989,0.38491,0.49955,0.61447,0.72963,0.84482]},
    {ar:6.66142,y:0.49485,x:[0.17736,0.28540,0.39472,0.50475,0.61328,0.72373,0.83211]},
    {ar:6.07738,y:0.51145,x:[0.13509,0.25671,0.37916,0.50143,0.62345,0.74601,0.86683]},
    {ar:7.05357,y:0.48797,x:[0.14452,0.26278,0.38083,0.49885,0.61699,0.73439,0.85146]},
    {ar:5.91608,y:0.49778,x:[0.17794,0.28640,0.39576,0.50482,0.61463,0.72458,0.83394]},
    {ar:4.85802,y:0.49458,x:[0.14615,0.26450,0.38234,0.49967,0.61759,0.73555,0.85295]},
    {ar:5.83333,y:0.48325,x:[0.15722,0.27508,0.38983,0.50285,0.61596,0.72974,0.84270]},
    {ar:6.76159,y:0.49795,x:[0.13507,0.25664,0.37917,0.50139,0.62354,0.74600,0.86703]},
    {ar:7.05357,y:0.48500,x:[0.14450,0.26277,0.38104,0.49894,0.61692,0.73453,0.85149]},
    {ar:5.82313,y:0.51238,x:[0.18156,0.28895,0.39668,0.50474,0.61275,0.72141,0.82943]},
    {ar:4.97531,y:0.49080,x:[0.15152,0.26582,0.37991,0.49380,0.60768,0.72178,0.83608]},
    {ar:6.05426,y:0.47559,x:[0.15110,0.26469,0.37811,0.49595,0.61562,0.73374,0.85307]}
  ];
  const basePlateSkins=[...PLATE_SKINS];
  const basePlateNames=[...PLATE_SKIN_NAMES];
  const basePlateHoleY=[...PLATE_HOLE_Y];
  const tensionSkins=[null,
    'assets/tensions/tension_bar_01.webp',
    'assets/tensions/tension_hook_01.webp',
    'assets/tensions/tension_kink_01.webp',
    'assets/tensions/tension_wave_01.webp',
    'assets/tensions/tension_angle_01.webp'
  ];
  const tensionLabels=[null,'Bar','Hook','Kink','Wave','Angle'];
  const typeOrder=['bar','hook','kink','wave','angle'];
  const typeBySkin={1:'bar',2:'hook',3:'kink',4:'wave',5:'angle'};
  const typedTensionModes=new Set(['classic','sequence','special','g1']);

  TENSION_SKINS.splice(0,TENSION_SKINS.length,...tensionSkins);
  TENSION_SKIN_LABELS.splice(0,TENSION_SKIN_LABELS.length,...tensionLabels);

  function levelUsesTypedPlates(){ return getModeDifficulty(mode)===1; }
  function activePlateSkins(){ return levelUsesTypedPlates()?typedPlateSkins:basePlateSkins; }
  function activePlateNames(){ return levelUsesTypedPlates()?typedPlateNames:basePlateNames; }

  chooseRoundPlateSkin=function(){
    const pool=activePlateSkins();
    roundPlateSkin=rand(0,Math.max(0,pool.length-1));
  };
  currentPlateName=function(){
    const pool=activePlateNames();
    return pool[Math.min(roundPlateSkin||0,pool.length-1)] || pool[0] || '—';
  };
  currentPlateSkin=function(){
    const pool=activePlateSkins();
    return pool[Math.min(roundPlateSkin||0,pool.length-1)] || pool[0] || '';
  };
  // .plate is a fixed 520x97 box and .plateFace paints with `contain`, so a
  // plate narrower than the box is letterboxed; hole positions have to be
  // mapped through that fit before pins can line up with them.
  const BASE_BOX_W=520, SHELL_BOX_W=565, BOX_H=97;
  function currentBoxW(){
    return document.body.classList.contains('lock-shell-active')?SHELL_BOX_W:BASE_BOX_W;
  }
  function fitBox(ar){
    const BOX_W=currentBoxW();
    const BOX_AR=BOX_W/BOX_H;
    const rw = ar>=BOX_AR ? BOX_W : BOX_H*ar;
    const rh = ar>=BOX_AR ? BOX_W/ar : BOX_H;
    return {rw,rh,ox:(BOX_W-rw)/2,oy:(BOX_H-rh)/2};
  }
  function typedGeom(){
    if(!levelUsesTypedPlates()) return null;
    return typedPlateGeom[Math.min(roundPlateSkin||0,typedPlateGeom.length-1)] || null;
  }

  currentPlateHoleY=function(){
    const g=typedGeom();
    if(g){ const f=fitBox(g.ar); return (f.oy + g.y*f.rh)/BOX_H; }
    const i=Math.min(roundPlateSkin||0,Math.max(0,basePlateHoleY.length-1));
    return basePlateHoleY[i] ?? .47;
  };

  const basePinXForState=pinXForState;
  pinXForState=function(pos){
    const g=typedGeom();
    if(!g) return basePinXForState(pos);
    const f=fitBox(g.ar);
    return f.ox + g.x[Math.max(0,Math.min(6,pos-1))]*f.rw;
  };

  function extractTensionTypeFromText(value=''){
    const low=String(value||'').toLowerCase();
    return typeOrder.find(type=>low.includes(type)) || null;
  }
  function currentRequiredTensionType(){
    // A special tensioner is required only where the puzzle visibly contains
    // both the shared tension tool and a typed plate that provides its clue.
    if(!typedTensionModes.has(mode)||!levelUsesTypedPlates())return null;
    const names=[currentLockBodyEntry().name,currentLockerEntry().name,currentPlateName()];
    for(const name of names){
      const type=extractTensionTypeFromText(name);
      if(type) return type;
    }
    return roundTensionPatternType||null;
  }
  function selectedTensionType(){ return typeBySkin[tensionSkin] || null; }
  function tensionCompatible(){
    const required=currentRequiredTensionType();
    return !required || selectedTensionType()===required;
  }
  function tensionTypeLabel(type){
    return type ? type[0].toUpperCase()+type.slice(1) : '—';
  }
  window.getKeynlockTensionRequirement=()=>{
    const type=currentRequiredTensionType();
    return {type,label:type?tensionTypeLabel(type):'Любой'};
  };

  function forceWrongTensionBreak(){
    const required=currentRequiredTensionType();
    if(!required || tensionCompatible()) return false;

    const previousVisiblePicks=Math.max(0,Math.min(pickCapacity,picks));
    picks=Math.max(0,picks-1);
    window.KeynlockResources?.consumePicks?.(1);
    if(previousVisiblePicks>0) triggerInventoryBreakAnimation(previousVisiblePicks);
    brokenPicks++;
    SFX.break();
    updatePickUI();
    $mechanism?.classList.remove('ready');
    nudgeTools();
    SFX.wrongLock();

    if(mode==='skyrim'){
      PuzzleModes.action('skyrim','wrongTool');
    }else{
      shakeUniversalLock?.();
    }

    if(picks<=0){
      showPickDepletedLoss();
      return true;
    }

    toast(`Неверный натяжитель · нужен ${tensionTypeLabel(required)}`);
    return true;
  }

  function guardOpen(fn){
    return function(...args){
      if(solved) return fn.apply(this,args);
      if(forceWrongTensionBreak()) return;
      return fn.apply(this,args);
    };
  }

  // Base modes are registered in GameActions through tryOpenBaseLock, so the
  // physical lock click must guard that canonical opener as well. Guarding
  // only the legacy tryOpenLock entry let Classic bypass the typed tensioner
  // check entirely.
  tryOpenBaseLock=guardOpen(tryOpenBaseLock);
  tryOpenLock=guardOpen(tryOpenLock);
  ['classic','sequence','special'].forEach(modeId=>{
    GameActions.registerOpenGuard(modeId,()=>!forceWrongTensionBreak());
  });
  GameActions.registerOpenGuard('g1',()=>!forceWrongTensionBreak());

  // init.js bound these two handlers by function reference before this patch runs.
  // Capture them so the same guard still applies to their dedicated controls.
  document.addEventListener('click',e=>{
    if(!e.target.closest('#skTorqueButton')) return;
    if(solved || tensionCompatible()) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    forceWrongTensionBreak();
  },true);

  applyTensionSkin();
  renderInventoryTools();
  chooseRoundPlateSkin();
  rebuildPlates();
  render();
  updateMechanismAssetHud();
})();

/* v260 — pointer proximity: the inventory eases out and the lock warms up as the
   cursor approaches, instead of snapping on a binary :hover. Extended (v303) to
   the alchemy rack drawer the same way. Both drawers use the same distance field
   in both directions, so moving away reverses the approach just as smoothly. */
(function(){
  const TRIGGER_DEPTH=180; // total px from the viewport bottom, including the visible peek
  const LIFT=30;      // px of extra peek at full approach
  const LOCK_REACH=300;  // px around the lock hit area where the glow starts

  let px=0, py=0, queued=false, seen=false;

  const clamp01=v=>v<0?0:v>1?1:v;
  // Distance from the pointer to a rect, zero once inside it.
  function gapTo(r){
    const dx=Math.max(r.left-px, 0, px-r.right);
    const dy=Math.max(r.top-py, 0, py-r.bottom);
    return Math.hypot(dx,dy);
  }
  // Ease so the last stretch of the approach moves more than the first.
  const ease=t=>t*t*(3-2*t);

  // One of these per drawer, written as a CSS custom property that the drawer's
  // own transitioned transform reads.
  // maxLift is either a flat px number or, for a drawer that wants a bigger
  // rise, a function of the drawer's own rect (the rack's is 15% of its own
  // height taller than the flat LIFT everyone else gets, on request — more
  // of the shelf clears the peek line at full approach, not just a few
  // extra px of cork).
  function makeApproach(selector, cssVar, maxLift=LIFT,onLift=null){
    return function apply(){
      const drawer=document.querySelector(selector);
      if(!drawer) return;
      if(drawer.classList.contains('open')){
        drawer.style.setProperty(cssVar,'0px');
        if(onLift) onLift(0);
        return;
      }
      const r=drawer.getBoundingClientRect();
      // Measure to the resting edge, not the lifted one, so the drawer cannot
      // chase its own movement. Spread the rect field by field — DOMRect keeps
      // its values on the prototype, so {...rect} comes out empty.
      const lift=parseFloat(drawer.style.getPropertyValue(cssVar))||0;
      const restingRect={left:r.left,right:r.right,top:r.top+lift,bottom:r.bottom+lift};
      // The old radius started above the already-visible peek, so a requested
      // 180px zone was really 180px + 56/72px. Subtract that peek here: the
      // first movement now begins exactly 180px from the viewport bottom for
      // both the lockpick case and the alchemy rack.
      const peekName=cssVar==='--rack-approach' ? '--rack-peek' : '--inv-peek';
      const peek=parseFloat(getComputedStyle(drawer).getPropertyValue(peekName))||0;
      const reach=Math.max(1,TRIGGER_DEPTH-peek);
      const t=seen ? ease(clamp01(1 - gapTo(restingRect)/reach)) : 0;
      const peak=typeof maxLift==='function' ? maxLift(r) : maxLift;
      const amount=t*peak;
      drawer.style.setProperty(cssVar,`${amount.toFixed(2)}px`);
      if(onLift) onLift(amount);
    };
  }
  const applyInventoryApproach=makeApproach('#inventoryDrawer','--inv-approach',LIFT,amount=>{
    document.querySelector('#challengeHud')?.style.setProperty('--challenge-inventory-lift',`${amount.toFixed(2)}px`);
  });
  const applyRackApproach=makeApproach('#alchemyRackDrawer','--rack-approach', r=>LIFT+r.height*0.15);

  function apply(){
    queued=false;
    applyInventoryApproach();
    applyRackApproach();

    const lock=document.querySelector('#lock.universalLockBlock');
    if(lock){
      const hit=lock.querySelector('.lockHitArea');
      const r=(hit||lock).getBoundingClientRect();
      const t=seen ? ease(clamp01(1 - gapTo(r)/LOCK_REACH)) : 0;
      lock.style.setProperty('--lock-glow',t.toFixed(3));
      document.querySelector('#lockShellFrame')?.style.setProperty('--lock-glow',t.toFixed(3));
    }
  }
  function schedule(){ if(!queued){ queued=true; requestAnimationFrame(apply); } }

  document.addEventListener('pointermove',e=>{
    if(e.pointerType==='touch') return;
    px=e.clientX; py=e.clientY; seen=true; schedule();
  },{passive:true});
  document.addEventListener('pointerleave',()=>{ seen=false; schedule(); },{passive:true});
  window.addEventListener('blur',()=>{ seen=false; schedule(); });
  window.addEventListener('scroll',schedule,{passive:true});
  window.addEventListener('resize',schedule,{passive:true});
})();
