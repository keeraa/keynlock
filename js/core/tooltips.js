(()=>{
  'use strict';
  const tooltip=document.createElement('div');
  tooltip.id='keynlockTooltip';
  tooltip.className='keynlockTooltip';
  tooltip.setAttribute('role','tooltip');
  tooltip.setAttribute('aria-hidden','true');
  document.body.appendChild(tooltip);

  let target=null,showTimer=0,pointerX=0,pointerY=0,keyboard=false;
  function normalizeElement(element){
    if(!(element instanceof Element))return;
    const title=element.getAttribute('title');
    const dataTip=element.getAttribute('data-tip');
    const text=(title||dataTip||'').trim();
    if(title&&text)element.dataset.keynlockTooltip=text;
    else if(text&&!element.dataset.keynlockTooltip)element.dataset.keynlockTooltip=text;
    if(title!==null)element.removeAttribute('title');
  }
  function normalizeTree(node){
    if(!(node instanceof Element)&&node!==document)return;
    if(node instanceof Element)normalizeElement(node);
    node.querySelectorAll?.('[title],[data-tip]').forEach(normalizeElement);
  }
  function place(){
    if(!target||!tooltip.classList.contains('visible'))return;
    let x=pointerX+14,y=pointerY+18;
    if(keyboard){const rect=target.getBoundingClientRect();x=rect.left+rect.width/2;y=rect.bottom+9;}
    const rect=tooltip.getBoundingClientRect();
    x=Math.max(8,Math.min(innerWidth-rect.width-8,x));
    if(y+rect.height>innerHeight-8)y=Math.max(8,(keyboard?target.getBoundingClientRect().top:pointerY)-rect.height-12);
    tooltip.style.left=`${Math.round(x)}px`;
    tooltip.style.top=`${Math.round(y)}px`;
  }
  function show(next,fromKeyboard=false){
    if(!next?.dataset.keynlockTooltip)return;
    clearTimeout(showTimer);target=next;keyboard=fromKeyboard;
    showTimer=setTimeout(()=>{
      if(!target)return;
      tooltip.textContent=target.dataset.keynlockTooltip;
      tooltip.classList.add('visible');
      tooltip.setAttribute('aria-hidden','false');
      target.setAttribute('aria-describedby',tooltip.id);
      requestAnimationFrame(place);
    },fromKeyboard?80:180);
  }
  function hide(){
    clearTimeout(showTimer);showTimer=0;
    target?.removeAttribute('aria-describedby');target=null;
    tooltip.classList.remove('visible');tooltip.setAttribute('aria-hidden','true');
  }

  normalizeTree(document);
  new MutationObserver(records=>records.forEach(record=>{
    if(record.type==='attributes')normalizeElement(record.target);
    else record.addedNodes.forEach(normalizeTree);
  })).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['title','data-tip']});

  document.addEventListener('pointerover',event=>{const next=event.target.closest?.('[data-keynlock-tooltip]');if(next&&next!==target){pointerX=event.clientX;pointerY=event.clientY;show(next);}});
  document.addEventListener('pointermove',event=>{pointerX=event.clientX;pointerY=event.clientY;if(target&&!keyboard)place();},{passive:true});
  document.addEventListener('pointerout',event=>{if(target&&event.target.closest?.('[data-keynlock-tooltip]')===target&&!target.contains(event.relatedTarget))hide();});
  document.addEventListener('focusin',event=>{const next=event.target.closest?.('[data-keynlock-tooltip]');if(next)show(next,true);});
  document.addEventListener('focusout',event=>{if(target&&event.target===target)hide();});
  document.addEventListener('pointerdown',hide,{capture:true});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')hide();},{capture:true});
  addEventListener('scroll',hide,{capture:true,passive:true});
  addEventListener('resize',hide,{passive:true});
})();
