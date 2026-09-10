  window.KeynlockEquipmentDrawers=window.KeynlockEquipmentDrawers||(()=>{
    const controllers=new Map();
    function create(options){
      const root=document.querySelector(options.root),toggle=document.querySelector(options.toggle);
      if(!root||!toggle)return null;
      if(controllers.has(root))return controllers.get(root);
      const approachVar=options.approachVar||'--equipment-approach';
      root.classList.add('uiInventory');toggle.classList.add('uiInventoryToggle');
      const decorate=()=>root.querySelectorAll(options.itemSelector||'.equipmentInventoryItem').forEach(item=>item.classList.add('uiInventoryItem'));decorate();
      new MutationObserver(decorate).observe(root,{childList:true,subtree:true});
      let gesture=null,suppressClick=false,hovered=null;
      function setOpen(force){
        const wasOpen=root.classList.contains('open'),next=typeof force==='boolean'?force:!wasOpen;
        root.classList.toggle('open',next);
        if(!next)setHovered(null);
        if(options.bodyClass)document.body.classList.toggle(options.bodyClass,next);
        toggle.setAttribute('aria-expanded',String(next));toggle.setAttribute('aria-label',next?options.closeLabel:options.openLabel);
        root.style.setProperty(approachVar,'0px');
        if(next!==wasOpen){if(next)SFX.inventoryOpen?.();else SFX.inventoryClose?.();}
      }
      function itemAt(x,y){
        if(options.hitTest)return options.hitTest(x,y);
        let nearest=null;
        root.querySelectorAll(options.itemSelector||'.equipmentInventoryItem:not(:disabled)').forEach(item=>{
          const image=item.querySelector('img'),rect=(image||item).getBoundingClientRect();
          if(x<rect.left-14||x>rect.right+14||y<rect.top-14||y>rect.bottom+14)return;
          const distance=(x-(rect.left+rect.right)/2)**2+(y-(rect.top+rect.bottom)/2)**2;
          if(!nearest||distance<nearest.distance)nearest={item,distance};
        });
        return nearest?.item||null;
      }
      function setHovered(item){if(hovered===item)return;hovered?.classList.remove('visual-hover');hovered=item||null;hovered?.classList.add('visual-hover');}
      toggle.addEventListener('click',event=>{event.stopPropagation();if(suppressClick){suppressClick=false;event.preventDefault();return;}setOpen();});
      document.addEventListener('pointerdown',event=>{
        if(!root.classList.contains('open'))return;
        if(root.contains(event.target)||itemAt(event.clientX,event.clientY))return;
        setOpen(false);
      },true);
      // Route the final click once. Selecting a tool must not also toggle the
      // case when its artwork sits above the closed drawer's grab strip.
      if(options.routeVisualItems)root.addEventListener('click',event=>{
        if(event.target.closest?.(options.itemSelector||'.equipmentInventoryItem'))return;
        const item=itemAt(event.clientX,event.clientY);if(!item)return;
        event.preventDefault();event.stopImmediatePropagation();item.click();
      },true);
      let pointerFrame=0,lastPointer=null;
      function updatePointer(event){
        if(!root.getClientRects().length||getComputedStyle(root).visibility==='hidden'||getComputedStyle(root).pointerEvents==='none'){setHovered(null);root.style.setProperty(approachVar,'0px');return;}
        setHovered(event.pointerType==='touch'?null:itemAt(event.clientX,event.clientY));
        if(event.pointerType==='touch'||root.classList.contains('open'))return;
        if(options.ignoreApproach?.(event)){root.style.setProperty(approachVar,'0px');return;}
        const rect=root.getBoundingClientRect(),horizontal=event.clientX>=rect.left-80&&event.clientX<=rect.right+80;
        const distance=innerHeight-event.clientY,depth=180,lift=50.4,amount=horizontal?lift*Math.max(0,Math.min(1,(depth-distance)/depth)):0;
        root.style.setProperty(approachVar,`${amount.toFixed(1)}px`);
        if(root.id==='inventoryDrawer')document.querySelector('#challengeHud')?.style.setProperty('--challenge-inventory-lift',`${amount.toFixed(1)}px`);
      }
      document.addEventListener('pointermove',event=>{
        lastPointer=event;
        if(!pointerFrame)pointerFrame=requestAnimationFrame(()=>{pointerFrame=0;updatePointer(lastPointer);lastPointer=null;});
      },{passive:true,capture:true});
      const resetPointer=()=>{cancelAnimationFrame(pointerFrame);pointerFrame=0;lastPointer=null;setHovered(null);root.style.setProperty(approachVar,'0px');};
      document.addEventListener('pointerleave',resetPointer,{passive:true});window.addEventListener('blur',resetPointer);
      root.addEventListener('focusin',event=>{if(event.target.matches('.uiInventoryItem'))setHovered(event.target);});
      root.addEventListener('focusout',()=>setHovered(null));
      toggle.addEventListener('pointerdown',event=>{if(event.pointerType==='touch')gesture={id:event.pointerId,y:event.clientY};},{passive:true});
      toggle.addEventListener('pointerup',event=>{if(!gesture||gesture.id!==event.pointerId)return;const dy=event.clientY-gesture.y;gesture=null;if(Math.abs(dy)>24){suppressClick=true;setOpen(dy<0);}},{passive:true});
      const controller=Object.freeze({root,toggle,setOpen,itemAt});controllers.set(root,controller);return controller;
    }
    return Object.freeze({create});
  })();

  let inventoryDrawerController=null;
  function inventoryEls(){
    return {
      root:document.querySelector('#inventoryDrawer'),
      toggle:document.querySelector('#inventoryToggle'),
      pickRail:document.querySelector('#inventoryPickRail'),
      tensionRail:document.querySelector('#inventoryTensionRail'),
      avatar:document.querySelector('#inventoryAvatar')
    };
  }

  function triggerInventoryBreakAnimation(slot){
    triggerPickBreakVisual();
    inventoryBrokenSlot = Math.max(0, Math.min(6, Number(slot)||0));
    if(inventoryBreakTimer) clearTimeout(inventoryBreakTimer);
    inventoryBreakTimer = setTimeout(()=>{
      inventoryBrokenSlot = 0;
      renderInventoryTools();
    }, 720);
  }

  function triggerPickBreakVisual(){
    const body=document.body;
    body.classList.remove('pick-breaking','pick-reforming');
    void body.offsetWidth;
    body.classList.add('pick-breaking');

    const sources=[...document.querySelectorAll(
      '.mechanismZone .pick,.sharedModeLockArt .pick,.skPickArm,.inventoryTool-pick.selected img'
    )].filter(el=>{
      const style=getComputedStyle(el);
      const r=el.getBoundingClientRect();
      return style.display!=='none' && style.visibility!=='hidden' && r.right>=0 && r.left<=innerWidth && r.bottom>=0 && r.top<=innerHeight;
    });

    sources.forEach((source,sourceIndex)=>{
      const r=source.getBoundingClientRect();
      const burst=document.createElement('div');
      burst.className='pickBreakBurst';
      burst.style.left=`${r.left+r.width/2}px`;
      burst.style.top=`${r.top+r.height/2}px`;
      for(let i=0;i<9;i++){
        const fragment=document.createElement('i');
        const angle=(Math.PI*2*i/9)+(sourceIndex*.31);
        const distance=28+(i%3)*16;
        fragment.style.setProperty('--break-x',`${Math.cos(angle)*distance}px`);
        fragment.style.setProperty('--break-y',`${Math.sin(angle)*distance+28}px`);
        fragment.style.setProperty('--break-r',`${(i-4)*37}deg`);
        fragment.style.setProperty('--break-delay',`${i*12}ms`);
        burst.appendChild(fragment);
      }
      document.body.appendChild(burst);
      setTimeout(()=>burst.remove(),760);
    });

    setTimeout(()=>{
      body.classList.remove('pick-breaking');
      body.classList.add('pick-reforming');
    },390);
    setTimeout(()=>body.classList.remove('pick-reforming'),760);
  }

  function setInventoryOpen(force){
    if(!inventoryDrawerController)return;
    inventoryDrawerController.setOpen(force);
  }

  function renderInventoryAvatar(){
    const {avatar}=inventoryEls();
    if(!avatar) return;
    const ch=LAIR_CHARACTERS[lairCharacter] || LAIR_CHARACTERS.kai;
    avatar.innerHTML=ch?.portrait
      ? `<img src="${ch.portrait}" alt="${ch.name}">`
      : `<span>${(ch?.name||'К')[0]}</span>`;
  }

  const inventoryToolNodes=new Map();
  function inventoryTool(kind,index,src,label,options={}){
    const key=`${kind}:${index}`;
    let btn=inventoryToolNodes.get(key);
    if(!btn){
      btn=document.createElement('button');
      btn.type='button';
      btn.className=`inventoryTool inventoryTool-${kind}`;
      btn.addEventListener('click',e=>{
        e.stopPropagation();
        if(btn.disabled)return;
        if(btn.inventoryOptions.onClick)btn.inventoryOptions.onClick();
        else if(kind==='pick')selectPickSkin(index);
        else selectTensionSkin(index);
        if(kind==='pick')SFX.pickDraw?.();else SFX.tensionDraw?.();
      });
      inventoryToolNodes.set(key,btn);
    }
    btn.inventoryOptions=options;
    const active=options.active!==undefined?options.active:(kind==='pick'?pickSkin===index:tensionSkin===index);
    btn.classList.toggle('selected',active);
    btn.classList.toggle('hidden-slot',Boolean(options.hidden));
    btn.classList.toggle('breaking-out',Boolean(options.breaking));
    btn.disabled=Boolean(options.hidden||options.breaking);
    btn.title=label;btn.setAttribute('aria-label',label);
    let img=btn.querySelector('img');
    if(src){
      if(!img){img=document.createElement('img');img.alt='';btn.appendChild(img);}
      if(img.getAttribute('src')!==src)img.src=src;
    }else img?.remove();
    return btn;
  }

  function renderInventoryTools(){
    const {pickRail,tensionRail}=inventoryEls();
    if(!pickRail || !tensionRail) return;

    const visiblePicks=Math.max(0, Math.min(pickCapacity, picks));
    const caseSlots=pickProgress.capacity;
    [...pickRail.children].filter(node=>Number(node.dataset.slot)>caseSlots).forEach(node=>node.remove());
    pickRail.dataset.slots=String(caseSlots);
    // Match the six pockets in the artwork at every upgrade level.
    // Empty pockets keep their space when tools are used or broken.
    pickRail.style.gridTemplateColumns = '72fr 64fr 63fr 59fr 61fr 53fr';
    pickRail.style.opacity = pickCapacity > 0 ? '1' : '.45';

    // The rail shows the player's own Коллекция picks when that screen
    // (js/world/collection.js) has set itself up — its own currently
    // equipped collection's handles, first-come first-slot — falling
    // Slots stay visually empty until their composite is ready; showing the
    // retired fixed PICK_SKINS here caused the old wooden models to flash.
    const rail = window.KeynlockCollection?.getInventoryRail(caseSlots) || [];
    const equippedHandleId = window.KeynlockCollection?.getEquippedHandleId();

    for(let i=1;i<=caseSlots;i++){
      const pickIndex=i;
      const isAvailable=i<=visiblePicks;
      const isBreaking=(i===inventoryBrokenSlot && i===visiblePicks+1 && i<=pickCapacity+1);
      const isRenderable=isAvailable || isBreaking;
      const railEntry=rail[i-1];
      const src=railEntry?.image || '';
      const btn=inventoryTool('pick',pickIndex,src,`Отмычка ${pickIndex} · слот ${i}${isAvailable ? ` · осталось ${visiblePicks}` : ''}`,{
        hidden: !isRenderable || !src,
        breaking: isBreaking,
        active: railEntry ? railEntry.id===equippedHandleId : undefined,
        onClick: railEntry ? (()=>window.KeynlockCollection.equipHandleById(railEntry.id)) : undefined
      });
      btn.dataset.pickIndex=String(pickIndex);
      btn.dataset.slot=String(i);
      if(btn.parentElement!==pickRail)pickRail.appendChild(btn);
    }

    tensionRail.style.gridTemplateColumns = 'repeat(5,1fr)';
    for(let i=1;i<=5;i++){
      const btn=inventoryTool('tension',i,TENSION_SKINS[i],`Натяжитель · ${TENSION_SKIN_LABELS[i]||`Вариант ${i}`}`);
      if(btn.parentElement!==tensionRail)tensionRail.appendChild(btn);
    }
  }

  function initInventoryDrawer(){
    const {toggle,root}=inventoryEls();
    renderInventoryTools();
    renderInventoryAvatar();
    window.setInventoryOpen = setInventoryOpen;
    inventoryDrawerController=window.KeynlockEquipmentDrawers.create({root:'#inventoryDrawer',toggle:'#inventoryToggle',bodyClass:'inventory-open',openLabel:'Открыть инвентарь',closeLabel:'Закрыть инвентарь',approachVar:'--inv-approach',itemSelector:'.inventoryTool:not(.hidden-slot):not(.breaking-out):not(:disabled)',hitTest:(x,y)=>window.inventoryToolAtPoint?.(x,y)});
  }
