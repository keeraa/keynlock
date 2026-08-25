/* Inventory visual hit testing */
(function(){
  const PAD=14;
  function root(){ return document.querySelector('#inventoryDrawer'); }
  function candidates(x,y){
    const r=root();
    if(!r) return [];
    return [...r.querySelectorAll('.inventoryTool:not(.hidden-slot):not(.breaking-out):not(:disabled)')]
      .map(btn=>{
        const img=btn.querySelector('img');
        if(!img) return null;
        const b=img.getBoundingClientRect();
        const inside=x>=b.left-PAD && x<=b.right+PAD && y>=b.top-PAD && y<=b.bottom+PAD;
        if(!inside) return null;
        const cx=(b.left+b.right)/2, cy=(b.top+b.bottom)/2;
        const dx=x-cx, dy=y-cy;
        return {btn,dist:dx*dx+dy*dy};
      })
      .filter(Boolean)
      .sort((a,b)=>a.dist-b.dist);
  }
  function clearVisualHover(){
    root()?.querySelectorAll('.inventoryTool.visual-hover').forEach(el=>el.classList.remove('visual-hover'));
  }
  document.addEventListener('pointermove',e=>{
    const r=root();
    if(!r){ return; }
    clearVisualHover();
    const hit=candidates(e.clientX,e.clientY)[0];
    if(hit) hit.btn.classList.add('visual-hover');
  },{passive:true});
  document.addEventListener('pointerleave',clearVisualHover,{passive:true});

  // Keep enlarged tool images clickable outside their narrow grid cells.
  document.addEventListener('pointerdown',e=>{
    const r=root();
    if(!r || !r.contains(e.target)) return;
    if(e.target.closest('.inventoryToggle')) return;
    if(e.target.closest('.inventoryTool')) return;
    const hit=candidates(e.clientX,e.clientY)[0];
    if(hit){
      e.preventDefault();
      e.stopPropagation();
      hit.btn.click();
    }
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
    if(mode==='heatcold'){
      const col=target?.closest?.('[data-hc-col]');
      if(col) setHeatColdActive(Number(col.dataset.hcCol));
      if(dir==='left') setHeatColdActive(hcActiveIndex-1);
      else if(dir==='right') setHeatColdActive(hcActiveIndex+1);
      else if(dir==='up') adjustHeatColdDigit(hcActiveIndex,1);
      else adjustHeatColdDigit(hcActiveIndex,-1);
      return true;
    }

    const drumWheel=target?.closest?.('.digitalWheel[id^="drumWheel"]');
    if(mode==='drum' && drumWheel){
      const index=Number(drumWheel.id.replace('drumWheel',''));
      changeDrum(index,dir==='up'||dir==='right'?1:-1);
      return true;
    }

    const scopeWheel=target?.closest?.('.digitalWheel');
    if(mode==='scope' && scopeWheel){
      const control=scopeWheel.querySelector('[data-scope-i]');
      if(control){
        changeScope(Number(control.dataset.scopeI),dir==='up'||dir==='right'?1:-1);
        return true;
      }
    }
    return false;
  }

  function applySwipe(dir,target){
    if(solved || shopOpen || mapOpen || lairOpen) return;
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
      if(e.target.closest('.touch,.topRightHud,.modeTabs,.mobileModeMenuButton,.inventoryDrawer,.worldMapScreen,.lairOverlay,.shopOverlay,.skBoard,.tnGauge')) return;
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
    const lockArt=e.target?.closest?.('.mechanismZone,.sharedModeLockArt') || e.target;
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
