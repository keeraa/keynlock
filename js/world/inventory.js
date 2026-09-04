  window.KeynlockEquipmentDrawers=window.KeynlockEquipmentDrawers||(()=>{
    const controllers=new Map();
    function create(options){
      const root=document.querySelector(options.root),toggle=document.querySelector(options.toggle);
      if(!root||!toggle)return null;
      if(controllers.has(root))return controllers.get(root);
      const approachVar=options.approachVar||'--equipment-approach';
      let gesture=null,suppressClick=false,hovered=null;
      function setOpen(force){
        const wasOpen=root.classList.contains('open'),next=typeof force==='boolean'?force:!wasOpen;
        root.classList.toggle('open',next);
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
      if(options.routeVisualItems)document.addEventListener('pointerdown',event=>{
        if(!root.contains(event.target)||event.target.closest?.(options.itemSelector||'.equipmentInventoryItem'))return;
        const item=itemAt(event.clientX,event.clientY);if(!item)return;
        event.preventDefault();event.stopPropagation();suppressClick=true;item.click();if(!root.classList.contains('open'))setOpen(true);setTimeout(()=>{suppressClick=false;},0);
      },true);
      document.addEventListener('pointermove',event=>{
        setHovered(root.classList.contains('open')?itemAt(event.clientX,event.clientY):null);
        if(options.approachLift===false||event.pointerType==='touch'||root.classList.contains('open'))return;
        if(options.ignoreApproach?.(event)){root.style.setProperty(approachVar,'0px');return;}
        const rect=root.getBoundingClientRect(),horizontal=event.clientX>=rect.left-80&&event.clientX<=rect.right+80;
        const distance=innerHeight-event.clientY,depth=options.approachDepth||180,lift=options.approachLift||34,amount=horizontal?lift*Math.max(0,Math.min(1,(depth-distance)/depth)):0;
        root.style.setProperty(approachVar,`${amount.toFixed(1)}px`);
      },{passive:true});
      document.addEventListener('pointerleave',()=>setHovered(null),{passive:true});
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
    inventoryBrokenSlot = Math.max(0, Math.min(7, Number(slot)||0));
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

  function inventoryTool(kind,index,src,label,options={}){
    const btn=document.createElement('button');
    btn.type='button';
    const active=options.active!==undefined ? options.active : (kind==='pick' ? pickSkin===index : tensionSkin===index);
    btn.className=`inventoryTool inventoryTool-${kind}${active?' selected':''}`;
    if(options.hidden) btn.classList.add('hidden-slot');
    if(options.breaking) btn.classList.add('breaking-out');
    if(options.hidden || options.breaking) btn.disabled = true;
    btn.title=label;
    btn.setAttribute('aria-label',label);
    if(src){
      const img=document.createElement('img');
      img.src=src;
      img.alt='';
      btn.appendChild(img);
    }
    if(!(options.hidden || options.breaking)) btn.addEventListener('click',e=>{
      e.stopPropagation();
      if(options.onClick) options.onClick();
      else if(kind==='pick') selectPickSkin(index);
      else selectTensionSkin(index);
      if(kind==='pick') SFX.pickDraw?.();
      else SFX.tensionDraw?.();
    });
    return btn;
  }

  function renderInventoryTools(){
    const {pickRail,tensionRail}=inventoryEls();
    if(!pickRail || !tensionRail) return;
    pickRail.replaceChildren();
    tensionRail.replaceChildren();

    const visiblePicks=Math.max(0, Math.min(pickCapacity, picks));
    const caseSlots=pickProgress.capacity;
    pickRail.dataset.slots=String(caseSlots);
    // The artwork always contains seven fixed pockets. Capacity controls how
    // many of those pockets are usable, not how widely the visible picks are
    // spread across the rail.
    pickRail.style.gridTemplateColumns = 'repeat(7,1fr)';
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
      pickRail.appendChild(btn);
    }

    tensionRail.style.gridTemplateColumns = 'repeat(5,1fr)';
    for(let i=1;i<=5;i++){
      tensionRail.appendChild(inventoryTool('tension',i,TENSION_SKINS[i],`Натяжитель · ${TENSION_SKIN_LABELS[i]||`Вариант ${i}`}`));
    }
  }

  function initInventoryDrawer(){
    const {toggle,root}=inventoryEls();
    renderInventoryTools();
    renderInventoryAvatar();
    window.setInventoryOpen = setInventoryOpen;
    inventoryDrawerController=window.KeynlockEquipmentDrawers.create({root:'#inventoryDrawer',toggle:'#inventoryToggle',bodyClass:'inventory-open',openLabel:'Открыть инвентарь',closeLabel:'Закрыть инвентарь',approachVar:'--inv-approach',approachLift:false,hitTest:(x,y)=>window.inventoryToolAtPoint?.(x,y)});
  }
