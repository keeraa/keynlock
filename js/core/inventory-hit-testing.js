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
